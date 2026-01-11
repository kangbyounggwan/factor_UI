/**
 * PostCard 컴포넌트
 * 커뮤니티 게시물 카드
 */
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Eye, Pin, CheckCircle2, AlertCircle, Box } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommunityPost, PostCategory } from "@shared/services/supabaseService/community";

// 썸네일 타입
type ThumbnailType = 'image' | 'model' | 'none';

// 카테고리 색상 맵
const CATEGORY_COLORS: Record<PostCategory, string> = {
  showcase: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  question: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  troubleshooting: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  tip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  review: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  free: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400',
};

// 카테고리 아이콘
const CATEGORY_ICONS: Record<PostCategory, string> = {
  showcase: '🎨',
  question: '❓',
  troubleshooting: '🔧',
  tip: '💡',
  review: '⭐',
  free: '💬',
};

interface PostCardProps {
  post: CommunityPost;
  onClick?: () => void;
  onTagClick?: (tag: string) => void;
  className?: string;
}

export function PostCard({ post, onClick, onTagClick, className }: PostCardProps) {
  const { t } = useTranslation();

  // 썸네일 정보 결정 (이미지 > 모델 썸네일 순으로 우선)
  const getThumbnailInfo = (): { type: ThumbnailType; url?: string } => {
    // 첨부된 이미지가 있으면 첫 번째 이미지 사용
    if (post.images && post.images.length > 0) {
      return { type: 'image', url: post.images[0] };
    }
    // 첨부된 모델이 있고 썸네일이 있으면 모델 썸네일 사용
    if (post.model?.thumbnail_url) {
      return { type: 'model', url: post.model.thumbnail_url };
    }
    return { type: 'none' };
  };

  const thumbnail = getThumbnailInfo();

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
      showcase: t('community.category.showcase', '자랑'),
      question: t('community.category.question', '질문'),
      troubleshooting: t('community.category.troubleshooting', '트러블슈팅'),
      tip: t('community.category.tip', '팁'),
      review: t('community.category.review', '리뷰'),
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
          {/* 썸네일 (이미지 또는 모델) */}
          {thumbnail.type !== 'none' && thumbnail.url && (
            <div className="shrink-0 relative">
              <img
                src={thumbnail.url}
                alt=""
                className="w-20 h-20 object-cover rounded-lg bg-muted"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
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

            {/* 제목 */}
            <h3 className="font-medium text-base line-clamp-1 mb-2">
              {post.title}
            </h3>

            {/* 트러블슈팅 메타 정보 */}
            {post.category === 'troubleshooting' && post.troubleshooting_meta && (
              <div className="flex flex-wrap gap-1.5 mb-2 text-xs">
                {post.troubleshooting_meta.printer_model && (
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {post.troubleshooting_meta.printer_model}
                  </span>
                )}
                {post.troubleshooting_meta.filament_type && (
                  <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    {post.troubleshooting_meta.filament_type}
                  </span>
                )}
                {post.troubleshooting_meta.slicer && (
                  <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                    {post.troubleshooting_meta.slicer}
                  </span>
                )}
                {post.troubleshooting_meta.symptom_tags && post.troubleshooting_meta.symptom_tags.length > 0 && (
                  <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    {post.troubleshooting_meta.symptom_tags[0]}
                  </span>
                )}
              </div>
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
                  <AvatarImage src={post.author?.avatar_url} />
                  <AvatarFallback className="text-[10px]">
                    {post.author?.username?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span>{post.author?.username || t('community.anonymous', '익명')}</span>
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
                  post.is_liked && "text-red-500"
                )}>
                  <Heart className={cn("w-3.5 h-3.5", post.is_liked && "fill-current")} />
                  {post.like_count}
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
