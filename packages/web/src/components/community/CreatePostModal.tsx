/**
 * CreatePostModal 컴포넌트
 * 게시물 작성 모달 - 트러블슈팅 폼 지원
 * - RichTextEditor로 본문 작성
 * - 이미지 첨부 및 크기 조절 지원
 */
import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Loader2, X, ChevronDown, AlertTriangle, Wrench, Thermometer, Box, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { RichTextEditor, type AttachedImage } from "./RichTextEditor";
import {
  createPost,
  uploadPostImage,
  type CommunityPost,
  type PostCategory,
  type CreatePostInput,
  type TroubleshootingMeta,
  type AuthorDisplayType,
  SYMPTOM_TAGS,
} from "@shared/services/supabaseService/community";
import { supabase } from "@shared/integrations/supabase/client";

// 카테고리 옵션
const CATEGORIES: { value: PostCategory; label: string; icon: string; description?: string }[] = [
  { value: 'showcase', label: '자랑', icon: '🎨', description: '출력물 공유' },
  { value: 'question', label: '질문', icon: '❓', description: '일반 질문' },
  { value: 'troubleshooting', label: '트러블슈팅', icon: '🔧', description: '출력 문제 해결' },
  { value: 'failure', label: '실패', icon: '😅', description: '실패 자랑하기' },
  { value: 'free', label: '자유', icon: '💬', description: '자유 주제' },
];

// 펌웨어 옵션
const FIRMWARE_OPTIONS = ['Klipper', 'Marlin', 'RRF (RepRapFirmware)', 'Prusa Firmware', 'Other'];

// 필라멘트 타입 옵션
const FILAMENT_OPTIONS = ['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'Nylon', 'PC', 'CF/GF 강화', 'Other'];

// 슬라이서 옵션
const SLICER_OPTIONS = ['Cura', 'PrusaSlicer', 'OrcaSlicer', 'Bambu Studio', 'SuperSlicer', 'Simplify3D', 'Other'];

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

interface CreatePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostCreated: (post: CommunityPost) => void;
}

export function CreatePostModal({ open, onOpenChange, onPostCreated }: CreatePostModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();

  // 폼 상태
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<PostCategory>('free');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [authorDisplayType, setAuthorDisplayType] = useState<AuthorDisplayType>('nickname');

  // 프로필 정보 상태
  const [profile, setProfile] = useState<{
    display_name?: string;
    full_name?: string;
    avatar_url?: string;
  } | null>(null);

  // 프로필 정보 로드
  useEffect(() => {
    if (!user || !open) return;

    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name, full_name, avatar_url')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('[CreatePostModal] Profile loaded:', { data, error });

        if (!error && data) {
          setProfile(data);
        }
      } catch (err) {
        console.error('[CreatePostModal] Error loading profile:', err);
      }
    };

    loadProfile();
  }, [user, open]);

  // 트러블슈팅 메타데이터 상태
  const [troubleshootingMeta, setTroubleshootingMeta] = useState<TroubleshootingMeta>({});
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);

  // 섹션 열림 상태
  const [printerSectionOpen, setPrinterSectionOpen] = useState(true);
  const [filamentSectionOpen, setFilamentSectionOpen] = useState(true);
  const [slicerSectionOpen, setSlicerSectionOpen] = useState(true);
  const [symptomSectionOpen, setSymptomSectionOpen] = useState(true);

  // 트러블슈팅 폼 표시 여부
  const showTroubleshootingForm = category === 'troubleshooting' || category === 'question';

  // 이미지 업로드 핸들러
  const handleImageUpload = useCallback(async (file: File): Promise<string | null> => {
    if (!user) return null;

    try {
      const url = await uploadPostImage(user.id, file);
      return url;
    } catch (error) {
      console.error('[CreatePostModal] Error uploading image:', error);
      toast({
        title: t('community.error.uploadFailed', '이미지 업로드 실패'),
        variant: 'destructive',
      });
      return null;
    }
  }, [user, toast, t]);

  // 3D 모델 업로드 핸들러
  const handle3DUpload = useCallback(async (file: File): Promise<string | null> => {
    if (!user) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('community-3d-models')
        .upload(fileName, file);

      if (error) {
        // 버킷이 없으면 community-images 버킷 사용
        const { data: fallbackData, error: fallbackError } = await supabase.storage
          .from('community-images')
          .upload(`3d-models/${fileName}`, file);

        if (fallbackError) {
          throw fallbackError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('community-images')
          .getPublicUrl(`3d-models/${fallbackData.path}`);

        return publicUrl;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('community-3d-models')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error('[CreatePostModal] Error uploading 3D model:', error);
      toast({
        title: t('community.error.uploadFailed', '3D 모델 업로드 실패'),
        variant: 'destructive',
      });
      return null;
    }
  }, [user, toast, t]);

  // GCode 업로드 핸들러
  const handleGCodeUpload = useCallback(async (file: File): Promise<string | null> => {
    if (!user) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('community-3d-models')
        .upload(`gcode/${fileName}`, file);

      if (error) {
        // 버킷이 없으면 community-images 버킷 사용
        const { data: fallbackData, error: fallbackError } = await supabase.storage
          .from('community-images')
          .upload(`gcode/${fileName}`, file);

        if (fallbackError) {
          throw fallbackError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('community-images')
          .getPublicUrl(`gcode/${fallbackData.path}`);

        return publicUrl;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('community-3d-models')
        .getPublicUrl(`gcode/${data.path}`);

      return publicUrl;
    } catch (error) {
      console.error('[CreatePostModal] Error uploading GCode:', error);
      toast({
        title: t('community.error.uploadFailed', 'GCode 업로드 실패'),
        variant: 'destructive',
      });
      return null;
    }
  }, [user, toast, t]);

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

  // 폼 초기화
  const resetForm = () => {
    setTitle('');
    setContent('');
    setCategory('free');
    setTagInput('');
    setTags([]);
    setAttachedImages([]);
    setTroubleshootingMeta({});
    setSelectedSymptoms([]);
    setAuthorDisplayType('nickname');
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

    if (!content.trim()) {
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
    if (!user) return;
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

      // 첨부된 이미지 URL 목록 추출
      const imageUrls = attachedImages.map(img => img.url);

      const input: CreatePostInput = {
        title: title.trim(),
        content: content.trim(),
        category,
        tags: tags.length > 0 ? tags : undefined,
        images: imageUrls.length > 0 ? imageUrls : undefined,
        author_display_type: authorDisplayType,
        troubleshooting_meta: finalMeta,
      };

      const post = await createPost(user.id, input);

      if (post) {
        onPostCreated(post);
        resetForm();
        onOpenChange(false);
      } else {
        throw new Error('Failed to create post');
      }
    } catch (error) {
      console.error('[CreatePostModal] Error creating post:', error);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>{t('community.createPost', '글쓰기')}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 py-4">
            {/* 작성자 표시 + 카테고리 선택 (한 줄) */}
            <div className="flex items-end gap-4">
              {/* 작성자 표시 방식 */}
              <div className="flex items-center gap-3">
                <Avatar className="w-9 h-9 border">
                  {authorDisplayType !== 'anonymous' && profile?.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt="avatar" />
                  ) : null}
                  <AvatarFallback className="bg-muted">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">
                    {authorDisplayType === 'nickname' && (profile?.display_name || t('community.author.unknown', '알 수 없음'))}
                    {authorDisplayType === 'realname' && (profile?.full_name || profile?.display_name || t('community.author.unknown', '알 수 없음'))}
                    {authorDisplayType === 'anonymous' && t('community.author.anonymous', '익명')}
                  </span>
                  <Select
                    value={authorDisplayType}
                    onValueChange={(v) => setAuthorDisplayType(v as AuthorDisplayType)}
                  >
                    <SelectTrigger className="h-6 w-[100px] text-xs px-2 py-0 border-dashed">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nickname">
                        <span className="text-xs">{t('community.authorType.nickname', '닉네임')}</span>
                      </SelectItem>
                      <SelectItem value="realname">
                        <span className="text-xs">{t('community.authorType.realname', '실명')}</span>
                      </SelectItem>
                      <SelectItem value="anonymous">
                        <span className="text-xs">{t('community.authorType.anonymous', '익명')}</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 카테고리 선택 */}
              <div className="flex-1 space-y-2">
                <Label>{t('community.form.category', '카테고리')}</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as PostCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <span>{cat.icon}</span>
                          <span>{t(`community.category.${cat.value}`, cat.label)}</span>
                          {cat.description && (
                            <span className="text-xs text-muted-foreground">- {cat.description}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 제목 */}
            <div className="space-y-2">
              <Label>{t('community.form.title', '제목')} *</Label>
              <Input
                placeholder={t('community.form.titlePlaceholder', '제목을 입력하세요')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </div>

            {/* 트러블슈팅 폼 */}
            {showTroubleshootingForm && (
              <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  {category === 'troubleshooting'
                    ? t('community.troubleshooting.requiredInfo', '문제 해결을 위해 아래 정보를 입력해주세요 (필수)')
                    : t('community.troubleshooting.optionalInfo', '더 정확한 답변을 위해 정보를 입력해주세요 (선택)')}
                </div>

                {/* 프린터 정보 섹션 */}
                <Collapsible open={printerSectionOpen} onOpenChange={setPrinterSectionOpen}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <Box className="w-4 h-4" />
                      {t('community.troubleshooting.printerInfo', '프린터 정보')}
                      {category === 'troubleshooting' && <span className="text-destructive">*</span>}
                    </div>
                    <ChevronDown className={cn("w-4 h-4 transition-transform", printerSectionOpen && "rotate-180")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">{t('community.troubleshooting.printerModel', '프린터 모델')}</Label>
                        <Input
                          placeholder="예: Bambu Lab X1C"
                          value={troubleshootingMeta.printer_model || ''}
                          onChange={(e) => updateMeta('printer_model', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t('community.troubleshooting.firmware', '펌웨어')}</Label>
                        <Select value={troubleshootingMeta.firmware || ''} onValueChange={(v) => updateMeta('firmware', v)}>
                          <SelectTrigger className="h-9">
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
                        <Label className="text-xs">{t('community.troubleshooting.nozzleSize', '노즐 크기')}</Label>
                        <Input
                          placeholder="예: 0.4mm"
                          value={troubleshootingMeta.nozzle_size || ''}
                          onChange={(e) => updateMeta('nozzle_size', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t('community.troubleshooting.bedType', '베드 타입')}</Label>
                        <Input
                          placeholder="예: PEI, Glass"
                          value={troubleshootingMeta.bed_type || ''}
                          onChange={(e) => updateMeta('bed_type', e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* 필라멘트 정보 섹션 */}
                <Collapsible open={filamentSectionOpen} onOpenChange={setFilamentSectionOpen}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium border-t pt-4">
                    <div className="flex items-center gap-2">
                      <Thermometer className="w-4 h-4" />
                      {t('community.troubleshooting.filamentInfo', '필라멘트 정보')}
                      {category === 'troubleshooting' && <span className="text-destructive">*</span>}
                    </div>
                    <ChevronDown className={cn("w-4 h-4 transition-transform", filamentSectionOpen && "rotate-180")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">{t('community.troubleshooting.filamentType', '필라멘트 종류')}</Label>
                        <Select value={troubleshootingMeta.filament_type || ''} onValueChange={(v) => updateMeta('filament_type', v)}>
                          <SelectTrigger className="h-9">
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
                        <Label className="text-xs">{t('community.troubleshooting.filamentBrand', '브랜드')}</Label>
                        <Input
                          placeholder="예: eSUN, Polymaker"
                          value={troubleshootingMeta.filament_brand || ''}
                          onChange={(e) => updateMeta('filament_brand', e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="filament_dried"
                        checked={troubleshootingMeta.filament_dried || false}
                        onCheckedChange={(checked) => updateMeta('filament_dried', checked as boolean)}
                      />
                      <Label htmlFor="filament_dried" className="text-sm cursor-pointer">
                        {t('community.troubleshooting.filamentDried', '필라멘트 건조함')}
                      </Label>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* 슬라이서 정보 섹션 */}
                <Collapsible open={slicerSectionOpen} onOpenChange={setSlicerSectionOpen}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium border-t pt-4">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4" />
                      {t('community.troubleshooting.slicerInfo', '슬라이서 설정')}
                    </div>
                    <ChevronDown className={cn("w-4 h-4 transition-transform", slicerSectionOpen && "rotate-180")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">{t('community.troubleshooting.slicer', '슬라이서')}</Label>
                        <Select value={troubleshootingMeta.slicer || ''} onValueChange={(v) => updateMeta('slicer', v)}>
                          <SelectTrigger className="h-9">
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
                        <Label className="text-xs">{t('community.troubleshooting.printSpeed', '출력 속도')}</Label>
                        <Input
                          placeholder="예: 60mm/s"
                          value={troubleshootingMeta.print_speed || ''}
                          onChange={(e) => updateMeta('print_speed', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t('community.troubleshooting.nozzleTemp', '노즐 온도')}</Label>
                        <Input
                          placeholder="예: 210°C"
                          value={troubleshootingMeta.nozzle_temp || ''}
                          onChange={(e) => updateMeta('nozzle_temp', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t('community.troubleshooting.bedTemp', '베드 온도')}</Label>
                        <Input
                          placeholder="예: 60°C"
                          value={troubleshootingMeta.bed_temp || ''}
                          onChange={(e) => updateMeta('bed_temp', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t('community.troubleshooting.retraction', '리트랙션')}</Label>
                        <Input
                          placeholder="예: 0.8mm @ 30mm/s"
                          value={troubleshootingMeta.retraction || ''}
                          onChange={(e) => updateMeta('retraction', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t('community.troubleshooting.layerHeight', '레이어 높이')}</Label>
                        <Input
                          placeholder="예: 0.2mm"
                          value={troubleshootingMeta.layer_height || ''}
                          onChange={(e) => updateMeta('layer_height', e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* 증상 태그 섹션 */}
                <Collapsible open={symptomSectionOpen} onOpenChange={setSymptomSectionOpen}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium border-t pt-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      {t('community.troubleshooting.symptoms', '증상')}
                      {category === 'troubleshooting' && <span className="text-destructive">*</span>}
                    </div>
                    <ChevronDown className={cn("w-4 h-4 transition-transform", symptomSectionOpen && "rotate-180")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="flex flex-wrap gap-2">
                      {SYMPTOM_TAGS.map(symptom => (
                        <Badge
                          key={symptom}
                          variant={selectedSymptoms.includes(symptom) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleSymptom(symptom)}
                        >
                          {SYMPTOM_LABELS[symptom] || symptom}
                        </Badge>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            {/* 태그 */}
            <div className="space-y-2">
              <Label>{t('community.form.tags', '태그')} (최대 5개)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={t('community.form.tagPlaceholder', '태그 입력 후 Enter')}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={handleAddTag}
                  disabled={tags.length >= 5}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddTag}
                  disabled={tags.length >= 5 || !tagInput.trim()}
                >
                  {t('common.add', '추가')}
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* 내용 - RichTextEditor로 이미지 첨부 포함 */}
            <div className="space-y-2">
              <Label>
                {t('community.form.content', '내용')} *
                {category === 'troubleshooting' && (
                  <span className="text-xs text-muted-foreground ml-2">
                    - {t('community.troubleshooting.imageHint', '문제 부분 사진을 첨부하면 도움이 됩니다')}
                  </span>
                )}
              </Label>
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder={
                  category === 'troubleshooting'
                    ? t('community.form.troubleshootingPlaceholder', '문제 상황을 자세히 설명해주세요. 언제부터 발생했는지, 어떤 상황에서 발생하는지 등')
                    : t('community.form.contentPlaceholder', '내용을 입력하세요')
                }
                onImageUpload={handleImageUpload}
                on3DUpload={handle3DUpload}
                onGCodeUpload={handleGCodeUpload}
                attachedImages={attachedImages}
                onAttachedImagesChange={setAttachedImages}
                showAttachmentSection={true}
                maxImages={5}
                minHeight="250px"
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('common.cancel', '취소')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('community.submit', '등록')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreatePostModal;
