import { useState, useRef, useEffect, useCallback } from "react";
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
import { Upload, Loader2, Wrench, Send, Trash2, Plus, MessageSquare, User, Bot } from "lucide-react";
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
import {
  createSession,
  listSessions,
  addMessage,
  getMessages,
  updateSession,
  generateSessionTitle,
  estimateTokens,
} from "@shared/services/supabaseService/troubleshooting";
import {
  postTroubleshootingDiagnose,
  filesToBase64,
  type TroubleshootingResponse,
} from "@shared/services/aiService";
import type {
  TroubleshootingSession,
  TroubleshootingMessage,
} from "@shared/types/troubleshootingTypes";

interface AITroubleshootingTabProps {
  isProcessing?: boolean;
}

export const AITroubleshootingTab = ({ isProcessing = false }: AITroubleshootingTabProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]); // Base64 preview용
  const [imageFiles, setImageFiles] = useState<File[]>([]); // 실제 파일 저장용

  // 세션 관리 (DB 연동)
  const [sessions, setSessions] = useState<TroubleshootingSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<TroubleshootingMessage[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // 프린터 제조사 선택
  const [selectedManufacturer, setSelectedManufacturer] = useState("");
  const [selectedSeries, setSelectedSeries] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedModelName, setSelectedModelName] = useState("");

  // DB에서 가져온 데이터
  const [manufacturers, setManufacturers] = useState<ManufacturerOption[]>([]);
  const [series, setSeries] = useState<SeriesOption[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);

  // 로딩 상태
  const [loadingManufacturers, setLoadingManufacturers] = useState(false);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  // 세션 목록 로드
  const loadSessions = useCallback(async () => {
    if (!user?.id) return;

    setLoadingSessions(true);
    try {
      const data = await listSessions(supabase, user.id, { limit: 50 });
      setSessions(data);
    } catch (error) {
      console.error('[Troubleshooting] Failed to load sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  }, [user?.id]);

  // 초기 로드
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 채팅 스크롤 자동 이동
  useEffect(() => {
    if (chatScrollRef.current) {
      const scrollArea = chatScrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }
    }
  }, [currentMessages, analyzing]);

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
      setSelectedModelName("");
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
        setSelectedModelName("");
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
      setSelectedModelName("");
      return;
    }

    const fetchModels = async () => {
      setLoadingModels(true);
      try {
        const data = await getModelsByManufacturerAndSeries(selectedManufacturer, selectedSeries);
        setModels(data);
        setSelectedModel("");
        setSelectedModelName("");
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

  // 모델 선택 시 이름도 저장
  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    const model = models.find(m => m.id === modelId);
    setSelectedModelName(model?.display_name || "");
  };

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

  // 새 세션 시작
  const startNewSession = () => {
    setCurrentSessionId(null);
    setCurrentMessages([]);
    setMessageInput("");
    setUploadedImages([]);
    setImageFiles([]);
  };

  // 세션 선택
  const selectSession = async (session: TroubleshootingSession) => {
    setCurrentSessionId(session.id);
    setSelectedManufacturer(session.printer_manufacturer || "");
    setSelectedSeries(session.printer_series || "");
    setSelectedModel(session.printer_model_id || "");
    setSelectedModelName(session.printer_model_name || "");

    // 메시지 로드
    try {
      const messages = await getMessages(supabase, session.id);
      setCurrentMessages(messages);
    } catch (error) {
      console.error('[Troubleshooting] Failed to load messages:', error);
      toast({
        title: t('common.error'),
        description: '메시지를 불러오는데 실패했습니다.',
        variant: 'destructive'
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

    // NOTE: 비로그인 사용자도 분석은 가능 (anonymous_id로 추적)
    // 세션/메시지 DB 저장은 로그인 사용자만 가능

    // 입력 저장 후 초기화
    const currentInput = messageInput;
    const currentImages = [...imageFiles];
    const currentImagePreviews = [...uploadedImages];
    setMessageInput("");
    setUploadedImages([]);
    setImageFiles([]);

    // AI 분석 시작
    setAnalyzing(true);

    try {
      let sessionId = currentSessionId;

      // 로그인 사용자만 세션/DB 저장
      if (user?.id) {
        // 1. 세션이 없으면 새로 생성
        if (!sessionId) {
          const newSession = await createSession(supabase, user.id, {
            title: generateSessionTitle(currentInput),
            printer_manufacturer: selectedManufacturer || undefined,
            printer_series: selectedSeries || undefined,
            printer_model_id: selectedModel || undefined,
            printer_model_name: selectedModelName || undefined,
          });
          sessionId = newSession.id;
          setCurrentSessionId(sessionId);
          setSessions(prev => [newSession, ...prev]);
        }

        // 2. Supabase Storage에 이미지 업로드
        const uploadedImageUrls: string[] = [];
        for (let i = 0; i < currentImages.length; i++) {
          const file = currentImages[i];
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
          }
        }

        // 3. 사용자 메시지 DB에 저장
        const userMessage = await addMessage(supabase, {
          session_id: sessionId,
          role: 'user',
          content: currentInput,
          token_count: estimateTokens(currentInput),
          has_images: currentImagePreviews.length > 0,
          image_urls: uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined,
        });

        // UI에 사용자 메시지 표시 (Base64 이미지 사용)
        const userMessageForUI: TroubleshootingMessage = {
          ...userMessage,
          image_urls: currentImagePreviews, // Base64로 표시
        };
        setCurrentMessages(prev => [...prev, userMessageForUI]);
      } else {
        // 비로그인 사용자: UI에만 메시지 표시 (임시 메시지)
        const tempUserMessage: TroubleshootingMessage = {
          id: `temp-user-${Date.now()}`,
          session_id: 'temp',
          role: 'user',
          content: currentInput,
          token_count: estimateTokens(currentInput),
          has_images: currentImagePreviews.length > 0,
          image_urls: currentImagePreviews,
          image_analysis: null,
          importance_score: 0.5,
          is_key_message: false,
          metadata: {},
          created_at: new Date().toISOString(),
        };
        setCurrentMessages(prev => [...prev, tempUserMessage]);
      }

      // 4. AI 분석 - Python 서버 API 호출
      let aiResponse: string;

      try {
        // 이미지 파일들을 Base64로 변환
        const base64Images = currentImages.length > 0
          ? await filesToBase64(currentImages)
          : undefined;

        // AI 서버에 진단 요청
        const diagnosisResult: TroubleshootingResponse = await postTroubleshootingDiagnose({
          manufacturer: selectedManufacturer || undefined,
          series: selectedSeries || undefined,
          model: selectedModelName || undefined,
          symptom_text: currentInput,
          images: base64Images,
          language: 'ko',
          session_id: sessionId,
        });

        if (diagnosisResult.status === 'error') {
          throw new Error(diagnosisResult.error || diagnosisResult.message || '분석에 실패했습니다.');
        }

        // AI 응답 포맷팅
        const data = diagnosisResult.data;
        if (data) {
          aiResponse = data.diagnosis || '';

          // 감지된 문제가 있으면 추가
          if (data.detected_issues && data.detected_issues.length > 0) {
            aiResponse += `\n\n**감지된 문제:**\n${data.detected_issues.map(issue => `• ${issue}`).join('\n')}`;
          }

          // 가능한 원인이 있으면 추가
          if (data.possible_causes && data.possible_causes.length > 0) {
            aiResponse += `\n\n**가능한 원인:**\n${data.possible_causes.map((cause, i) => `${i + 1}. ${cause}`).join('\n')}`;
          }

          // 해결 방안이 있으면 추가
          if (data.solutions && data.solutions.length > 0) {
            aiResponse += `\n\n**해결 방안:**\n${data.solutions.map((sol, i) => `${i + 1}. ${sol}`).join('\n')}`;
          }

          // 이미지 분석 결과가 있으면 추가
          if (data.image_analysis) {
            aiResponse = `**이미지 분석:**\n${data.image_analysis}\n\n${aiResponse}`;
          }

          // 추가 질문 유도
          aiResponse += '\n\n추가 질문이 있으시면 말씀해주세요.';
        } else {
          aiResponse = '분석 결과를 받지 못했습니다. 다시 시도해주세요.';
        }
      } catch (apiError) {
        console.error('[Troubleshooting] AI API error:', apiError);
        // API 실패 시 에러 메시지
        aiResponse = `죄송합니다. AI 분석 중 오류가 발생했습니다.\n\n**오류 내용:** ${apiError instanceof Error ? apiError.message : '알 수 없는 오류'}\n\n잠시 후 다시 시도해주세요.`;
      }

      // 5. AI 응답 처리 (로그인 사용자만 DB 저장)
      if (user?.id && sessionId) {
        // 로그인 사용자: DB에 저장
        const assistantMessage = await addMessage(supabase, {
          session_id: sessionId,
          role: 'assistant',
          content: aiResponse,
          token_count: estimateTokens(aiResponse),
          importance_score: 0.7, // AI 응답은 기본적으로 중요
        });
        setCurrentMessages(prev => [...prev, assistantMessage]);

        // 세션 목록 새로고침
        await loadSessions();
      } else {
        // 비로그인 사용자: UI에만 표시 (임시 메시지)
        const tempAssistantMessage: TroubleshootingMessage = {
          id: `temp-ai-${Date.now()}`,
          session_id: 'temp',
          role: 'assistant',
          content: aiResponse,
          token_count: estimateTokens(aiResponse),
          has_images: false,
          image_urls: null,
          image_analysis: null,
          importance_score: 0.7,
          is_key_message: false,
          metadata: {},
          created_at: new Date().toISOString(),
        };
        setCurrentMessages(prev => [...prev, tempAssistantMessage]);
      }

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
    <div className="flex h-full max-h-full overflow-hidden bg-background">
      {/* 왼쪽: 아카이브 사이드바 */}
      <div className="w-[280px] flex flex-col border-r-2 border-border bg-card">
        <div className="p-3 border-b-2 border-border bg-card">
          <Button
            onClick={startNewSession}
            className="w-full gap-2 font-medium"
            variant="default"
          >
            <Plus className="w-4 h-4" />
            새 대화
          </Button>
        </div>

        <ScrollArea className="flex-1 bg-card">
          <div className="p-2 space-y-1">
            {loadingSessions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <MessageSquare className="w-8 h-8 mb-2" />
                <p className="text-sm">대화 기록이 없습니다</p>
              </div>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => selectSession(session)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    currentSessionId === session.id
                      ? 'bg-primary/15 border-2 border-primary shadow-sm'
                      : 'hover:bg-accent border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      currentSessionId === session.id ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-foreground">
                        {session.title || '새 대화'}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {session.printer_manufacturer && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium">
                            {session.printer_manufacturer}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {new Date(session.updated_at).toLocaleDateString('ko-KR')}
                        </span>
                        {session.message_count > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {session.message_count}개 메시지
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* 오른쪽: 채팅 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* 프린터 제조사 및 시리즈 선택 */}
        <div className="px-4 py-3 border-b-2 border-border bg-card flex-shrink-0">
          <Label className="text-sm font-semibold mb-2 block text-foreground">프린터 제조사 및 시리즈 선택</Label>
          <div className="grid grid-cols-3 gap-3">
            <Select value={selectedManufacturer} onValueChange={setSelectedManufacturer} disabled={loadingManufacturers}>
              <SelectTrigger className="h-9 text-sm border-2 font-medium">
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
              <SelectTrigger className="h-9 text-sm border-2 font-medium">
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
              onValueChange={handleModelChange}
              disabled={!selectedSeries || loadingModels}
            >
              <SelectTrigger className="h-9 text-sm border-2 font-medium">
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

        {/* 채팅 메시지 영역 */}
        <ScrollArea className="flex-1 bg-background" ref={chatScrollRef}>
          <div className="p-6 space-y-6">
            {currentMessages.length === 0 ? (
              // 빈 상태 - 환영 메시지
              <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Wrench className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-foreground">무엇을 도와드릴까요?</h3>
                <p className="text-sm text-muted-foreground max-w-lg leading-relaxed mb-8">
                  프린터에서 발생한 문제를 사진으로 보여주시거나 설명해주세요.<br />
                  FACTOR AI가 빠르게 원인을 찾고 해결 방법을 안내해드립니다.
                </p>

                {/* 기능 소개 카드 */}
                <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
                  <div className="bg-card border-2 border-border rounded-xl p-4 text-left">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center mb-2">
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-foreground mb-1">제조사별 공식 가이드</p>
                    <p className="text-[11px] text-muted-foreground">각 브랜드의 공식 매뉴얼과 위키를 참고합니다</p>
                  </div>

                  <div className="bg-card border-2 border-border rounded-xl p-4 text-left">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center mb-2">
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-foreground mb-1">실시간 정보 검색</p>
                    <p className="text-[11px] text-muted-foreground">최신 커뮤니티 해결책을 찾아드립니다</p>
                  </div>

                  <div className="bg-card border-2 border-border rounded-xl p-4 text-left">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mb-2">
                      <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-foreground mb-1">학습된 전문 분석</p>
                    <p className="text-[11px] text-muted-foreground">수많은 해결 사례로 훈련된 AI입니다</p>
                  </div>

                  <div className="bg-card border-2 border-border rounded-xl p-4 text-left">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center mb-2">
                      <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-foreground mb-1">이미지 분석</p>
                    <p className="text-[11px] text-muted-foreground">사진만으로 문제를 정확히 파악합니다</p>
                  </div>
                </div>
              </div>
            ) : (
              // 채팅 메시지 표시
              currentMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-10 h-10 rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-primary" />
                    </div>
                  )}

                  <div
                    className={`max-w-[70%] rounded-2xl p-4 shadow-sm ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card border-2 border-border'
                    }`}
                  >
                    {/* 이미지 표시 */}
                    {message.has_images && message.image_urls && message.image_urls.length > 0 && (
                      <div className="flex gap-2 mb-3 flex-wrap">
                        {message.image_urls.map((img, idx) => (
                          <img
                            key={idx}
                            src={img}
                            alt={`Uploaded ${idx + 1}`}
                            className="w-36 h-36 object-cover rounded-xl border-2 border-border"
                          />
                        ))}
                      </div>
                    )}

                    {/* 메시지 내용 */}
                    {message.content && (
                      <div className="whitespace-pre-wrap text-sm leading-relaxed font-medium">
                        {message.content}
                      </div>
                    )}

                    {/* 시간 표시 */}
                    <div className={`text-[11px] mt-2 font-medium ${
                      message.role === 'user' ? 'text-primary-foreground/80' : 'text-muted-foreground'
                    }`}>
                      {new Date(message.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {message.role === 'user' && (
                    <div className="w-10 h-10 rounded-full bg-primary border-2 border-primary flex items-center justify-center flex-shrink-0 shadow-sm">
                      <User className="w-5 h-5 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))
            )}

            {/* 로딩 표시 */}
            {analyzing && (
              <div className="flex gap-3 justify-start">
                <div className="w-10 h-10 rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div className="bg-card border-2 border-border rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-sm font-medium text-foreground">AI가 분석 중입니다...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* 하단: 메시지 입력바 */}
        <div
          className="border-t-2 border-border bg-card flex-shrink-0 shadow-lg"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="px-4 py-4">
            {/* 업로드된 이미지 미리보기 */}
            {uploadedImages.length > 0 && (
              <div className="flex gap-3 mb-4 flex-wrap">
                {uploadedImages.map((img, index) => (
                  <div key={index} className="relative group w-24 h-24">
                    <img
                      src={img}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-full object-cover rounded-xl border-2 border-border shadow-sm"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 w-7 h-7 rounded-full shadow-lg"
                      onClick={() => removeImage(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 items-end">
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 h-11 w-11 border-2"
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
                  className="pr-14 h-11 rounded-full border-2 focus-visible:ring-2 text-sm font-medium"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAnalyzeSubmit();
                    }
                  }}
                  disabled={analyzing}
                />
                <Button
                  onClick={handleAnalyzeSubmit}
                  disabled={(!messageInput.trim() && uploadedImages.length === 0) || analyzing}
                  size="icon"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full h-8 w-8 shadow-sm"
                >
                  {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
