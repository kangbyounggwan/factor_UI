import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Printer, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from "@shared/contexts/AuthContext";
import { supabase } from "@shared/integrations/supabase/client"
import { useToast } from '@/hooks/use-toast';
import { createSharedMqttClient } from '@shared/component/mqtt';
import { startDashStatusSubscriptionsForUser } from '@shared/component/mqtt';

// 등록 유효 기간: 5분 (밀리초)
const REGISTRATION_TIMEOUT_MS = 5 * 60 * 1000;

const DeviceSetup = () => {
  const navigate = useNavigate();
  const { uuid } = useParams<{ uuid: string }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deviceExists, setDeviceExists] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [registrationExpired, setRegistrationExpired] = useState(false);

  // MQTT로 실패 메시지 전송하는 헬퍼 함수
  const sendFailureMqttMessage = async (
    uuid: string,
    status: 'timeout' | 'failed',
    error: string,
    errorCode?: string
  ) => {
    try {
      const mqttClient = createSharedMqttClient();
      await mqttClient.connect();

      const topic = `device/${uuid}/registration`;
      const payload: any = {
        status,
        error,
        attempted_at: new Date().toISOString(),
      };

      if (status === 'timeout') {
        payload.timeout_duration_ms = REGISTRATION_TIMEOUT_MS;
      }

      if (errorCode) {
        payload.error_code = errorCode;
      }

      await mqttClient.publish(topic, payload, 1);
      console.log('[DeviceSetup] MQTT failure message sent:', { topic, payload });
    } catch (mqttError) {
      console.error('[DeviceSetup] Failed to send MQTT failure message:', mqttError);
    }
  };

  // UUID 유효성 및 등록 상태 확인
  useEffect(() => {
    const checkDevice = async () => {
      if (!uuid) {
        setLoading(false);
        return;
      }

      // UUID 형식 검증 (UUID v4 형식 또는 최소 길이)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(uuid) && uuid.length < 10) {
        // 유효하지 않은 UUID 형식
        setLoading(false);
        return;
      }

      // 등록 시작 시간 확인 (localStorage에 저장)
      const storageKey = `device_registration_start_${uuid}`;
      const registrationStartTime = localStorage.getItem(storageKey);

      if (registrationStartTime) {
        const startTime = parseInt(registrationStartTime, 10);
        const elapsed = Date.now() - startTime;

        if (elapsed > REGISTRATION_TIMEOUT_MS) {
          // 5분 경과 - 등록 기간 만료
          // MQTT로 타임아웃 메시지 전송
          await sendFailureMqttMessage(
            uuid,
            'timeout',
            'Registration window expired (5 minutes)'
          );

          setRegistrationExpired(true);
          setLoading(false);
          return;
        }
      } else {
        // 최초 접근 시 시작 시간 기록
        localStorage.setItem(storageKey, Date.now().toString());
      }

      try {
        // 해당 UUID가 이미 등록되어 있는지 확인 (printers 테이블 사용)
        const { data, error } = await supabase
          .from('printers')
          .select('id, name, user_id')
          .eq('id', uuid)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          // 이미 등록된 디바이스
          setAlreadyRegistered(true);
          setDeviceName(data.name);
          // 등록 완료되었으므로 타이머 삭제
          localStorage.removeItem(storageKey);
        } else {
          // 등록 가능한 UUID (신규 디바이스)
          setDeviceExists(true);
        }
      } catch (error) {
        console.error('Error checking device:', error);
        // 에러가 발생해도 등록 가능하도록 설정
        setDeviceExists(true);
      } finally {
        setLoading(false);
      }
    };

    checkDevice();
  }, [uuid]);

  // 디바이스 등록 처리
  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      // 로그인되지 않은 경우 로그인 페이지로 리다이렉트 (UUID 정보 유지)
      navigate(`/auth?redirect=/setup/${uuid}`);
      return;
    }

    if (!deviceName.trim()) {
      toast({
        title: "입력 오류",
        description: "프린터 이름을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      // printers 테이블에 설비 정보 저장
      const { data, error } = await supabase
        .from('printers')
        .insert({
          id: uuid,
          name: deviceName.trim(),
          user_id: user.id,
          ip_address: 'pending', // OctoPrint 플러그인에서 업데이트
          model: 'Unknown', // OctoPrint 플러그인에서 업데이트
          firmware: 'Unknown',
          port: 5000,
          status: 'disconnected'
        })
        .select()
        .single();

      if (error) {
        const errorCode = (error as any)?.code;
        const errorMessage = errorCode === '23505'
          ? '이 디바이스는 이미 등록되었습니다.'
          : '데이터베이스 등록 중 오류가 발생했습니다.';

        // MQTT로 실패 메시지 전송
        await sendFailureMqttMessage(
          uuid!,
          'failed',
          errorMessage,
          errorCode
        );

        throw new Error(errorMessage);
      }

      // 등록 성공 - MQTT로 등록 완료 메시지 전송
      try {
        const mqttClient = createSharedMqttClient();
        await mqttClient.connect();

        const topic = `device/${uuid}/registration`;
        const payload = {
          status: 'registered',
          device_name: deviceName.trim(),
          registered_at: new Date().toISOString(),
          user_id: user.id
        };

        await mqttClient.publish(topic, payload, 1); // QoS 1 for guaranteed delivery
        console.log('[DeviceSetup] MQTT registration message sent:', { topic, payload });
      } catch (mqttError) {
        console.error('[DeviceSetup] Failed to send MQTT message:', mqttError);
        // MQTT 실패해도 등록은 성공한 것으로 처리
      }

      // 등록 시작 시간 삭제 (등록 완료됨)
      localStorage.removeItem(`device_registration_start_${uuid}`);

      // 신규 프린터를 위한 MQTT 구독 갱신 (캐시 강제 리프레시)
      try {
        console.log('[DeviceSetup] 신규 프린터 MQTT 구독 시작:', uuid);
        await startDashStatusSubscriptionsForUser(user.id, { forceRefresh: true });
        console.log('[DeviceSetup] MQTT 구독 갱신 완료');
      } catch (mqttRefreshError) {
        console.error('[DeviceSetup] MQTT 구독 갱신 실패:', mqttRefreshError);
        // 구독 실패해도 등록은 성공한 것으로 처리
      }

      toast({
        title: "설비 등록 완료!",
        description: `${deviceName}이(가) 성공적으로 등록되었습니다.`,
      });

      // 대시보드로 이동
      navigate('/dashboard');
    } catch (error: unknown) {
      console.error('Error setting up device:', error);

      // 일반 에러인 경우에도 MQTT 실패 메시지 전송
      if (uuid && error instanceof Error) {
        await sendFailureMqttMessage(
          uuid,
          'failed',
          error.message
        );
      }

      toast({
        title: "등록 실패",
        description: error instanceof Error ? error.message : "디바이스 등록 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">디바이스 정보 확인 중...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 등록 기간 만료
  if (registrationExpired) {
    const handleRetry = () => {
      // 타이머 리셋하여 재등록 허용
      localStorage.setItem(`device_registration_start_${uuid}`, Date.now().toString());
      setRegistrationExpired(false);
      setDeviceExists(true);
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-destructive" />
              <CardTitle>등록 기간 만료</CardTitle>
            </div>
            <CardDescription>
              설정 링크의 유효 기간이 만료되었습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>
                디바이스 등록은 링크 생성 후 5분 이내에 완료해야 합니다.
                유효 기간이 경과하여 등록을 진행할 수 없습니다.
              </AlertDescription>
            </Alert>
            <div className="mt-6 space-y-2">
              <Button onClick={handleRetry} className="w-full">
                재등록 시도하기
              </Button>
              <Link to="/">
                <Button variant="outline" className="w-full">홈으로 돌아가기</Button>
              </Link>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              <p>새로운 설정 링크가 필요한 경우, 플러그인에서 다시 생성해주세요.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 잘못된 UUID
  if (!uuid || !deviceExists && !alreadyRegistered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-destructive" />
              <CardTitle>잘못된 설정 링크</CardTitle>
            </div>
            <CardDescription>
              유효하지 않은 디바이스 UUID입니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                플러그인에서 생성된 올바른 설정 링크를 사용해주세요.
              </AlertDescription>
            </Alert>
            <div className="mt-6">
              <Link to="/">
                <Button className="w-full">홈으로 돌아가기</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 이미 등록된 디바이스
  if (alreadyRegistered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <CardTitle>이미 등록된 설비</CardTitle>
            </div>
            <CardDescription>
              이 설비는 이미 등록되었습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                <strong>{deviceName}</strong> 설비는 이미 FACTOR에 등록되어 있습니다.
                대시보드에서 확인하실 수 있습니다.
              </AlertDescription>
            </Alert>
            <div className="mt-6 space-y-2">
              <Link to="/dashboard">
                <Button className="w-full">대시보드로 이동</Button>
              </Link>
              <Link to="/">
                <Button variant="outline" className="w-full">홈으로 돌아가기</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 설정 폼
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Printer className="w-6 h-6 text-primary" />
            <CardTitle>3D 프린터 설정</CardTitle>
          </div>
          <CardDescription>
            플러그인이 설치된 프린터를 FACTOR에 연결하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!user && (
            <Alert className="mb-6">
              <AlertDescription>
                설비를 등록하려면 먼저 로그인이 필요합니다.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSetup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="uuid">디바이스 UUID</Label>
              <Input
                id="uuid"
                value={uuid}
                disabled
                className="font-mono text-sm bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                플러그인에서 자동으로 생성된 고유 식별자입니다
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">프린터 이름 *</Label>
              <Input
                id="name"
                placeholder="예: 메인 프린터"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                disabled={submitting}
                required
              />
              <p className="text-xs text-muted-foreground">
                대시보드에서 표시될 이름입니다
              </p>
            </div>

            <div className="pt-4 space-y-2">
              <Button
                type="submit"
                className="w-full"
                disabled={submitting || !deviceName.trim()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    등록 중...
                  </>
                ) : user ? (
                  '설비 등록하기'
                ) : (
                  '로그인하고 등록하기'
                )}
              </Button>

              <Link to="/">
                <Button type="button" variant="outline" className="w-full">
                  취소
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeviceSetup;
