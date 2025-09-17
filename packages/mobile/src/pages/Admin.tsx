import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Users, 
  Monitor, 
  Plus, 
  Settings, 
  Trash2, 
  Edit,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@shared/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EdgeDevice {
  id: string;
  device_uuid: string;
  device_name: string;
  device_type: string;
  status: string;
  ip_address?: string;
  port: number;
  last_seen?: string;
  registered_at: string;
}

interface UserWithRole {
  id: string;
  email: string;
  display_name?: string;
  role: 'admin' | 'user';
  created_at: string;
}

const Admin = () => {
  const { toast } = useToast();
  const [devices, setDevices] = useState<EdgeDevice[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDevices: 0,
    activeDevices: 0,
    totalUsers: 0,
    adminUsers: 0
  });

  // 데이터 로드
  const loadData = async () => {
    try {
      setLoading(true);

      // 엣지 디바이스 로드
      const { data: devicesData, error: devicesError } = await supabase
        .from('edge_devices')
        .select('*')
        .order('registered_at', { ascending: false });

      if (devicesError) throw devicesError;

      // 사용자와 역할 로드
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // 프로필 정보 별도 로드
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name');

      if (profilesError) throw profilesError;

      setDevices(devicesData || []);
      
      // 통계 계산
      const activeDeviceCount = (devicesData || []).filter(d => d.status === 'active').length;
      const adminCount = (rolesData || []).filter(r => r.role === 'admin').length;

      setStats({
        totalDevices: devicesData?.length || 0,
        activeDevices: activeDeviceCount,
        totalUsers: rolesData?.length || 0,
        adminUsers: adminCount
      });

    } catch (error) {
      console.error('Error loading admin data:', error);
      toast({
        title: "데이터 로드 실패",
        description: "관리자 데이터를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 디바이스 삭제
  const deleteDevice = async (deviceId: string) => {
    try {
      const { error } = await supabase
        .from('edge_devices')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;

      toast({
        title: "디바이스 삭제 완료",
        description: "디바이스가 성공적으로 삭제되었습니다.",
      });

      loadData();
    } catch (error) {
      console.error('Error deleting device:', error);
      toast({
        title: "삭제 실패",
        description: "디바이스 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success text-success-foreground';
      case 'inactive': return 'bg-muted text-muted-foreground';
      case 'error': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return '활성';
      case 'inactive': return '비활성';
      case 'error': return '오류';
      default: return '알 수 없음';
    }
  };

  if (loading) {
    return (
      <div className="bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">관리자 데이터를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              관리자 대시보드
            </h1>
            <p className="text-muted-foreground">
              시스템 전체를 관리하고 모니터링할 수 있습니다.
            </p>
          </div>
          <Button asChild>
            <Link to="/admin/device/register">
              <Plus className="h-4 w-4 mr-2" />
              새 디바이스 등록
            </Link>
          </Button>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-6">
              <div className="text-2xl font-bold text-primary">{stats.totalDevices}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Monitor className="h-4 w-4" />
                총 디바이스
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-6">
              <div className="text-2xl font-bold text-success">{stats.activeDevices}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Activity className="h-4 w-4" />
                활성 디바이스
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-6">
              <div className="text-2xl font-bold text-primary">{stats.totalUsers}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="h-4 w-4" />
                총 사용자
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-6">
              <div className="text-2xl font-bold text-warning">{stats.adminUsers}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Shield className="h-4 w-4" />
                관리자
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 엣지 디바이스 관리 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              엣지 디바이스 관리
            </CardTitle>
          </CardHeader>
          <CardContent>
            {devices.length === 0 ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  등록된 엣지 디바이스가 없습니다. 새 디바이스를 등록해보세요.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {devices.map((device) => (
                  <div 
                    key={device.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{device.device_name}</h3>
                          <Badge className={getStatusColor(device.status)}>
                            {getStatusLabel(device.status)}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>UUID: <code className="bg-muted px-1 rounded">{device.device_uuid}</code></p>
                          <p>타입: {device.device_type}</p>
                          {device.ip_address && (
                            <p>IP: {device.ip_address}:{device.port}</p>
                          )}
                          <p>등록일: {new Date(device.registered_at).toLocaleDateString('ko-KR')}</p>
                          {device.last_seen && (
                            <p>마지막 접속: {new Date(device.last_seen).toLocaleString('ko-KR')}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4 mr-1" />
                          수정
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => deleteDevice(device.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          삭제
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 사용자 관리 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              사용자 관리
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4" />
              <p>사용자 관리 기능은 개발 중입니다.</p>
              <p className="text-sm">곧 사용자 역할 변경 및 관리 기능이 추가될 예정입니다.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;