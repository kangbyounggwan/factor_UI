/**
 * EditPost Page
 * 게시물 편집 페이지 - CreatePost와 유사한 구조
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
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
} from "lucide-react";

// Layout Components
import { AppHeader } from "@/components/common/AppHeader";
import { AppSidebar } from "@/components/common/AppSidebar";
import { CommunitySidebarContent } from "@/components/sidebar";
import { SharedBottomNavigation } from "@/components/shared/SharedBottomNavigation";
import { LoginPromptModal } from "@/components/auth/LoginPromptModal";

// Community Components
import { RichTextEditor } from "@/components/community/RichTextEditor";

// Services
import {
  getPost,
  updatePost,
  uploadPostImage,
  getCommunityStats,
  getMyRecentPosts,
  getMyRecentComments,
  type PostCategory,
  type UpdatePostInput,
  type TroubleshootingMeta,
  type CommunityStats,
  type MyRecentPost,
  type MyRecentComment,
  SYMPTOM_TAGS,
} from "@shared/services/supabaseService/community";
import { listAIModels } from "@shared/services/supabaseService/aiModel";
import { supabase } from "@shared/integrations/supabase/client";
import type { AIGeneratedModel } from "@shared/types/aiModelType";

// Shared constants
import {
  getCategoryOptions,
  FIRMWARE_OPTIONS,
  FILAMENT_OPTIONS,
  SLICER_OPTIONS,
} from "@shared/constants/community";

// 카테고리 옵션 (shared에서 가져옴)
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

export default function EditPost() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { postId } = useParams<{ postId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 사이드바 상태 (localStorage 연동)
  const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebarState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 로딩 상태
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  // 폼 상태
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<PostCategory>('free');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  // 커뮤니티 통계
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);

  // 내 글/댓글 상태
  const [myPosts, setMyPosts] = useState<MyRecentPost[]>([]);
  const [myComments, setMyComments] = useState<MyRecentComment[]>([]);

  // 트러블슈팅 폼 표시 여부
  const showTroubleshootingForm = category === 'troubleshooting' || category === 'question';

  // 게시물 불러오기
  useEffect(() => {
    const fetchPost = async () => {
      if (!postId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        const post = await getPost(postId);

        if (!post) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        // 작성자 확인
        if (user && post.user_id !== user.id) {
          setUnauthorized(true);
          setLoading(false);
          return;
        }

        // 폼 상태 초기화
        setTitle(post.title);
        setContent(post.content);
        setCategory(post.category);
        setTags(post.tags || []);
        setImages(post.images || []);

        if (post.troubleshooting_meta) {
          setTroubleshootingMeta(post.troubleshooting_meta);
          setSelectedSymptoms(post.troubleshooting_meta.symptom_tags || []);
          setShowTroubleshootingPanel(true);
        }

        // 모델 ID 설정
        if (post.model_id) {
          setSelectedModelId(post.model_id);
        }

        setLoading(false);
      } catch (error) {
        console.error('[EditPost] Error fetching post:', error);
        setNotFound(true);
        setLoading(false);
      }
    };

    if (user) {
      fetchPost();
    } else {
      setShowLoginModal(true);
      setLoading(false);
    }
  }, [postId, user]);

  // 사용자 모델 목록 로드
  useEffect(() => {
    const loadUserModels = async () => {
      if (!user) return;
      setLoadingModels(true);
      try {
        const result = await listAIModels(supabase, user.id, { pageSize: 50 });
        setUserModels(result.items);
      } catch (error) {
        console.error('[EditPost] Error loading models:', error);
      } finally {
        setLoadingModels(false);
      }
    };
    loadUserModels();
  }, [user]);

  // 커뮤니티 통계 및 내 글/댓글 로드
  useEffect(() => {
    const loadCommunityStats = async () => {
      try {
        const stats = await getCommunityStats();
        setCommunityStats(stats);
      } catch (error) {
        console.error('[EditPost] Error loading community stats:', error);
      }
    };
    loadCommunityStats();
    // 내 글/댓글 로드
    if (user) {
      Promise.all([
        getMyRecentPosts(user.id, 5),
        getMyRecentComments(user.id, 5),
      ]).then(([posts, comments]) => {
        setMyPosts(posts);
        setMyComments(comments);
      });
    }
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
    return await uploadPostImage(user.id, file);
  }, [user, toast, t]);

  // 에디터용 GCode 파일 업로드
  const handleEditorGCodeUpload = useCallback(async (file: File): Promise<string | null> => {
    if (!user) return null;
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: t('community.error.fileTooLarge', '파일이 너무 큽니다 (최대 100MB)'),
        variant: 'destructive',
      });
      return null;
    }
    return await uploadPostImage(user.id, file);
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
      console.error('[EditPost] Error uploading image:', error);
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

  // 게시물 수정 제출
  const handleSubmit = async () => {
    if (!user || !postId) {
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

      const input: UpdatePostInput = {
        title: title.trim(),
        content: content,
        category,
        tags: tags.length > 0 ? tags : [],
        images: images.length > 0 ? images : [],
        model_id: selectedModelId,
        troubleshooting_meta: finalMeta,
      };

      const post = await updatePost(postId, user.id, input);

      if (post) {
        toast({
          title: t('community.postUpdated', '게시물이 수정되었습니다'),
        });
        navigate(`/community/${post.id}`);
      } else {
        throw new Error('Failed to update post');
      }
    } catch (error) {
      console.error('[EditPost] Error updating post:', error);
      toast({
        title: t('community.error.updateFailed', '게시물 수정 실패'),
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
    if (postId) {
      navigate(`/community/${postId}`);
    } else {
      navigate('/community');
    }
  };

  // 로딩 화면
  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // 게시물을 찾을 수 없음
  if (notFound) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-lg text-muted-foreground">{t('community.postNotFound', '게시물을 찾을 수 없습니다')}</p>
        <Button onClick={() => navigate('/community')}>
          {t('community.backToList', '목록으로')}
        </Button>
      </div>
    );
  }

  // 권한 없음
  if (unauthorized) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-lg text-muted-foreground">{t('community.unauthorized', '수정 권한이 없습니다')}</p>
        <Button onClick={() => navigate('/community')}>
          {t('community.backToList', '목록으로')}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("h-screen bg-background flex", isMobile && "pb-16")}>
      {/* 사이드바 (데스크탑) */}
      {!isMobile && (
        <AppSidebar
          isOpen={sidebarOpen}
          onToggle={toggleSidebar}
          user={user}
          onLoginClick={() => setShowLoginModal(true)}
          hidePlanCard
        >
          <CommunitySidebarContent
            communityStats={communityStats ? {
              totalPosts: communityStats.totalPosts,
              totalComments: communityStats.totalComments,
              totalUsers: communityStats.totalUsers,
              totalLikes: communityStats.totalLikes,
              todayPosts: communityStats.todayPosts,
            } : null}
            myPosts={myPosts}
            myComments={myComments}
          />
        </AppSidebar>
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
            {t('common.cancel', '취소')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || uploading}
            className="px-6"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('community.saveChanges', '수정')}
          </Button>
        </div>

        {/* 편집 영역 */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto py-4">
            {/* 편집 폼 */}
            <div className="bg-background border rounded-lg">
              {/* 카테고리 & 제목 헤더 */}
              <div className="border-b">
                {/* 카테고리 선택 */}
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

                        {/* 선택된 3D 모델 */}
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

                        {/* 3D 모델 추가 버튼 */}
                        {!selectedModel && (
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
                        이미지 최대 10장 (각 5MB), 3D 모델 1개
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 모바일 하단 수정 버튼 */}
              {isMobile && (
                <div className="p-4 border-t">
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || uploading}
                    className="w-full"
                  >
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {t('community.saveChanges', '수정')}
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
        description={t('community.loginRequiredDesc', '게시물을 수정하려면 로그인이 필요합니다.')}
      />
    </div>
  );
}
