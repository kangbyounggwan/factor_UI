import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ModelViewer from "@/components/ModelViewer";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Layers,
  Upload,
  Play,
  Loader2,
  Box,
  FileText,
  Camera as CameraIcon,
  Wand2,
  Send,
  ImageIcon,
  Trash2,
  FolderOpen,
  Grid3X3,
  Image as ImageFile,
  Shapes,
  Printer,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@shared/contexts/AuthContext";

const AI = () => {
  const [activeTab, setActiveTab] = useState('text-to-3d');
  const [textPrompt, setTextPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [generatedModels, setGeneratedModels] = useState<any[]>([]);
  const [connectedPrinters] = useState([
    { id: '1', name: 'Ender 3 Pro', status: 'ready', temperature: { nozzle: 25, bed: 22 } },
    { id: '2', name: 'Prusa i3 MK3S+', status: 'printing', temperature: { nozzle: 210, bed: 60 }, progress: 45 },
    { id: '3', name: 'Bambu Lab X1 Carbon', status: 'ready', temperature: { nozzle: 28, bed: 25 } },
  ]);
  const totalPrinters = connectedPrinters.length;
  const connectedCount = connectedPrinters.filter(p => p.status === 'ready' || p.status === 'printing').length;
  const printingCount = connectedPrinters.filter(p => p.status === 'printing').length;
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'AI 3D 모델링 스튜디오 | 텍스트·이미지 → 3D';
    const desc = '텍스트와 이미지를 AI로 3D 모델로 변환하고, 프린터와 연동해 즉시 출력까지 진행하세요.';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc);
  }, []);

  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState<any | null>(null);
  const [printSettings, setPrintSettings] = useState({
    support_enable: true,
    support_angle: 50,
    layer_height: 0.2,
    line_width: 0.4,
    speed_print: 50,
    material_diameter: 1.75,
    material_flow: 100,
    infill_sparse_density: 15,
    wall_line_count: 2,
    top_layers: 4,
    bottom_layers: 4,
    adhesion_type: 'none' as 'none' | 'skirt' | 'brim' | 'raft',
  });

  const openPrinterSettings = (printer: any) => {
    setSelectedPrinter(printer);
    setPrintDialogOpen(true);
  };

  const updateSetting = (key: string, value: any) => {
    setPrintSettings((prev) => ({ ...prev, [key]: value }));
  };

  const startPrint = async () => {
    toast({ title: '출력 시작', description: `${selectedPrinter?.name}에 출력 작업을 전송했습니다.` });
    setPrintDialogOpen(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setUploadedFiles([...uploadedFiles, { id: Date.now(), name: file.name, size: file.size, type: file.type, url: URL.createObjectURL(file) }]);
      toast({ title: '파일 업로드 완료', description: `${file.name}이 업로드되었습니다.` });
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      setUploadedFiles([...uploadedFiles, { id: Date.now(), name: file.name, size: file.size, type: file.type, url: URL.createObjectURL(file) }]);
      toast({ title: '파일 업로드 완료', description: `${file.name}이 업로드되었습니다.` });
    }
  };

  const generateModel = async () => {
    if (!textPrompt.trim() && uploadedFiles.length === 0) {
      toast({ title: '입력 필요', description: '텍스트를 입력하거나 파일을 업로드해주세요.', variant: 'destructive' });
      return;
    }
    setIsProcessing(true);
    toast({ title: 'AI 생성 시작', description: '3D 모델을 생성하고 있습니다...' });
    setTimeout(() => {
      const newModel = { id: Date.now(), name: `Model_${Date.now()}`, type: activeTab, prompt: textPrompt, status: 'completed', thumbnail: '/placeholder.svg', createdAt: new Date().toISOString() };
      setGeneratedModels([newModel, ...generatedModels]);
      setIsProcessing(false);
      toast({ title: '생성 완료', description: '3D 모델이 성공적으로 생성되었습니다.' });
    }, 1500);
  };

  const removeFile = (fileId: number) => { setUploadedFiles(uploadedFiles.filter(file => file.id !== fileId)); };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="px-3 py-3 space-y-3 pb-[calc(env(safe-area-inset-bottom,0)+72px)]">
        {/* 상단 헤더 요약 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg"><Layers className="w-5 h-5 text-primary" /></div>
            <h1 className="text-lg font-semibold">AI 3D 모델링 스튜디오</h1>
          </div>
          <div className="text-xs text-muted-foreground">모델 {generatedModels.length} • 프린터 {connectedCount}/{totalPrinters} • 프린팅 {printingCount}</div>
        </div>

        {/* 탭 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-3">
            <TabsTrigger value="text-to-3d" className="flex items-center gap-1 text-xs"><Wand2 className="w-3 h-3" />텍스트→3D</TabsTrigger>
            <TabsTrigger value="image-to-3d" className="flex items-center gap-1 text-xs"><ImageIcon className="w-3 h-3" />이미지→3D</TabsTrigger>
            <TabsTrigger value="text-to-image" className="flex items-center gap-1 text-xs"><FileText className="w-3 h-3" />텍스트→이미지</TabsTrigger>
          </TabsList>

          {/* 텍스트 → 3D */}
          <TabsContent value="text-to-3d" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wand2 className="w-5 h-5" />3D 모델 생성</CardTitle>
                <CardDescription>텍스트 설명으로 3D 모델을 생성하세요</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea placeholder="예: 빨간색 스포츠카, 현대적인 의자, 귀여운 로봇..." value={textPrompt} onChange={(e)=>setTextPrompt(e.target.value)} className="min-h-[100px]" />
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" size="sm">낮음</Button>
                  <Button variant="default" size="sm">보통</Button>
                  <Button variant="outline" size="sm">높음</Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="default" size="sm">Flux Kontext</Button>
                  <Button variant="outline" size="sm">GPT-4</Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm">사실적</Button>
                  <Button variant="outline" size="sm">추상적</Button>
                </div>
                <Button onClick={generateModel} disabled={isProcessing || !textPrompt.trim()} className="w-full" size="lg">
                  {isProcessing ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />생성 중...</>) : (<><Send className="w-4 h-4 mr-2" />3D 모델 생성</>)}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="bg-muted rounded-lg flex items-center justify-center h-[52vh] relative overflow-hidden">
                  {isProcessing ? (
                    <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
                      <div className="text-center space-y-3">
                        <Loader2 className="w-10 h-10 mx-auto animate-spin text-white" />
                        <p className="text-sm text-white">AI 모델 생성 중...</p>
                      </div>
                    </div>
                  ) : (
                    <ModelViewer className="w-full h-full" />
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 이미지 → 3D */}
          <TabsContent value="image-to-3d" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5" />이미지 업로드</CardTitle>
                <CardDescription>JPG, PNG 이미지를 3D 모델로 변환하세요</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer" onDragOver={handleDragOver} onDrop={handleDrop} onClick={()=>fileInputRef.current?.click()}>
                  <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm">클릭하거나 여기에 이미지를 드롭하세요</p>
                  <Button variant="outline" size="sm" className="mt-3">파일 선택</Button>
                  <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept="image/*" multiple />
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="font-medium text-sm">업로드된 이미지</h4>
                    {uploadedFiles.map((file) => (
                      <div key={file.id} className="flex items-center gap-3 p-2 border rounded-lg">
                        <img src={file.url} alt={file.name} className="w-12 h-12 object-cover rounded" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{(file.size/1024/1024).toFixed(2)} MB</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={()=>removeFile(file.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    ))}
                  </div>
                )}

                <Button onClick={generateModel} className="w-full mt-4" size="lg">
                  {isProcessing ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />변환 중...</>) : (<><Upload className="w-4 h-4 mr-2" />3D 모델로 변환</>)}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="rounded-lg overflow-hidden h-[52vh]">
                  <ModelViewer className="w-full h-full" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 텍스트 → 이미지 */}
          <TabsContent value="text-to-image" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CameraIcon className="w-5 h-5" />이미지 생성</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea placeholder="생성하고 싶은 이미지를 설명하세요..." value={textPrompt} onChange={(e)=>setTextPrompt(e.target.value)} className="min-h-[100px]" />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="default" size="sm">사실적</Button>
                  <Button variant="outline" size="sm">카툰</Button>
                  <Button variant="outline" size="sm">추상적</Button>
                  <Button variant="outline" size="sm">픽셀아트</Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm">512x512</Button>
                  <Button variant="default" size="sm">1024x1024</Button>
                </div>
                <Button onClick={generateModel} className="w-full" size="lg">
                  {isProcessing ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />이미지 생성 중...</>) : (<><CameraIcon className="w-4 h-4 mr-2" />이미지 생성</>)}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="bg-gray-900 rounded-lg flex items-center justify-center h-[52vh] relative overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 연결된 프린터 섹션 */}
        {(activeTab === 'text-to-3d' || activeTab === 'image-to-3d') && (
          <div>
            <Separator className="my-3" />
            <h3 className="font-medium mb-2">연결된 프린터</h3>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">연결: {connectedCount}/{totalPrinters}</Badge>
              <Badge className="rounded-full px-3 py-1 text-xs">프린팅: {printingCount}</Badge>
            </div>
            <div className="space-y-2">
              {connectedPrinters.map((printer) => (
                <Card key={printer.id} className="p-3 cursor-pointer hover:shadow-md transition" onClick={()=>openPrinterSettings(printer)}>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{printer.name}</p>
                      <Badge variant={printer.status === 'ready' ? 'secondary' : 'default'} className="text-xs">{printer.status === 'ready' ? '대기중' : '프린팅중'}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex justify-between">
                      <span>노즐: {printer.temperature.nozzle}°C</span>
                      <span>베드: {printer.temperature.bed}°C</span>
                    </div>
                    {printer.progress && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs"><span>진행률</span><span>{printer.progress}%</span></div>
                        <Progress value={printer.progress} className="h-1" />
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* 출력 설정 다이얼로그 */}
        <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
          <DialogContent className="w-[92vw] max-w-[92vw] max-h-[90vh] overflow-hidden p-0 rounded-xl">
            <div className="flex flex-col h-full">
              <div className="px-4 py-3 border-b">
                <DialogHeader className="flex flex-row items-center justify-between w-full">
                  <DialogTitle className="text-base font-semibold">출력 설정{selectedPrinter ? ` - ${selectedPrinter.name}` : ''}</DialogTitle>
                </DialogHeader>
              </div>

              <div className="grid grid-cols-1 gap-4 p-4 overflow-hidden flex-1">
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <ModelViewer className="w-full h-[52vh]" />
                  </CardContent>
                </Card>

                <div className="h-[52vh] overflow-y-auto pr-1">
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2"><h4 className="font-medium">서포트</h4></div>
                      <div className="flex items-center justify-between p-3 rounded-lg border"><Label htmlFor="support_enable">서포트 활성화</Label><Switch id="support_enable" checked={printSettings.support_enable} onCheckedChange={(v)=>updateSetting('support_enable', v)} /></div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div><Label htmlFor="support_angle">오버행 임계각(°)</Label><Input id="support_angle" type="number" step="1" value={printSettings.support_angle} onChange={(e)=>updateSetting('support_angle', Number(e.target.value))} /></div>
                        <div>
                          <Label htmlFor="adhesion_type">빌드플레이트 접착</Label>
                          <Select value={printSettings.adhesion_type} onValueChange={(v)=>updateSetting('adhesion_type', v)}>
                            <SelectTrigger id="adhesion_type" className="w-full"><SelectValue placeholder="없음" /></SelectTrigger>
                            <SelectContent className="bg-background z-50">
                              <SelectItem value="none">없음</SelectItem>
                              <SelectItem value="skirt">Skirt</SelectItem>
                              <SelectItem value="brim">Brim</SelectItem>
                              <SelectItem value="raft">Raft</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-3">
                      <div><Label htmlFor="layer_height">레이어 높이(mm)</Label><Input id="layer_height" type="number" step="0.01" value={printSettings.layer_height} onChange={(e)=>updateSetting('layer_height', Number(e.target.value))} /></div>
                      <div><Label htmlFor="line_width">라인 너비(mm)</Label><Input id="line_width" type="number" step="0.01" value={printSettings.line_width} onChange={(e)=>updateSetting('line_width', Number(e.target.value))} /></div>
                      <div><Label htmlFor="speed_print">프린트 속도(mm/s)</Label><Input id="speed_print" type="number" step="1" value={printSettings.speed_print} onChange={(e)=>updateSetting('speed_print', Number(e.target.value))} /></div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-3">
                      <div><Label htmlFor="material_diameter">재료 직경(mm)</Label><Input id="material_diameter" type="number" step="0.01" value={printSettings.material_diameter} onChange={(e)=>updateSetting('material_diameter', Number(e.target.value))} /></div>
                      <div><Label htmlFor="material_flow">재료 유량(%)</Label><Input id="material_flow" type="number" step="1" value={printSettings.material_flow} onChange={(e)=>updateSetting('material_flow', Number(e.target.value))} /></div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-3">
                      <div><Label htmlFor="infill_sparse_density">인필 밀도(%)</Label><Input id="infill_sparse_density" type="number" step="1" value={printSettings.infill_sparse_density} onChange={(e)=>updateSetting('infill_sparse_density', Number(e.target.value))} /></div>
                      <div><Label htmlFor="wall_line_count">벽 라인 수</Label><Input id="wall_line_count" type="number" step="1" value={printSettings.wall_line_count} onChange={(e)=>updateSetting('wall_line_count', Number(e.target.value))} /></div>
                      <div><Label htmlFor="top_layers">탑 레이어</Label><Input id="top_layers" type="number" step="1" value={printSettings.top_layers} onChange={(e)=>updateSetting('top_layers', Number(e.target.value))} /></div>
                      <div><Label htmlFor="bottom_layers">바닥 레이어</Label><Input id="bottom_layers" type="number" step="1" value={printSettings.bottom_layers} onChange={(e)=>updateSetting('bottom_layers', Number(e.target.value))} /></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
                <Button variant="outline" onClick={()=>setPrintDialogOpen(false)}>취소</Button>
                <Button onClick={startPrint}><Printer className="w-4 h-4 mr-2" />출력 시작</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AI;