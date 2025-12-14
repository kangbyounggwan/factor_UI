import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2, AlertCircle, Wrench, Send, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  getManufacturers,
  getSeriesByManufacturer,
  getModelsByManufacturerAndSeries,
  type ManufacturerOption,
  type SeriesOption,
  type ModelOption
} from "@shared/api/manufacturingPrinter";
import { supabase } from "@shared/integrations/supabase/client";
import { uploadTroubleshootingImage } from "@shared/services/supabaseService/aiStorage";
import { useAuth } from "@shared/contexts/AuthContext";

interface AITroubleshootingTabProps {
  isProcessing?: boolean;
}

export const AITroubleshootingTab = ({ isProcessing = false }: AITroubleshootingTabProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]); // Base64 preview용
  const [imageFiles, setImageFiles] = useState<File[]>([]); // 실제 파일 저장용

  // 분석 아카이브
  interface AnalysisArchive {
    id: string;
    description: string;
    images: string[];
    result: string;
    manufacturer?: string;
    series?: string;
    model?: string;
    timestamp: Date;
  }
  const [archives, setArchives] = useState<AnalysisArchive[]>([]);
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);

  // 프린터 제조사 선택
  const [selectedManufacturer, setSelectedManufacturer] = useState("");
  const [selectedSeries, setSelectedSeries] = useState("");
  const [selectedModel, setSelectedModel] = useState("");

  // DB에서 가져온 데이터
  const [manufacturers, setManufacturers] = useState<ManufacturerOption[]>([]);
  const [series, setSeries] = useState<SeriesOption[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);

  // 로딩 상태
  const [loadingManufacturers, setLoadingManufacturers] = useState(false);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  // 제조사 목록 가져오기
  useEffect(() => {
    const fetchManufacturers = async () => {
      setLoadingManufacturers(true);
      try {
        const data = await getManufacturers();
        setManufacturers(data);
      } catch (error) {
        console.error('Failed to fetch manufacturers:', error);
        toast({
          title: t('common.error'),
          description: '제조사 목록을 불러오는데 실패했습니다.',
          variant: 'destructive'
        });
      } finally {
        setLoadingManufacturers(false);
      }
    };

    fetchManufacturers();
  }, []);

  // 제조사가 변경되면 시리즈 목록 가져오기
  useEffect(() => {
    if (!selectedManufacturer) {
      setSeries([]);
      setSelectedSeries("");
      setModels([]);
      setSelectedModel("");
      return;
    }

    const fetchSeries = async () => {
      setLoadingSeries(true);
      try {
        const data = await getSeriesByManufacturer(selectedManufacturer);
        setSeries(data);
        setSelectedSeries("");
        setModels([]);
        setSelectedModel("");
      } catch (error) {
        console.error('Failed to fetch series:', error);
        toast({
          title: t('common.error'),
          description: '시리즈 목록을 불러오는데 실패했습니다.',
          variant: 'destructive'
        });
      } finally {
        setLoadingSeries(false);
      }
    };

    fetchSeries();
  }, [selectedManufacturer]);

  // 시리즈가 변경되면 모델 목록 가져오기
  useEffect(() => {
    if (!selectedManufacturer || !selectedSeries) {
      setModels([]);
      setSelectedModel("");
      return;
    }

    const fetchModels = async () => {
      setLoadingModels(true);
      try {
        const data = await getModelsByManufacturerAndSeries(selectedManufacturer, selectedSeries);
        setModels(data);
        setSelectedModel("");
      } catch (error) {
        console.error('Failed to fetch models:', error);
        toast({
          title: t('common.error'),
          description: '모델 목록을 불러오는데 실패했습니다.',
          variant: 'destructive'
        });
      } finally {
        setLoadingModels(false);
      }
    };

    fetchModels();
  }, [selectedManufacturer, selectedSeries]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const validFiles: File[] = [];
      Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) {
          toast({
            title: t('common.error'),
            description: t('profile.imageOnly'),
            variant: 'destructive'
          });
          return;
        }

        validFiles.push(file);

        // 미리보기용 Base64 생성
        const reader = new FileReader();
        reader.onload = (e) => {
          setUploadedImages(prev => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });

      // 실제 파일 저장
      setImageFiles(prev => [...prev, ...validFiles]);

      toast({
        title: t('ai.uploadSuccess'),
        description: t('ai.fileUploaded')
      });
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files) {
      const validFiles: File[] = [];
      Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
          validFiles.push(file);

          // 미리보기용 Base64 생성
          const reader = new FileReader();
          reader.onload = (e) => {
            setUploadedImages(prev => [...prev, e.target?.result as string]);
          };
          reader.readAsDataURL(file);
        }
      });

      // 실제 파일 저장
      setImageFiles(prev => [...prev, ...validFiles]);

      toast({
        title: t('ai.uploadSuccess'),
        description: t('ai.fileUploaded')
      });
    }
  };

  const handleAnalyzeSubmit = async () => {
    if (!messageInput.trim() && uploadedImages.length === 0) {
      toast({
        title: t('common.error'),
        description: '문제 설명 또는 이미지를 입력해주세요.',
        variant: 'destructive'
      });
      return;
    }

    if (!user) {
      toast({
        title: t('common.error'),
        description: '로그인이 필요합니다.',
        variant: 'destructive'
      });
      return;
    }

    // AI 분석 시작
    setAnalyzing(true);

    try {
      // 1. Supabase Storage에 이미지 업로드
      const uploadedImageUrls: string[] = [];
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        try {
          const { publicUrl } = await uploadTroubleshootingImage(
            supabase,
            user.id,
            file,
            file.name
          );
          uploadedImageUrls.push(publicUrl);
          console.log(`[Troubleshooting] Image ${i + 1} uploaded:`, publicUrl);
        } catch (error) {
          console.error(`[Troubleshooting] Failed to upload image ${i + 1}:`, error);
          toast({
            title: t('common.error'),
            description: `이미지 ${i + 1} 업로드 실패`,
            variant: 'destructive'
          });
        }
      }

      // 2. AI 분석 시뮬레이션 (TODO: 실제 AI API 호출로 교체)
      await new Promise(resolve => setTimeout(resolve, 2000));

      const result = `레이어 분리 현상이 감지되었습니다.\n\n**해결 방안:**\n1. 노즐 온도를 5-10°C 높여보세요\n2. 프린트 속도를 20-30% 줄여보세요\n3. 레이어 높이를 0.1-0.2mm로 조정해보세요`;

      // 3. 아카이브에 저장 (Supabase URL 사용)
      const newArchive: AnalysisArchive = {
        id: Date.now().toString(),
        description: messageInput,
        images: uploadedImageUrls, // Supabase Storage URL
        result: result,
        manufacturer: selectedManufacturer,
        series: selectedSeries,
        model: selectedModel,
        timestamp: new Date()
      };

      setArchives(prev => [newArchive, ...prev]);
      setAnalysisResult(result);
      setSelectedArchiveId(newArchive.id);

      // 4. 입력 초기화
      setMessageInput("");
      setUploadedImages([]);
      setImageFiles([]);

      toast({
        title: t('ai.analysisComplete'),
        description: t('ai.analysisResult')
      });
    } catch (error) {
      console.error('[Troubleshooting] Analysis failed:', error);
      toast({
        title: t('common.error'),
        description: '분석 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="flex h-full max-h-full overflow-hidden">
      {/* 왼쪽: 입력창 또는 아카이브 */}
      <div className="flex-1 flex flex-col border-r overflow-hidden">
        {archives.length === 0 || analyzing ? (
          // 입력 화면
          <div className="flex-1 flex flex-col">
            {/* 프린터 제조사 및 시리즈 선택 */}
            <div className="px-4 py-3 border-b bg-background/50">
              <Label className="text-sm font-medium mb-2 block">프린터 제조사 및 시리즈 선택</Label>
              <div className="grid grid-cols-3 gap-2">
                <Select value={selectedManufacturer} onValueChange={setSelectedManufacturer} disabled={loadingManufacturers}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={loadingManufacturers ? "로딩 중..." : t('ai.manufacturer')} />
                  </SelectTrigger>
                  <SelectContent>
                    {manufacturers.map((mfr) => (
                      <SelectItem key={mfr.manufacturer} value={mfr.manufacturer}>{mfr.manufacturer}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedSeries}
                  onValueChange={setSelectedSeries}
                  disabled={!selectedManufacturer || loadingSeries}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={loadingSeries ? "로딩 중..." : t('ai.series')} />
                  </SelectTrigger>
                  <SelectContent>
                    {series.map((s) => (
                      <SelectItem key={s.series} value={s.series}>{s.series}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedModel}
                  onValueChange={setSelectedModel}
                  disabled={!selectedSeries || loadingModels}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={loadingModels ? "로딩 중..." : t('ai.printerModel')} />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>{model.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ScrollArea className="flex-1 px-4">
              <div className="max-w-3xl mx-auto py-8">
                <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                  <Wrench className="w-16 h-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">AI 고장 해결 도우미</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    프린터 문제 사진을 업로드하거나 문제를 설명해주세요.<br />
                    AI가 원인을 분석하고 해결 방법을 제안해드립니다.
                  </p>
                </div>
              </div>
            </ScrollArea>

          {/* 하단: 메시지 입력바 */}
          <div
            className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="px-4 py-4">
              {/* 업로드된 이미지 미리보기 */}
              {uploadedImages.length > 0 && (
                <div className="flex gap-2 mb-3 flex-wrap">
                  {uploadedImages.map((img, index) => (
                    <div key={index} className="relative group w-20 h-20">
                      <img
                        src={img}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg border"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full shadow-lg"
                        onClick={() => removeImage(index)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 items-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0"
                  title="이미지 업로드"
                >
                  <Upload className="w-5 h-5" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <div className="flex-1 relative">
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="문제를 설명하거나 질문을 입력하세요..."
                    className="pr-12 rounded-3xl border-2 focus-visible:ring-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAnalyzeSubmit();
                      }
                    }}
                  />
                  <Button
                    onClick={handleAnalyzeSubmit}
                    disabled={(!messageInput.trim() && uploadedImages.length === 0) || analyzing}
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full h-8 w-8"
                  >
                    {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          </div>
        ) : (
          // 아카이브 리스트
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-3 border-b bg-background/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold">분석 기록</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedArchiveId(null);
                  setAnalysisResult(null);
                }}
              >
                새 분석
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {archives.map((archive) => (
                  <button
                    key={archive.id}
                    onClick={() => {
                      setSelectedArchiveId(archive.id);
                      setAnalysisResult(archive.result);
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedArchiveId === archive.id
                        ? 'bg-primary/10 border-primary'
                        : 'bg-background hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex gap-3">
                      {archive.images.length > 0 && (
                        <img
                          src={archive.images[0]}
                          alt="Thumbnail"
                          className="w-16 h-16 object-cover rounded flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2 mb-1">
                          {archive.description || '이미지 분석'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {archive.manufacturer && (
                            <span className="px-1.5 py-0.5 bg-muted rounded">
                              {archive.manufacturer}
                            </span>
                          )}
                          <span>
                            {archive.timestamp.toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* 오른쪽: LLM 분석 결과 */}
      <div className="w-[400px] flex flex-col bg-muted/30 overflow-hidden">
          <div className="px-4 py-3 border-b bg-background/50 flex-shrink-0">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              AI 분석 결과
            </h3>
          </div>
          <ScrollArea className="flex-1 p-4 overflow-auto">
            {analyzing ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">AI가 분석 중입니다...</p>
              </div>
            ) : analysisResult ? (
              <div className="space-y-4">
                <div className="bg-background rounded-lg p-4 border">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {analysisResult}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">문제를 설명하거나<br />사진을 업로드하면<br />AI가 분석을 시작합니다</p>
              </div>
            )}
          </ScrollArea>
        </div>
    </div>
  );
};
