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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Layers, 
  Upload, 
  Download, 
  Play, 
  Pause, 
  Image, 
  Box, 
  FileText, 
  Printer, 
  Settings, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  ArrowRight,
  Zap,
  Sparkles,
  Monitor,
  Camera,
  Wand2,
  Send,
  ImageIcon,
  FileUp,
  Trash2,
  Eye,
  RotateCcw,
  FolderOpen,
  Grid3X3,
  Image as ImageFile,
  Shapes
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@shared/contexts/AuthContext";
import { getUserPrintersWithGroup } from "@shared/services/supabaseService/printerList";

const AI = () => {
  const [activeTab, setActiveTab] = useState('text-to-3d');
  const [textPrompt, setTextPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [generatedModels, setGeneratedModels] = useState<any[]>([]);
  const [printers, setPrinters] = useState<any[]>([]);
  const totalPrinters = printers.length;
  const connectedCount = printers.filter((p: any) => p?.status === 'ready' || p?.status === 'printing' || p?.status === 'operational').length;
  const printingCount = printers.filter((p: any) => p?.status === 'printing').length;
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 연결된 프린터 로드 (Supabase)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!user?.id) return;
        const rows = await getUserPrintersWithGroup(user.id);
        if (!active) return;
        const mapped = (rows || []).map((r: any) => ({
          id: r.id,
          name: r.model ?? r.device_uuid ?? 'Unknown Printer',
          status: r.status ?? 'disconnected',
          temperature: { nozzle: 0, bed: 0 }, // 실시간 온도는 별도 채널에서
          progress: undefined,
          raw: r,
        }));
        setPrinters(mapped);
      } catch (e) {
        console.error('[AI] load printers failed', e);
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  // SEO: Title & Meta description
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

  // 출력 설정 다이얼로그 상태
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
    toast({
      title: '출력 시작',
      description: `${selectedPrinter?.name}에 출력 작업을 전송했습니다.`,
    });
    setPrintDialogOpen(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setUploadedFiles([...uploadedFiles, {
        id: Date.now(),
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file)
      }]);
      toast({
        title: "파일 업로드 완료",
        description: `${file.name}이 업로드되었습니다.`,
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      setUploadedFiles([...uploadedFiles, {
        id: Date.now(),
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file)
      }]);
      toast({
        title: "파일 업로드 완료",
        description: `${file.name}이 업로드되었습니다.`,
      });
    }
  };

  const generateModel = async () => {
    if (!textPrompt.trim() && uploadedFiles.length === 0) {
      toast({
        title: "입력 필요",
        description: "텍스트를 입력하거나 파일을 업로드해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    toast({
      title: "AI 생성 시작",
      description: "3D 모델을 생성하고 있습니다...",
    });

    // 시뮬레이션 - 실제로는 AI API 호출
    setTimeout(() => {
      const newModel = {
        id: Date.now(),
        name: `Model_${Date.now()}`,
        type: activeTab,
        prompt: textPrompt,
        status: 'completed',
        thumbnail: '/placeholder.svg',
        createdAt: new Date().toISOString()
      };
      
      setGeneratedModels([newModel, ...generatedModels]);
      setIsProcessing(false);
      toast({
        title: "생성 완료",
        description: "3D 모델이 성공적으로 생성되었습니다.",
      });
    }, 3000);
  };

  const removeFile = (fileId: number) => {
    setUploadedFiles(uploadedFiles.filter(file => file.id !== fileId));
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* 메인 작업 영역 */}
        <div className="flex-1 flex flex-col">
          {/* 헤더 */}
          <div className="border-b p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Layers className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">AI 3D 모델링 스튜디오</h1>
            </div>
          </div>

          {/* 탭 및 작업 영역 */}
          <div className="flex-1 p-4 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-3 mb-6 shrink-0">
                <TabsTrigger value="text-to-3d" className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4" />
                  텍스트 → 3D
                </TabsTrigger>
                <TabsTrigger value="image-to-3d" className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  이미지 → 3D
                </TabsTrigger>
                <TabsTrigger value="text-to-image" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  텍스트 → 이미지
                </TabsTrigger>
              </TabsList>

              {/* 텍스트 → 3D 탭 */}
              <TabsContent value="text-to-3d" className="flex-1 min-h-0 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 h-full">
                  {/* 입력 영역 */}
                  <Card className="lg:sticky top-4 max-h-[calc(85vh-4rem-2rem)] overflow-auto">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wand2 className="w-5 h-5" />
                        3D 모델 생성
                      </CardTitle>
                      <CardDescription>
                        텍스트 설명으로 3D 모델을 생성하세요
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">모델 설명</label>
                        <Textarea
                          placeholder="예: 빨간색 스포츠카, 현대적인 의자, 귀여운 로봇..."
                          value={textPrompt}
                          onChange={(e) => setTextPrompt(e.target.value)}
                          className="min-h-[120px]"
                        />
                      </div>
                      
                      {/* 생성 설정 */}
                      <div className="space-y-4 p-4 bg-muted/5 rounded-lg">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">품질 설정</label>
                          <div className="grid grid-cols-3 gap-2">
                            <Button variant="outline" size="sm">낮음</Button>
                            <Button variant="default" size="sm">보통</Button>
                            <Button variant="outline" size="sm">높음</Button>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium">AI 모델</label>
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="default" size="sm">Flux Kontext</Button>
                            <Button variant="outline" size="sm">GPT-4</Button>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium">스타일</label>
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm">사실적</Button>
                            <Button variant="outline" size="sm">추상적</Button>
                          </div>
                        </div>
                      </div>
                      
                      <Button 
                        onClick={generateModel}
                        disabled={isProcessing || !textPrompt.trim()}
                        className="w-full"
                        size="lg"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            생성 중...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            3D 모델 생성
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* 프리뷰 영역 */}
                  <Card className="h-fit lg:sticky top-4">
                    <CardContent className="p-0">
                      <div className="bg-muted rounded-lg flex items-center justify-center h-[calc(85vh-4rem-2rem)] relative overflow-hidden">
                        {isProcessing ? (
                          <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
                            <div className="text-center space-y-4">
                              <Loader2 className="w-20 h-20 mx-auto animate-spin text-white" />
                              <div>
                                <p className="text-xl font-medium text-white">AI 모델 생성 중...</p>
                                <p className="text-lg text-gray-300">잠시만 기다려주세요</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <ModelViewer className="w-full h-full" />
                        )}
                       </div>
                     </CardContent>
                   </Card>
                </div>
              </TabsContent>

              {/* 이미지 → 3D 탭 */}
              <TabsContent value="image-to-3d" className="flex-1 min-h-0 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 h-full">
                  {/* 업로드 영역 */}
                  <Card className="lg:sticky top-4 max-h-[calc(85vh-4rem-2rem)] overflow-auto">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Upload className="w-5 h-5" />
                        이미지 업로드
                      </CardTitle>
                      <CardDescription>
                        JPG, PNG 이미지를 3D 모델로 변환하세요
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div 
                        className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-lg font-medium mb-2">
                          클릭하거나 여기에 이미지를 드롭하세요
                        </p>
                        <p className="text-sm text-muted-foreground mb-4">
                          JPG, PNG, WEBP 또는 GIF
                        </p>
                        <Button variant="outline">
                          파일 선택
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          onChange={handleFileUpload}
                          className="hidden"
                          accept="image/*"
                          multiple
                        />
                      </div>

                      {/* 업로드된 이미지 목록 */}
                      {uploadedFiles.length > 0 && (
                        <div className="mt-6 space-y-3">
                          <h4 className="font-medium">업로드된 이미지</h4>
                          {uploadedFiles.map((file) => (
                            <div key={file.id} className="flex items-center gap-3 p-3 border rounded-lg">
                              <img 
                                src={file.url} 
                                alt={file.name}
                                className="w-12 h-12 object-cover rounded"
                              />
                              <div className="flex-1">
                                <p className="text-sm font-medium">{file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {(file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(file.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 변환 설정 */}
                      <div className="space-y-4 p-4 bg-muted/5 rounded-lg">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">깊이 인식</label>
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="default" size="sm">자동</Button>
                            <Button variant="outline" size="sm">수동</Button>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium">품질</label>
                          <div className="grid grid-cols-3 gap-2">
                            <Button variant="outline" size="sm">낮음</Button>
                            <Button variant="default" size="sm">보통</Button>
                            <Button variant="outline" size="sm">높음</Button>
                          </div>
                        </div>
                      </div>

                      <Button onClick={generateModel} className="w-full" size="lg">
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            변환 중...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            3D 모델로 변환
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* 결과 영역 */}
                  <Card className="h-fit lg:sticky top-4">
                    <CardContent className="p-0">
                      <div className="rounded-lg overflow-hidden h-[calc(85vh-4rem-2rem)]">
                        <ModelViewer className="w-full h-full" />
                      </div>
                       </CardContent>
                     </Card>
                   </div>
                 </TabsContent>

              {/* 텍스트 → 이미지 탭 */}
              <TabsContent value="text-to-image" className="flex-1 min-h-0 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 h-full">
                  <Card className="lg:sticky top-4 max-h-[calc(85vh-4rem-2rem)] overflow-auto">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Camera className="w-5 h-5" />
                        이미지 생성
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">이미지 설명</label>
                        <Textarea
                          placeholder="생성하고 싶은 이미지를 설명하세요..."
                          value={textPrompt}
                          onChange={(e) => setTextPrompt(e.target.value)}
                          className="min-h-[120px]"
                        />
                      </div>
                      
                      {/* 이미지 설정 */}
                      <div className="space-y-4 p-4 bg-muted/5 rounded-lg">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">아트 스타일</label>
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="default" size="sm">사실적</Button>
                            <Button variant="outline" size="sm">카툰</Button>
                            <Button variant="outline" size="sm">추상적</Button>
                            <Button variant="outline" size="sm">픽셀아트</Button>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium">해상도</label>
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm">512x512</Button>
                            <Button variant="default" size="sm">1024x1024</Button>
                          </div>
                        </div>
                      </div>
                      
                      <Button onClick={generateModel} className="w-full" size="lg">
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            이미지 생성 중...
                          </>
                        ) : (
                          <>
                            <Camera className="w-4 h-4 mr-2" />
                            이미지 생성
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                    <Card className="h-fit lg:sticky top-4">
                    <CardContent className="p-0">
                      <div className="bg-gray-900 rounded-lg flex items-center justify-center h-[calc(85vh-4rem-2rem)] relative overflow-hidden">
                        <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                          <div className="absolute inset-0" style={{
                            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                            backgroundSize: '20px 20px'
                          }} />
                        </div>
                       </div>
                     </CardContent>
                   </Card>
                 </div>
               </TabsContent>
             </Tabs>
           </div>
         </div>

        {/* 사이드바 - 탭별 내용 */}
        <div className="w-[340px] border-l bg-muted/5 overflow-y-auto">
          <div className="p-6">
            {activeTab === 'text-to-3d' && (
              <>
                <h2 className="text-lg font-semibold mb-4">3D 모델 생성</h2>
                
                {/* 생성된 3D 모델 목록 */}
                <ScrollArea className="h-[300px] mb-6">
                  {generatedModels.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Box className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">생성된 3D 모델이 없습니다</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {generatedModels.map((model) => (
                        <Card key={model.id} className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                              <Box className="w-6 h-6 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{model.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(model.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {/* 컨트롤 버튼 */}
                <div className="flex items-center justify-center gap-2 mb-4 p-2 bg-muted/5 rounded-lg">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <FolderOpen className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Grid3X3 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <ImageFile className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Shapes className="w-4 h-4" />
                  </Button>
                </div>

              </>
            )}

            {activeTab === 'image-to-3d' && (
              <>
                <h2 className="text-lg font-semibold mb-4">이미지 → 3D 변환</h2>
                
                {/* 업로드된 이미지 미리보기 */}
                <div className="mb-6">
                  <h3 className="font-medium mb-3">업로드된 이미지</h3>
                  {uploadedFiles.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">업로드된 이미지가 없습니다</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {uploadedFiles.map((file) => (
                        <div key={file.id} className="border rounded-lg p-2">
                          <img 
                            src={file.url} 
                            alt={file.name}
                            className="w-full h-24 object-cover rounded mb-2"
                          />
                          <p className="text-xs font-medium">{file.name}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </>
            )}

            {activeTab === 'text-to-image' && (
              <>
                <h2 className="text-lg font-semibold mb-4">이미지 생성</h2>
                
                {/* 생성된 이미지 갤러리 */}
                <ScrollArea className="h-[300px] mb-6">
                  <div className="text-center py-8 text-muted-foreground">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">생성된 이미지가 없습니다</p>
                  </div>
                </ScrollArea>
              </>
            )}

            {/* 연결된 프린터 - 3D 관련 탭에서만 표시 */}
            {(activeTab === 'text-to-3d' || activeTab === 'image-to-3d') && (
              <>
                <Separator className="my-4" />
                
                <h3 className="font-medium mb-2">연결된 프린터</h3>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                    연결: {connectedCount}/{totalPrinters}
                  </Badge>
                  <Badge className="rounded-full px-3 py-1 text-xs">
                    프린팅: {printingCount}
                  </Badge>
                </div>
                <div className="space-y-3">
                  {printers.map((printer: any) => (
                    <Card key={printer.id} className="p-3 cursor-pointer hover:shadow-md transition" onClick={() => openPrinterSettings(printer)}>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{printer.name}</p>
                          <Badge 
                            variant={printer.status === 'ready' || printer.status === 'operational' ? 'secondary' : 'default'}
                            className="text-xs"
                          >
                            {printer.status === 'printing' ? '프린팅중' : (printer.status === 'ready' || printer.status === 'operational' ? '대기중' : (printer.status || '연결끊김'))}
                          </Badge>
                        </div>
                        
                        <div className="text-xs text-muted-foreground">
                          <div className="flex justify-between">
                            <span>노즐: {printer?.temperature?.nozzle ?? 0}°C</span>
                            <span>베드: {printer?.temperature?.bed ?? 0}°C</span>
                          </div>
                        </div>

                        {typeof printer.progress === 'number' && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>진행률</span>
                              <span>{printer.progress}%</span>
                            </div>
                            <Progress value={printer.progress} className="h-1" />
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 출력 설정 다이얼로그 */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="w-[75vw] max-w-[75vw] max-h-[90vh] overflow-hidden p-0 rounded-xl">
          <div className="flex flex-col h-full">
            {/* 헤더 */}
            <div className="px-6 py-4 border-b">
              <DialogHeader className="flex flex-row items-center justify-between w-full">
                <DialogTitle className="text-lg font-semibold">
                  출력 설정{selectedPrinter ? ` - ${selectedPrinter.name}` : ''}
                </DialogTitle>
              </DialogHeader>
            </div>

            {/* 본문 */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(560px,1fr)_440px] gap-6 p-6 overflow-hidden flex-1">
              {/* 좌: 렌더링 */}
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <ModelViewer className="w-full h-[68vh]" />
                </CardContent>
              </Card>

              {/* 우: 설정 폼 */}
              <div className="h-[68vh] overflow-y-auto pr-1">
                <div className="space-y-6">
                  {/* 서포트 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">서포트</h4>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <Label htmlFor="support_enable">서포트 활성화</Label>
                      <Switch id="support_enable" checked={printSettings.support_enable} onCheckedChange={(v)=>updateSetting('support_enable', v)} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="support_angle">오버행 임계각(°)</Label>
                        <Input id="support_angle" type="number" step="1" value={printSettings.support_angle} onChange={(e)=>updateSetting('support_angle', Number(e.target.value))} />
                      </div>
                      <div>
                        <Label htmlFor="adhesion_type">빌드플레이트 접착</Label>
                        <Select value={printSettings.adhesion_type} onValueChange={(v)=>updateSetting('adhesion_type', v)}>
                          <SelectTrigger id="adhesion_type" className="w-full">
                            <SelectValue placeholder="없음" />
                          </SelectTrigger>
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

                  {/* 품질/속도 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="layer_height">레이어 높이(mm)</Label>
                      <Input id="layer_height" type="number" step="0.01" value={printSettings.layer_height} onChange={(e)=>updateSetting('layer_height', Number(e.target.value))} />
                    </div>
                    <div>
                      <Label htmlFor="line_width">라인 너비(mm)</Label>
                      <Input id="line_width" type="number" step="0.01" value={printSettings.line_width} onChange={(e)=>updateSetting('line_width', Number(e.target.value))} />
                    </div>
                    <div>
                      <Label htmlFor="speed_print">프린트 속도(mm/s)</Label>
                      <Input id="speed_print" type="number" step="1" value={printSettings.speed_print} onChange={(e)=>updateSetting('speed_print', Number(e.target.value))} />
                    </div>
                  </div>

                  <Separator />

                  {/* 재료 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="material_diameter">재료 직경(mm)</Label>
                      <Input id="material_diameter" type="number" step="0.01" value={printSettings.material_diameter} onChange={(e)=>updateSetting('material_diameter', Number(e.target.value))} />
                    </div>
                    <div>
                      <Label htmlFor="material_flow">재료 유량(%)</Label>
                      <Input id="material_flow" type="number" step="1" value={printSettings.material_flow} onChange={(e)=>updateSetting('material_flow', Number(e.target.value))} />
                    </div>
                  </div>

                  <Separator />

                  {/* 인필/벽/탑/바닥 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="infill_sparse_density">인필 밀도(%)</Label>
                      <Input id="infill_sparse_density" type="number" step="1" value={printSettings.infill_sparse_density} onChange={(e)=>updateSetting('infill_sparse_density', Number(e.target.value))} />
                    </div>
                    <div>
                      <Label htmlFor="wall_line_count">벽 라인 수</Label>
                      <Input id="wall_line_count" type="number" step="1" value={printSettings.wall_line_count} onChange={(e)=>updateSetting('wall_line_count', Number(e.target.value))} />
                    </div>
                    <div>
                      <Label htmlFor="top_layers">탑 레이어</Label>
                      <Input id="top_layers" type="number" step="1" value={printSettings.top_layers} onChange={(e)=>updateSetting('top_layers', Number(e.target.value))} />
                    </div>
                    <div>
                      <Label htmlFor="bottom_layers">바닥 레이어</Label>
                      <Input id="bottom_layers" type="number" step="1" value={printSettings.bottom_layers} onChange={(e)=>updateSetting('bottom_layers', Number(e.target.value))} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 푸터 */}
            <div className="px-6 py-4 border-t flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>취소</Button>
              <Button onClick={startPrint}>
                <Printer className="w-4 h-4 mr-2" />
                출력 시작
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AI;