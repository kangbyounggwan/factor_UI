/**
 * CreatePost Page
 * 게시물 작성 페이지 - 네이버 카페 스타일 웹 게시판 형태
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@shared/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebarState } from "@/hooks/useSidebarState";
import { cn } from "@/lib/utils";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  ImagePlus,
  X,
  ChevronDown,
  AlertTriangle,
  Wrench,
  Thermometer,
  Box,
  ArrowLeft,
  Check,
  FileCode,
} from "lucide-react";

// Layout Components
import { AppHeader } from "@/components/common/AppHeader";
import { AppSidebar } from "@/components/common/AppSidebar";
import { SharedBottomNavigation } from "@/components/shared/SharedBottomNavigation";
import { LoginPromptModal } from "@/components/auth/LoginPromptModal";

// Community Components
import { RichTextEditor } from "@/components/community/RichTextEditor";

// Services
import {
  createPost,
  uploadPostImage,
  type PostCategory,
  type CreatePostInput,
  type TroubleshootingMeta,
  SYMPTOM_TAGS,
} from "@shared/services/supabaseService/community";
import { listAIModels } from "@shared/services/supabaseService/aiModel";
import { supabase } from "@shared/integrations/supabase/client";
import type { AIGeneratedModel } from "@shared/types/aiModelType";
import { createCommunitySegments, type GCodeAnalysisResponse } from "@/lib/api/gcode";
import { saveCommunitySegmentData, linkSegmentsToPost } from "@/lib/gcodeSegmentService";

// Constants (공용 상수)
import {
  getCategoryOptions,
  FIRMWARE_OPTIONS,
  FILAMENT_OPTIONS,
  SLICER_OPTIONS,
} from "@shared/constants/community";

// 글 작성용 카테고리 옵션 (all 제외)
const CATEGORIES = getCategoryOptions(false);

// 증상 태그 한글 매핑
const SYMPTOM_LABELS: Record<string, string> = {
  stringing: '스트링잉',
  layer_shift: '레이어 밀림',
  warping: '뒤틀림/휨',
  bed_adhesion: '베드 접착 불량',
  under_extrusion: '압출 부족',
  over_extrusion: '과압출',
  z_banding: 'Z 밴딩',
  ghosting: '고스팅/울림',
  elephant_foot: '코끼리발',
  bridging: '브릿징 불량',
  support_issues: '서포트 문제',
  first_layer: '첫층 문제',
  clogging: '막힘/클로깅',
  heat_creep: '히트 크립',
  wet_filament: '습한 필라멘트',
  layer_separation: '레이어 분리',
  blobs: '블롭/덩어리',
  zits: '지트/돌기',
  gaps: '갭/빈틈',
  infill_issues: '인필 문제',
};

export default function CreatePost() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 사이드바 상태 (localStorage 연동)
  const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebarState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 폼 상태
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<PostCategory>('free');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  // G-code 파일 정보 (세그먼트 ID로 DB 저장)
  const [gcodeFiles, setGcodeFiles] = useState<{
    gcodeEmbedId: string;  // 게시물 내 G-code 고유 ID
    segmentId: string;     // gcode_segment_data 테이블의 ID
    url: string;
    filename: string;
    isLoading?: boolean;   // 업로드/처리 중 여부
  }[]>([]);
  // 에디터에서 업로드한 3D 파일 정보
  const [uploaded3DFiles, setUploaded3DFiles] = useState<{
    url: string;
    filename: string;
    filetype: string;
    isLoading?: boolean;   // 업로드 중 여부
  }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 작성자 표시 방식: 'nickname' | 'realname' | 'anonymous'
  const [authorDisplayType, setAuthorDisplayType] = useState<'nickname' | 'realname' | 'anonymous'>('nickname');

  // 트러블슈팅 메타데이터 상태
  const [troubleshootingMeta, setTroubleshootingMeta] = useState<TroubleshootingMeta>({});
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);

  // 모델 선택 상태
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [userModels, setUserModels] = useState<AIGeneratedModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);

  // 섹션 열림 상태
  const [printerSectionOpen, setPrinterSectionOpen] = useState(true);
  const [filamentSectionOpen, setFilamentSectionOpen] = useState(true);
  const [slicerSectionOpen, setSlicerSectionOpen] = useState(false);
  const [symptomSectionOpen, setSymptomSectionOpen] = useState(true);
  const [showTroubleshootingPanel, setShowTroubleshootingPanel] = useState(false);

  // 트러블슈팅 폼 표시 여부
  const showTroubleshootingForm = category === 'troubleshooting' || category === 'question';

  // 사용자 모델 목록 로드
  useEffect(() => {
    const loadUserModels = async () => {
      if (!user) return;
      setLoadingModels(true);
      try {
        const result = await listAIModels(supabase, user.id, { pageSize: 50 });
        setUserModels(result.items);
      } catch (error) {
        console.error('[CreatePost] Error loading models:', error);
      } finally {
        setLoadingModels(false);
      }
    };
    loadUserModels();
  }, [user]);

  // 선택된 모델 정보
  const selectedModel = userModels.find(m => m.id === selectedModelId);

  // 태그 추가
  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  // 태그 입력 키 핸들러
  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  // 태그 삭제
  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  // 증상 태그 토글
  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(symptom)
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  // 에디터용 이미지 업로드 (첨부 목록에도 추가)
  const handleEditorImageUpload = useCallback(async (file: File): Promise<string | null> => {
    if (!user) return null;
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t('community.error.imageTooLarge', '이미지가 너무 큽니다 (최대 5MB)'),
        variant: 'destructive',
      });
      return null;
    }
    const url = await uploadPostImage(user.id, file);
    if (url) {
      // 첨부 이미지 목록에도 추가 (최대 5개까지)
      setImages(prev => prev.length < 10 ? [...prev, url] : prev);
    }
    return url;
  }, [user, toast, t]);

  // 에디터용 3D 파일 업로드
  const handleEditor3DUpload = useCallback(async (file: File): Promise<string | null> => {
    if (!user) return null;
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: t('community.error.fileTooLarge', '파일이 너무 큽니다 (최대 50MB)'),
        variant: 'destructive',
      });
      return null;
    }

    // 파일 확장자 추출
    const ext = file.name.split('.').pop()?.toLowerCase() || 'stl';
    // 임시 ID 생성 (로딩 상태 추적용)
    const tempId = `temp_3d_${Date.now()}`;

    // 1. 먼저 로딩 카드 추가 (최대 1개)
    setUploaded3DFiles(prev => {
      if (prev.length >= 1) return prev;
      return [...prev, { url: tempId, filename: file.name, filetype: ext, isLoading: true }];
    });

    // 2. 실제 업로드 수행
    // TODO: 3D 파일 업로드 서비스 구현 필요
    // 임시로 이미지 업로드 서비스 사용 (실제로는 별도 버킷 필요)
    const url = await uploadPostImage(user.id, file);

    if (url) {
      // 3. 업로드 완료 - 로딩 상태 해제 및 URL 업데이트
      setUploaded3DFiles(prev =>
        prev.map(f => f.url === tempId ? { ...f, url, isLoading: false } : f)
      );
    } else {
      // 업로드 실패 - 로딩 카드 제거
      setUploaded3DFiles(prev => prev.filter(f => f.url !== tempId));
    }

    return url;
  }, [user, toast, t]);

  // 에디터용 GCode 파일 업로드 (세그먼트를 gcode_segment_data 테이블에 저장)
  const handleEditorGCodeUpload = useCallback(async (file: File): Promise<{ url: string; id: string } | null> => {
    if (!user) return null;
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: t('community.error.fileTooLarge', '파일이 너무 큽니다 (최대 100MB)'),
        variant: 'destructive',
      });
      return null;
    }

    // 고유 ID 생성 (타임스탬프 + 랜덤)
    const gcodeEmbedId = `gcode_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // 1. 먼저 로딩 카드 추가 (최대 5개까지)
    setGcodeFiles(prev => {
      if (prev.length >= 5) return prev;
      return [...prev, { gcodeEmbedId, segmentId: '', url: '', filename: file.name, isLoading: true }];
    });

    // 2. G-code 파일 내용 읽기
    const gcodeContent = await file.text();

    // 3. 파일 업로드
    const url = await uploadPostImage(user.id, file);
    if (!url) {
      // 업로드 실패 - 로딩 카드 제거
      setGcodeFiles(prev => prev.filter(f => f.gcodeEmbedId !== gcodeEmbedId));
      return null;
    }

    // 4. 세그먼트 생성 API 호출 (gcode_content 사용)
    let segmentId: string | null = null;
    try {
      const segmentResponse = await createCommunitySegments({
        gcode_content: gcodeContent,
        filename: file.name,
      });

      if (segmentResponse.success && segmentResponse.segments) {
        console.log('[CreatePost] Segments created, layer count:', segmentResponse.layer_count);

        // 5. gcode_segment_data 테이블에 저장 (기존 저장 방식 사용)
        const saveResult = await saveCommunitySegmentData({
          userId: user.id,
          gcodeEmbedId,
          segmentResponse: segmentResponse as GCodeAnalysisResponse,
        });

        if (saveResult.segmentId) {
          segmentId = saveResult.segmentId;
          console.log('[CreatePost] Segment saved to DB:', segmentId);
        }
      }
    } catch (err) {
      // 세그먼트 생성/저장 실패해도 게시물 작성은 계속 진행
      console.warn('[CreatePost] Segment creation/save failed:', err);
    }

    // 6. 로딩 카드 업데이트 (URL, segmentId 설정, 로딩 해제)
    if (segmentId) {
      setGcodeFiles(prev =>
        prev.map(f => f.gcodeEmbedId === gcodeEmbedId
          ? { ...f, segmentId, url, isLoading: false }
          : f
        )
      );
    } else {
      // segmentId가 없으면 카드 제거 (세그먼트 생성 실패)
      setGcodeFiles(prev => prev.filter(f => f.gcodeEmbedId !== gcodeEmbedId));
    }

    return { url, id: gcodeEmbedId };
  }, [user, toast, t]);

  // 첨부 이미지 업로드
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (images.length >= 10) break;

        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: t('community.error.imageTooLarge', '이미지가 너무 큽니다 (최대 5MB)'),
            variant: 'destructive',
          });
          continue;
        }

        const url = await uploadPostImage(user.id, file);
        if (url) {
          setImages(prev => [...prev, url]);
        }
      }
    } catch (error) {
      console.error('[CreatePost] Error uploading image:', error);
      toast({
        title: t('community.error.uploadFailed', '이미지 업로드 실패'),
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 이미지 삭제
  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  // 유효성 검사
  const validateForm = (): boolean => {
    // 파일 업로드 중인지 확인
    const isFileUploading = gcodeFiles.some(f => f.isLoading) || uploaded3DFiles.some(f => f.isLoading);
    if (isFileUploading) {
      toast({
        title: t('community.error.fileUploading', '파일 업로드 중입니다. 잠시 후 다시 시도해주세요.'),
        variant: 'destructive',
      });
      return false;
    }

    if (!title.trim()) {
      toast({
        title: t('community.error.titleRequired', '제목을 입력해주세요'),
        variant: 'destructive',
      });
      return false;
    }

    // HTML 태그 제거 후 내용 체크
    const textContent = content.replace(/<[^>]*>/g, '').trim();
    if (!textContent) {
      toast({
        title: t('community.error.contentRequired', '내용을 입력해주세요'),
        variant: 'destructive',
      });
      return false;
    }

    // 트러블슈팅 카테고리 필수 입력 검사
    if (category === 'troubleshooting') {
      if (!troubleshootingMeta.printer_model) {
        toast({
          title: t('community.error.printerRequired', '프린터 모델을 입력해주세요'),
          variant: 'destructive',
        });
        return false;
      }
      if (!troubleshootingMeta.filament_type) {
        toast({
          title: t('community.error.filamentRequired', '필라멘트 종류를 선택해주세요'),
          variant: 'destructive',
        });
        return false;
      }
      if (selectedSymptoms.length === 0) {
        toast({
          title: t('community.error.symptomRequired', '증상을 하나 이상 선택해주세요'),
          variant: 'destructive',
        });
        return false;
      }
    }

    return true;
  };

  // 게시물 제출
  const handleSubmit = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      // 트러블슈팅 메타데이터 구성
      const finalMeta: TroubleshootingMeta | undefined = showTroubleshootingForm
        ? {
            ...troubleshootingMeta,
            symptom_tags: selectedSymptoms.length > 0 ? selectedSymptoms : undefined,
          }
        : undefined;

      const input: CreatePostInput = {
        title: title.trim(),
        content: content,
        category,
        tags: tags.length > 0 ? tags : undefined,
        images: images.length > 0 ? images : undefined,
        model_id: selectedModelId || undefined,
        // gcode_files는 더 이상 community_posts에 저장하지 않음
        // 대신 gcode_segment_data 테이블 사용
        troubleshooting_meta: finalMeta,
      };

      const post = await createPost(user.id, input);

      if (post) {
        // 게시물 생성 후 세그먼트 데이터에 post_id 연결
        if (gcodeFiles.length > 0) {
          const segmentIds = gcodeFiles.map(f => f.segmentId);
          await linkSegmentsToPost(segmentIds, post.id);
          console.log('[CreatePost] Linked segments to post:', post.id);
        }

        toast({
          title: t('community.postCreated', '게시물이 작성되었습니다'),
        });
        navigate(`/community/${post.id}`);
      } else {
        throw new Error('Failed to create post');
      }
    } catch (error) {
      console.error('[CreatePost] Error creating post:', error);
      toast({
        title: t('community.error.createFailed', '게시물 작성 실패'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 메타데이터 업데이트 헬퍼
  const updateMeta = (key: keyof TroubleshootingMeta, value: string | boolean | undefined) => {
    setTroubleshootingMeta(prev => ({ ...prev, [key]: value }));
  };

  // 뒤로가기
  const handleBack = () => {
    navigate('/community');
  };

  return (
    <div className={cn("h-screen bg-background flex", isMobile && "pb-16")}>
      {/* 사이드바 (데스크탑) */}
      {!isMobile && (
        <AppSidebar
          mode="community"
          isOpen={sidebarOpen}
          onToggle={toggleSidebar}
          user={user}
          onLoginClick={() => setShowLoginModal(true)}
        />
      )}

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 헤더 */}
        <AppHeader
          sidebarOpen={sidebarOpen}
          onLoginRequired={() => setShowLoginModal(true)}
        />

        {/* 상단 네비게이션 바 */}
        <div className="border-b bg-background px-4 py-2 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t('community.backToList', '목록으로')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || uploading}
            className="px-6"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('community.submit', '등록')}
          </Button>
        </div>

        {/* 글쓰기 영역 */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto py-4">
            {/* 글쓰기 폼 */}
            <div className="bg-background border rounded-lg">
              {/* 카테고리 & 제목 헤더 */}
              <div className="border-b">
                {/* 카테고리 선택 + 작성자 정보 */}
                <div className="flex items-center border-b">
                  <div className="w-24 sm:w-32 px-4 py-3 bg-muted/50 text-sm font-medium shrink-0">
                    {t('community.form.category', '카테고리')}
                  </div>
                  <div className="flex-1 px-4 py-2">
                    <Select value={category} onValueChange={(v) => setCategory(v as PostCategory)}>
                      <SelectTrigger className="w-full sm:w-64 border-0 shadow-none focus:ring-0 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            <div className="flex items-center gap-2">
                              <span>{cat.icon}</span>
                              <span>{t(`community.category.${cat.value}`, cat.label)}</span>
                              <span className="text-xs text-muted-foreground">- {cat.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* 작성자 정보 */}
                  <div className="hidden sm:flex items-center gap-3 px-4 py-2 border-l bg-muted/30">
                    <div className="flex items-center gap-2">
                      {authorDisplayType !== 'anonymous' && user?.user_metadata?.avatar_url ? (
                        <img
                          src={user.user_metadata.avatar_url}
                          alt=""
                          className="w-6 h-6 rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs text-primary-foreground">
                          {authorDisplayType === 'anonymous'
                            ? '?'
                            : (user?.user_metadata?.full_name || user?.email || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-medium">
                        {authorDisplayType === 'anonymous'
                          ? t('common.anonymous', '익명')
                          : authorDisplayType === 'realname'
                            ? (user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('common.anonymous', '익명'))
                            : (user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('common.anonymous', '익명'))
                        }
                      </span>
                    </div>
                    <Select value={authorDisplayType} onValueChange={(v) => setAuthorDisplayType(v as 'nickname' | 'realname' | 'anonymous')}>
                      <SelectTrigger className="w-24 h-7 text-xs border-0 shadow-none bg-background/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nickname">
                          <span className="text-xs">{t('community.form.authorNickname', '닉네임')}</span>
                        </SelectItem>
                        <SelectItem value="realname">
                          <span className="text-xs">{t('community.form.authorRealname', '실명')}</span>
                        </SelectItem>
                        <SelectItem value="anonymous">
                          <span className="text-xs">{t('community.form.authorAnonymous', '익명')}</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 제목 입력 */}
                <div className="flex items-center">
                  <div className="w-24 sm:w-32 px-4 py-3 bg-muted/50 text-sm font-medium shrink-0">
                    {t('community.form.title', '제목')} <span className="text-destructive">*</span>
                  </div>
                  <div className="flex-1 px-4 py-2">
                    <Input
                      placeholder={t('community.form.titlePlaceholder', '제목을 입력하세요')}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={100}
                      className="border-0 shadow-none focus-visible:ring-0 text-base h-10"
                    />
                  </div>
                </div>
              </div>

              {/* 트러블슈팅 정보 패널 (접을 수 있음) */}
              {showTroubleshootingForm && (
                <Collapsible open={showTroubleshootingPanel} onOpenChange={setShowTroubleshootingPanel}>
                  <CollapsibleTrigger className="w-full border-b px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="font-medium">
                        {category === 'troubleshooting'
                          ? '트러블슈팅 정보 (필수)'
                          : '출력 환경 정보 (선택)'}
                      </span>
                      {category === 'troubleshooting' && (
                        <Badge variant="destructive" className="text-xs">필수</Badge>
                      )}
                    </div>
                    <ChevronDown className={cn(
                      "w-4 h-4 transition-transform",
                      showTroubleshootingPanel && "rotate-180"
                    )} />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 py-4 bg-muted/20 border-b space-y-4">
                      {/* 프린터 정보 */}
                      <Collapsible open={printerSectionOpen} onOpenChange={setPrinterSectionOpen}>
                        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium w-full">
                          <Box className="w-4 h-4" />
                          프린터 정보
                          {category === 'troubleshooting' && <span className="text-destructive">*</span>}
                          <ChevronDown className={cn("w-3 h-3 ml-auto transition-transform", printerSectionOpen && "rotate-180")} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                              <Label className="text-xs text-muted-foreground">프린터 모델</Label>
                              <Input
                                placeholder="예: Ender 3 V2"
                                value={troubleshootingMeta.printer_model || ''}
                                onChange={(e) => updateMeta('printer_model', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">펌웨어</Label>
                              <Select value={troubleshootingMeta.firmware || ''} onValueChange={(v) => updateMeta('firmware', v)}>
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue placeholder="선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  {FIRMWARE_OPTIONS.map(opt => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">노즐 크기</Label>
                              <Input
                                placeholder="예: 0.4mm"
                                value={troubleshootingMeta.nozzle_size || ''}
                                onChange={(e) => updateMeta('nozzle_size', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">베드 타입</Label>
                              <Input
                                placeholder="예: PEI"
                                value={troubleshootingMeta.bed_type || ''}
                                onChange={(e) => updateMeta('bed_type', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                      <Separator />

                      {/* 필라멘트 정보 */}
                      <Collapsible open={filamentSectionOpen} onOpenChange={setFilamentSectionOpen}>
                        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium w-full">
                          <Thermometer className="w-4 h-4" />
                          필라멘트 정보
                          {category === 'troubleshooting' && <span className="text-destructive">*</span>}
                          <ChevronDown className={cn("w-3 h-3 ml-auto transition-transform", filamentSectionOpen && "rotate-180")} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                              <Label className="text-xs text-muted-foreground">필라멘트 종류</Label>
                              <Select value={troubleshootingMeta.filament_type || ''} onValueChange={(v) => updateMeta('filament_type', v)}>
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue placeholder="선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  {FILAMENT_OPTIONS.map(opt => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">브랜드</Label>
                              <Input
                                placeholder="예: eSUN"
                                value={troubleshootingMeta.filament_brand || ''}
                                onChange={(e) => updateMeta('filament_brand', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="col-span-2 flex items-center gap-2 pt-5">
                              <Checkbox
                                id="filament_dried"
                                checked={troubleshootingMeta.filament_dried || false}
                                onCheckedChange={(checked) => updateMeta('filament_dried', checked as boolean)}
                              />
                              <Label htmlFor="filament_dried" className="text-sm cursor-pointer">
                                필라멘트 건조함
                              </Label>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                      <Separator />

                      {/* 슬라이서 설정 */}
                      <Collapsible open={slicerSectionOpen} onOpenChange={setSlicerSectionOpen}>
                        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium w-full">
                          <Wrench className="w-4 h-4" />
                          슬라이서 설정
                          <ChevronDown className={cn("w-3 h-3 ml-auto transition-transform", slicerSectionOpen && "rotate-180")} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                              <Label className="text-xs text-muted-foreground">슬라이서</Label>
                              <Select value={troubleshootingMeta.slicer || ''} onValueChange={(v) => updateMeta('slicer', v)}>
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue placeholder="선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  {SLICER_OPTIONS.map(opt => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">출력 속도</Label>
                              <Input
                                placeholder="예: 60mm/s"
                                value={troubleshootingMeta.print_speed || ''}
                                onChange={(e) => updateMeta('print_speed', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">노즐 온도</Label>
                              <Input
                                placeholder="예: 210°C"
                                value={troubleshootingMeta.nozzle_temp || ''}
                                onChange={(e) => updateMeta('nozzle_temp', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">베드 온도</Label>
                              <Input
                                placeholder="예: 60°C"
                                value={troubleshootingMeta.bed_temp || ''}
                                onChange={(e) => updateMeta('bed_temp', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">리트랙션</Label>
                              <Input
                                placeholder="예: 0.8mm"
                                value={troubleshootingMeta.retraction || ''}
                                onChange={(e) => updateMeta('retraction', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">레이어 높이</Label>
                              <Input
                                placeholder="예: 0.2mm"
                                value={troubleshootingMeta.layer_height || ''}
                                onChange={(e) => updateMeta('layer_height', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                      <Separator />

                      {/* 증상 태그 */}
                      <Collapsible open={symptomSectionOpen} onOpenChange={setSymptomSectionOpen}>
                        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium w-full">
                          <AlertTriangle className="w-4 h-4" />
                          증상 선택
                          {category === 'troubleshooting' && <span className="text-destructive">*</span>}
                          <ChevronDown className={cn("w-3 h-3 ml-auto transition-transform", symptomSectionOpen && "rotate-180")} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3">
                          <div className="flex flex-wrap gap-2">
                            {SYMPTOM_TAGS.map(symptom => (
                              <Badge
                                key={symptom}
                                variant={selectedSymptoms.includes(symptom) ? "default" : "outline"}
                                className="cursor-pointer hover:bg-primary/80"
                                onClick={() => toggleSymptom(symptom)}
                              >
                                {SYMPTOM_LABELS[symptom] || symptom}
                              </Badge>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* 내용 에디터 */}
              <div className="min-h-[400px]">
                <RichTextEditor
                  content={content}
                  onChange={setContent}
                  placeholder={
                    category === 'troubleshooting'
                      ? t('community.form.troubleshootingPlaceholder', '문제 상황을 자세히 설명해주세요. 언제부터 발생했는지, 어떤 상황에서 발생하는지 등')
                      : t('community.form.contentPlaceholder', '내용을 입력하세요')
                  }
                  onImageUpload={handleEditorImageUpload}
                  on3DUpload={handleEditor3DUpload}
                  onGCodeUpload={handleEditorGCodeUpload}
                  minHeight="350px"
                />
              </div>

              {/* 하단 옵션 영역 */}
              <div className="border-t">
                {/* 태그 입력 */}
                <div className="flex items-center border-b">
                  <div className="w-24 sm:w-32 px-4 py-3 bg-muted/50 text-sm font-medium shrink-0">
                    {t('community.form.tags', '태그')}
                  </div>
                  <div className="flex-1 px-4 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          #{tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:text-destructive ml-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                      {tags.length < 5 && (
                        <Input
                          placeholder={t('community.form.tagPlaceholder', '태그 입력 후 Enter')}
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={handleTagKeyDown}
                          onBlur={handleAddTag}
                          className="border-0 shadow-none focus-visible:ring-0 h-8 w-40 text-sm"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* 첨부 (이미지 + 3D 모델) */}
                <div className="flex items-start">
                  <div className="w-24 sm:w-32 px-4 py-3 bg-muted/50 text-sm font-medium shrink-0">
                    {t('community.form.attachments', '첨부')}
                  </div>
                  <div className="flex-1 px-4 py-3 space-y-4">
                    {/* 이미지 첨부 */}
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <div className="flex flex-wrap gap-2">
                        {/* 첨부된 이미지들 */}
                        {images.map((url, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={url}
                              alt=""
                              className="w-20 h-20 object-cover rounded border"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(index)}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}

                        {/* 선택된 AI 생성 3D 모델 */}
                        {selectedModel && (
                          <div className="relative group">
                            <div className="w-20 h-20 rounded border bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 overflow-hidden">
                              {selectedModel.thumbnail_url ? (
                                <img
                                  src={selectedModel.thumbnail_url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Box className="w-8 h-8 text-blue-500" />
                                </div>
                              )}
                              {/* 3D 모델 표시 */}
                              <div className="absolute bottom-1 right-1 bg-blue-500 rounded px-1 py-0.5">
                                <span className="text-[10px] text-white font-medium">3D</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedModelId(null)}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* 에디터에서 업로드한 3D 파일들 */}
                        {uploaded3DFiles.map((file3d, index) => (
                          <div key={`3d-${index}`} className="relative group">
                            <div className={cn(
                              "w-20 h-20 rounded border bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 overflow-hidden flex flex-col items-center justify-center",
                              file3d.isLoading && "animate-pulse"
                            )}>
                              {file3d.isLoading ? (
                                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                              ) : (
                                <Box className="w-8 h-8 text-blue-500" />
                              )}
                              <span className="text-[9px] text-muted-foreground mt-1 px-1 truncate max-w-full">
                                {file3d.filename.length > 10 ? file3d.filename.slice(0, 8) + '...' : file3d.filename}
                              </span>
                              {/* 파일타입 표시 */}
                              <div className="absolute bottom-1 right-1 bg-blue-500 rounded px-1 py-0.5">
                                <span className="text-[10px] text-white font-medium uppercase">
                                  {file3d.isLoading ? '...' : file3d.filetype}
                                </span>
                              </div>
                            </div>
                            {!file3d.isLoading && (
                              <button
                                type="button"
                                onClick={() => setUploaded3DFiles(prev => prev.filter((_, i) => i !== index))}
                                className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}

                        {/* 첨부된 G-code 파일들 */}
                        {gcodeFiles.map((gcode, index) => (
                          <div key={`gcode-${index}`} className="relative group">
                            <div className={cn(
                              "w-20 h-20 rounded border bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 overflow-hidden flex flex-col items-center justify-center",
                              gcode.isLoading && "animate-pulse"
                            )}>
                              {gcode.isLoading ? (
                                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                              ) : (
                                <FileCode className="w-8 h-8 text-orange-500" />
                              )}
                              <span className="text-[9px] text-muted-foreground mt-1 px-1 truncate max-w-full">
                                {gcode.filename.length > 10 ? gcode.filename.slice(0, 8) + '...' : gcode.filename}
                              </span>
                              {/* GCODE 표시 */}
                              <div className="absolute bottom-1 right-1 bg-orange-500 rounded px-1 py-0.5">
                                <span className="text-[10px] text-white font-medium">
                                  {gcode.isLoading ? '...' : 'GC'}
                                </span>
                              </div>
                            </div>
                            {!gcode.isLoading && (
                              <button
                                type="button"
                                onClick={() => setGcodeFiles(prev => prev.filter((_, i) => i !== index))}
                                className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}

                        {/* 이미지 추가 버튼 */}
                        {images.length < 10 && (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className={cn(
                              "w-20 h-20 border-2 border-dashed rounded flex flex-col items-center justify-center gap-1",
                              "text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
                            )}
                          >
                            {uploading ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <>
                                <ImagePlus className="w-5 h-5" />
                                <span className="text-xs">이미지</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* 3D 모델 추가 버튼 - AI 모델 선택 또는 업로드된 3D 파일이 없을 때만 표시 */}
                        {!selectedModel && uploaded3DFiles.length === 0 && (
                          <button
                            type="button"
                            onClick={() => setShowModelSelector(!showModelSelector)}
                            disabled={loadingModels || userModels.length === 0}
                            className={cn(
                              "w-20 h-20 border-2 border-dashed rounded flex flex-col items-center justify-center gap-1",
                              "text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors",
                              (loadingModels || userModels.length === 0) && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {loadingModels ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <>
                                <Box className="w-5 h-5" />
                                <span className="text-xs">3D모델</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* 모델 선택 드롭다운 */}
                      {showModelSelector && userModels.length > 0 && (
                        <div className="mt-3 p-2 border rounded-lg bg-background max-h-60 overflow-y-auto">
                          <p className="text-xs text-muted-foreground mb-2">내 3D 모델 선택</p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {userModels.map((model) => (
                              <button
                                key={model.id}
                                type="button"
                                onClick={() => {
                                  setSelectedModelId(model.id);
                                  setShowModelSelector(false);
                                }}
                                className={cn(
                                  "p-1.5 rounded-lg border text-left hover:bg-muted/50 transition-colors",
                                  selectedModelId === model.id && "border-primary bg-primary/5"
                                )}
                              >
                                <div className="aspect-square w-full rounded bg-muted overflow-hidden mb-1">
                                  {model.thumbnail_url ? (
                                    <img
                                      src={model.thumbnail_url}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Box className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                                <p className="text-[10px] font-medium truncate">
                                  {model.model_name || t('community.form.untitledModel', '제목 없음')}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground mt-2">
                        이미지 최대 10장 (각 5MB), 3D 모델 1개, G-code 최대 5개 (각 100MB)
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 모바일 하단 등록 버튼 */}
              {isMobile && (
                <div className="p-4 border-t">
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || uploading}
                    className="w-full"
                  >
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {t('community.submit', '등록')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 모바일 하단 네비게이션 */}
      {isMobile && <SharedBottomNavigation />}

      {/* 로그인 유도 모달 */}
      <LoginPromptModal
        open={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title={t('community.loginRequired', '로그인이 필요합니다')}
        description={t('community.loginRequiredDesc', '게시물을 작성하려면 로그인이 필요합니다.')}
      />
    </div>
  );
}
