import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { fetchAdminData } from '@shared/services/supabaseService/admin';
import { useAuth } from '@shared/contexts/AuthContext';
import { getUserPrintersWithGroup } from '@shared/services/supabaseService/printerList';
import { createSharedMqttClient } from '@shared/component/mqtt';
import { onDashStatusMessage } from '@shared/component/mqtt';
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
  const { user } = useAuth();
  const [devices, setDevices] = useState<EdgeDevice[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDevices: 0,
    activeDevices: 0,
    totalUsers: 0,
    adminUsers: 0
  });

  // AdminCommand state
  const [printerRows, setPrinterRows] = useState<Array<{ id: string; name?: string; model?: string; device_uuid?: string }>>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [mode, setMode] = useState<'command' | 'mcode'>("command");
  const [cmd, setCmd] = useState<string>("");
  const mqtt = useState(() => createSharedMqttClient())[0];
  const [logs, setLogs] = useState<Array<{ id: number; ts: number; dir: 'tx'|'rx'; topic: string; deviceId: string; payload: unknown }>>([]);
  const logIdRef = useState(1)[0];
  const consoleRef = useState<HTMLDivElement | null>(null)[0];
  const adminResultTopicRef = useRef<string | null>(null);
  const adminResultHandlerRef = useRef<((t: string, p: unknown)=>void) | null>(null);

  // 데이터 로드
  const loadData = async () => {
    try {
      setLoading(true);
      const { devices: devicesData, stats } = await fetchAdminData();
      setDevices(devicesData);
      setStats(stats);
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

  // Load printers for command UI
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const rows = await getUserPrintersWithGroup(user.id);
        setPrinterRows(rows);
        if (rows?.length && !deviceId) setDeviceId(rows[0]?.device_uuid ?? "");
      } catch (e) {
        console.error(e);
      }
    })();
  }, [user?.id]);

  const publishAdminCommand = async () => {
    if (!deviceId || !cmd.trim()) return;
    const dashboardTopic = `dashboard/${deviceId}`;
    const payload = { type: 'command', cmd: cmd.trim() };
    try {
      console.log('[MQTT][TX]', dashboardTopic, payload);
      setLogs((prev) => [...prev, { id: Date.now(), ts: Date.now(), dir: 'tx', topic: dashboardTopic, deviceId, payload }]);
      await mqtt.publish(dashboardTopic, payload, 0, false);
      if (mode === 'command') {
        const t = `ADMIN_COMMAND/${deviceId}`;
        console.log('[MQTT][TX]', t, payload);
        setLogs((prev) => [...prev, { id: Date.now() + 1, ts: Date.now(), dir: 'tx', topic: t, deviceId, payload }]);
        await mqtt.publish(t, payload, 0, false);
      } else {
        const t = `ADMIN_COMMAND/MCOD_MODE/${deviceId}`;
        console.log('[MQTT][TX]', t, payload);
        setLogs((prev) => [...prev, { id: Date.now() + 2, ts: Date.now(), dir: 'tx', topic: t, deviceId, payload }]);
        await mqtt.publish(t, payload, 0, false);
      }
      toast({ title: '전송 완료', description: `${deviceId}에 커맨드 전송됨` });
      setCmd('');
    } catch (e: unknown) {
      console.error(e);
      toast({ title: '전송 실패', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    }
  };

  const onCmdKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter') publishAdminCommand();
  };

  // 수신 로그 (dash_status/<uuid>)
  useEffect(() => {
    const off = onDashStatusMessage((uuid, data) => {
      // 선택된 디바이스만 표시
      if (deviceId && uuid !== deviceId) return;
      const topic = `dash_status/${uuid}`;
      setLogs((prev) => [...prev, { id: Date.now(), ts: Date.now(), dir: 'rx', topic, deviceId: uuid, payload: data }]);
    });
    return () => { off(); };
  }, [deviceId]);

  const clearLogs = () => setLogs([]);

  // admin_result/<serial> 구독 적용
  const applyAdminResultSubscribe = async () => {
    if (!deviceId) return;
    const topic = `admin_result/${deviceId}`;
    try {
      // 이전 구독 제거
      if (adminResultTopicRef.current && adminResultHandlerRef.current) {
        try { await mqtt.unsubscribe(adminResultTopicRef.current, adminResultHandlerRef.current); } catch (err) { console.warn('Unsubscribe failed:', err); }
      }
      const handler = (t: string, payload: unknown) => {
        let parsed: unknown = payload;
        try {
          if (typeof payload === 'string') parsed = JSON.parse(payload);
          else if (payload instanceof Uint8Array) parsed = JSON.parse(new TextDecoder().decode(payload));
        } catch (parseErr) { console.warn('Failed to parse payload:', parseErr); }
        setLogs((prev) => [...prev, { id: Date.now(), ts: Date.now(), dir: 'rx', topic: t, deviceId, payload: parsed }]);
      };
      await mqtt.subscribe(topic, handler);
      adminResultTopicRef.current = topic;
      adminResultHandlerRef.current = handler;
      toast({ title: '구독 시작', description: `${topic} 구독을 시작했습니다.` });
    } catch (e: unknown) {
      console.error(e);
      toast({ title: '구독 실패', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    }
  };

  // 언마운트 시 구독 해제
  useEffect(() => {
    return () => {
      (async () => {
        if (adminResultTopicRef.current && adminResultHandlerRef.current) {
          try { await mqtt.unsubscribe(adminResultTopicRef.current, adminResultHandlerRef.current); } catch (err) { console.warn('Cleanup unsubscribe failed:', err); }
        }
      })();
    };
  }, [mqtt]);

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

        {/* 관리자 커맨드 전송 */}
        <Card>
          <CardHeader>
            <CardTitle>관리자 커맨드 전송</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>디바이스 선택</Label>
              <Select value={deviceId} onValueChange={setDeviceId}>
                <SelectTrigger>
                  <SelectValue placeholder="디바이스 선택" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(new Map((printerRows || []).map((p)=>[p.device_uuid,p])).values())
                    .filter((p)=>p && typeof p.device_uuid === 'string' && p.device_uuid.length>0)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.device_uuid}>
                        {(p.name || p.model || p.id)} ({p.device_uuid})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>토픽 모드</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'command' | 'mcode')} className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="command" id="rg-command" />
                  <Label htmlFor="rg-command">COMMAND (ADMIN_COMMAND/&lt;id&gt;)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="mcode" id="rg-mcode" />
                  <Label htmlFor="rg-mcode">M-CODE (ADMIN_COMMAND/MCOD_MODE/&lt;id&gt;)</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>커맨드 입력 (Enter로 전송)</Label>
              <div className="flex gap-2">
                <Input
                  value={cmd}
                  onChange={(e) => setCmd(e.target.value)}
                  onKeyDown={onCmdKeyDown}
                  placeholder="예: M105 또는 G28 등"
                />
                <Button onClick={publishAdminCommand} disabled={!deviceId || !cmd.trim()}>전송</Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                전송 대상:
                <div>- dashboard/&lt;deviceId&gt; 에 {`{"type":"command","cmd":"<입력값>"}`} 전송</div>
                <div>- 라디오 선택에 따라 ADMIN_COMMAND/* 토픽에도 동일 페이로드 전송</div>
              </div>
              <Button variant="outline" size="sm" onClick={clearLogs}>로그 지우기</Button>
            </div>

            {/* 콘솔 영역 */}
            <div className="border rounded-md bg-black text-green-200 font-mono text-xs p-3 h-56 overflow-auto">
              {logs.length === 0 ? (
                <div className="text-muted-foreground">로그가 없습니다.</div>
              ) : (
                logs.slice(-300).map((l) => (
                  <div key={l.id} className="whitespace-pre-wrap break-all">
                    {`[${new Date(l.ts).toLocaleTimeString()}] ${l.dir.toUpperCase()} ${l.topic} -> ${typeof l.payload === 'string' ? l.payload : JSON.stringify(l.payload)}`}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

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