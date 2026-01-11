/**
 * Community Page
 * 커뮤니티 메인 페이지
 * - 게시물 목록
 * - 카테고리 필터
 * - 검색 기능
 * - 인기 태그
 * - 오른쪽 패널 (인기 게시물, 통계)
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@shared/contexts/AuthContext";
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
  FileText,
  ThumbsUp,
  Hash,
} from "lucide-react";

// Layout Components
import { AppHeader } from "@/components/common/AppHeader";
import { AppSidebar } from "@/components/common/AppSidebar";
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
  type CommunityPost,
  type PostCategory,
  type GetPostsOptions,
  type CommunityStats,
} from "@shared/services/supabaseService/community";

// 카테고리 설정
const CATEGORIES: { value: PostCategory | 'all'; labelKey: string; icon: string }[] = [
  { value: 'all', labelKey: 'community.category.all', icon: '📋' },
  { value: 'showcase', labelKey: 'community.category.showcase', icon: '🎨' },
  { value: 'question', labelKey: 'community.category.question', icon: '❓' },
  { value: 'troubleshooting', labelKey: 'community.category.troubleshooting', icon: '🔧' },
  { value: 'tip', labelKey: 'community.category.tip', icon: '💡' },
  { value: 'review', labelKey: 'community.category.review', icon: '⭐' },
  { value: 'free', labelKey: 'community.category.free', icon: '💬' },
];

// 정렬 옵션
const SORT_OPTIONS: { value: GetPostsOptions['sortBy']; labelKey: string }[] = [
  { value: 'latest', labelKey: 'community.sort.latest' },
  { value: 'popular', labelKey: 'community.sort.popular' },
  { value: 'views', labelKey: 'community.sort.views' },
];

export default function Community() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
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
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);

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
  }, [category, sortBy, searchQuery, selectedTag, page, user?.id, t, toast]);

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

  // 커뮤니티 통계 로드
  const loadCommunityStats = useCallback(async () => {
    try {
      const stats = await getCommunityStats();
      setCommunityStats(stats);
    } catch (error) {
      console.error('[Community] Error loading stats:', error);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    loadPosts(true);
    loadPopularTags();
  }, [category, sortBy, searchQuery, selectedTag]);

  // 사이드 패널 데이터 로드 (웹에서만)
  useEffect(() => {
    if (!isMobile) {
      loadPopularPosts();
      loadCommunityStats();
    }
  }, [isMobile, loadPopularPosts, loadCommunityStats]);

  // URL 파라미터 업데이트
  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    if (sortBy !== 'latest') params.set('sort', sortBy);
    if (searchQuery) params.set('q', searchQuery);
    if (selectedTag) params.set('tag', selectedTag);
    setSearchParams(params, { replace: true });
  }, [category, sortBy, searchQuery, selectedTag, setSearchParams]);

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

  // 글쓰기 클릭 - 페이지로 이동
  const handleCreateClick = () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    navigate('/community/write');
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
      {/* 커뮤니티 통계 */}
      {communityStats && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              {t('community.stats', '커뮤니티 현황')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                <FileText className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('community.totalPosts', '총 게시물')}</p>
                  <p className="font-semibold text-sm">{communityStats.totalPosts.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                <MessageCircle className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('community.totalComments', '총 댓글')}</p>
                  <p className="font-semibold text-sm">{communityStats.totalComments.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                <Users className="w-4 h-4 text-purple-500" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('community.activeUsers', '활동 회원')}</p>
                  <p className="font-semibold text-sm">{communityStats.totalUsers.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                <ThumbsUp className="w-4 h-4 text-red-500" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('community.totalLikes', '총 좋아요')}</p>
                  <p className="font-semibold text-sm">{communityStats.totalLikes.toLocaleString()}</p>
                </div>
              </div>
            </div>
            {communityStats.todayPosts > 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                {t('community.todayPosts', '오늘 {{count}}개의 새 글', { count: communityStats.todayPosts })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 인기 게시물 */}
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

      {/* 인기 태그 (데스크탑 사이드바 버전) */}
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
              {popularTags.map((item) => (
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
    </div>
  );

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
          rightContent={
            <Button onClick={handleCreateClick} size="sm" className="gap-1">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('community.write', '글쓰기')}</span>
            </Button>
          }
        />

        {/* 콘텐츠 영역 */}
        <div className="flex-1 overflow-auto">
          {/* 필터 섹션 */}
          <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
            <div className={cn(
              "mx-auto px-4 py-3",
              isMobile ? "container" : "max-w-[1400px]"
            )}>
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

              {/* 검색 및 정렬 */}
              <div className="flex items-center gap-2 mt-3">
                <form onSubmit={handleSearch} className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={t('community.searchPlaceholder', '검색어를 입력하세요')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </form>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as GetPostsOptions['sortBy'])}>
                  <SelectTrigger className="w-[120px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value!}>
                        {opt.value === 'latest' && <Clock className="w-3.5 h-3.5 mr-1.5 inline" />}
                        {opt.value === 'popular' && <TrendingUp className="w-3.5 h-3.5 mr-1.5 inline" />}
                        {opt.value === 'views' && <Eye className="w-3.5 h-3.5 mr-1.5 inline" />}
                        {t(opt.labelKey, opt.value === 'latest' ? '최신순' : opt.value === 'popular' ? '인기순' : '조회순')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 인기 태그 - 모바일에서만 표시 (웹은 오른쪽 패널) */}
              {isMobile && popularTags.length > 0 && (
                <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
                  <span className="text-xs text-muted-foreground shrink-0">
                    {t('community.popularTags', '인기 태그')}:
                  </span>
                  {popularTags.slice(0, 8).map((item) => (
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

          {/* 메인 콘텐츠 + 오른쪽 패널 */}
          <div className={cn(
            "flex gap-6 mx-auto px-4 py-4",
            isMobile ? "container" : "max-w-[1400px]"
          )}>
            {/* 게시물 목록 */}
            <div className="flex-1 min-w-0">
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
                {renderRightPanel()}
              </div>
            )}
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
