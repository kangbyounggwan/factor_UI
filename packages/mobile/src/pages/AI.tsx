import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ModelViewer from "@/components/ModelViewer";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Layers,
  Upload,
  Loader2,
  Wand2,
  Send,
  ImageIcon,
  Trash2,
  Printer,
  Download,
  ChevronDown,
  ChevronRight,
  Sparkles,
  FileText,
  Camera as CameraIcon,
  Settings,
  History,
  Check,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@shared/contexts/AuthContext";
import { useTranslation } from "react-i18next";

// 단계 정의
type Step = "select-input" | "create-prompt" | "configure" | "generate" | "result";

const AI = () => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState<Step>("select-input");
  const [inputType, setInputType] = useState<"text" | "image" | "text-to-image">("text");
  const [textPrompt, setTextPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [generatedModel, setGeneratedModel] = useState<any | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const advancedSectionRef = useRef<HTMLDivElement>(null);

  // 고급 설정
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");
  const [style, setStyle] = useState<"realistic" | "abstract" | "cartoon">("realistic");
  const [resolution, setResolution] = useState("1024x1024");

  const [connectedPrinters] = useState([
    { id: "1", name: "Ender 3 Pro", status: "ready", temperature: { nozzle: 25, bed: 22 } },
    { id: "2", name: "Prusa i3 MK3S+", status: "printing", temperature: { nozzle: 210, bed: 60 }, progress: 45 },
    { id: "3", name: "Bambu Lab X1 Carbon", status: "ready", temperature: { nozzle: 28, bed: 25 } },
  ]);

  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 예시 프롬프트
  const examplePrompts = [
    { icon: "🚗", text: t('ai.exampleCar') || "빨간색 스포츠카" },
    { icon: "🪑", text: t('ai.exampleChair') || "현대적인 의자" },
    { icon: "🤖", text: t('ai.exampleRobot') || "귀여운 로봇" },
    { icon: "🏠", text: t('ai.exampleHouse') || "작은 집 모형" },
  ];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    document.title = t('ai.title') || "AI 3D 모델링 스튜디오";
  }, [t]);

  // 고급 설정 열릴 때 해당 섹션으로 스크롤 이동
  useEffect(() => {
    if (showAdvanced && contentScrollRef.current && advancedSectionRef.current) {
      // 약간의 지연 후 스크롤(전개 애니메이션 완료 고려)
      const id = window.setTimeout(() => {
        const container = contentScrollRef.current!;
        const targetTop = advancedSectionRef.current!.offsetTop;
        container.scrollTo({ top: targetTop - 12, behavior: 'smooth' });
      }, 50);
      return () => window.clearTimeout(id);
    }
  }, [showAdvanced]);

  // 파일 업로드 핸들러
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setUploadedFiles([...uploadedFiles, {
        id: Date.now(),
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
      }]);
      toast({ title: t('ai.uploadSuccess'), description: `${file.name}` });
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
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
        url: URL.createObjectURL(file),
      }]);
      toast({ title: t('ai.uploadSuccess'), description: `${file.name}` });
    }
  };

  const removeFile = (fileId: number) => {
    setUploadedFiles(uploadedFiles.filter((file) => file.id !== fileId));
  };

  // 생성 시작
  const startGeneration = async () => {
    if (!textPrompt.trim() && uploadedFiles.length === 0) {
      toast({
        title: t('ai.inputRequired'),
        description: t('ai.inputRequiredDesc'),
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setCurrentStep("generate");

    // 프로그레스 시뮬레이션
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return prev;
        }
        return prev + 5;
      });
    }, 200);

    // 생성 시뮬레이션
    setTimeout(() => {
      clearInterval(interval);
      setProgress(100);
      const newModel = {
        id: Date.now(),
        name: `Model_${Date.now()}`,
        type: inputType,
        prompt: textPrompt,
        status: "completed",
        thumbnail: "/placeholder.svg",
        createdAt: new Date().toISOString(),
      };
      setGeneratedModel(newModel);
      setIsProcessing(false);
      setCurrentStep("result");
      toast({
        title: t('ai.generationComplete'),
        description: t('ai.generationCompleteDesc'),
      });
    }, 4000);
  };

  // 다시 시작
  const resetFlow = () => {
    setCurrentStep("select-input");
    setTextPrompt("");
    setUploadedFiles([]);
    setGeneratedModel(null);
    setProgress(0);
  };

  // Step 1: 입력 방식 선택
  const renderSelectInput = () => (
    <div className="space-y-3">
      <div className="text-center space-y-1.5">
        <h1 className="text-xl font-bold">{t('ai.whatToCreate')}</h1>
        <p className="text-sm text-muted-foreground">{t('ai.selectInputMethod')}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 mt-4">
        <Card
          className={`cursor-pointer transition-all hover:shadow-lg ${
            inputType === "text" ? "ring-2 ring-primary" : ""
          }`}
          onClick={() => {
            setInputType("text");
            setCurrentStep("create-prompt");
          }}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-lg">
              <Wand2 className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base">{t('ai.textTo3D')}</h3>
              <p className="text-sm text-muted-foreground">{t('ai.textTo3DDesc')}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-lg ${
            inputType === "image" ? "ring-2 ring-primary" : ""
          }`}
          onClick={() => {
            setInputType("image");
            setCurrentStep("create-prompt");
          }}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-lg">
              <ImageIcon className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base">{t('ai.imageTo3D')}</h3>
              <p className="text-sm text-muted-foreground">{t('ai.imageTo3DDesc')}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-lg ${
            inputType === "text-to-image" ? "ring-2 ring-primary" : ""
          }`}
          onClick={() => {
            setInputType("text-to-image");
            setCurrentStep("create-prompt");
          }}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-lg">
              <CameraIcon className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base">{t('ai.textToImage')}</h3>
              <p className="text-sm text-muted-foreground">{t('ai.textToImageDesc')}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // Step 2: 프롬프트 작성
  const renderCreatePrompt = () => (
    <div className="space-y-4">
      {/* 뒤로 가기 */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setCurrentStep("select-input")}>
          ← {t('common.back')}
        </Button>
        <Badge variant="outline">{inputType === "text" ? t('ai.textTo3D') : inputType === "image" ? t('ai.imageTo3D') : t('ai.textToImage')}</Badge>
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">{t('ai.describeYourIdea')}</h2>
        <p className="text-sm text-muted-foreground">{t('ai.describeYourIdeaDesc')}</p>
      </div>

      {/* 이미지 업로드 모드 */}
      {inputType === "image" && (
        <div
          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium">{t('ai.dragAndDrop')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('ai.supportedFormats')}</p>
          <Button variant="outline" size="sm" className="mt-3">
            {t('gcode.selectFile')}
          </Button>
          <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept="image/*" />
        </div>
      )}

      {/* 업로드된 파일 목록 */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          {uploadedFiles.map((file) => (
            <div key={file.id} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
              <img src={file.url} alt={file.name} className="w-16 h-16 object-cover rounded" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeFile(file.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* 텍스트 입력 */}
      {(inputType === "text" || inputType === "text-to-image") && (
        <div className="space-y-3">
          <Textarea
            placeholder={t('ai.textPromptPlaceholder')}
            value={textPrompt}
            onChange={(e) => setTextPrompt(e.target.value)}
            className="min-h-[120px] text-base resize-none"
          />

          {/* 예시 칩들 */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t('ai.tryExamples')}</p>
            <div className="flex flex-wrap gap-2">
              {examplePrompts.map((example, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => setTextPrompt(example.text)}
                >
                  {example.icon} {example.text}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 고급 설정 (접을 수 있음) */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              {t('ai.advancedSettings')}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          <div ref={advancedSectionRef} />
          {/* 품질 선택 */}
          <div className="space-y-2">
            <Label>{t('ai.quality')}</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={quality === "low" ? "default" : "outline"}
                size="sm"
                onClick={() => setQuality("low")}
              >
                {t('ai.qualityLow')}
              </Button>
              <Button
                variant={quality === "medium" ? "default" : "outline"}
                size="sm"
                onClick={() => setQuality("medium")}
              >
                {t('ai.qualityMedium')}
              </Button>
              <Button
                variant={quality === "high" ? "default" : "outline"}
                size="sm"
                onClick={() => setQuality("high")}
              >
                {t('ai.qualityHigh')}
              </Button>
            </div>
          </div>

          {/* 스타일 선택 */}
          <div className="space-y-2">
            <Label>{t('ai.style')}</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={style === "realistic" ? "default" : "outline"}
                size="sm"
                onClick={() => setStyle("realistic")}
              >
                {t('ai.styleRealistic')}
              </Button>
              <Button
                variant={style === "cartoon" ? "default" : "outline"}
                size="sm"
                onClick={() => setStyle("cartoon")}
              >
                {t('ai.styleCartoon')}
              </Button>
              <Button
                variant={style === "abstract" ? "default" : "outline"}
                size="sm"
                onClick={() => setStyle("abstract")}
              >
                {t('ai.styleAbstract')}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  // Step 3: 생성 중
  const renderGenerating = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <div className="relative">
        <Loader2 className="w-16 h-16 animate-spin text-primary" />
        <Sparkles className="w-6 h-6 text-primary absolute top-0 right-0 animate-pulse" />
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">{t('ai.generatingAI')}</h2>
        <p className="text-sm text-muted-foreground">{t('ai.generatingDesc')}</p>
      </div>

      <div className="w-full max-w-sm space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('ai.progressLabel')}</span>
          <span className="font-medium">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-center text-muted-foreground">
          {t('ai.estimatedTime')}: {Math.max(1, Math.ceil((100 - progress) / 25))}s
        </p>
      </div>
    </div>
  );

  // Step 4: 결과
  const renderResult = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-green-500/10 rounded-full">
          <Check className="w-5 h-5 text-green-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold">{t('ai.generationComplete')}</h2>
          <p className="text-xs text-muted-foreground">{t('ai.generationCompleteDesc')}</p>
        </div>
      </div>

      {/* 3D 뷰어 */}
      <Card>
        <CardContent className="p-0">
          <div className="rounded-lg overflow-hidden h-[40vh] relative bg-muted">
            <ModelViewer className="w-full h-full" />
          </div>
        </CardContent>
      </Card>

      {/* 액션 버튼들 */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-12">
          <Download className="w-4 h-4 mr-2" />
          {t('ai.download')}
        </Button>
        <Sheet>
          <SheetTrigger asChild>
            <Button className="h-12">
              <Printer className="w-4 h-4 mr-2" />
              {t('common.download')}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh]">
            <SheetHeader>
              <SheetTitle>{t('ai.selectPrinterTitle')}</SheetTitle>
              <SheetDescription>{t('ai.selectPrinterDesc')}</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-3">
              {connectedPrinters.map((printer) => (
                <Card
                  key={printer.id}
                  className="cursor-pointer hover:shadow-md transition"
                  onClick={() => {
                    toast({
                      title: t('ai.printStarted'),
                      description: `${printer.name}${t('ai.printStartedDesc')}`,
                    });
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">{printer.name}</p>
                      <Badge variant={printer.status === "ready" ? "secondary" : "default"}>
                        {printer.status === "ready" ? t('ai.printerReady') : t('ai.printerPrinting')}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex justify-between">
                      <span>{t('printer.nozzle')}: {printer.temperature.nozzle}°C</span>
                      <span>{t('printer.bed')}: {printer.temperature.bed}°C</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* 다시 만들기 */}
      <Button variant="ghost" className="w-full" onClick={resetFlow}>
        {t('ai.createAnother')}
      </Button>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* 상단 헤더 - 고정 */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-lg font-semibold">{t('ai.title')}</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
            <History className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 컨텐츠 영역 - 스크롤 가능 (하단 여백 제거) */}
      <div ref={contentScrollRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-0">
        {currentStep === "select-input" && renderSelectInput()}
        {currentStep === "create-prompt" && renderCreatePrompt()}
        {currentStep === "generate" && renderGenerating()}
        {currentStep === "result" && renderResult()}
      </div>

      {/* 고정된 하단 버튼 (프롬프트 작성 단계에서만) */}
      {currentStep === "create-prompt" && (
        <div className="flex-shrink-0 p-4 bg-background border-t" style={{ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 16px)` }}>
          <Button
            size="lg"
            className="w-full h-14 text-lg font-semibold"
            onClick={startGeneration}
            disabled={!textPrompt.trim() && uploadedFiles.length === 0}
          >
            <Sparkles className="w-5 h-5 mr-2" />
            {t('ai.generate')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default AI;
