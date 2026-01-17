/**
 * PostCard 컴포넌트
 * 커뮤니티 게시물 카드
 */
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThumbsUp, ThumbsDown, MessageCircle, Eye, Pin, CheckCircle2, AlertCircle, Box } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommunityPost, PostCategory } from "@shared/services/supabaseService/community";
import { getDisplayName, getDisplayAvatar } from "@shared/services/supabaseService/community";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@shared/constants/community";

// 썸네일 타입
type ThumbnailType = 'image' | 'model' | '3d-embed' | 'none';

// 본문 HTML에서 첫 번째 이미지 URL 추출
function extractFirstImageFromContent(content: string): string | null {
  if (!content) return null;
  // <img src="..."> 패턴 매칭
  const imgMatch = content.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i);
  return imgMatch ? imgMatch[1] : null;
}

// 본문 HTML에서 3D 모델 임베드 정보 추출
interface Model3DEmbedInfo {
  url: string;
  filename: string;
  type: string;
  thumbnail?: string;
}

function extractFirst3DModelFromContent(content: string): Model3DEmbedInfo | null {
  if (!content) return null;
  // model-3d-embed 클래스를 가진 div 찾기
  const modelMatch = content.match(/<div[^>]*class="model-3d-embed"[^>]*>/i);
  if (!modelMatch) return null;

  const divHtml = modelMatch[0];
  // data 속성 추출
  const urlMatch = divHtml.match(/data-url="([^"]*)"/i);
  const filenameMatch = divHtml.match(/data-filename="([^"]*)"/i);
  const typeMatch = divHtml.match(/data-type="([^"]*)"/i);
  const thumbnailMatch = divHtml.match(/data-thumbnail="([^"]*)"/i);

  if (urlMatch) {
    return {
      url: urlMatch[1],
      filename: filenameMatch ? filenameMatch[1] : 'model',
      type: typeMatch ? typeMatch[1] : 'unknown',
      thumbnail: thumbnailMatch ? thumbnailMatch[1] : undefined
    };
  }
  return null;
}

// 본문 요약 추출 (HTML 태그 및 3D 모델 임베드 정보 제거)
function extractContentSummary(content: string, maxLength: number = 100): string {
  if (!content) return '';

  // 1. model-3d-embed div 전체 제거 (내부 콘텐츠 포함)
  let cleaned = content.replace(/<div[^>]*class="model-3d-embed"[^>]*>[\s\S]*?<\/div>/gi, '');

  // 2. HTML 태그 제거
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  // 3. 3D 모델 임베드 패턴 텍스트 제거
  // 📦 파일명.확장자 (3D 모델) 패턴
  cleaned = cleaned.replace(/📦\s*[\w가-힣\-_.]+\.(stl|obj|gcode|3mf|step|stp)\s*\(3D\s*모델\)/gi, '');
  // 🎲 3D 모델: 파일명 패턴
  cleaned = cleaned.replace(/🎲\s*3D\s*모델[:\s]*[\w가-힣\-_.]+/gi, '');
  // [3D 모델] 또는 (3D 모델) 단독 패턴
  cleaned = cleaned.replace(/[[(]3D\s*모델[\])]/gi, '');
  // 파일명.확장자 (3D 모델) 패턴 (이모지 없이)
  cleaned = cleaned.replace(/[\w가-힣\-_.]+\.(stl|obj|gcode|3mf|step|stp)\s*\(3D\s*모델\)/gi, '');

  // 4. 연속 공백 정리
  const textOnly = cleaned.replace(/\s+/g, ' ').trim();

  if (textOnly.length <= maxLength) return textOnly;
  return textOnly.substring(0, maxLength) + '...';
}

interface PostCardProps {
  post: CommunityPost;
  onClick?: () => void;
  onTagClick?: (tag: string) => void;
  className?: string;
}

export function PostCard({ post, onClick, onTagClick, className }: PostCardProps) {
  const { t } = useTranslation();

  // i18n 번역된 폴백 텍스트
  const authorFallbacks = {
    unknown: t('community.unknownAuthor'),
    anonymous: t('community.anonymous'),
  };

  // 썸네일 정보 결정 (images > 모델 썸네일 > content 이미지 > content 3D 모델 썸네일 > 3D 아이콘 순으로 우선)
  const getThumbnailInfo = (): { type: ThumbnailType; url?: string; model3d?: Model3DEmbedInfo } => {
    // 1. 첨부된 이미지가 있으면 첫 번째 이미지 사용
    if (post.images && post.images.length > 0) {
      return { type: 'image', url: post.images[0] };
    }
    // 2. 첨부된 모델이 있고 썸네일이 있으면 모델 썸네일 사용
    if (post.model?.thumbnail_url) {
      return { type: 'model', url: post.model.thumbnail_url };
    }
    // 3. 본문에서 첫 번째 이미지 추출 (content가 있는 경우에만)
    if (post.content) {
      const contentImage = extractFirstImageFromContent(post.content);
      if (contentImage) {
        return { type: 'image', url: contentImage };
      }
      // 4. 본문에서 3D 모델 임베드 추출
      const model3d = extractFirst3DModelFromContent(post.content);
      if (model3d) {
        // 4-1. 3D 모델에 썸네일이 있으면 이미지로 표시
        if (model3d.thumbnail) {
          return { type: 'model', url: model3d.thumbnail };
        }
        // 4-2. 썸네일이 없으면 3D 아이콘으로 표시
        return { type: '3d-embed', model3d };
      }
    }
    return { type: 'none' };
  };

  const thumbnail = getThumbnailInfo();

  // 본문 요약 (썸네일이 없는 경우 더 긴 요약 표시)
  const contentSummary = extractContentSummary(post.content, thumbnail.type === 'none' ? 150 : 80);

  // 상대적 시간 계산
  const getRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return t('time.justNow', '방금 전');
    if (diffMins < 60) return t('time.minutesAgo', '{{count}}분 전', { count: diffMins });
    if (diffHours < 24) return t('time.hoursAgo', '{{count}}시간 전', { count: diffHours });
    if (diffDays < 7) return t('time.daysAgo', '{{count}}일 전', { count: diffDays });
    return date.toLocaleDateString();
  };

  // 카테고리 라벨
  const getCategoryLabel = (category: PostCategory) => {
    const labels: Record<PostCategory, string> = {
      announcement: t('community.category.announcement', '공지'),
      showcase: t('community.category.showcase', '자랑'),
      question: t('community.category.question', '질문'),
      troubleshooting: t('community.category.troubleshooting', '트러블슈팅'),
      failure: t('community.category.failure', '실패'),
      free: t('community.category.free', '자유'),
    };
    return labels[category];
  };

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md hover:border-primary/30",
        post.is_pinned && "border-amber-400/50 bg-amber-50/30 dark:bg-amber-900/10",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex gap-3">
          {/* 썸네일 (이미지, 모델 썸네일, 또는 3D 모델 임베드) */}
          {thumbnail.type !== 'none' && (
            <div className="shrink-0 relative">
              {/* 이미지 또는 모델 썸네일 */}
              {(thumbnail.type === 'image' || thumbnail.type === 'model') && thumbnail.url && (
                <img
                  src={thumbnail.url}
                  alt=""
                  className="w-20 h-20 object-cover rounded-lg bg-muted"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              {/* 3D 모델 임베드 (썸네일 없음 - 아이콘 표시) */}
              {thumbnail.type === '3d-embed' && thumbnail.model3d && (
                <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 dark:from-blue-500/30 dark:to-purple-500/30 border border-blue-500/30 flex flex-col items-center justify-center">
                  <Box className="w-8 h-8 text-blue-500" />
                  <span className="text-[9px] text-muted-foreground mt-1 uppercase font-medium">
                    {thumbnail.model3d.type}
                  </span>
                </div>
              )}
              {/* 모델 썸네일인 경우 3D 아이콘 표시 */}
              {thumbnail.type === 'model' && (
                <div className="absolute bottom-1 right-1 bg-black/60 rounded p-0.5">
                  <Box className="w-3 h-3 text-white" />
                </div>
              )}
              {/* 여러 이미지가 있는 경우 표시 */}
              {thumbnail.type === 'image' && post.images && post.images.length > 1 && (
                <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1 py-0.5">
                  <span className="text-[10px] text-white font-medium">+{post.images.length - 1}</span>
                </div>
              )}
            </div>
          )}

          {/* 콘텐츠 */}
          <div className="flex-1 min-w-0">
            {/* 상단: 카테고리 + 고정 배지 */}
            <div className="flex items-center gap-2 mb-1.5">
              <Badge className={cn("text-xs", CATEGORY_COLORS[post.category])}>
                <span className="mr-0.5">{CATEGORY_ICONS[post.category]}</span>
                {getCategoryLabel(post.category)}
              </Badge>
              {post.is_pinned && (
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
                  <Pin className="w-3 h-3 mr-0.5" />
                  {t('community.pinned', '고정')}
                </Badge>
              )}
              {/* 해결됨/미해결 표시 (질문/트러블슈팅) */}
              {(post.category === 'question' || post.category === 'troubleshooting') && (
                post.is_solved ? (
                  <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle2 className="w-3 h-3 mr-0.5" />
                    {t('community.solved', '해결됨')}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-orange-600 border-orange-400">
                    <AlertCircle className="w-3 h-3 mr-0.5" />
                    {t('community.unsolved', '미해결')}
                  </Badge>
                )
              )}
            </div>

            {/* 제목 + 트러블슈팅 메타정보/태그 (오른쪽 상단 배치) */}
            <div className="flex items-start justify-between gap-3 mb-1">
              {/* 제목 */}
              <h3 className="font-medium text-base line-clamp-1 flex-1 min-w-0">
                {post.title}
              </h3>

              {/* 트러블슈팅 메타 정보 (오른쪽 상단) */}
              {post.category === 'troubleshooting' && post.troubleshooting_meta && (
                <div className="flex flex-wrap gap-1 shrink-0 max-w-[200px] justify-end">
                  {post.troubleshooting_meta.printer_model && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {post.troubleshooting_meta.printer_model}
                    </span>
                  )}
                  {post.troubleshooting_meta.filament_type && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                      {post.troubleshooting_meta.filament_type}
                    </span>
                  )}
                  {post.troubleshooting_meta.slicer && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                      {post.troubleshooting_meta.slicer}
                    </span>
                  )}
                  {post.troubleshooting_meta.symptom_tags && post.troubleshooting_meta.symptom_tags.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                      {post.troubleshooting_meta.symptom_tags[0]}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 본문 요약 */}
            {contentSummary && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {contentSummary}
              </p>
            )}

            {/* 태그 */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {post.tags.slice(0, 3).map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs cursor-pointer hover:bg-secondary/80"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTagClick?.(tag);
                    }}
                  >
                    #{tag}
                  </Badge>
                ))}
                {post.tags.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{post.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}

            {/* 하단: 작성자 정보 + 통계 */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Avatar className="w-5 h-5">
                  <AvatarImage src={getDisplayAvatar(post.author, post.author_display_type)} />
                  <AvatarFallback className="text-[10px]">
                    {getDisplayName(post.author, post.author_display_type, authorFallbacks).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>{getDisplayName(post.author, post.author_display_type, authorFallbacks)}</span>
                <span className="text-muted-foreground/50">·</span>
                <span>{getRelativeTime(post.created_at)}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  {post.view_count}
                </span>
                <span className={cn(
                  "flex items-center gap-1",
                  post.is_liked && "text-primary"
                )}>
                  <ThumbsUp className={cn("w-3.5 h-3.5", post.is_liked && "fill-current")} />
                  {post.like_count}
                </span>
                <span className={cn(
                  "flex items-center gap-1",
                  post.is_disliked && "text-destructive"
                )}>
                  <ThumbsDown className={cn("w-3.5 h-3.5", post.is_disliked && "fill-current")} />
                  {post.dislike_count || 0}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" />
                  {post.comment_count}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default PostCard;
