/**
 * CommunityPost Page
 * 커뮤니티 게시물 상세 페이지
 * - 게시물 내용
 * - 댓글 목록
 * - 좋아요/공유
 * - 웹/모바일 반응형 레이아웃 (웹: 사이드바+헤더, 모바일: 기존 레이아웃)
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@shared/contexts/AuthContext";
import { useSEO } from "@/hooks/useSEO";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useSidebarState } from "@/hooks/useSidebarState";
import { cn } from "@/lib/utils";
import { useUserPlan } from "@shared/hooks/useUserPlan";

// UI Components
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Loader2,
  ArrowLeft,
  Heart,
  MessageCircle,
  Eye,
  Share2,
  MoreVertical,
  Edit,
  Trash2,
  Send,
  ChevronDown,
  ChevronUp,
  X,
  Calendar,
  ExternalLink,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Layout Components
import { AppHeader } from "@/components/common/AppHeader";
import { AppSidebar } from "@/components/common/AppSidebar";
import { SharedBottomNavigation } from "@/components/shared/SharedBottomNavigation";
import { LoginPromptModal } from "@/components/auth/LoginPromptModal";

// Community Components
import { ContentRenderer } from "@/components/community/ContentRenderer";

// Services
import {
  getPost,
  getComments,
  createComment,
  deletePost,
  deleteComment,
  togglePostLike,
  toggleCommentLike,
  type CommunityPost,
  type PostComment,
  type PostCategory,
} from "@shared/services/supabaseService/community";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@shared/constants/community";

export default function CommunityPostPage() {
  const { postId } = useParams<{ postId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { plan: userPlan } = useUserPlan(user?.id);

  // SEO
  useSEO('community');

  // 사이드바 상태 (localStorage 연동)
  const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebarState(true);

  // 상태
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<{ commentId: string; username: string } | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  // 모달 상태
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'post' | 'comment'; id: string } | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);


  // 로그아웃 핸들러
  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      navigate('/community');
    } catch (error) {
      console.error('[CommunityPost] Sign out error:', error);
    }
  }, [signOut, navigate]);

  // 데이터 로드
  const loadPost = useCallback(async () => {
    if (!postId) return;

    setLoading(true);
    try {
      const data = await getPost(postId, user?.id);
      if (data) {
        setPost(data);
      } else {
        navigate('/community', { replace: true });
      }
    } catch (error) {
      console.error('[CommunityPost] Error loading post:', error);
      navigate('/community', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [postId, user?.id, navigate]);

  const loadComments = useCallback(async () => {
    if (!postId) return;

    setCommentLoading(true);
    try {
      const data = await getComments(postId, user?.id);
      setComments(data);
    } catch (error) {
      console.error('[CommunityPost] Error loading comments:', error);
    } finally {
      setCommentLoading(false);
    }
  }, [postId, user?.id]);

  useEffect(() => {
    loadPost();
    loadComments();
  }, [loadPost, loadComments]);

  // 좋아요 토글
  const handleLikePost = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!post) return;

    const result = await togglePostLike(post.id, user.id);
    if (result) {
      setPost(prev => prev ? {
        ...prev,
        is_liked: result.liked,
        like_count: result.likeCount,
      } : null);
    }
  };

  // 댓글 좋아요
  const handleLikeComment = async (commentId: string) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    const result = await toggleCommentLike(commentId, user.id);
    if (result) {
      setComments(prev => prev.map(comment => {
        if (comment.id === commentId) {
          return { ...comment, is_liked: result.liked, like_count: result.likeCount };
        }
        if (comment.replies) {
          return {
            ...comment,
            replies: comment.replies.map(reply =>
              reply.id === commentId
                ? { ...reply, is_liked: result.liked, like_count: result.likeCount }
                : reply
            ),
          };
        }
        return comment;
      }));
    }
  };

  // 댓글 작성
  const handleSubmitComment = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!post || !newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const comment = await createComment(
        post.id,
        user.id,
        newComment.trim(),
        replyTo?.commentId
      );

      if (comment) {
        if (replyTo) {
          // 대댓글 추가
          setComments(prev => prev.map(c =>
            c.id === replyTo.commentId
              ? { ...c, replies: [...(c.replies || []), comment] }
              : c
          ));
          setExpandedReplies(prev => new Set(prev).add(replyTo.commentId));
        } else {
          // 새 댓글 추가
          setComments(prev => [...prev, comment]);
        }
        setNewComment('');
        setReplyTo(null);
        setPost(prev => prev ? { ...prev, comment_count: prev.comment_count + 1 } : null);
      }
    } catch (error) {
      console.error('[CommunityPost] Error creating comment:', error);
      toast({
        title: t('community.error.commentFailed', '댓글 작성 실패'),
        variant: 'destructive',
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  // 삭제 핸들러
  const handleDelete = async () => {
    if (!user || !deleteTarget) return;

    try {
      if (deleteTarget.type === 'post' && post) {
        const success = await deletePost(post.id, user.id);
        if (success) {
          toast({ title: t('community.postDeleted', '게시물이 삭제되었습니다') });
          navigate('/community', { replace: true });
        }
      } else if (deleteTarget.type === 'comment' && post) {
        const success = await deleteComment(deleteTarget.id, user.id, post.id);
        if (success) {
          setComments(prev => prev.filter(c => {
            if (c.id === deleteTarget.id) return false;
            if (c.replies) {
              c.replies = c.replies.filter(r => r.id !== deleteTarget.id);
            }
            return true;
          }));
          setPost(prev => prev ? { ...prev, comment_count: Math.max(0, prev.comment_count - 1) } : null);
          toast({ title: t('community.commentDeleted', '댓글이 삭제되었습니다') });
        }
      }
    } catch (error) {
      console.error('[CommunityPost] Error deleting:', error);
      toast({
        title: t('community.error.deleteFailed', '삭제 실패'),
        variant: 'destructive',
      });
    } finally {
      setShowDeleteModal(false);
      setDeleteTarget(null);
    }
  };

  // 공유
  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: t('community.linkCopied', '링크가 복사되었습니다') });
    } catch {
      toast({
        title: t('community.error.copyFailed', '복사 실패'),
        variant: 'destructive',
      });
    }
  };

  // 대댓글 토글
  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  // 상대적 시간
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!post) {
    return null;
  }

  const isAuthor = user?.id === post.user_id;

  // 게시물 콘텐츠 렌더링 (웹/모바일 공통)
  const renderPostContent = () => (
    <>
      {/* 게시물 헤더 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge className={cn("text-xs", CATEGORY_COLORS[post.category])}>
            <span className="mr-0.5">{CATEGORY_ICONS[post.category]}</span>
            {t(`community.category.${post.category}`, post.category)}
          </Badge>
        </div>
        <h1 className="text-xl md:text-2xl font-bold mb-3">{post.title}</h1>
        {/* 모바일에서만 작성자 정보 표시 (웹에서는 오른쪽 패널에 표시) */}
        {isMobile && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={post.author?.avatar_url} />
                <AvatarFallback>{post.author?.username?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <span className="font-medium text-sm">{post.author?.username}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{getRelativeTime(post.created_at)}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" /> {post.view_count}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Separator className="my-4" />

      {/* 게시물 내용 (3D 모델 임베드 지원) */}
      <ContentRenderer
        content={post.content}
        className="mb-4"
        postId={post.id}
      />

      {/* 이미지 */}
      {post.images && post.images.length > 0 && (
        <div className={cn(
          "grid gap-2 mb-4",
          post.images.length === 1 ? "grid-cols-1" : "grid-cols-2 md:grid-cols-3"
        )}>
          {post.images.map((url, index) => (
            <img
              key={index}
              src={url}
              alt=""
              className={cn(
                "w-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity",
                post.images && post.images.length === 1 ? "max-h-96" : "aspect-square"
              )}
              onClick={() => setSelectedImage(url)}
            />
          ))}
        </div>
      )}

      {/* 태그 */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {post.tags.map((tag) => (
            <Link key={tag} to={`/community?tag=${tag}`}>
              <Badge variant="secondary" className="text-xs hover:bg-secondary/80">
                #{tag}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex items-center gap-3 py-3 border-t border-b">
        <Button
          variant="ghost"
          size="sm"
          className={cn(post.is_liked && "text-red-500")}
          onClick={handleLikePost}
        >
          <Heart className={cn("w-4 h-4 mr-1", post.is_liked && "fill-current")} />
          {post.like_count}
        </Button>
        <Button variant="ghost" size="sm">
          <MessageCircle className="w-4 h-4 mr-1" />
          {post.comment_count}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleShare}>
          <Share2 className="w-4 h-4 mr-1" />
          {t('common.share', '공유')}
        </Button>
        {/* 웹에서 수정/삭제 버튼 표시 (모바일은 헤더에 표시) */}
        {!isMobile && isAuthor && (
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/community/${post.id}/edit`)}
            >
              <Edit className="w-4 h-4 mr-1" />
              {t('common.edit', '수정')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                setDeleteTarget({ type: 'post', id: post.id });
                setShowDeleteModal(true);
              }}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              {t('common.delete', '삭제')}
            </Button>
          </div>
        )}
      </div>
    </>
  );

  // 댓글 섹션 렌더링
  const renderComments = () => (
    <div className="mt-6">
      <h3 className="font-semibold mb-4">
        {t('community.comments', '댓글')} {post.comment_count}
      </h3>

      {/* 댓글 작성 */}
      <Card className="mb-4">
        <CardContent className="p-3">
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
              <span>@{replyTo.username}</span>
              <button onClick={() => setReplyTo(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              placeholder={
                replyTo
                  ? t('community.replyPlaceholder', '답글을 입력하세요')
                  : t('community.commentPlaceholder', '댓글을 입력하세요')
              }
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={2}
              className="resize-none flex-1"
            />
            <Button
              size="icon"
              onClick={handleSubmitComment}
              disabled={submittingComment || !newComment.trim()}
            >
              {submittingComment ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 댓글 목록 */}
      {commentLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t('community.noComments', '첫 번째 댓글을 작성해보세요!')}
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id}>
              {/* 댓글 */}
              <div className="flex gap-3">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={comment.author?.avatar_url} />
                  <AvatarFallback>
                    {comment.author?.username?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{comment.author?.username}</span>
                    <span className="text-xs text-muted-foreground">
                      {getRelativeTime(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap mb-2">{comment.content}</p>
                  <div className="flex items-center gap-3 text-xs">
                    <button
                      className={cn(
                        "flex items-center gap-1 text-muted-foreground hover:text-foreground",
                        comment.is_liked && "text-red-500"
                      )}
                      onClick={() => handleLikeComment(comment.id)}
                    >
                      <Heart className={cn("w-3.5 h-3.5", comment.is_liked && "fill-current")} />
                      {comment.like_count > 0 && comment.like_count}
                    </button>
                    <button
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setReplyTo({ commentId: comment.id, username: comment.author?.username || '' })}
                    >
                      {t('community.reply', '답글')}
                    </button>
                    {user?.id === comment.user_id && (
                      <button
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setDeleteTarget({ type: 'comment', id: comment.id });
                          setShowDeleteModal(true);
                        }}
                      >
                        {t('common.delete', '삭제')}
                      </button>
                    )}
                  </div>

                  {/* 대댓글 토글 */}
                  {comment.replies && comment.replies.length > 0 && (
                    <button
                      className="flex items-center gap-1 mt-2 text-xs text-primary"
                      onClick={() => toggleReplies(comment.id)}
                    >
                      {expandedReplies.has(comment.id) ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          {t('community.hideReplies', '답글 숨기기')}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          {t('community.showReplies', '답글 {{count}}개 보기', { count: comment.replies.length })}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* 대댓글 목록 */}
              {comment.replies && comment.replies.length > 0 && expandedReplies.has(comment.id) && (
                <div className="ml-11 mt-3 space-y-3 pl-3 border-l-2">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="flex gap-3">
                      <Avatar className="w-6 h-6 shrink-0">
                        <AvatarImage src={reply.author?.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {reply.author?.username?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-xs">{reply.author?.username}</span>
                          <span className="text-xs text-muted-foreground">
                            {getRelativeTime(reply.created_at)}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap mb-1">{reply.content}</p>
                        <div className="flex items-center gap-3 text-xs">
                          <button
                            className={cn(
                              "flex items-center gap-1 text-muted-foreground hover:text-foreground",
                              reply.is_liked && "text-red-500"
                            )}
                            onClick={() => handleLikeComment(reply.id)}
                          >
                            <Heart className={cn("w-3 h-3", reply.is_liked && "fill-current")} />
                            {reply.like_count > 0 && reply.like_count}
                          </button>
                          {user?.id === reply.user_id && (
                            <button
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                setDeleteTarget({ type: 'comment', id: reply.id });
                                setShowDeleteModal(true);
                              }}
                            >
                              {t('common.delete', '삭제')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // 웹 레이아웃 오른쪽 패널 (작성자 정보 + 게시물 정보)
  const renderRightPanel = () => (
    <div className="w-72 shrink-0 space-y-4">
      {/* 작성자 정보 카드 */}
      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {t('community.author', '작성자')}
          </h3>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="w-12 h-12">
              <AvatarImage src={post.author?.avatar_url} />
              <AvatarFallback className="text-lg">
                {post.author?.username?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{post.author?.username}</p>
              <p className="text-xs text-muted-foreground">
                {t('community.memberSince', '회원')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 게시물 정보 카드 */}
      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {t('community.postInfo', '게시물 정보')}
          </h3>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>{new Date(post.created_at).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <span>{t('community.views', '조회수')} {post.view_count}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Heart className="w-4 h-4 text-muted-foreground" />
            <span>{t('community.likes', '좋아요')} {post.like_count}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MessageCircle className="w-4 h-4 text-muted-foreground" />
            <span>{t('community.commentsCount', '댓글')} {post.comment_count}</span>
          </div>
        </CardContent>
      </Card>

      {/* 목록으로 돌아가기 버튼 */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => navigate('/community')}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        {t('community.backToList', '목록으로')}
      </Button>
    </div>
  );

  // ===== 모바일 레이아웃 =====
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col pb-16">
        {/* 모바일 헤더 */}
        <AppHeader
          leftContent={
            <Button variant="ghost" size="icon" onClick={() => navigate('/community')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          }
          rightContent={
            isAuthor && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate(`/community/${post.id}/edit`)}>
                    <Edit className="w-4 h-4 mr-2" />
                    {t('common.edit', '수정')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => {
                      setDeleteTarget({ type: 'post', id: post.id });
                      setShowDeleteModal(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('common.delete', '삭제')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )
          }
        />

        {/* 모바일 메인 콘텐츠 */}
        <div className="flex-1 container mx-auto px-4 py-4 max-w-3xl">
          {renderPostContent()}
          {renderComments()}
        </div>

        {/* 모바일 하단 네비게이션 */}
        <SharedBottomNavigation />

        {/* 모달들 */}
        {renderModals()}
      </div>
    );
  }

  // ===== 웹 레이아웃 (데스크톱) =====
  return (
    <div className="h-screen bg-background flex">
      {/* 사이드바 (데스크탑) - Community.tsx와 동일한 구조 */}
      <AppSidebar
        mode="community"
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        user={user}
        userPlan={userPlan}
        onLoginClick={() => setShowLoginModal(true)}
        onSignOut={handleSignOut}
      />

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 헤더 */}
        <AppHeader
          sidebarOpen={sidebarOpen}
          onLoginRequired={() => setShowLoginModal(true)}
        />

        {/* 콘텐츠 영역 */}
        <div className="flex-1 flex justify-center overflow-auto">
          <div className="flex gap-6 w-full max-w-7xl px-6 py-6">
            {/* 중앙 콘텐츠 영역 */}
            <div className="flex-1 min-w-0">
              <Card className="p-6">
                {renderPostContent()}
                {renderComments()}
              </Card>
            </div>

            {/* 오른쪽 패널 - lg 이상에서만 표시 */}
            <div className="hidden lg:block">
              {renderRightPanel()}
            </div>
          </div>
        </div>
      </div>

      {/* 모달들 */}
      {renderModals()}
    </div>
  );

  // 모달 렌더링 함수
  function renderModals() {
    return (
      <>
        {/* 이미지 확대 모달 */}
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
            {selectedImage && (
              <div className="relative">
                <button
                  className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white"
                  onClick={() => setSelectedImage(null)}
                >
                  <X className="w-5 h-5" />
                </button>
                <img
                  src={selectedImage}
                  alt=""
                  className="w-full max-h-[90vh] object-contain"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* 삭제 확인 모달 */}
        <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {deleteTarget?.type === 'post'
                  ? t('community.deletePostTitle', '게시물 삭제')
                  : t('community.deleteCommentTitle', '댓글 삭제')
                }
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget?.type === 'post'
                  ? t('community.deletePostDesc', '이 게시물을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')
                  : t('community.deleteCommentDesc', '이 댓글을 삭제하시겠습니까?')
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel', '취소')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                {t('common.delete', '삭제')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 로그인 유도 모달 */}
        <LoginPromptModal
          open={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          title={t('community.loginRequired', '로그인이 필요합니다')}
          description={t('community.loginRequiredDesc', '이 기능을 사용하려면 로그인이 필요합니다.')}
        />
      </>
    );
  }
}
