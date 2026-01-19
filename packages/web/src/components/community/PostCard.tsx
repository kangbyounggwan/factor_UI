/**
 * PostCard 컴포넌트
 * 커뮤니티 게시물 카드
 *
 * v1.2.2 개선사항:
 * - 상단 배지: 상태 + 카테고리만 (핀 제거)
 * - 프린터/소재 정보는 푸터 메타 라인으로 이동
 * - 태그 2개 + 스타일 톤다운
 * - 좋아요/싫어요 hover에서만 표시, 조회/댓글만 기본 표시
 * - 제목 1줄 크게, 요약 1줄 제한
 * - 썸네일 크기/존재감 축소
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThumbsUp, ThumbsDown, MessageCircle, Eye, CheckCircle2, AlertCircle, Box } from "lucide-react";
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
  const [isHovered, setIsHovered] = useState(false);

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

  // 트러블슈팅 메타 정보 존재 여부
  const hasTroubleshootingMeta = post.category === 'troubleshooting' && post.troubleshooting_meta;
  const meta = post.troubleshooting_meta;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md hover:border-primary/20 group",
        post.is_pinned && "border-amber-300/40 bg-amber-50/20 dark:bg-amber-900/5",
        className
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-4">
        <div className="flex gap-3">
          {/* 콘텐츠 - 항상 왼쪽 고정 */}
          <div className="flex-1 min-w-0">
            {/* 상단 배지: 상태 + 카테고리만 (고정 배지 제거) */}
            <div className="flex items-center gap-1.5 mb-2">
              {/* 해결됨/미해결 표시 (질문/트러블슈팅) */}
              {(post.category === 'question' || post.category === 'troubleshooting') && (
                post.is_solved ? (
                  <Badge className="text-[10px] px-1.5 py-0 h-5 font-medium bg-green-500/90 text-white hover:bg-green-500">
                    <CheckCircle2 className="w-3 h-3 mr-0.5" />
                    {t('community.solved', '해결')}
                  </Badge>
                ) : (
                  <Badge className="text-[10px] px-1.5 py-0 h-5 font-medium bg-orange-500/90 text-white hover:bg-orange-500">
                    <AlertCircle className="w-3 h-3 mr-0.5" />
                    {t('community.unsolved', '미해결')}
                  </Badge>
                )
              )}
              {/* 카테고리 배지 */}
              <Badge className={cn("text-[10px] px-1.5 py-0 h-5 font-normal", CATEGORY_COLORS[post.category])}>
                <span className="mr-0.5 text-[9px]">{CATEGORY_ICONS[post.category]}</span>
                {getCategoryLabel(post.category)}
              </Badge>
            </div>

            {/* 제목 - 1줄, 크게 */}
            <h3 className="font-semibold text-[15px] leading-snug line-clamp-1 mb-1">
              {post.title}
            </h3>

            {/* 본문 요약 - 1줄로 제한 */}
            {contentSummary && (
              <p className="text-sm text-muted-foreground/80 line-clamp-1 mb-2">
                {contentSummary}
              </p>
            )}

            {/* 태그 - 2개만, 스타일 톤다운 */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex items-center gap-1">
                {post.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] text-muted-foreground/70 hover:text-primary cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTagClick?.(tag);
                    }}
                  >
                    #{tag}
                  </span>
                ))}
                {post.tags.length > 2 && (
                  <span className="text-[11px] text-muted-foreground/50">
                    +{post.tags.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 썸네일 - 적당한 크기 */}
          {post.images && post.images.length > 0 ? (
            <div className="shrink-0">
              <div className="relative">
                <img
                  src={post.images[0]}
                  alt=""
                  className="w-20 h-20 object-cover rounded-lg bg-muted/50"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                {/* 이미지 개수 표시 (2개 이상일 때) */}
                {post.images.length > 1 && (
                  <div className="absolute bottom-1 right-1 bg-black/70 rounded px-1.5 py-0.5">
                    <span className="text-[10px] text-white font-medium">+{post.images.length - 1}</span>
                  </div>
                )}
              </div>
            </div>
          ) : thumbnail.type !== 'none' && (
            <div className="shrink-0">
              {/* 모델 썸네일 */}
              {(thumbnail.type === 'model' || thumbnail.type === 'image') && thumbnail.url && (
                <div className="relative">
                  <img
                    src={thumbnail.url}
                    alt=""
                    className="w-20 h-20 object-cover rounded-lg bg-muted/50"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  {thumbnail.type === 'model' && (
                    <div className="absolute bottom-1 right-1 bg-black/70 rounded p-0.5">
                      <Box className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              )}
              {/* 3D 모델 임베드 (썸네일 없음) */}
              {thumbnail.type === '3d-embed' && thumbnail.model3d && (
                <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-border/50 flex flex-col items-center justify-center">
                  <Box className="w-7 h-7 text-blue-400" />
                  <span className="text-[9px] text-muted-foreground mt-0.5 uppercase">
                    {thumbnail.model3d.type}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터: 작성자 + 메타정보(프린터/소재) + 통계 */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2.5 pt-2.5 border-t border-border/30">
          {/* 왼쪽: 작성자 + 시간 + 프린터/소재 메타 */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Avatar className="w-4 h-4">
              <AvatarImage src={getDisplayAvatar(post.author, post.author_display_type)} />
              <AvatarFallback className="text-[8px]">
                {getDisplayName(post.author, post.author_display_type, authorFallbacks).charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate max-w-[80px]">{getDisplayName(post.author, post.author_display_type, authorFallbacks)}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="shrink-0">{getRelativeTime(post.created_at)}</span>

            {/* 트러블슈팅 메타 (프린터/소재) - 푸터로 이동 */}
            {hasTroubleshootingMeta && (meta?.printer_model || meta?.filament_type) && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                  {meta?.printer_model && (
                    <span className="truncate max-w-[60px]">{meta.printer_model}</span>
                  )}
                  {meta?.printer_model && meta?.filament_type && (
                    <span className="text-muted-foreground/30">/</span>
                  )}
                  {meta?.filament_type && (
                    <span>{meta.filament_type}</span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* 오른쪽: 통계 - 조회/댓글 기본, 좋아요/싫어요는 hover시만 */}
          <div className="flex items-center gap-2 shrink-0">
            {/* 좋아요/싫어요 - hover시에만 표시 */}
            <div className={cn(
              "flex items-center gap-2 transition-opacity duration-200",
              isHovered ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
            )}>
              <span className={cn(
                "flex items-center gap-0.5",
                post.is_liked && "text-primary"
              )}>
                <ThumbsUp className={cn("w-3 h-3", post.is_liked && "fill-current")} />
                {post.like_count}
              </span>
              {(post.dislike_count ?? 0) > 0 && (
                <span className={cn(
                  "flex items-center gap-0.5",
                  post.is_disliked && "text-destructive"
                )}>
                  <ThumbsDown className={cn("w-3 h-3", post.is_disliked && "fill-current")} />
                  {post.dislike_count}
                </span>
              )}
            </div>

            {/* 조회수/댓글 - 항상 표시 */}
            <span className="flex items-center gap-0.5">
              <Eye className="w-3 h-3" />
              {post.view_count}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageCircle className="w-3 h-3" />
              {post.comment_count}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default PostCard;
