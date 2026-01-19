/**
 * Community Page
 * 커뮤니티 메인 페이지
 * - 게시물 목록
 * - 카테고리 필터
 * - 검색 기능
 * - 인기 태그
 * - 오른쪽 패널 (인기 게시물, 통계)
 *
 * UI 개선 v2:
 * - 탐색 바 1행/2행 구조
 * - 필터 칩 (미해결/해결됨/내 글)
 * - 미해결 Top 모듈
 * - 하단 가이드/추천 섹션
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@shared/contexts/AuthContext";
import { useUserPlan } from "@shared/hooks/useUserPlan";
import { useSEO } from "@/hooks/useSEO";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useSidebarState } from "@/hooks/useSidebarState";
import { cn } from "@/lib/utils";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Search,
  Plus,
  TrendingUp,
  Clock,
  Eye,
  MessageCircle,
  Flame,
  Users,
  ThumbsUp,
  Hash,
  Edit,
  AlertCircle,
  CheckCircle2,
  User,
  ImageIcon,
  Settings2,
  HelpCircle,
  Lightbulb,
  BookOpen,
} from "lucide-react";

// Layout Components
import { AppHeader } from "@/components/common/AppHeader";
import { AppSidebar } from "@/components/common/AppSidebar";
import { CommunitySidebarContent } from "@/components/sidebar";
import { SharedBottomNavigation } from "@/components/shared/SharedBottomNavigation";
import { LoginPromptModal } from "@/components/auth/LoginPromptModal";

// Community Components
import { PostCard } from "@/components/community/PostCard";

// Services
import {
  getPosts,
  getPopularTags,
  getPopularPosts,
  getCommunityStats,
  getMyRecentPosts,
  getMyRecentComments,
  getAnnouncements,
  getUnsolvedPosts,
  type CommunityPost,
  type PostCategory,
  type GetPostsOptions,
  type CommunityStats,
  type MyRecentPost,
  type MyRecentComment,
} from "@shared/services/supabaseService/community";

// Constants (공용 상수)
import {
  getCategoryOptions,
  SORT_OPTIONS,
} from "@shared/constants/community";

// 필터용 카테고리 옵션 (all 포함)
const CATEGORIES = getCategoryOptions(true);

export default function Community() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { plan: userPlan } = useUserPlan(user?.id);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // SEO
  useSEO('community');

  // 상태
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [popularTags, setPopularTags] = useState<{ tag: string; count: number }[]>([]);
  const [popularPosts, setPopularPosts] = useState<CommunityPost[]>([]);
  const [unsolvedPosts, setUnsolvedPosts] = useState<CommunityPost[]>([]);
  const [announcements, setAnnouncements] = useState<CommunityPost[]>([]);
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);
  const [myPosts, setMyPosts] = useState<MyRecentPost[]>([]);
  const [myComments, setMyComments] = useState<MyRecentComment[]>([]);

  // 필터 상태
  const [category, setCategory] = useState<PostCategory | 'all'>(
    (searchParams.get('category') as PostCategory) || 'all'
  );
  const [sortBy, setSortBy] = useState<GetPostsOptions['sortBy']>(
    (searchParams.get('sort') as GetPostsOptions['sortBy']) || 'latest'
  );
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedTag, setSelectedTag] = useState(searchParams.get('tag') || '');
  const [page, setPage] = useState(1);

  // 추가 필터 상태 (필터 칩용)
  const [filterSolved, setFilterSolved] = useState<'all' | 'unsolved' | 'solved'>(
    (searchParams.get('solved') as 'all' | 'unsolved' | 'solved') || 'all'
  );
  const [filterMyPosts, setFilterMyPosts] = useState(searchParams.get('mine') === 'true');
  const [filterHasImage, setFilterHasImage] = useState(searchParams.get('hasImage') === 'true');

  // 모달 상태
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 사이드바 상태 (localStorage 연동)
  const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebarState(true);

  // 게시물 로드
  const loadPosts = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }

    try {
      const options: GetPostsOptions = {
        category: category === 'all' ? undefined : category,
        sortBy,
        search: searchQuery || undefined,
        tag: selectedTag || undefined,
        page: reset ? 1 : page,
        limit: 20,
        userId: user?.id,
        // 추가 필터
        isSolved: filterSolved === 'all' ? undefined : filterSolved === 'solved',
        authorId: filterMyPosts && user?.id ? user.id : undefined,
        hasImage: filterHasImage || undefined,
      };

      const result = await getPosts(options);

      if (reset) {
        setPosts(result.posts);
      } else {
        setPosts(prev => [...prev, ...result.posts]);
      }
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error('[Community] Error loading posts:', error);
      toast({
        title: t('community.error.loadFailed', '게시물을 불러오는데 실패했습니다'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [category, sortBy, searchQuery, selectedTag, page, user?.id, filterSolved, filterMyPosts, filterHasImage, t, toast]);

  // 인기 태그 로드
  const loadPopularTags = useCallback(async () => {
    try {
      const tags = await getPopularTags(10);
      setPopularTags(tags);
    } catch (error) {
      console.error('[Community] Error loading tags:', error);
    }
  }, []);

  // 인기 게시물 로드
  const loadPopularPosts = useCallback(async () => {
    try {
      const posts = await getPopularPosts(5);
      setPopularPosts(posts);
    } catch (error) {
      console.error('[Community] Error loading popular posts:', error);
    }
  }, []);

  // 미해결 게시물 로드
  const loadUnsolvedPosts = useCallback(async () => {
    try {
      const posts = await getUnsolvedPosts(5);
      setUnsolvedPosts(posts);
    } catch (error) {
      console.error('[Community] Error loading unsolved posts:', error);
    }
  }, []);

  // 공지사항 로드
  const loadAnnouncements = useCallback(async () => {
    try {
      const data = await getAnnouncements(3);
      setAnnouncements(data);
    } catch (error) {
      console.error('[Community] Error loading announcements:', error);
    }
  }, []);

  // 커뮤니티 통계 로드
  const loadCommunityStats = useCallback(async () => {
    try {
      const stats = await getCommunityStats();
      setCommunityStats(stats);
    } catch (error) {
      console.error('[Community] Error loading stats:', error);
    }
  }, []);

  // 내 글/댓글 로드
  const loadMyActivity = useCallback(async () => {
    if (!user) {
      setMyPosts([]);
      setMyComments([]);
      return;
    }
    try {
      const [posts, comments] = await Promise.all([
        getMyRecentPosts(user.id, 5),
        getMyRecentComments(user.id, 5),
      ]);
      setMyPosts(posts);
      setMyComments(comments);
    } catch (error) {
      console.error('[Community] Error loading my activity:', error);
    }
  }, [user]);

  // 초기 로드
  useEffect(() => {
    loadPosts(true);
    loadPopularTags();
    loadAnnouncements();
  }, [category, sortBy, searchQuery, selectedTag, filterSolved, filterMyPosts, filterHasImage, loadPosts, loadPopularTags, loadAnnouncements]);

  // 사이드 패널 데이터 로드 (웹에서만)
  useEffect(() => {
    if (!isMobile) {
      loadPopularPosts();
      loadUnsolvedPosts();
      loadCommunityStats();
      loadMyActivity();
    }
  }, [isMobile, loadPopularPosts, loadUnsolvedPosts, loadCommunityStats, loadMyActivity]);

  // URL 파라미터 업데이트
  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    if (sortBy !== 'latest') params.set('sort', sortBy);
    if (searchQuery) params.set('q', searchQuery);
    if (selectedTag) params.set('tag', selectedTag);
    if (filterSolved !== 'all') params.set('solved', filterSolved);
    if (filterMyPosts) params.set('mine', 'true');
    if (filterHasImage) params.set('hasImage', 'true');
    setSearchParams(params, { replace: true });
  }, [category, sortBy, searchQuery, selectedTag, filterSolved, filterMyPosts, filterHasImage, setSearchParams]);

  // 필터 칩 토글 핸들러
  const handleFilterSolvedChange = (value: 'all' | 'unsolved' | 'solved') => {
    setFilterSolved(value);
  };

  const toggleFilterMyPosts = () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    setFilterMyPosts(prev => !prev);
  };

  const toggleFilterHasImage = () => {
    setFilterHasImage(prev => !prev);
  };

  // 검색 핸들러
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadPosts(true);
  };

  // 더보기
  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      setPage(prev => prev + 1);
      loadPosts(false);
    }
  };

  // 글쓰기 클릭 - 페이지로 이동 (현재 카테고리 전달)
  const handleCreateClick = () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    // 'all'인 경우 'free'로 기본값 설정, 그 외에는 현재 카테고리 전달
    const targetCategory = category === 'all' ? 'free' : category;
    navigate(`/community/write?category=${targetCategory}`);
  };

  // 게시물 클릭
  const handlePostClick = (postId: string) => {
    navigate(`/community/${postId}`);
  };

  // 태그 클릭
  const handleTagClick = (tag: string) => {
    if (selectedTag === tag) {
      setSelectedTag('');
    } else {
      setSelectedTag(tag);
    }
  };

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

  // 오른쪽 패널 렌더링 (웹에서만)
  const renderRightPanel = () => (
    <div className="w-80 shrink-0 space-y-4">
      {/* 1. 글등록 버튼 + 가이드 */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <Button
            className="w-full mb-3"
            size="lg"
            onClick={handleCreateClick}
          >
            <Edit className="w-4 h-4 mr-2" />
            {t('community.write', '글쓰기')}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            💡 {t('community.writeGuide', '출력 문제? 세팅값과 증상을 함께 올려주세요!')}
          </p>
        </CardContent>
      </Card>

      {/* 2. 해결이 필요한 글 (미해결 Top) */}
      {unsolvedPosts.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-800/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              {t('community.needsHelp', '해결이 필요한 글')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {unsolvedPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-start gap-2 p-2 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-950/20 cursor-pointer transition-colors border border-transparent hover:border-orange-200 dark:hover:border-orange-800/50"
                  onClick={() => handlePostClick(post.id)}
                >
                  <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1">{post.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <MessageCircle className="w-3 h-3" />
                        {post.comment_count}
                      </span>
                      <span>{getRelativeTime(post.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20"
              onClick={() => handleFilterSolvedChange('unsolved')}
            >
              {t('community.viewAllUnsolved', '미해결 글 모두 보기')} →
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 3. 인기 게시물 */}
      {popularPosts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              {t('community.popularPosts', '인기 게시물')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2.5">
              {popularPosts.map((post, index) => (
                <div
                  key={post.id}
                  className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handlePostClick(post.id)}
                >
                  <span className={cn(
                    "shrink-0 w-5 h-5 rounded text-xs font-bold flex items-center justify-center",
                    index === 0 ? "bg-red-500 text-white" :
                    index === 1 ? "bg-orange-500 text-white" :
                    index === 2 ? "bg-amber-500 text-white" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1">{post.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Eye className="w-3 h-3" />
                        {post.view_count}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <ThumbsUp className="w-3 h-3" />
                        {post.like_count}
                      </span>
                      <span>{getRelativeTime(post.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. 인기 태그 */}
      {popularTags.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Hash className="w-4 h-4 text-primary" />
              {t('community.popularTags', '인기 태그')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-1.5">
              {popularTags.slice(0, 10).map((item) => (
                <Badge
                  key={item.tag}
                  variant={selectedTag === item.tag ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => handleTagClick(item.tag)}
                >
                  #{item.tag}
                  <span className="ml-1 text-muted-foreground">({item.count})</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. 초보자 가이드 */}
      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-500" />
            {t('community.beginnerGuide', '초보자 가이드')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <Lightbulb className="w-3 h-3 text-amber-500" />
              {t('community.guideTip1', '출력 문제 시 온도/속도/리트랙션 필수 기재')}
            </li>
            <li className="flex items-center gap-1.5">
              <Lightbulb className="w-3 h-3 text-amber-500" />
              {t('community.guideTip2', '사진은 문제 부분을 확대해서 촬영')}
            </li>
            <li className="flex items-center gap-1.5">
              <Lightbulb className="w-3 h-3 text-amber-500" />
              {t('community.guideTip3', '해결되면 해결됨 표시 잊지 마세요!')}
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className={cn("h-screen bg-background flex", isMobile && "pb-16")}>
      {/* 사이드바 (데스크탑) */}
      {!isMobile && (
        <AppSidebar
          isOpen={sidebarOpen}
          onToggle={toggleSidebar}
          user={user}
          userPlan={userPlan}
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

        {/* 콘텐츠 영역 */}
        <div className="flex-1 overflow-auto">
          {/* 탐색 바 - 1행/2행 구조 */}
          <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
            <div className={cn(
              "mx-auto px-4",
              isMobile ? "container" : "max-w-[1400px]"
            )}>
              {/* 1행: 검색 (데스크탑) */}
              {!isMobile && (
                <div className="flex items-center gap-4 py-3 border-b border-border/50">
                  <form onSubmit={handleSearch} className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={t('community.searchPlaceholder', '제목, 내용, 태그로 검색...')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-10"
                    />
                  </form>
                </div>
              )}

              {/* 2행: 카테고리 탭 + 필터 칩 + 정렬 */}
              <div className="py-3 space-y-3">
                {/* 카테고리 탭 */}
                <ScrollArea className="w-full" orientation="horizontal">
                  <Tabs value={category} onValueChange={(v) => setCategory(v as PostCategory | 'all')}>
                    <TabsList className="inline-flex h-9 gap-1 bg-transparent p-0">
                      {CATEGORIES.map((cat) => (
                        <TabsTrigger
                          key={cat.value}
                          value={cat.value}
                          className="px-3 py-1.5 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full"
                        >
                          <span className="mr-1">{cat.icon}</span>
                          {t(cat.labelKey, cat.value === 'all' ? '전체' : cat.value)}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </ScrollArea>

                {/* 필터 칩 + 정렬 */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {/* 필터 칩 그룹 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* 미해결/해결됨 필터 */}
                    <div className="flex items-center gap-1 bg-muted/50 rounded-full p-0.5">
                      <Button
                        variant={filterSolved === 'unsolved' ? 'default' : 'ghost'}
                        size="sm"
                        className={cn(
                          "h-7 px-3 rounded-full text-xs",
                          filterSolved === 'unsolved' && "bg-orange-500 hover:bg-orange-600 text-white"
                        )}
                        onClick={() => handleFilterSolvedChange(filterSolved === 'unsolved' ? 'all' : 'unsolved')}
                      >
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {t('community.filter.unsolved', '미해결')}
                      </Button>
                      <Button
                        variant={filterSolved === 'solved' ? 'default' : 'ghost'}
                        size="sm"
                        className={cn(
                          "h-7 px-3 rounded-full text-xs",
                          filterSolved === 'solved' && "bg-green-500 hover:bg-green-600 text-white"
                        )}
                        onClick={() => handleFilterSolvedChange(filterSolved === 'solved' ? 'all' : 'solved')}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {t('community.filter.solved', '해결됨')}
                      </Button>
                    </div>

                    {/* 사진 첨부 필터 */}
                    <Button
                      variant={filterHasImage ? 'default' : 'outline'}
                      size="sm"
                      className={cn(
                        "h-7 px-3 rounded-full text-xs",
                        filterHasImage && "bg-blue-500 hover:bg-blue-600 text-white"
                      )}
                      onClick={toggleFilterHasImage}
                    >
                      <ImageIcon className="w-3 h-3 mr-1" />
                      {t('community.filter.hasImage', '사진')}
                    </Button>

                    {/* 내 글 필터 */}
                    <Button
                      variant={filterMyPosts ? 'default' : 'outline'}
                      size="sm"
                      className={cn(
                        "h-7 px-3 rounded-full text-xs",
                        filterMyPosts && "bg-purple-500 hover:bg-purple-600 text-white"
                      )}
                      onClick={toggleFilterMyPosts}
                    >
                      <User className="w-3 h-3 mr-1" />
                      {t('community.filter.myPosts', '내 글')}
                    </Button>

                    {/* 선택된 태그 표시 */}
                    {selectedTag && (
                      <Badge
                        variant="secondary"
                        className="h-7 px-3 rounded-full text-xs cursor-pointer"
                        onClick={() => setSelectedTag('')}
                      >
                        #{selectedTag} ✕
                      </Badge>
                    )}
                  </div>

                  {/* 정렬 드롭다운 */}
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as GetPostsOptions['sortBy'])}>
                    <SelectTrigger className="w-[120px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value!}>
                          {opt.value === 'latest' && <Clock className="w-3 h-3 mr-1.5 inline" />}
                          {opt.value === 'popular' && <TrendingUp className="w-3 h-3 mr-1.5 inline" />}
                          {opt.value === 'views' && <Eye className="w-3 h-3 mr-1.5 inline" />}
                          {t(opt.labelKey, opt.value === 'latest' ? '최신순' : opt.value === 'popular' ? '인기순' : '조회순')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 모바일: 검색 */}
                {isMobile && (
                  <form onSubmit={handleSearch} className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={t('community.searchPlaceholder', '검색어를 입력하세요')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </form>
                )}

                {/* 인기 태그 - 모바일에서만 표시 */}
                {isMobile && popularTags.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <span className="text-xs text-muted-foreground shrink-0">
                      {t('community.popularTags', '인기 태그')}:
                    </span>
                    {popularTags.slice(0, 6).map((item) => (
                      <Badge
                        key={item.tag}
                        variant={selectedTag === item.tag ? 'default' : 'outline'}
                        className="cursor-pointer shrink-0 text-xs"
                        onClick={() => handleTagClick(item.tag)}
                      >
                        #{item.tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 메인 콘텐츠 + 오른쪽 패널 */}
          <div className={cn(
            "flex gap-6 mx-auto px-4 py-4",
            isMobile ? "container" : "max-w-[1400px]"
          )}>
            {/* 게시물 목록 */}
            <div className="flex-1 min-w-0">
              {/* 공지사항 (상단 고정) */}
              {announcements.length > 0 && category === 'all' && (
                <div className="mb-4 space-y-2">
                  {announcements.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => handlePostClick(post.id)}
                      className="flex items-center gap-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/50 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-950/30 transition-colors"
                    >
                      <Badge className="shrink-0 bg-rose-500 text-white hover:bg-rose-600">
                        📢 {t('community.category.announcement', '공지')}
                      </Badge>
                      <span className="font-medium truncate flex-1">{post.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(post.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <MessageCircle className="w-12 h-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {t('community.noPosts', '게시물이 없습니다')}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('community.beFirst', '첫 번째 게시물을 작성해보세요!')}
                  </p>
                  <Button onClick={handleCreateClick}>
                    <Plus className="w-4 h-4 mr-1" />
                    {t('community.write', '글쓰기')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onClick={() => handlePostClick(post.id)}
                      onTagClick={handleTagClick}
                    />
                  ))}

                  {/* 더보기 버튼 */}
                  {page < totalPages && (
                    <div className="flex justify-center pt-4">
                      <Button
                        variant="outline"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                      >
                        {loadingMore ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        {t('community.loadMore', '더보기')}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 오른쪽 패널 - lg 이상에서만 표시 */}
            {!isMobile && (
              <div className="hidden lg:block">
                <div className="sticky top-[120px]">
                  {renderRightPanel()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 모바일 플로팅 글쓰기 버튼 */}
      {isMobile && (
        <Button
          onClick={handleCreateClick}
          className="fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-lg z-20"
          size="icon"
        >
          <Plus className="w-6 h-6" />
        </Button>
      )}

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
