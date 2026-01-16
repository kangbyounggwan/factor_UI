/**
 * CommunityPost Page
 * 커뮤니티 게시물 상세 페이지
 * - 게시물 내용
 * - 댓글 목록
 * - 좋아요/공유
 * - 웹/모바일 반응형 레이아웃 (웹: 사이드바+헤더, 모바일: 기존 레이아웃)
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@shared/contexts/AuthContext";
import { useSEO, createCommunityPostSEO } from "@/hooks/useSEO";
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
  ImagePlus,
  Flame,
  ThumbsUp,
  ThumbsDown,
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
import { CommunitySidebarContent } from "@/components/sidebar";
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
  togglePostDislike,
  toggleCommentLike,
  toggleCommentDislike,
  uploadPostImage,
  getPopularPosts,
  getDisplayName,
  getDisplayAvatar,
  getCommunityStats,
  getMyRecentPosts,
  getMyRecentComments,
  type CommunityPost,
  type PostComment,
  type PostCategory,
  type CommunityStats,
  type MyRecentPost,
  type MyRecentComment,
} from "@shared/services/supabaseService/community";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@shared/constants/community";

export default function CommunityPostPage() {
  const { postId } = useParams<{ postId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { plan: userPlan } = useUserPlan(user?.id);

  // 댓글 하이라이트를 위한 ref와 상태
  const commentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);

  // i18n 번역된 폴백 텍스트
  const authorFallbacks = {
    unknown: t('community.unknownAuthor'),
    anonymous: t('community.anonymous'),
  };

  // 사이드바 상태 (localStorage 연동)
  const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebarState(true);

  // 상태 - post를 먼저 선언해야 SEO에서 사용 가능
  const [post, setPost] = useState<CommunityPost | null>(null);

  // SEO - 게시물 데이터 기반 동적 SEO
  const seoData = post
    ? createCommunityPostSEO({
        title: post.title,
        category: post.category,
        content: post.content,
        author: post.profiles?.display_name || post.profiles?.full_name,
        created_at: post.created_at,
        thumbnail: post.images?.[0],
      })
    : { title: '게시물 로딩 중... | FACTOR 커뮤니티', description: '', keywords: [] };
  useSEO(seoData);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentImages, setCommentImages] = useState<string[]>([]);
  const [uploadingCommentImage, setUploadingCommentImage] = useState(false);
  const [replyTo, setReplyTo] = useState<{ commentId: string; username: string } | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyImages, setReplyImages] = useState<string[]>([]);
  const [uploadingReplyImage, setUploadingReplyImage] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  // 모달 상태
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'post' | 'comment'; id: string } | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // 인기 게시물 상태
  const [popularPosts, setPopularPosts] = useState<CommunityPost[]>([]);

  // 커뮤니티 통계 상태
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);

  // 내 글/댓글 상태
  const [myPosts, setMyPosts] = useState<MyRecentPost[]>([]);
  const [myComments, setMyComments] = useState<MyRecentComment[]>([]);


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

      // 답글이 있는 모든 댓글을 기본으로 펼치기
      const commentsWithReplies = data
        .filter(c => c.replies && c.replies.length > 0)
        .map(c => c.id);
      if (commentsWithReplies.length > 0) {
        setExpandedReplies(new Set(commentsWithReplies));
      }
    } catch (error) {
      console.error('[CommunityPost] Error loading comments:', error);
    } finally {
      setCommentLoading(false);
    }
  }, [postId, user?.id]);

  // 인기 게시물 로드
  const loadPopularPosts = useCallback(async () => {
    try {
      const data = await getPopularPosts(5);
      setPopularPosts(data);
    } catch (error) {
      console.error('[CommunityPost] Error loading popular posts:', error);
    }
  }, []);

  useEffect(() => {
    loadPost();
    loadComments();
    loadPopularPosts();
    // 커뮤니티 통계 로드
    getCommunityStats().then(stats => {
      if (stats) setCommunityStats(stats);
    });
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
  }, [loadPost, loadComments, loadPopularPosts, user]);

  // URL hash에서 댓글 ID 추출 후 스크롤 및 하이라이트
  useEffect(() => {
    const hash = location.hash;
    if (hash && hash.startsWith('#comment-') && comments.length > 0) {
      const commentId = hash.replace('#comment-', '');

      // 먼저 댓글인지 대댓글인지 확인
      const isTopLevelComment = comments.some(c => c.id === commentId);

      if (!isTopLevelComment) {
        // 대댓글인 경우, 부모 댓글을 찾아서 replies 펼치기
        const parentComment = comments.find(c =>
          c.replies?.some(r => r.id === commentId)
        );
        if (parentComment) {
          setExpandedReplies(prev => new Set([...prev, parentComment.id]));
        }
      }

      // 약간의 딜레이 후 스크롤 (DOM 렌더링 대기)
      setTimeout(() => {
        const commentElement = commentRefs.current.get(commentId);
        if (commentElement) {
          commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightedCommentId(commentId);

          // 3초 후 하이라이트 해제
          setTimeout(() => {
            setHighlightedCommentId(null);
          }, 3000);
        }
      }, 500); // 대댓글 펼치는 시간을 위해 딜레이 약간 증가
    }
  }, [location.hash, comments]);

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
        is_disliked: result.disliked,
        like_count: result.likeCount,
        dislike_count: result.dislikeCount,
      } : null);
    }
  };

  // 비추천 토글
  const handleDislikePost = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!post) return;

    const result = await togglePostDislike(post.id, user.id);
    if (result) {
      setPost(prev => prev ? {
        ...prev,
        is_liked: result.liked,
        is_disliked: result.disliked,
        like_count: result.likeCount,
        dislike_count: result.dislikeCount,
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
          return {
            ...comment,
            is_liked: result.liked,
            is_disliked: result.disliked,
            like_count: result.likeCount,
            dislike_count: result.dislikeCount,
          };
        }
        if (comment.replies) {
          return {
            ...comment,
            replies: comment.replies.map(reply =>
              reply.id === commentId
                ? {
                    ...reply,
                    is_liked: result.liked,
                    is_disliked: result.disliked,
                    like_count: result.likeCount,
                    dislike_count: result.dislikeCount,
                  }
                : reply
            ),
          };
        }
        return comment;
      }));
    }
  };

  // 댓글 비추천
  const handleDislikeComment = async (commentId: string) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    const result = await toggleCommentDislike(commentId, user.id);
    if (result) {
      setComments(prev => prev.map(comment => {
        if (comment.id === commentId) {
          return {
            ...comment,
            is_liked: result.liked,
            is_disliked: result.disliked,
            like_count: result.likeCount,
            dislike_count: result.dislikeCount,
          };
        }
        if (comment.replies) {
          return {
            ...comment,
            replies: comment.replies.map(reply =>
              reply.id === commentId
                ? {
                    ...reply,
                    is_liked: result.liked,
                    is_disliked: result.disliked,
                    like_count: result.likeCount,
                    dislike_count: result.dislikeCount,
                  }
                : reply
            ),
          };
        }
        return comment;
      }));
    }
  };

  // 댓글 이미지 업로드 핸들러
  const handleCommentImageUpload = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (commentImages.length >= 3) {
      toast({
        title: t('community.error.maxImages', '이미지는 최대 3개까지 첨부할 수 있습니다'),
        variant: 'destructive',
      });
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length === 0) return;

      // 최대 3개 제한
      const remainingSlots = 3 - commentImages.length;
      const filesToUpload = files.slice(0, remainingSlots);

      setUploadingCommentImage(true);
      try {
        const uploadedUrls: string[] = [];
        for (const file of filesToUpload) {
          if (file.size > 5 * 1024 * 1024) {
            toast({
              title: t('community.error.imageTooLarge', '이미지가 너무 큽니다 (최대 5MB)'),
              variant: 'destructive',
            });
            continue;
          }
          const url = await uploadPostImage(user.id, file);
          if (url) {
            uploadedUrls.push(url);
          }
        }
        if (uploadedUrls.length > 0) {
          setCommentImages(prev => [...prev, ...uploadedUrls]);
        }
      } catch (error) {
        console.error('[CommunityPost] Error uploading image:', error);
        toast({
          title: t('community.error.uploadFailed', '이미지 업로드 실패'),
          variant: 'destructive',
        });
      } finally {
        setUploadingCommentImage(false);
      }
    };
    input.click();
  };

  // 댓글 이미지 삭제
  const handleRemoveCommentImage = (index: number) => {
    setCommentImages(prev => prev.filter((_, i) => i !== index));
  };

  // 답글 이미지 업로드 핸들러
  const handleReplyImageUpload = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (replyImages.length >= 3) {
      toast({
        title: t('community.error.maxImages', '이미지는 최대 3개까지 첨부할 수 있습니다'),
        variant: 'destructive',
      });
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length === 0) return;

      const remainingSlots = 3 - replyImages.length;
      const filesToUpload = files.slice(0, remainingSlots);

      setUploadingReplyImage(true);
      try {
        const uploadedUrls: string[] = [];
        for (const file of filesToUpload) {
          if (file.size > 5 * 1024 * 1024) {
            toast({
              title: t('community.error.imageTooLarge', '이미지가 너무 큽니다 (최대 5MB)'),
              variant: 'destructive',
            });
            continue;
          }
          const url = await uploadPostImage(user.id, file);
          if (url) {
            uploadedUrls.push(url);
          }
        }
        if (uploadedUrls.length > 0) {
          setReplyImages(prev => [...prev, ...uploadedUrls]);
        }
      } catch (error) {
        console.error('[CommunityPost] Error uploading reply image:', error);
        toast({
          title: t('community.error.uploadFailed', '이미지 업로드 실패'),
          variant: 'destructive',
        });
      } finally {
        setUploadingReplyImage(false);
      }
    };
    input.click();
  };

  // 답글 이미지 삭제
  const handleRemoveReplyImage = (index: number) => {
    setReplyImages(prev => prev.filter((_, i) => i !== index));
  };

  // 답글창 닫기
  const handleCancelReply = () => {
    setReplyTo(null);
    setReplyContent('');
    setReplyImages([]);
  };

  // 답글 작성
  const handleSubmitReply = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!post || !replyTo || (!replyContent.trim() && replyImages.length === 0)) return;

    setSubmittingReply(true);
    try {
      const comment = await createComment(
        post.id,
        user.id,
        replyContent.trim(),
        replyTo.commentId,
        replyImages.length > 0 ? replyImages : undefined
      );

      if (comment) {
        // 대댓글 추가
        setComments(prev => prev.map(c =>
          c.id === replyTo.commentId
            ? { ...c, replies: [...(c.replies || []), comment] }
            : c
        ));
        setExpandedReplies(prev => new Set(prev).add(replyTo.commentId));
        setReplyContent('');
        setReplyImages([]);
        setReplyTo(null);
        setPost(prev => prev ? { ...prev, comment_count: prev.comment_count + 1 } : null);
      }
    } catch (error) {
      console.error('[CommunityPost] Error creating reply:', error);
      toast({
        title: t('community.error.commentFailed', '답글 작성 실패'),
        variant: 'destructive',
      });
    } finally {
      setSubmittingReply(false);
    }
  };

  // 댓글 작성 (최상위 댓글만)
  const handleSubmitComment = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!post || (!newComment.trim() && commentImages.length === 0)) return;

    setSubmittingComment(true);
    try {
      const comment = await createComment(
        post.id,
        user.id,
        newComment.trim(),
        undefined,
        commentImages.length > 0 ? commentImages : undefined
      );

      if (comment) {
        // 새 댓글 추가
        setComments(prev => [...prev, comment]);
        setNewComment('');
        setCommentImages([]);
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
        {/* 작성자 정보 및 게시물 정보 (웹/모바일 공통) */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src={getDisplayAvatar(post.author, post.author_display_type)} />
              <AvatarFallback>{getDisplayName(post.author, post.author_display_type, authorFallbacks).charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <span className="font-medium text-sm">{getDisplayName(post.author, post.author_display_type, authorFallbacks)}</span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{new Date(post.created_at).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</span>
              </div>
            </div>
          </div>
          {/* 게시물 통계 */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {post.view_count}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-4 h-4" />
              {post.like_count}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-4 h-4" />
              {post.comment_count}
            </span>
          </div>
        </div>
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
        {/* 추천/비추천 버튼 그룹 */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-3 rounded-md",
              post.is_liked && "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
            onClick={handleLikePost}
          >
            <ThumbsUp className={cn("w-4 h-4 mr-1.5", post.is_liked && "fill-current")} />
            <span className="font-medium">{post.like_count}</span>
          </Button>
          <div className="w-px h-5 bg-border" />
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-3 rounded-md",
              post.is_disliked && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            )}
            onClick={handleDislikePost}
          >
            <ThumbsDown className={cn("w-4 h-4 mr-1.5", post.is_disliked && "fill-current")} />
            <span className="font-medium">{post.dislike_count || 0}</span>
          </Button>
        </div>
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
    <div className="mt-8">
      {/* 댓글 헤더 */}
      <div className="flex items-center gap-2 mb-6">
        <MessageCircle className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-bold">
          {t('community.comments', '댓글')}
        </h3>
        <span className="text-lg font-bold text-primary">{post.comment_count}</span>
      </div>

      {/* 댓글 작성 */}
      <Card className="mb-6 border-2 border-primary/20 shadow-sm">
        <CardContent className="p-5">
          {/* 첨부 이미지 미리보기 */}
          {commentImages.length > 0 && (
            <div className="flex gap-3 mb-4 flex-wrap">
              {commentImages.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt=""
                    className="w-20 h-20 object-cover rounded-lg border-2 shadow-sm"
                  />
                  <button
                    onClick={() => handleRemoveCommentImage(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Textarea
            placeholder={t('community.commentPlaceholder', '댓글을 입력하세요')}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
            className="resize-none mb-4 text-base border-2 border-muted focus:border-primary transition-colors"
          />
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="default"
              onClick={handleCommentImageUpload}
              disabled={uploadingCommentImage || commentImages.length >= 3}
              className="gap-2 h-10"
            >
              {uploadingCommentImage ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ImagePlus className="w-4 h-4" />
              )}
              {t('community.addImage', '이미지')}
              {commentImages.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {commentImages.length}/3
                </Badge>
              )}
            </Button>
            <Button
              onClick={handleSubmitComment}
              disabled={submittingComment || (!newComment.trim() && commentImages.length === 0)}
              size="default"
              className="gap-2 h-10 px-6"
            >
              {submittingComment ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {t('community.submit', '등록')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 댓글 목록 */}
      {commentLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12">
          <MessageCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground text-base">
            {t('community.noComments', '첫 번째 댓글을 작성해보세요!')}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {comments.map((comment, index) => (
            <div
              key={comment.id}
              id={`comment-${comment.id}`}
              ref={(el) => {
                if (el) commentRefs.current.set(comment.id, el);
              }}
            >
              {/* 댓글 */}
              <div className={cn(
                "flex gap-4 p-4 rounded-xl transition-all hover:bg-muted/50",
                index !== comments.length - 1 && "border-b",
                highlightedCommentId === comment.id && "bg-primary/10 ring-2 ring-primary/50 animate-pulse"
              )}>
                <Avatar className="w-10 h-10 shrink-0 ring-2 ring-background shadow-sm">
                  <AvatarImage src={comment.author?.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {comment.author?.username?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-base">{comment.author?.username}</span>
                    <span className="text-sm text-muted-foreground">
                      {getRelativeTime(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-base whitespace-pre-wrap mb-3 leading-relaxed">{comment.content}</p>
                  {/* 댓글 이미지 표시 */}
                  {comment.images && comment.images.length > 0 && (
                    <div className="flex gap-3 mb-3 flex-wrap">
                      {comment.images.map((url, imgIndex) => (
                        <img
                          key={imgIndex}
                          src={url}
                          alt=""
                          className="max-w-[220px] max-h-[160px] object-cover rounded-xl border-2 cursor-pointer hover:opacity-90 hover:shadow-lg transition-all"
                          onClick={() => setSelectedImage(url)}
                        />
                      ))}
                    </div>
                  )}
                  {/* 댓글 액션 버튼 */}
                  <div className="flex items-center gap-1">
                    {/* 추천 버튼 */}
                    <button
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                        comment.is_liked
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      onClick={() => handleLikeComment(comment.id)}
                    >
                      <ThumbsUp className={cn("w-4 h-4", comment.is_liked && "fill-current")} />
                      <span>{comment.like_count || 0}</span>
                    </button>
                    {/* 비추천 버튼 */}
                    <button
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                        comment.is_disliked
                          ? "bg-destructive/10 text-destructive"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      onClick={() => handleDislikeComment(comment.id)}
                    >
                      <ThumbsDown className={cn("w-4 h-4", comment.is_disliked && "fill-current")} />
                      <span>{comment.dislike_count || 0}</span>
                    </button>
                    {/* 답글 버튼 */}
                    <button
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                        replyTo?.commentId === comment.id
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      onClick={() => {
                        if (replyTo?.commentId === comment.id) {
                          handleCancelReply();
                        } else {
                          setReplyTo({ commentId: comment.id, username: comment.author?.username || '' });
                          setReplyContent('');
                          setReplyImages([]);
                        }
                      }}
                    >
                      <MessageCircle className="w-4 h-4" />
                      {t('community.reply', '답글')}
                    </button>
                    {/* 삭제 버튼 */}
                    {user?.id === comment.user_id && (
                      <button
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all ml-auto"
                        onClick={() => {
                          setDeleteTarget({ type: 'comment', id: comment.id });
                          setShowDeleteModal(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                        {t('common.delete', '삭제')}
                      </button>
                    )}
                  </div>

                  {/* 인라인 답글 입력창 */}
                  {replyTo?.commentId === comment.id && (
                    <div className="mt-4 p-4 bg-muted/30 rounded-xl border-2 border-primary/20">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="secondary" className="gap-1">
                          <span className="text-primary font-medium">@{replyTo.username}</span>
                        </Badge>
                        <span className="text-sm text-muted-foreground">{t('community.replyingTo', '님에게 답글 작성 중')}</span>
                        <button
                          onClick={handleCancelReply}
                          className="ml-auto p-1 rounded-full hover:bg-muted transition-colors"
                        >
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                      {/* 답글 이미지 미리보기 */}
                      {replyImages.length > 0 && (
                        <div className="flex gap-3 mb-3 flex-wrap">
                          {replyImages.map((url, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={url}
                                alt=""
                                className="w-16 h-16 object-cover rounded-lg border-2 shadow-sm"
                              />
                              <button
                                onClick={() => handleRemoveReplyImage(index)}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <Textarea
                        placeholder={t('community.replyPlaceholder', '답글을 입력하세요')}
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        rows={2}
                        className="resize-none mb-3 text-base bg-background border-2"
                        autoFocus
                      />
                      <div className="flex items-center justify-between">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleReplyImageUpload}
                          disabled={uploadingReplyImage || replyImages.length >= 3}
                          className="gap-1.5 h-9"
                        >
                          {uploadingReplyImage ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ImagePlus className="w-4 h-4" />
                          )}
                          {t('community.addImage', '이미지')}
                          {replyImages.length > 0 && (
                            <Badge variant="secondary" className="ml-1 text-xs">
                              {replyImages.length}/3
                            </Badge>
                          )}
                        </Button>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelReply}
                            className="h-9"
                          >
                            {t('common.cancel', '취소')}
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSubmitReply}
                            disabled={submittingReply || (!replyContent.trim() && replyImages.length === 0)}
                            className="h-9 gap-1.5"
                          >
                            {submittingReply ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            {t('community.submitReply', '답글 등록')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 대댓글 토글 */}
                  {comment.replies && comment.replies.length > 0 && (
                    <button
                      className={cn(
                        "flex items-center gap-2 mt-4 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                        expandedReplies.has(comment.id)
                          ? "bg-primary/10 text-primary"
                          : "bg-muted/50 text-primary hover:bg-primary/10"
                      )}
                      onClick={() => toggleReplies(comment.id)}
                    >
                      {expandedReplies.has(comment.id) ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          {t('community.hideReplies', '답글 숨기기')}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          {t('community.showReplies', '답글 {{count}}개 보기', { count: comment.replies.length })}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* 대댓글 목록 */}
              {comment.replies && comment.replies.length > 0 && expandedReplies.has(comment.id) && (
                <div className="ml-14 mt-4 space-y-2 pl-4 border-l-2 border-primary/20">
                  {comment.replies.map((reply) => (
                    <div
                      key={reply.id}
                      id={`comment-${reply.id}`}
                      ref={(el) => {
                        if (el) commentRefs.current.set(reply.id, el);
                      }}
                      className={cn(
                        "flex gap-3 p-3 rounded-lg hover:bg-muted/30 transition-all",
                        highlightedCommentId === reply.id && "bg-primary/10 ring-2 ring-primary/50 animate-pulse"
                      )}
                    >
                      <Avatar className="w-8 h-8 shrink-0 ring-2 ring-background shadow-sm">
                        <AvatarImage src={reply.author?.avatar_url} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                          {reply.author?.username?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-semibold text-sm">{reply.author?.username}</span>
                          <span className="text-xs text-muted-foreground">
                            {getRelativeTime(reply.created_at)}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap mb-2 leading-relaxed">{reply.content}</p>
                        {/* 대댓글 이미지 표시 */}
                        {reply.images && reply.images.length > 0 && (
                          <div className="flex gap-2 mb-3 flex-wrap">
                            {reply.images.map((url, imgIndex) => (
                              <img
                                key={imgIndex}
                                src={url}
                                alt=""
                                className="max-w-[160px] max-h-[120px] object-cover rounded-lg border-2 cursor-pointer hover:opacity-90 hover:shadow-md transition-all"
                                onClick={() => setSelectedImage(url)}
                              />
                            ))}
                          </div>
                        )}
                        {/* 대댓글 액션 버튼 */}
                        <div className="flex items-center gap-1">
                          {/* 추천 버튼 */}
                          <button
                            className={cn(
                              "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                              reply.is_liked
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                            onClick={() => handleLikeComment(reply.id)}
                          >
                            <ThumbsUp className={cn("w-3.5 h-3.5", reply.is_liked && "fill-current")} />
                            <span>{reply.like_count || 0}</span>
                          </button>
                          {/* 비추천 버튼 */}
                          <button
                            className={cn(
                              "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                              reply.is_disliked
                                ? "bg-destructive/10 text-destructive"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                            onClick={() => handleDislikeComment(reply.id)}
                          >
                            <ThumbsDown className={cn("w-3.5 h-3.5", reply.is_disliked && "fill-current")} />
                            <span>{reply.dislike_count || 0}</span>
                          </button>
                          {/* 삭제 버튼 */}
                          {user?.id === reply.user_id && (
                            <button
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all ml-auto"
                              onClick={() => {
                                setDeleteTarget({ type: 'comment', id: reply.id });
                                setShowDeleteModal(true);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

  // 웹 레이아웃 오른쪽 패널 (작성자 정보 + 인기 게시물)
  const renderRightPanel = () => (
    <div className="w-80 shrink-0 space-y-4">
      {/* 작성자 정보 카드 */}
      <Card>
        <CardHeader className="pb-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {t('community.author', '작성자')}
          </h3>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12">
              <AvatarImage src={getDisplayAvatar(post.author, post.author_display_type)} />
              <AvatarFallback className="text-lg">
                {getDisplayName(post.author, post.author_display_type, authorFallbacks).charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{getDisplayName(post.author, post.author_display_type, authorFallbacks)}</p>
              <p className="text-xs text-muted-foreground">
                {t('community.memberSince', '회원')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 인기 게시물 카드 */}
      {popularPosts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              {t('community.popularPosts', '인기 게시물')}
            </h3>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2.5">
              {popularPosts.map((popularPost, index) => (
                <div
                  key={popularPost.id}
                  className={cn(
                    "flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors",
                    popularPost.id === postId && "opacity-50 pointer-events-none"
                  )}
                  onClick={() => {
                    if (popularPost.id !== postId) {
                      navigate(`/community/${popularPost.id}`);
                    }
                  }}
                >
                  {/* 순위 */}
                  <span className={cn(
                    "shrink-0 w-5 h-5 rounded text-xs font-bold flex items-center justify-center",
                    index === 0 ? "bg-red-500 text-white" :
                    index === 1 ? "bg-orange-500 text-white" :
                    index === 2 ? "bg-amber-500 text-white" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {index + 1}
                  </span>
                  {/* 게시물 정보 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1">
                      {popularPost.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Eye className="w-3 h-3" />
                        {popularPost.view_count}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <ThumbsUp className="w-3 h-3" />
                        {popularPost.like_count}
                      </span>
                      <span>{getRelativeTime(popularPost.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 글등록 버튼 */}
      <Button
        className="w-full"
        onClick={() => {
          if (user) {
            navigate('/community/write');
          } else {
            setShowLoginModal(true);
          }
        }}
      >
        <Edit className="w-4 h-4 mr-2" />
        {t('community.write', '글등록')}
      </Button>

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
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        user={user}
        userPlan={userPlan}
        onLoginClick={() => setShowLoginModal(true)}
        onSignOut={handleSignOut}
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

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 헤더 */}
        <AppHeader
          sidebarOpen={sidebarOpen}
          onLoginRequired={() => setShowLoginModal(true)}
        />

        {/* 콘텐츠 영역 */}
        <div className="flex-1 overflow-auto">
          <div className="flex gap-6 max-w-[1400px] mx-auto px-4 py-4">
            {/* 중앙 콘텐츠 영역 */}
            <div className="flex-1 min-w-0">
              <Card className="p-6">
                {renderPostContent()}
                {renderComments()}
              </Card>
            </div>

            {/* 오른쪽 패널 - lg 이상에서만 표시 */}
            <div className="hidden lg:block">
              <div className="sticky top-4">
                {renderRightPanel()}
              </div>
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
