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

      try {
        // 해당 UUID가 이미 등록되어 있는지 확인
        const { data, error } = await supabase
          .from('edge_devices')
          .select('device_uuid, device_name, registered_by, status')
          .eq('device_uuid', uuid)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          // 이미 등록된 디바이스
          setAlreadyRegistered(true);
          setDeviceName(data.device_name);
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

      const { data, error } = await supabase
        .from('edge_devices')
        .insert({
          device_uuid: uuid,
          device_name: deviceName.trim(),
          device_type: 'printer',
          registered_by: user.id,
          status: 'inactive'
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('이 디바이스는 이미 등록되었습니다.');
        }
        throw error;
      }

      toast({
        title: "설비 등록 완료!",
        description: `${deviceName}이(가) 성공적으로 등록되었습니다.`,
      });

      // 대시보드로 이동
      navigate('/dashboard');
    } catch (error: unknown) {
      console.error('Error setting up device:', error);
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
