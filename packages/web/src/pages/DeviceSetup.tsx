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
import { useTranslation } from 'react-i18next';

// 등록 유효 기간: 5분 (밀리초)
const REGISTRATION_TIMEOUT_MS = 5 * 60 * 1000;

const DeviceSetup = () => {
  const navigate = useNavigate();
  const { uuid } = useParams<{ uuid: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

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
      const payload: {
        status: 'timeout' | 'failed';
        error: string;
        attempted_at: string;
        timeout_duration_ms?: number;
        error_code?: string;
      } = {
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
        title: t('deviceSetup.inputError'),
        description: t('deviceSetup.printerNameRequired'),
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
          device_uuid: uuid, // MQTT 구독용 UUID
          printer_uuid: uuid, // 프린터 UUID (OctoPrint 플러그인 호환)
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
        const errorCode = error.code;
        const errorMessage = errorCode === '23505'
          ? t('deviceSetup.deviceAlreadyRegistered')
          : t('deviceSetup.databaseError');

        // MQTT로 실패 메시지 전송
        await sendFailureMqttMessage(
          uuid!,
          'failed',
          errorMessage,
          errorCode
        );

        throw new Error(errorMessage);
      }

      // cameras 테이블에 카메라 정보 저장
      try {
        console.log('[DeviceSetup] Attempting to insert camera record for device_uuid:', uuid);

        const cameraData = {
          user_id: user.id,
          device_uuid: uuid,
          resolution: null,
          stream_url: null,
        };

        console.log('[DeviceSetup] Camera data to insert:', cameraData);

        const { data: cameraResult, error: cameraError } = await supabase
          .from('cameras')
          .insert(cameraData)
          .select();

        if (cameraError) {
          console.error('[DeviceSetup] Failed to insert camera record:', {
            error: cameraError,
            code: cameraError.code,
            message: cameraError.message,
            details: cameraError.details,
            hint: cameraError.hint
          });
          // 카메라 등록 실패는 치명적이지 않으므로 계속 진행
        } else {
          console.log('[DeviceSetup] Camera record inserted successfully:', cameraResult);
        }
      } catch (cameraError) {
        console.error('[DeviceSetup] Camera insert exception:', cameraError);
        // 카메라 등록 실패는 치명적이지 않으므로 계속 진행
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
        title: t('deviceSetup.registrationComplete'),
        description: t('deviceSetup.registrationCompleteMessage', { deviceName }),
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
        title: t('deviceSetup.registrationFailed'),
        description: error instanceof Error ? error.message : t('deviceSetup.registrationError'),
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
              <p className="text-muted-foreground">{t('deviceSetup.checkingDevice')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 등록 기간 만료
  if (registrationExpired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-destructive" />
              <CardTitle>{t('deviceSetup.registrationExpiredTitle')}</CardTitle>
            </div>
            <CardDescription>
              {t('deviceSetup.registrationExpiredDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>
                {t('deviceSetup.registrationExpiredMessage')}
              </AlertDescription>
            </Alert>
            <div className="mt-4 text-sm text-muted-foreground">
              <p>{t('deviceSetup.registrationExpiredHelper')}</p>
            </div>
            <div className="mt-6">
              <Link to="/">
                <Button className="w-full">{t('deviceSetup.confirmButton')}</Button>
              </Link>
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
              <CardTitle>{t('deviceSetup.invalidLinkTitle')}</CardTitle>
            </div>
            <CardDescription>
              {t('deviceSetup.invalidLinkDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                {t('deviceSetup.invalidLinkMessage')}
              </AlertDescription>
            </Alert>
            <div className="mt-6">
              <Link to="/">
                <Button className="w-full">{t('deviceSetup.backToHomeButton')}</Button>
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
              <CardTitle>{t('deviceSetup.alreadyRegisteredTitle')}</CardTitle>
            </div>
            <CardDescription>
              {t('deviceSetup.alreadyRegisteredDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                {t('deviceSetup.alreadyRegisteredMessage', { deviceName })}
              </AlertDescription>
            </Alert>
            <div className="mt-6 space-y-2">
              <Link to="/dashboard">
                <Button className="w-full">{t('deviceSetup.goToDashboardButton')}</Button>
              </Link>
              <Link to="/">
                <Button variant="outline" className="w-full">{t('deviceSetup.backToHomeButton')}</Button>
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
            <CardTitle>{t('deviceSetup.title')}</CardTitle>
          </div>
          <CardDescription>
            {t('deviceSetup.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!user && (
            <Alert className="mb-6">
              <AlertDescription>
                {t('deviceSetup.loginRequiredAlert')}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSetup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="uuid">{t('deviceSetup.deviceUuidLabel')}</Label>
              <Input
                id="uuid"
                value={uuid}
                disabled
                className="font-mono text-sm bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                {t('deviceSetup.deviceUuidHelper')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">{t('deviceSetup.printerNameLabel')} *</Label>
              <Input
                id="name"
                placeholder={t('deviceSetup.printerNamePlaceholder')}
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                disabled={submitting}
                required
              />
              <p className="text-xs text-muted-foreground">
                {t('deviceSetup.printerNameHelper')}
              </p>
            </div>

            <div className="pt-4 space-y-2">
              <Button
                type="submit"
                className="w-full"
                disabled={submitting || (user && !deviceName.trim())}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('deviceSetup.registeringButton')}
                  </>
                ) : user ? (
                  t('deviceSetup.registerButton')
                ) : (
                  t('deviceSetup.loginAndRegisterButton')
                )}
              </Button>

              <Link to="/">
                <Button type="button" variant="outline" className="w-full">
                  {t('deviceSetup.cancelButton')}
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
