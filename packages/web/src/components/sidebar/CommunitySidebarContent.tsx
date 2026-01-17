/**
 * Community 모드 사이드바 콘텐츠
 * - 커뮤니티 통계
 * - 내가 쓴 글 (최근 5개)
 * - 내가 쓴 댓글 (최근 5개)
 */
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  FileText,
  MessageSquare,
  Users,
  ThumbsUp,
  Clock,
  Edit3,
  ChevronRight,
} from "lucide-react";
import type { CommunitySidebarStats, MyRecentPostItem, MyRecentCommentItem } from "./types";

interface CommunitySidebarContentProps {
  communityStats?: CommunitySidebarStats | null;
  myPosts?: MyRecentPostItem[];
  myComments?: MyRecentCommentItem[];
}

// 카테고리 색상 매핑
const CATEGORY_STYLES: Record<string, { color: string }> = {
  showcase: { color: 'text-purple-500' },
  question: { color: 'text-blue-500' },
  failure: { color: 'text-orange-500' },
  free: { color: 'text-gray-500' },
  troubleshooting: { color: 'text-red-500' },
};

// 상대 시간 포맷
function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export function CommunitySidebarContent({
  communityStats,
  myPosts = [],
  myComments = [],
}: CommunitySidebarContentProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      {/* 커뮤니티 통계 */}
      {communityStats && (
        <div>
          <div className="flex items-center gap-2 px-2 py-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">
              {t('community.stats', '커뮤니티 현황')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 px-1">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border/60">
              <FileText className="w-4 h-4 text-blue-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">{t('community.totalPosts', '총 게시물')}</p>
                <p className="font-semibold text-sm">{communityStats.totalPosts.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border/60">
              <MessageSquare className="w-4 h-4 text-green-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">{t('community.totalComments', '총 댓글')}</p>
                <p className="font-semibold text-sm">{communityStats.totalComments.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border/60">
              <Users className="w-4 h-4 text-purple-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">{t('community.totalMembers', '가입자')}</p>
                <p className="font-semibold text-sm">{communityStats.totalUsers.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border/60">
              <ThumbsUp className="w-4 h-4 text-red-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">{t('community.totalLikes', '총 좋아요')}</p>
                <p className="font-semibold text-sm">{communityStats.totalLikes.toLocaleString()}</p>
              </div>
            </div>
          </div>
          {communityStats.todayPosts > 0 && (
            <div className="mt-2 mx-1 flex items-center gap-2 text-xs text-muted-foreground px-2">
              <Clock className="w-3.5 h-3.5" />
              {t('community.todayPosts', '오늘 {{count}}개의 새 글', { count: communityStats.todayPosts })}
            </div>
          )}
        </div>
      )}

      {/* 내가 쓴 글 */}
      <div>
        <div className="flex items-center gap-2 px-2 py-2">
          <Edit3 className="w-4 h-4 text-blue-500" />
          <p className="text-sm font-semibold text-foreground">
            {t('community.myPosts', '내가 쓴 글')}
          </p>
        </div>
        {myPosts.length > 0 ? (
          <div className="space-y-1 px-1">
            {myPosts.map((post) => (
              <Link
                key={post.id}
                to={`/community/${post.id}`}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg transition-colors",
                  "hover:bg-muted/50 group"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {post.title}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className={CATEGORY_STYLES[post.category]?.color || 'text-gray-500'}>
                      {t(`community.category.${post.category}`, post.category)}
                    </span>
                    <span>·</span>
                    <span>{formatRelativeTime(post.created_at)}</span>
                    {post.comment_count > 0 && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <MessageSquare className="w-3 h-3" />
                          {post.comment_count}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-muted-foreground">
              {t('community.noMyPosts', '작성한 글이 없습니다')}
            </p>
          </div>
        )}
      </div>

      {/* 내가 쓴 댓글 */}
      <div>
        <div className="flex items-center gap-2 px-2 py-2">
          <MessageSquare className="w-4 h-4 text-green-500" />
          <p className="text-sm font-semibold text-foreground">
            {t('community.myComments', '내가 쓴 댓글')}
          </p>
        </div>
        {myComments.length > 0 ? (
          <div className="space-y-1 px-1">
            {myComments.map((comment) => (
              <Link
                key={comment.id}
                to={`/community/${comment.post_id}#comment-${comment.id}`}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg transition-colors",
                  "hover:bg-muted/50 group"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate group-hover:text-primary transition-colors">
                    {comment.content.replace(/<[^>]*>/g, '').slice(0, 50)}
                    {comment.content.length > 50 && '...'}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="truncate max-w-[120px]">{comment.post_title}</span>
                    <span>·</span>
                    <span>{formatRelativeTime(comment.created_at)}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-muted-foreground">
              {t('community.noMyComments', '작성한 댓글이 없습니다')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CommunitySidebarContent;
