/**
 * 커뮤니티 서비스
 * - 게시물 CRUD
 * - 댓글 기능
 * - 좋아요 기능
 * - 카테고리 관리
 */
import { supabase } from '../../integrations/supabase/client';

// 프로필 정보 타입
export interface ProfileInfo {
  id: string;
  username: string;
  avatar_url?: string;
  full_name?: string; // 실명
}

/**
 * 프로필 정보 조회 헬퍼 함수 (RLS 오류 안전)
 * @param userIds - 조회할 유저 ID 배열 (auth.users의 ID)
 * @returns 프로필 맵 (userId -> ProfileInfo)
 */
async function getProfilesMap(userIds: string[]): Promise<Map<string, ProfileInfo>> {
  const profileMap = new Map<string, ProfileInfo>();

  if (!userIds || userIds.length === 0) {
    return profileMap;
  }

  try {
    // profiles 테이블은 user_id로 auth.users와 연결됨
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('user_id, display_name, full_name, avatar_url')
      .in('user_id', userIds);

    if (!error && profiles) {
      profiles.forEach(p => {
        profileMap.set(p.user_id, {
          id: p.user_id,
          username: p.display_name || 'Unknown',
          full_name: p.full_name,
          avatar_url: p.avatar_url,
        });
      });
    }
  } catch (err) {
    console.warn('[community] Failed to fetch profiles:', err);
  }

  return profileMap;
}

/**
 * 모델 정보 조회 헬퍼 함수 (RLS 오류 안전)
 * @param modelIds - 조회할 모델 ID 배열
 * @returns 모델 맵 (modelId -> AttachedModelInfo)
 */
async function getModelsMap(modelIds: string[]): Promise<Map<string, { id: string; name?: string; thumbnail_url?: string; download_url?: string }>> {
  const modelMap = new Map<string, { id: string; name?: string; thumbnail_url?: string; download_url?: string }>();

  if (!modelIds || modelIds.length === 0) {
    return modelMap;
  }

  try {
    const { data: models, error } = await supabase
      .from('ai_generated_models')
      .select('id, name, thumbnail_url, download_url')
      .in('id', modelIds);

    if (!error && models) {
      models.forEach(m => {
        modelMap.set(m.id, {
          id: m.id,
          name: m.name,
          thumbnail_url: m.thumbnail_url,
          download_url: m.download_url,
        });
      });
    }
  } catch (err) {
    console.warn('[community] Failed to fetch models:', err);
  }

  return modelMap;
}

/**
 * 단일 모델 정보 조회 헬퍼 함수 (RLS 오류 안전)
 * @param modelId - 조회할 모델 ID
 * @returns 모델 정보 또는 null
 */
async function getModelInfo(modelId: string): Promise<{ id: string; name?: string; thumbnail_url?: string; download_url?: string } | null> {
  if (!modelId) {
    return null;
  }

  try {
    const { data: model, error } = await supabase
      .from('ai_generated_models')
      .select('id, name, thumbnail_url, download_url')
      .eq('id', modelId)
      .maybeSingle();

    if (!error && model) {
      return {
        id: model.id,
        name: model.name,
        thumbnail_url: model.thumbnail_url,
        download_url: model.download_url,
      };
    }
  } catch (err) {
    console.warn('[community] Failed to fetch model:', err);
  }

  return null;
}

/**
 * 단일 프로필 정보 조회 헬퍼 함수 (RLS 오류 안전)
 * @param userId - 조회할 유저 ID (auth.users의 ID)
 * @returns 프로필 정보 또는 기본값
 */
async function getProfileInfo(userId: string): Promise<ProfileInfo> {
  const defaultProfile: ProfileInfo = { id: userId, username: 'Unknown' };

  if (!userId) {
    return defaultProfile;
  }

  try {
    // profiles 테이블은 user_id로 auth.users와 연결됨
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('user_id, display_name, full_name, avatar_url')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && profile) {
      return {
        id: profile.user_id,
        username: profile.display_name || 'Unknown',
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      };
    }
  } catch (err) {
    console.warn('[community] Failed to fetch profile:', err);
  }

  return defaultProfile;
}

// 게시물 카테고리
export type PostCategory = 'showcase' | 'question' | 'tip' | 'review' | 'free' | 'troubleshooting';

// 작성자 표시 방식
export type AuthorDisplayType = 'nickname' | 'realname' | 'anonymous';

/**
 * 작성자 표시 방식에 따른 표시 이름 반환
 * @param profile - 프로필 정보
 * @param displayType - 표시 방식
 * @param fallbacks - i18n 번역된 폴백 텍스트 (optional)
 * @returns 표시할 이름
 */
export function getDisplayName(
  profile: ProfileInfo | undefined,
  displayType: AuthorDisplayType,
  fallbacks?: { unknown?: string; anonymous?: string }
): string {
  const unknownText = fallbacks?.unknown || 'Unknown';
  const anonymousText = fallbacks?.anonymous || 'Anonymous';

  if (!profile) return unknownText;

  switch (displayType) {
    case 'realname':
      return profile.full_name || profile.username || unknownText;
    case 'anonymous':
      return anonymousText;
    case 'nickname':
    default:
      return profile.username || unknownText;
  }
}

/**
 * 작성자 표시 방식에 따른 아바타 URL 반환 (익명이면 null)
 * @param profile - 프로필 정보
 * @param displayType - 표시 방식
 * @returns 아바타 URL 또는 undefined
 */
export function getDisplayAvatar(profile: ProfileInfo | undefined, displayType: AuthorDisplayType): string | undefined {
  if (!profile || displayType === 'anonymous') return undefined;
  return profile.avatar_url;
}

// 트러블슈팅 메타데이터 (question/troubleshooting 카테고리용)
export interface TroubleshootingMeta {
  // 프린터 정보
  printer_model?: string;
  firmware?: string; // Klipper, Marlin, etc.
  nozzle_size?: string; // 0.4mm, 0.6mm, etc.
  bed_type?: string; // PEI, Glass, etc.
  chamber_temp?: string;
  // 필라멘트 정보
  filament_type?: string; // PLA, PETG, ABS, etc.
  filament_brand?: string;
  filament_dried?: boolean;
  // 슬라이서 정보
  slicer?: string; // Cura, PrusaSlicer, OrcaSlicer, etc.
  slicer_profile?: string;
  print_speed?: string;
  nozzle_temp?: string;
  bed_temp?: string;
  retraction?: string;
  fan_speed?: string;
  layer_height?: string;
  // 증상 태그
  symptom_tags?: string[]; // stringing, layer_shift, warping, etc.
  // G-code/로그 첨부
  gcode_url?: string;
  log_url?: string;
}

// 첨부된 AI 모델 정보 (간략)
export interface AttachedModelInfo {
  id: string;
  name?: string;
  thumbnail_url?: string;
  download_url?: string;
}

// 게시물 타입
// 참고: G-code 세그먼트 데이터는 gcode_segment_data 테이블에 별도 저장됨
export interface CommunityPost {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: PostCategory;
  images?: string[];
  tags?: string[];
  model_id?: string; // 첨부된 AI 모델 ID
  author_display_type: AuthorDisplayType; // 작성자 표시 방식
  view_count: number;
  like_count: number;
  dislike_count: number; // 비추천 수
  comment_count: number;
  helpful_count: number; // 유용함 투표 수
  is_pinned: boolean;
  is_solved: boolean; // 해결됨 여부
  accepted_answer_id?: string; // 채택된 답변 ID
  troubleshooting_meta?: TroubleshootingMeta; // 트러블슈팅 메타데이터
  created_at: string;
  updated_at: string;
  // 조인된 사용자 정보
  author?: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  // 첨부된 AI 모델 정보 (조인)
  model?: AttachedModelInfo;
  // 현재 사용자의 좋아요 여부
  is_liked?: boolean;
  // 현재 사용자의 비추천 여부
  is_disliked?: boolean;
  // 현재 사용자의 유용함 투표 여부
  is_helpful_voted?: boolean;
}

// 댓글 타입
export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id?: string;
  content: string;
  images?: string[]; // 첨부 이미지 URL 배열
  like_count: number;
  dislike_count: number; // 비추천 수
  helpful_count: number; // 유용함 투표 수
  is_accepted: boolean; // 정답 채택 여부
  created_at: string;
  updated_at: string;
  // 조인된 사용자 정보
  author?: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  // 대댓글
  replies?: PostComment[];
  // 현재 사용자의 좋아요 여부
  is_liked?: boolean;
  // 현재 사용자의 비추천 여부
  is_disliked?: boolean;
  // 현재 사용자의 유용함 투표 여부
  is_helpful_voted?: boolean;
}

// 게시물 생성 입력
// 참고: G-code 세그먼트는 gcode_segment_data 테이블에 저장되고 post_id로 연결됨
export interface CreatePostInput {
  title: string;
  content: string;
  category: PostCategory;
  images?: string[];
  tags?: string[];
  model_id?: string; // 첨부할 AI 모델 ID
  author_display_type?: AuthorDisplayType; // 작성자 표시 방식 (기본값: nickname)
  troubleshooting_meta?: TroubleshootingMeta;
}

// 게시물 수정 입력
export interface UpdatePostInput {
  title?: string;
  content?: string;
  category?: PostCategory;
  images?: string[];
  tags?: string[];
  model_id?: string | null; // 첨부할 AI 모델 ID (null로 삭제 가능)
  author_display_type?: AuthorDisplayType; // 작성자 표시 방식
  troubleshooting_meta?: TroubleshootingMeta;
  is_solved?: boolean;
}

// 게시물 목록 조회 옵션
export interface GetPostsOptions {
  category?: PostCategory;
  tag?: string;
  search?: string;
  sortBy?: 'latest' | 'popular' | 'views' | 'helpful' | 'unsolved';
  isSolved?: boolean; // 해결됨/미해결 필터
  page?: number;
  limit?: number;
  userId?: string; // 현재 사용자 ID (좋아요 여부 확인용)
}

// 페이지네이션 결과
export interface PaginatedPosts {
  posts: CommunityPost[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 게시물 목록 조회
 */
export async function getPosts(options: GetPostsOptions = {}): Promise<PaginatedPosts> {
  const {
    category,
    tag,
    search,
    sortBy = 'latest',
    isSolved,
    page = 1,
    limit = 20,
    userId,
  } = options;

  try {
    let query = supabase
      .from('community_posts')
      .select('*', { count: 'exact' });

    // 카테고리 필터
    if (category) {
      query = query.eq('category', category);
    }

    // 태그 필터
    if (tag) {
      query = query.contains('tags', [tag]);
    }

    // 검색어 필터
    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }

    // 해결됨/미해결 필터
    if (isSolved !== undefined) {
      query = query.eq('is_solved', isSolved);
    }

    // 정렬
    switch (sortBy) {
      case 'popular':
        query = query.order('like_count', { ascending: false });
        break;
      case 'views':
        query = query.order('view_count', { ascending: false });
        break;
      case 'helpful':
        query = query.order('helpful_count', { ascending: false });
        break;
      case 'unsolved':
        // 미해결 글 우선 + 최신순
        query = query.order('is_solved', { ascending: true })
                     .order('created_at', { ascending: false });
        break;
      default:
        query = query.order('is_pinned', { ascending: false })
                     .order('created_at', { ascending: false });
    }

    // 페이지네이션
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('[community] Error fetching posts:', error);
      return { posts: [], total: 0, page, limit, totalPages: 0 };
    }

    let posts = data as CommunityPost[];

    // 작성자 정보 조회 (헬퍼 함수 사용)
    if (posts.length > 0) {
      const userIds = [...new Set(posts.map(p => p.user_id).filter(Boolean))];
      const profileMap = await getProfilesMap(userIds);
      posts = posts.map(post => ({
        ...post,
        author: profileMap.get(post.user_id) || { id: post.user_id, username: 'Unknown' },
      }));
    }

    // 모델 정보 조회 (첨부된 모델이 있는 경우)
    if (posts.length > 0) {
      const modelIds = [...new Set(posts.map(p => p.model_id).filter(Boolean))] as string[];
      if (modelIds.length > 0) {
        const modelMap = await getModelsMap(modelIds);
        posts = posts.map(post => ({
          ...post,
          model: post.model_id ? modelMap.get(post.model_id) : undefined,
        }));
      }
    }

    // 좋아요/비추천 여부 확인 (통합 테이블 사용)
    if (userId && posts.length > 0) {
      const postIds = posts.map(p => p.id);

      // 투표 확인 (한 번의 쿼리로 like/dislike 모두 확인)
      const { data: votes } = await supabase
        .from('community_post_votes')
        .select('post_id, vote_type')
        .eq('user_id', userId)
        .in('post_id', postIds);

      const likedPostIds = new Set(votes?.filter(v => v.vote_type === 'like').map(v => v.post_id) || []);
      const dislikedPostIds = new Set(votes?.filter(v => v.vote_type === 'dislike').map(v => v.post_id) || []);

      posts = posts.map(post => ({
        ...post,
        is_liked: likedPostIds.has(post.id),
        is_disliked: dislikedPostIds.has(post.id),
      }));
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return { posts, total, page, limit, totalPages };
  } catch (error) {
    console.error('[community] Error fetching posts:', error);
    return { posts: [], total: 0, page, limit, totalPages: 0 };
  }
}

/**
 * 단일 게시물 조회
 */
export async function getPost(postId: string, userId?: string): Promise<CommunityPost | null> {
  try {
    const { data, error } = await supabase
      .from('community_posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (error) {
      console.error('[community] Error fetching post:', error);
      return null;
    }

    let post = data as CommunityPost;

    // 작성자 정보 조회 (헬퍼 함수 사용)
    const author = await getProfileInfo(post.user_id);
    post = { ...post, author };

    // 모델 정보 조회 (첨부된 모델이 있는 경우)
    if (post.model_id) {
      const model = await getModelInfo(post.model_id);
      if (model) {
        post = { ...post, model };
      }
    }

    // 조회수 증가
    await supabase
      .from('community_posts')
      .update({ view_count: (post.view_count || 0) + 1 })
      .eq('id', postId);

    // 좋아요/비추천 여부 확인 (통합 테이블 사용)
    if (userId) {
      const { data: votes } = await supabase
        .from('community_post_votes')
        .select('vote_type')
        .eq('post_id', postId)
        .eq('user_id', userId);

      const hasLike = votes?.some(v => v.vote_type === 'like') || false;
      const hasDislike = votes?.some(v => v.vote_type === 'dislike') || false;

      post = { ...post, is_liked: hasLike, is_disliked: hasDislike };
    }

    return post;
  } catch (error) {
    console.error('[community] Error fetching post:', error);
    return null;
  }
}

/**
 * 게시물 생성
 * 참고: G-code 세그먼트 데이터는 별도로 gcode_segment_data 테이블에 저장됨
 *       게시물 생성 후 linkSegmentsToPost()로 post_id 연결 필요
 */
export async function createPost(userId: string, input: CreatePostInput): Promise<CommunityPost | null> {
  try {
    const { data, error } = await supabase
      .from('community_posts')
      .insert({
        user_id: userId,
        title: input.title,
        content: input.content,
        category: input.category,
        images: input.images || [],
        tags: input.tags || [],
        model_id: input.model_id || null,
        author_display_type: input.author_display_type || 'nickname',
        troubleshooting_meta: input.troubleshooting_meta || null,
      })
      .select('*')
      .single();

    if (error) {
      console.error('[community] Error creating post:', error);
      return null;
    }

    // 작성자 정보 조회 (헬퍼 함수 사용)
    const author = await getProfileInfo(userId);

    return {
      ...data,
      author,
    } as CommunityPost;
  } catch (error) {
    console.error('[community] Error creating post:', error);
    return null;
  }
}

/**
 * 게시물 수정
 */
export async function updatePost(postId: string, userId: string, input: UpdatePostInput): Promise<CommunityPost | null> {
  try {
    const { data, error } = await supabase
      .from('community_posts')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      console.error('[community] Error updating post:', error);
      return null;
    }

    // 작성자 정보 조회 (헬퍼 함수 사용)
    const author = await getProfileInfo(userId);

    return {
      ...data,
      author,
    } as CommunityPost;
  } catch (error) {
    console.error('[community] Error updating post:', error);
    return null;
  }
}

/**
 * 게시물 삭제
 */
export async function deletePost(postId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('community_posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', userId);

    if (error) {
      console.error('[community] Error deleting post:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[community] Error deleting post:', error);
    return false;
  }
}

/**
 * 게시물 좋아요 토글 (통합 테이블 사용)
 * - 비추천이 있으면 비추천을 취소하고 좋아요 추가 (추천/비추천 동시 불가)
 */
export async function togglePostLike(postId: string, userId: string): Promise<{ liked: boolean; disliked: boolean; likeCount: number; dislikeCount: number } | null> {
  try {
    // 현재 투표 상태 확인 (한 번의 쿼리)
    const { data: votes } = await supabase
      .from('community_post_votes')
      .select('vote_type')
      .eq('post_id', postId)
      .eq('user_id', userId);

    const existingLike = votes?.some(v => v.vote_type === 'like');
    const existingDislike = votes?.some(v => v.vote_type === 'dislike');

    // 현재 게시물 정보 가져오기
    const { data: currentPost } = await supabase
      .from('community_posts')
      .select('like_count, dislike_count')
      .eq('id', postId)
      .single();

    let newLikeCount = currentPost?.like_count || 0;
    let newDislikeCount = currentPost?.dislike_count || 0;

    if (existingLike) {
      // 좋아요 취소
      await supabase
        .from('community_post_votes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId)
        .eq('vote_type', 'like');

      newLikeCount = Math.max(0, newLikeCount - 1);
    } else {
      // 비추천이 있으면 먼저 취소
      if (existingDislike) {
        await supabase
          .from('community_post_votes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId)
          .eq('vote_type', 'dislike');
        newDislikeCount = Math.max(0, newDislikeCount - 1);
      }

      // 좋아요 추가
      await supabase
        .from('community_post_votes')
        .insert({ post_id: postId, user_id: userId, vote_type: 'like' });

      newLikeCount = newLikeCount + 1;
    }

    // 카운트 업데이트
    await supabase
      .from('community_posts')
      .update({ like_count: newLikeCount, dislike_count: newDislikeCount })
      .eq('id', postId);

    return {
      liked: !existingLike,
      disliked: false,
      likeCount: newLikeCount,
      dislikeCount: newDislikeCount,
    };
  } catch (error) {
    console.error('[community] Error toggling like:', error);
    return null;
  }
}

/**
 * 게시물 비추천 토글 (통합 테이블 사용)
 * - 좋아요가 있으면 좋아요를 취소하고 비추천 추가 (추천/비추천 동시 불가)
 */
export async function togglePostDislike(postId: string, userId: string): Promise<{ liked: boolean; disliked: boolean; likeCount: number; dislikeCount: number } | null> {
  try {
    // 현재 투표 상태 확인 (한 번의 쿼리)
    const { data: votes } = await supabase
      .from('community_post_votes')
      .select('vote_type')
      .eq('post_id', postId)
      .eq('user_id', userId);

    const existingLike = votes?.some(v => v.vote_type === 'like');
    const existingDislike = votes?.some(v => v.vote_type === 'dislike');

    // 현재 게시물 정보 가져오기
    const { data: currentPost } = await supabase
      .from('community_posts')
      .select('like_count, dislike_count')
      .eq('id', postId)
      .single();

    let newLikeCount = currentPost?.like_count || 0;
    let newDislikeCount = currentPost?.dislike_count || 0;

    if (existingDislike) {
      // 비추천 취소
      await supabase
        .from('community_post_votes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId)
        .eq('vote_type', 'dislike');

      newDislikeCount = Math.max(0, newDislikeCount - 1);
    } else {
      // 좋아요가 있으면 먼저 취소
      if (existingLike) {
        await supabase
          .from('community_post_votes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId)
          .eq('vote_type', 'like');
        newLikeCount = Math.max(0, newLikeCount - 1);
      }

      // 비추천 추가
      await supabase
        .from('community_post_votes')
        .insert({ post_id: postId, user_id: userId, vote_type: 'dislike' });

      newDislikeCount = newDislikeCount + 1;
    }

    // 카운트 업데이트
    await supabase
      .from('community_posts')
      .update({ like_count: newLikeCount, dislike_count: newDislikeCount })
      .eq('id', postId);

    return {
      liked: false,
      disliked: !existingDislike,
      likeCount: newLikeCount,
      dislikeCount: newDislikeCount,
    };
  } catch (error) {
    console.error('[community] Error toggling dislike:', error);
    return null;
  }
}

/**
 * 댓글 목록 조회
 */
export async function getComments(postId: string, userId?: string): Promise<PostComment[]> {
  try {
    const { data, error } = await supabase
      .from('community_comments')
      .select('*')
      .eq('post_id', postId)
      .is('parent_id', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[community] Error fetching comments:', error);
      return [];
    }

    let comments = data as PostComment[];

    // 대댓글 조회
    const { data: replies } = await supabase
      .from('community_comments')
      .select('*')
      .eq('post_id', postId)
      .not('parent_id', 'is', null)
      .order('created_at', { ascending: true });

    // 모든 댓글 작성자 정보 조회 (헬퍼 함수 사용)
    const allComments = [...comments, ...(replies || [])];
    const userIds = [...new Set(allComments.map(c => c.user_id).filter(Boolean))];
    const profileMap = await getProfilesMap(userIds);

    // 댓글에 작성자 정보 추가
    comments = comments.map(comment => ({
      ...comment,
      author: profileMap.get(comment.user_id) || { id: comment.user_id, username: 'Unknown' },
    }));

    if (replies) {
      // 대댓글에 작성자 정보 추가
      const repliesWithAuthor = (replies as PostComment[]).map(reply => ({
        ...reply,
        author: profileMap.get(reply.user_id) || { id: reply.user_id, username: 'Unknown' },
      }));

      const repliesByParent = repliesWithAuthor.reduce((acc, reply) => {
        const parentId = reply.parent_id!;
        if (!acc[parentId]) acc[parentId] = [];
        acc[parentId].push(reply);
        return acc;
      }, {} as Record<string, PostComment[]>);

      comments = comments.map(comment => ({
        ...comment,
        replies: repliesByParent[comment.id] || [],
      }));
    }

    // 좋아요/비추천 여부 확인 (통합 테이블 사용)
    if (userId && comments.length > 0) {
      const allCommentIds = [
        ...comments.map(c => c.id),
        ...comments.flatMap(c => c.replies?.map(r => r.id) || []),
      ];

      // 투표 확인 (한 번의 쿼리로 like/dislike 모두 확인)
      const { data: votes } = await supabase
        .from('community_comment_votes')
        .select('comment_id, vote_type')
        .eq('user_id', userId)
        .in('comment_id', allCommentIds);

      const likedCommentIds = new Set(votes?.filter(v => v.vote_type === 'like').map(v => v.comment_id) || []);
      const dislikedCommentIds = new Set(votes?.filter(v => v.vote_type === 'dislike').map(v => v.comment_id) || []);

      comments = comments.map(comment => ({
        ...comment,
        is_liked: likedCommentIds.has(comment.id),
        is_disliked: dislikedCommentIds.has(comment.id),
        replies: comment.replies?.map(reply => ({
          ...reply,
          is_liked: likedCommentIds.has(reply.id),
          is_disliked: dislikedCommentIds.has(reply.id),
        })),
      }));
    }

    return comments;
  } catch (error) {
    console.error('[community] Error fetching comments:', error);
    return [];
  }
}

/**
 * 댓글 작성
 */
export async function createComment(
  postId: string,
  userId: string,
  content: string,
  parentId?: string,
  images?: string[]
): Promise<PostComment | null> {
  try {
    const { data, error } = await supabase
      .from('community_comments')
      .insert({
        post_id: postId,
        user_id: userId,
        content,
        parent_id: parentId || null,
        images: images || [],
      })
      .select('*')
      .single();

    if (error) {
      console.error('[community] Error creating comment:', error);
      return null;
    }

    // 작성자 정보 조회 (헬퍼 함수 사용)
    const profile = await getProfileInfo(userId);

    // 게시물 댓글 수 증가
    const { data: post } = await supabase
      .from('community_posts')
      .select('comment_count')
      .eq('id', postId)
      .single();

    await supabase
      .from('community_posts')
      .update({ comment_count: (post?.comment_count || 0) + 1 })
      .eq('id', postId);

    return {
      ...data,
      author: profile,
    } as PostComment;
  } catch (error) {
    console.error('[community] Error creating comment:', error);
    return null;
  }
}

/**
 * 댓글 삭제
 */
export async function deleteComment(commentId: string, userId: string, postId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('community_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', userId);

    if (error) {
      console.error('[community] Error deleting comment:', error);
      return false;
    }

    // 게시물 댓글 수 감소
    const { data: post } = await supabase
      .from('community_posts')
      .select('comment_count')
      .eq('id', postId)
      .single();

    await supabase
      .from('community_posts')
      .update({ comment_count: Math.max(0, (post?.comment_count || 1) - 1) })
      .eq('id', postId);

    return true;
  } catch (error) {
    console.error('[community] Error deleting comment:', error);
    return false;
  }
}

/**
 * 댓글 좋아요 토글 (통합 테이블 사용)
 * - 비추천이 있으면 비추천을 취소하고 좋아요 추가
 */
export async function toggleCommentLike(commentId: string, userId: string): Promise<{ liked: boolean; disliked: boolean; likeCount: number; dislikeCount: number } | null> {
  try {
    // 현재 투표 상태 확인 (한 번의 쿼리)
    const { data: votes } = await supabase
      .from('community_comment_votes')
      .select('vote_type')
      .eq('comment_id', commentId)
      .eq('user_id', userId);

    const existingLike = votes?.some(v => v.vote_type === 'like');
    const existingDislike = votes?.some(v => v.vote_type === 'dislike');

    const { data: currentComment } = await supabase
      .from('community_comments')
      .select('like_count, dislike_count')
      .eq('id', commentId)
      .single();

    let newLikeCount = currentComment?.like_count || 0;
    let newDislikeCount = currentComment?.dislike_count || 0;

    if (existingLike) {
      // 좋아요 취소
      await supabase
        .from('community_comment_votes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', userId)
        .eq('vote_type', 'like');

      newLikeCount = Math.max(0, newLikeCount - 1);
    } else {
      // 비추천이 있으면 먼저 취소
      if (existingDislike) {
        await supabase
          .from('community_comment_votes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', userId)
          .eq('vote_type', 'dislike');
        newDislikeCount = Math.max(0, newDislikeCount - 1);
      }

      // 좋아요 추가
      await supabase
        .from('community_comment_votes')
        .insert({ comment_id: commentId, user_id: userId, vote_type: 'like' });

      newLikeCount = newLikeCount + 1;
    }

    await supabase
      .from('community_comments')
      .update({ like_count: newLikeCount, dislike_count: newDislikeCount })
      .eq('id', commentId);

    return {
      liked: !existingLike,
      disliked: false,
      likeCount: newLikeCount,
      dislikeCount: newDislikeCount,
    };
  } catch (error) {
    console.error('[community] Error toggling comment like:', error);
    return null;
  }
}

/**
 * 댓글 비추천 토글 (통합 테이블 사용)
 * - 좋아요가 있으면 좋아요를 취소하고 비추천 추가
 */
export async function toggleCommentDislike(commentId: string, userId: string): Promise<{ liked: boolean; disliked: boolean; likeCount: number; dislikeCount: number } | null> {
  try {
    // 현재 투표 상태 확인 (한 번의 쿼리)
    const { data: votes } = await supabase
      .from('community_comment_votes')
      .select('vote_type')
      .eq('comment_id', commentId)
      .eq('user_id', userId);

    const existingLike = votes?.some(v => v.vote_type === 'like');
    const existingDislike = votes?.some(v => v.vote_type === 'dislike');

    const { data: currentComment } = await supabase
      .from('community_comments')
      .select('like_count, dislike_count')
      .eq('id', commentId)
      .single();

    let newLikeCount = currentComment?.like_count || 0;
    let newDislikeCount = currentComment?.dislike_count || 0;

    if (existingDislike) {
      // 비추천 취소
      await supabase
        .from('community_comment_votes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', userId)
        .eq('vote_type', 'dislike');

      newDislikeCount = Math.max(0, newDislikeCount - 1);
    } else {
      // 좋아요가 있으면 먼저 취소
      if (existingLike) {
        await supabase
          .from('community_comment_votes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', userId)
          .eq('vote_type', 'like');
        newLikeCount = Math.max(0, newLikeCount - 1);
      }

      // 비추천 추가
      await supabase
        .from('community_comment_votes')
        .insert({ comment_id: commentId, user_id: userId, vote_type: 'dislike' });

      newDislikeCount = newDislikeCount + 1;
    }

    await supabase
      .from('community_comments')
      .update({ like_count: newLikeCount, dislike_count: newDislikeCount })
      .eq('id', commentId);

    return {
      liked: false,
      disliked: !existingDislike,
      likeCount: newLikeCount,
      dislikeCount: newDislikeCount,
    };
  } catch (error) {
    console.error('[community] Error toggling comment dislike:', error);
    return null;
  }
}

// 커뮤니티 통계 타입
export interface CommunityStats {
  totalPosts: number;
  totalComments: number;
  totalLikes: number;
  totalUsers: number;
  todayPosts: number;
}

/**
 * 인기 게시물 조회 (조회수/좋아요 기준)
 */
export async function getPopularPosts(limit: number = 5): Promise<CommunityPost[]> {
  try {
    const { data, error } = await supabase
      .from('community_posts')
      .select('*')
      .order('like_count', { ascending: false })
      .order('view_count', { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error('[community] Error fetching popular posts:', error);
      return [];
    }

    let posts = data as CommunityPost[];

    // 작성자 정보 조회 (헬퍼 함수 사용)
    if (posts.length > 0) {
      const userIds = [...new Set(posts.map(p => p.user_id).filter(Boolean))];
      const profileMap = await getProfilesMap(userIds);
      posts = posts.map(post => ({
        ...post,
        author: profileMap.get(post.user_id) || { id: post.user_id, username: 'Unknown' },
      }));
    }

    return posts;
  } catch (error) {
    console.error('[community] Error fetching popular posts:', error);
    return [];
  }
}

/**
 * 커뮤니티 통계 조회
 */
export async function getCommunityStats(): Promise<CommunityStats> {
  try {
    // 총 게시물 수
    const { count: totalPosts } = await supabase
      .from('community_posts')
      .select('*', { count: 'exact', head: true });

    // 총 댓글 수
    const { count: totalComments } = await supabase
      .from('community_comments')
      .select('*', { count: 'exact', head: true });

    // 총 좋아요 수 (통합 테이블 사용)
    const { count: totalLikes } = await supabase
      .from('community_post_votes')
      .select('*', { count: 'exact', head: true })
      .eq('vote_type', 'like');

    // 총 가입자 수 (profiles 테이블 기준)
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // 오늘 작성된 게시물 수
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayPosts } = await supabase
      .from('community_posts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    return {
      totalPosts: totalPosts || 0,
      totalComments: totalComments || 0,
      totalLikes: totalLikes || 0,
      totalUsers: totalUsers || 0,
      todayPosts: todayPosts || 0,
    };
  } catch (error) {
    console.error('[community] Error fetching community stats:', error);
    return {
      totalPosts: 0,
      totalComments: 0,
      totalLikes: 0,
      totalUsers: 0,
      todayPosts: 0,
    };
  }
}

/**
 * 인기 태그 조회
 */
export async function getPopularTags(limit: number = 10): Promise<{ tag: string; count: number }[]> {
  try {
    // 모든 게시물의 태그를 가져와서 집계
    const { data, error } = await supabase
      .from('community_posts')
      .select('tags');

    if (error || !data) {
      return [];
    }

    const tagCounts: Record<string, number> = {};
    data.forEach(post => {
      (post.tags || []).forEach((tag: string) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  } catch (error) {
    console.error('[community] Error fetching popular tags:', error);
    return [];
  }
}

/**
 * 이미지 업로드
 */
export async function uploadPostImage(userId: string, file: File): Promise<string | null> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('community-images')
      .upload(fileName, file);

    if (error) {
      console.error('[community] Error uploading image:', error);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('community-images')
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    console.error('[community] Error uploading image:', error);
    return null;
  }
}

/**
 * 게시물 해결됨 상태 변경
 */
export async function markPostSolved(postId: string, userId: string, isSolved: boolean): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('community_posts')
      .update({
        is_solved: isSolved,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .eq('user_id', userId); // 작성자만 변경 가능

    if (error) {
      console.error('[community] Error marking post solved:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[community] Error marking post solved:', error);
    return false;
  }
}

/**
 * 정답 채택
 */
export async function acceptAnswer(postId: string, commentId: string, userId: string): Promise<boolean> {
  try {
    // 게시물 작성자 확인
    const { data: post } = await supabase
      .from('community_posts')
      .select('user_id, accepted_answer_id')
      .eq('id', postId)
      .single();

    if (!post || post.user_id !== userId) {
      console.error('[community] Only post author can accept answer');
      return false;
    }

    // 이전 채택 취소
    if (post.accepted_answer_id) {
      await supabase
        .from('community_comments')
        .update({ is_accepted: false })
        .eq('id', post.accepted_answer_id);
    }

    // 새 답변 채택
    await supabase
      .from('community_comments')
      .update({ is_accepted: true })
      .eq('id', commentId);

    // 게시물 업데이트
    const { error } = await supabase
      .from('community_posts')
      .update({
        accepted_answer_id: commentId,
        is_solved: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId);

    if (error) {
      console.error('[community] Error accepting answer:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[community] Error accepting answer:', error);
    return false;
  }
}

/**
 * 정답 채택 취소
 */
export async function unacceptAnswer(postId: string, userId: string): Promise<boolean> {
  try {
    // 게시물 작성자 확인
    const { data: post } = await supabase
      .from('community_posts')
      .select('user_id, accepted_answer_id')
      .eq('id', postId)
      .single();

    if (!post || post.user_id !== userId) {
      return false;
    }

    if (post.accepted_answer_id) {
      await supabase
        .from('community_comments')
        .update({ is_accepted: false })
        .eq('id', post.accepted_answer_id);
    }

    const { error } = await supabase
      .from('community_posts')
      .update({
        accepted_answer_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId);

    return !error;
  } catch (error) {
    console.error('[community] Error unaccepting answer:', error);
    return false;
  }
}

/**
 * 유용함 투표 토글 (게시물) - 통합 테이블 사용
 */
export async function togglePostHelpful(postId: string, userId: string): Promise<{ voted: boolean; helpfulCount: number } | null> {
  try {
    const { data: existingVote } = await supabase
      .from('community_post_votes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .eq('vote_type', 'helpful')
      .maybeSingle();

    if (existingVote) {
      // 투표 취소
      await supabase
        .from('community_post_votes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId)
        .eq('vote_type', 'helpful');

      const { data: currentPost } = await supabase
        .from('community_posts')
        .select('helpful_count')
        .eq('id', postId)
        .single();

      await supabase
        .from('community_posts')
        .update({ helpful_count: Math.max(0, (currentPost?.helpful_count || 1) - 1) })
        .eq('id', postId);

      return { voted: false, helpfulCount: Math.max(0, (currentPost?.helpful_count || 1) - 1) };
    } else {
      // 투표 추가
      await supabase
        .from('community_post_votes')
        .insert({ post_id: postId, user_id: userId, vote_type: 'helpful' });

      const { data: currentPost } = await supabase
        .from('community_posts')
        .select('helpful_count')
        .eq('id', postId)
        .single();

      await supabase
        .from('community_posts')
        .update({ helpful_count: (currentPost?.helpful_count || 0) + 1 })
        .eq('id', postId);

      return { voted: true, helpfulCount: (currentPost?.helpful_count || 0) + 1 };
    }
  } catch (error) {
    console.error('[community] Error toggling helpful vote:', error);
    return null;
  }
}

/**
 * 유용함 투표 토글 (댓글) - 통합 테이블 사용
 */
export async function toggleCommentHelpful(commentId: string, userId: string): Promise<{ voted: boolean; helpfulCount: number } | null> {
  try {
    const { data: existingVote } = await supabase
      .from('community_comment_votes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .eq('vote_type', 'helpful')
      .maybeSingle();

    if (existingVote) {
      await supabase
        .from('community_comment_votes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', userId)
        .eq('vote_type', 'helpful');

      const { data: comment } = await supabase
        .from('community_comments')
        .select('helpful_count')
        .eq('id', commentId)
        .single();

      await supabase
        .from('community_comments')
        .update({ helpful_count: Math.max(0, (comment?.helpful_count || 1) - 1) })
        .eq('id', commentId);

      return { voted: false, helpfulCount: Math.max(0, (comment?.helpful_count || 1) - 1) };
    } else {
      await supabase
        .from('community_comment_votes')
        .insert({ comment_id: commentId, user_id: userId, vote_type: 'helpful' });

      const { data: comment } = await supabase
        .from('community_comments')
        .select('helpful_count')
        .eq('id', commentId)
        .single();

      await supabase
        .from('community_comments')
        .update({ helpful_count: (comment?.helpful_count || 0) + 1 })
        .eq('id', commentId);

      return { voted: true, helpfulCount: (comment?.helpful_count || 0) + 1 };
    }
  } catch (error) {
    console.error('[community] Error toggling comment helpful:', error);
    return null;
  }
}

// 증상 태그 상수 (트러블슈팅용)
export const SYMPTOM_TAGS = [
  'stringing',
  'layer_shift',
  'warping',
  'bed_adhesion',
  'under_extrusion',
  'over_extrusion',
  'z_banding',
  'ghosting',
  'elephant_foot',
  'bridging',
  'support_issues',
  'first_layer',
  'clogging',
  'heat_creep',
  'wet_filament',
  'layer_separation',
  'blobs',
  'zits',
  'gaps',
  'infill_issues',
] as const;

export type SymptomTag = typeof SYMPTOM_TAGS[number];

// 내 최근 글 아이템 타입 (사이드바용)
export interface MyRecentPost {
  id: string;
  title: string;
  category: PostCategory;
  created_at: string;
  comment_count: number;
  like_count: number;
}

// 내 최근 댓글 아이템 타입 (사이드바용)
export interface MyRecentComment {
  id: string;
  content: string;
  post_id: string;
  post_title: string;
  created_at: string;
}

/**
 * 내가 쓴 최근 게시물 조회 (사이드바용)
 */
export async function getMyRecentPosts(userId: string, limit: number = 5): Promise<MyRecentPost[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('community_posts')
      .select('id, title, category, created_at, comment_count, like_count')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[community] Error fetching my posts:', error);
      return [];
    }

    return data as MyRecentPost[];
  } catch (error) {
    console.error('[community] Error fetching my posts:', error);
    return [];
  }
}

/**
 * 내가 쓴 최근 댓글 조회 (사이드바용)
 */
export async function getMyRecentComments(userId: string, limit: number = 5): Promise<MyRecentComment[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('community_comments')
      .select('id, content, post_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[community] Error fetching my comments:', error);
      return [];
    }

    // 게시물 제목 조회
    const postIds = [...new Set((data || []).map(c => c.post_id))];
    const { data: posts } = await supabase
      .from('community_posts')
      .select('id, title')
      .in('id', postIds);

    const postTitleMap = new Map((posts || []).map(p => [p.id, p.title]));

    return (data || []).map(comment => ({
      id: comment.id,
      content: comment.content,
      post_id: comment.post_id,
      post_title: postTitleMap.get(comment.post_id) || '삭제된 게시물',
      created_at: comment.created_at,
    }));
  } catch (error) {
    console.error('[community] Error fetching my comments:', error);
    return [];
  }
}
