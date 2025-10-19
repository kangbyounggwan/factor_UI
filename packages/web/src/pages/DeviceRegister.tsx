import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Monitor, RefreshCw, Info } from 'lucide-react';
import { useAuth } from "@shared/contexts/AuthContext";
import { supabase } from "@shared/integrations/supabase/client"
import { useToast } from '@/hooks/use-toast';

const DeviceRegister = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    device_uuid: '',
    device_name: '',
    device_type: 'printer',
    ip_address: '',
    port: 80,
    api_key: '',
    firmware: 'marlin'
  });

  // UUID 자동 생성
  const generateUUID = () => {
    const uuid = crypto.randomUUID();
    setFormData(prev => ({ ...prev, device_uuid: uuid }));
  };

  // 디바이스 등록
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "인증 오류",
        description: "로그인이 필요합니다.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.device_uuid || !formData.device_name) {
      toast({
        title: "입력 오류",
        description: "디바이스 UUID와 이름은 필수 항목입니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('edge_devices')
        .insert({
          device_uuid: formData.device_uuid,
          device_name: formData.device_name,
          device_type: formData.device_type,
          ip_address: formData.ip_address || null,
          port: formData.port,
          api_key: formData.api_key || null,
          firmware: formData.firmware,
          registered_by: user.id,
          status: 'inactive'
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('이미 등록된 UUID입니다. 다른 UUID를 사용해주세요.');
        }
        throw error;
      }

      toast({
        title: "디바이스 등록 완료",
        description: `${formData.device_name}이(가) 성공적으로 등록되었습니다.`,
      });

      navigate('/admin');
    } catch (error: unknown) {
      console.error('Error registering device:', error);
      toast({
        title: "등록 실패",
        description: error instanceof Error ? error.message : "디바이스 등록 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              관리자 대시보드로 돌아가기
            </Link>
          </Button>
        </div>

        <div className="space-y-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Monitor className="h-8 w-8 text-primary" />
            엣지 디바이스 등록
          </h1>
          <p className="text-muted-foreground">
            새로운 엣지 디바이스를 시스템에 등록합니다.
          </p>
        </div>

        {/* UUID 안내 */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">디바이스 UUID 안내</p>
              <p className="text-sm">
                각 엣지 디바이스는 고유한 UUID로 식별됩니다. 
                자동 생성하거나 디바이스에서 제공하는 UUID를 입력할 수 있습니다.
              </p>
            </div>
          </AlertDescription>
        </Alert>

        {/* 등록 폼 */}
        <Card>
          <CardHeader>
            <CardTitle>디바이스 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* UUID */}
              <div className="space-y-2">
                <Label htmlFor="device_uuid">디바이스 UUID *</Label>
                <div className="flex gap-2">
                  <Input
                    id="device_uuid"
                    value={formData.device_uuid}
                    onChange={(e) => setFormData(prev => ({ ...prev, device_uuid: e.target.value }))}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="font-mono"
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateUUID}
                    className="flex-shrink-0"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    생성
                  </Button>
                </div>
              </div>

              {/* 디바이스 이름 */}
              <div className="space-y-2">
                <Label htmlFor="device_name">디바이스 이름 *</Label>
                <Input
                  id="device_name"
                  value={formData.device_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, device_name: e.target.value }))}
                  placeholder="예: 공장 1층 프린터 #1"
                  required
                />
              </div>

              {/* 디바이스 타입 */}
              <div className="space-y-2">
                <Label htmlFor="device_type">디바이스 타입</Label>
                <Select
                  value={formData.device_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, device_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="printer">3D 프린터</SelectItem>
                    <SelectItem value="cnc">CNC 기계</SelectItem>
                    <SelectItem value="sensor">센서</SelectItem>
                    <SelectItem value="controller">컨트롤러</SelectItem>
                    <SelectItem value="other">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* IP 주소 */}
              <div className="space-y-2">
                <Label htmlFor="ip_address">IP 주소</Label>
                <Input
                  id="ip_address"
                  value={formData.ip_address}
                  onChange={(e) => setFormData(prev => ({ ...prev, ip_address: e.target.value }))}
                  placeholder="192.168.1.100"
                />
              </div>

              {/* 포트 */}
              <div className="space-y-2">
                <Label htmlFor="port">포트</Label>
                <Input
                  id="port"
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) || 80 }))}
                  placeholder="80"
                  min="1"
                  max="65535"
                />
              </div>

              {/* API 키 */}
              <div className="space-y-2">
                <Label htmlFor="api_key">API 키</Label>
                <Input
                  id="api_key"
                  value={formData.api_key}
                  onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                  placeholder="디바이스 API 키 (선택사항)"
                  type="password"
                />
              </div>

              {/* 펌웨어 */}
              <div className="space-y-2">
                <Label htmlFor="firmware">펌웨어</Label>
                <Select
                  value={formData.firmware}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, firmware: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="marlin">Marlin</SelectItem>
                    <SelectItem value="klipper">Klipper</SelectItem>
                    <SelectItem value="repetier">Repetier</SelectItem>
                    <SelectItem value="smoothie">Smoothie</SelectItem>
                    <SelectItem value="grbl">GRBL</SelectItem>
                    <SelectItem value="other">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 버튼 */}
              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/admin')}
                  className="flex-1"
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      등록 중...
                    </>
                  ) : (
                    '디바이스 등록'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DeviceRegister;