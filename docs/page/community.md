# 커뮤니티 시스템 문서

## 1. 개요

FACTOR-HIBRID 커뮤니티는 3D 프린팅 사용자들이 출력물을 공유하고, 질문하고, 문제를 해결할 수 있는 플랫폼입니다.

### 1.1 주요 기능
- 6가지 카테고리 게시물 (자랑, 질문, 트러블슈팅, 팁, 리뷰, 자유)
- 리치 텍스트 에디터 (이미지, 3D 모델, G-code 임베드)
- 댓글 및 대댓글
- 좋아요 및 유용함 투표
- 트러블슈팅 메타데이터 (프린터, 필라멘트, 슬라이서 정보)
- 정답 채택 시스템

### 1.2 기술 스택
- **프론트엔드**: React + TypeScript + Vite
- **백엔드**: Supabase (PostgreSQL + Auth + Storage)
- **상태 관리**: React Context (AuthContext)
- **에디터**: TipTap (ProseMirror 기반)
- **3D 렌더링**: Three.js (React Three Fiber)

---

## 2. 프로젝트 구조

```
packages/
├── shared/
│   └── src/services/supabaseService/
│       └── community.ts                    # 핵심 API 서비스 (1283줄)
│
└── web/
    ├── src/
    │   ├── pages/
    │   │   ├── Community.tsx               # 커뮤니티 메인 페이지
    │   │   ├── CommunityPost.tsx           # 게시물 상세 페이지
    │   │   ├── CreatePost.tsx              # 게시물 작성 페이지
    │   │   └── EditPost.tsx                # 게시물 수정 페이지
    │   │
    │   └── components/community/
    │       ├── index.ts                    # Export 파일
    │       ├── CreatePostModal.tsx         # 게시물 작성 모달
    │       ├── PostCard.tsx                # 게시물 카드 컴포넌트
    │       ├── RichTextEditor.tsx          # TipTap 리치 텍스트 에디터
    │       ├── ContentRenderer.tsx         # 게시물 콘텐츠 렌더러
    │       ├── GCodeEmbed.tsx              # G-code 파일 임베드
    │       ├── Model3DEmbed.tsx            # 3D 모델 파일 임베드
    │       ├── Model3DNode.ts              # TipTap 3D 모델 커스텀 노드
    │       ├── Model3DNodeComponent.tsx    # 3D 모델 노드 React 컴포넌트
    │       ├── ResizableImageNode.ts       # TipTap 크기 조절 이미지 노드
    │       ├── ResizableImage.tsx          # 크기 조절 이미지 컴포넌트
    │       └── PrinterSelector.tsx         # 프린터 선택 컴포넌트
    │
    └── supabase/migrations/
        ├── 20260110000000_community_tables.sql
        ├── 20260112100000_add_model_to_community_posts.sql
        └── 20260112150000_add_gcode_files_to_community_posts.sql
```

---

## 3. 라우팅

| 경로 | 페이지 | 권한 |
|------|--------|------|
| `/community` | Community.tsx | 공개 |
| `/community/write` | CreatePost.tsx | 로그인 필요 |
| `/community/:postId` | CommunityPost.tsx | 공개 |
| `/community/:postId/edit` | EditPost.tsx | 로그인 + 작성자만 |

---

## 4. 데이터베이스 스키마

### 4.1 핵심 테이블

#### community_posts (게시물)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | 게시물 ID (PK) |
| user_id | UUID | 작성자 ID (FK → auth.users) |
| title | TEXT | 제목 |
| content | TEXT | 본문 (HTML) |
| category | TEXT | 카테고리 |
| images | TEXT[] | 첨부 이미지 URL 배열 |
| tags | TEXT[] | 태그 배열 |
| model_id | UUID | AI 모델 ID (FK → ai_generated_models) |
| view_count | INTEGER | 조회수 |
| like_count | INTEGER | 좋아요 수 |
| comment_count | INTEGER | 댓글 수 |
| helpful_count | INTEGER | 유용함 투표 수 |
| is_pinned | BOOLEAN | 고정 여부 |
| is_solved | BOOLEAN | 해결됨 여부 |
| accepted_answer_id | UUID | 채택된 답변 ID |
| troubleshooting_meta | JSONB | 트러블슈팅 메타데이터 |
| created_at | TIMESTAMPTZ | 생성 시간 |
| updated_at | TIMESTAMPTZ | 수정 시간 |

**카테고리 종류:**
- `showcase` - 자랑 (출력물 공유)
- `question` - 질문
- `troubleshooting` - 트러블슈팅 (문제 해결)
- `tip` - 팁 (노하우 공유)
- `review` - 리뷰 (장비/재료)
- `free` - 자유

#### community_comments (댓글)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | 댓글 ID (PK) |
| post_id | UUID | 게시물 ID (FK) |
| user_id | UUID | 작성자 ID (FK) |
| parent_id | UUID | 상위 댓글 ID (대댓글용) |
| content | TEXT | 댓글 내용 |
| like_count | INTEGER | 좋아요 수 |
| helpful_count | INTEGER | 유용함 투표 수 |
| is_accepted | BOOLEAN | 정답 채택 여부 |
| created_at | TIMESTAMPTZ | 생성 시간 |
| updated_at | TIMESTAMPTZ | 수정 시간 |

#### community_post_likes (게시물 좋아요)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| post_id | UUID | 게시물 ID (FK) |
| user_id | UUID | 사용자 ID (FK) |
| created_at | TIMESTAMPTZ | 생성 시간 |

**제약조건:** UNIQUE(post_id, user_id) - 중복 좋아요 방지

#### community_comment_likes (댓글 좋아요)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| comment_id | UUID | 댓글 ID (FK) |
| user_id | UUID | 사용자 ID (FK) |
| created_at | TIMESTAMPTZ | 생성 시간 |

#### community_post_helpful (게시물 유용함 투표)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| post_id | UUID | 게시물 ID (FK) |
| user_id | UUID | 사용자 ID (FK) |
| created_at | TIMESTAMPTZ | 생성 시간 |

#### community_comment_helpful (댓글 유용함 투표)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| comment_id | UUID | 댓글 ID (FK) |
| user_id | UUID | 사용자 ID (FK) |
| created_at | TIMESTAMPTZ | 생성 시간 |

### 4.2 관련 테이블

#### gcode_segment_data (G-code 세그먼트)

커뮤니티용 추가 컬럼:

| 컬럼 | 타입 | 설명 |
|------|------|------|
| post_id | UUID | 게시물 ID (FK) |
| gcode_embed_id | TEXT | 게시물 내 임베드 고유 ID |

### 4.3 인덱스

```sql
-- community_posts
idx_community_posts_user_id          (user_id)
idx_community_posts_category         (category)
idx_community_posts_created_at       (created_at DESC)
idx_community_posts_is_pinned        (is_pinned DESC)
idx_community_posts_is_solved        (is_solved)
idx_community_posts_tags             (tags) -- GIN 인덱스
idx_community_posts_model_id         (model_id)

-- community_comments
idx_community_comments_post_id       (post_id)
idx_community_comments_user_id       (user_id)
idx_community_comments_parent_id     (parent_id)

-- gcode_segment_data
idx_gcode_segment_data_post_id       (post_id)
idx_gcode_segment_data_embed_id      (gcode_embed_id)
```

### 4.4 RLS 정책

| 테이블 | 작업 | 규칙 |
|--------|------|------|
| community_posts | SELECT | 모두 허용 |
| community_posts | INSERT | auth.uid() = user_id |
| community_posts | UPDATE/DELETE | auth.uid() = user_id |
| community_comments | SELECT | 모두 허용 |
| community_comments | INSERT | auth.uid() = user_id |
| community_comments | UPDATE/DELETE | auth.uid() = user_id |
| likes/helpful 테이블 | SELECT | 모두 허용 |
| likes/helpful 테이블 | ALL | auth.uid() = user_id |

### 4.5 스토리지

**버킷:** `community-images`

**경로 구조:** `{user_id}/{timestamp}.{ext}`

**정책:**
- SELECT: 공개
- INSERT: 인증 사용자
- DELETE: 소유자만

---

## 5. API 서비스

**위치:** `packages/shared/src/services/supabaseService/community.ts`

### 5.1 타입 정의

```typescript
type PostCategory = 'showcase' | 'question' | 'tip' | 'review' | 'free' | 'troubleshooting';

interface CommunityPost {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: PostCategory;
  images?: string[];
  tags?: string[];
  model_id?: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  helpful_count: number;
  is_pinned: boolean;
  is_solved: boolean;
  accepted_answer_id?: string;
  troubleshooting_meta?: TroubleshootingMeta;
  created_at: string;
  updated_at: string;
  author?: ProfileInfo;
  model?: ModelInfo;
  is_liked?: boolean;
  is_helpful_voted?: boolean;
}

interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id?: string;
  content: string;
  like_count: number;
  helpful_count: number;
  is_accepted: boolean;
  created_at: string;
  updated_at: string;
  author?: ProfileInfo;
  replies?: PostComment[];
  is_liked?: boolean;
  is_helpful_voted?: boolean;
}

interface TroubleshootingMeta {
  // 프린터 정보
  printer_model?: string;
  firmware?: string;
  nozzle_size?: string;
  bed_type?: string;
  chamber_temp?: string;
  // 필라멘트 정보
  filament_type?: string;
  filament_brand?: string;
  filament_dried?: boolean;
  // 슬라이서 정보
  slicer?: string;
  slicer_profile?: string;
  print_speed?: string;
  nozzle_temp?: string;
  bed_temp?: string;
  retraction?: string;
  fan_speed?: string;
  layer_height?: string;
  // 증상 태그
  symptom_tags?: string[];
  // 첨부 파일
  gcode_url?: string;
  log_url?: string;
}

interface GetPostsOptions {
  category?: PostCategory;
  tag?: string;
  search?: string;
  sortBy?: 'latest' | 'popular' | 'views' | 'helpful' | 'unsolved';
  isSolved?: boolean;
  page?: number;
  limit?: number;
  userId?: string;
}
```

### 5.2 주요 함수

#### 게시물 관련

| 함수 | 설명 |
|------|------|
| `getPosts(options)` | 게시물 목록 조회 (필터, 정렬, 페이지네이션) |
| `getPost(postId, userId?)` | 단일 게시물 조회 + 조회수 증가 |
| `createPost(userId, input)` | 게시물 생성 |
| `updatePost(postId, userId, input)` | 게시물 수정 |
| `deletePost(postId, userId)` | 게시물 삭제 |
| `markPostSolved(postId, userId, isSolved)` | 해결됨 표시 |

#### 댓글 관련

| 함수 | 설명 |
|------|------|
| `getComments(postId, userId?)` | 댓글 목록 조회 (대댓글 포함) |
| `createComment(postId, userId, content, parentId?)` | 댓글/대댓글 작성 |
| `deleteComment(commentId, userId, postId)` | 댓글 삭제 |

#### 좋아요/투표 관련

| 함수 | 설명 |
|------|------|
| `togglePostLike(postId, userId)` | 게시물 좋아요 토글 |
| `toggleCommentLike(commentId, userId)` | 댓글 좋아요 토글 |
| `togglePostHelpful(postId, userId)` | 게시물 유용함 투표 토글 |
| `toggleCommentHelpful(commentId, userId)` | 댓글 유용함 투표 토글 |

#### 정답 채택

| 함수 | 설명 |
|------|------|
| `acceptAnswer(postId, commentId, userId)` | 댓글을 정답으로 채택 |
| `unacceptAnswer(postId, userId)` | 정답 채택 취소 |

#### 통계 및 추천

| 함수 | 설명 |
|------|------|
| `getPopularPosts(limit?)` | 인기 게시물 조회 |
| `getCommunityStats()` | 커뮤니티 통계 조회 |
| `getPopularTags(limit?)` | 인기 태그 조회 |

#### 파일 업로드

| 함수 | 설명 |
|------|------|
| `uploadPostImage(userId, file)` | 게시물 이미지 업로드 |

---

## 6. 컴포넌트 상세

### 6.1 CreatePostModal

**역할:** 모달 형태의 게시물 작성 UI

**Props:**
```typescript
interface CreatePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostCreated: (post: CommunityPost) => void;
}
```

**주요 기능:**
- 카테고리 선택
- RichTextEditor로 본문 작성
- 이미지/3D 모델/G-code 업로드
- 태그 관리 (최대 5개)
- 트러블슈팅 메타데이터 입력 (Collapsible 섹션)

### 6.2 PostCard

**역할:** 게시물 목록에서 사용하는 카드 컴포넌트

**Props:**
```typescript
interface PostCardProps {
  post: CommunityPost;
  onClick?: () => void;
  onTagClick?: (tag: string) => void;
  className?: string;
}
```

**표시 정보:**
- 썸네일 (이미지 또는 모델)
- 카테고리 배지 (색상 구분)
- 제목, 요약
- 작성자 (아바타 + 닉네임)
- 메타데이터 (생성일, 조회수, 좋아요, 댓글)
- 핀/해결됨 상태

**카테고리별 색상:**
| 카테고리 | 색상 | 아이콘 |
|---------|------|--------|
| showcase | Purple | 🎨 |
| question | Blue | ❓ |
| troubleshooting | Red | 🔧 |
| tip | Amber | 💡 |
| review | Green | ⭐ |
| free | Gray | 💬 |

### 6.3 RichTextEditor

**역할:** TipTap 기반 리치 텍스트 에디터

**Props:**
```typescript
interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  onImageUpload?: (file: File) => Promise<string | null>;
  on3DUpload?: (file: File) => Promise<string | null>;
  onGCodeUpload?: (file: File) => Promise<{ url: string; id: string } | null>;
  minHeight?: string;
  attachedImages?: AttachedImage[];
  onAttachedImagesChange?: (images: AttachedImage[]) => void;
  showAttachmentSection?: boolean;
  maxImages?: number;
}
```

**지원 기능:**
- 텍스트 포맷팅 (Bold, Italic, Underline, Strikethrough)
- 정렬 (Left, Center, Right)
- 리스트 (Bullet, Ordered)
- 링크, 인용문, 코드 블록
- 색상 및 하이라이트 (15가지 프리셋)
- 폰트 크기 (12~32px)
- 이미지 업로드 및 크기 조절
- 3D 모델 임베드 (STL, OBJ, GLTF, GLB)
- G-code 파일 임베드
- Undo/Redo

### 6.4 ContentRenderer

**역할:** 게시물 본문을 안전하게 렌더링

**Props:**
```typescript
interface ContentRendererProps {
  content: string;
  className?: string;
  postId?: string;
}
```

**주요 기능:**
- HTML Sanitizer (XSS 방지)
- 3D 모델 임베드 자동 감지 및 렌더링
- G-code 임베드 자동 감지 및 렌더링
- 이미지 스타일 적용

### 6.5 Model3DEmbed

**역할:** 3D 모델 파일 임베드 뷰어

**Props:**
```typescript
interface Model3DEmbedProps {
  url: string;
  filename: string;
  fileType: string;
  className?: string;
}
```

**지원 포맷:**
- 뷰어 지원: STL, OBJ, GLTF, GLB
- 다운로드 전용: 3MF, GCODE

**기능:**
- Three.js 기반 3D 뷰어
- 확대 모달 (전체 화면 뷰)
- 다운로드 버튼
- 회전 컨트롤

### 6.6 GCodeEmbed

**역할:** G-code 파일 임베드 뷰어

**Props:**
```typescript
interface GCodeEmbedProps {
  url: string;
  filename: string;
  gcodeEmbedId?: string;
  className?: string;
}
```

**기능:**
- GCodeAnalysisReport 임베드 모드 사용
- 레이어 세그먼트 데이터 조회/생성
- 메트릭 표시 (출력 시간, 레이어 수, 온도 등)
- 속도 분포 분석
- 확대 모달 (GCodeViewerReportModal)
- 다운로드 버튼

### 6.7 PrinterSelector

**역할:** 프린터 제조사/시리즈/모델 계층 선택

**Props:**
```typescript
interface PrinterSelectorProps {
  value?: string;
  onChange: (printerInfo: PrinterInfo | null) => void;
  allowCustomInput?: boolean;
  required?: boolean;
  disabled?: boolean;
}

interface PrinterInfo {
  manufacturer: string;
  series: string;
  model: string;
  displayName: string;
  modelId?: string;
}
```

**기능:**
- 제조사 → 시리즈 → 모델 순차 선택
- 직접 입력 모드 지원
- 비동기 데이터 로딩

### 6.8 TipTap 커스텀 노드

#### Model3DNode

**명령어:**
```typescript
model3d: {
  setModel3D: (options: {
    url: string;
    filename: string;
    filetype: string;
    gcodeId?: string;
    isLoading?: boolean;
  }) => ReturnType;

  updateModel3DLoading: (tempUrl: string, newUrl: string) => ReturnType;
}
```

#### ResizableImageNode

**명령어:**
```typescript
resizableImage: {
  setResizableImage: (options: {
    src: string;
    alt?: string;
    width?: number;
  }) => ReturnType;
}
```

---

## 7. 페이지 상세

### 7.1 Community.tsx (메인 페이지)

**주요 기능:**
- 게시물 목록 (PostCard 그리드)
- 카테고리 탭 필터
- 정렬 옵션 (최신, 인기, 조회수)
- 검색 기능
- 태그 필터링
- 무한 스크롤/페이지네이션

**오른쪽 패널 (웹):**
- 커뮤니티 통계 (총 게시물, 댓글, 활동 회원, 좋아요)
- 인기 게시물 (Top 5)
- 인기 태그 (Top 10)

**URL 파라미터:**
- `category` - 카테고리 필터
- `sort` - 정렬 방식
- `q` - 검색어
- `tag` - 태그 필터

### 7.2 CommunityPost.tsx (상세 페이지)

**주요 기능:**
- 게시물 내용 (ContentRenderer)
- 이미지 갤러리
- 좋아요/공유 버튼
- 댓글 목록 및 작성
- 대댓글 지원
- 게시물 수정/삭제 (작성자)
- 댓글 좋아요/삭제

**오른쪽 패널 (웹):**
- 작성자 정보
- 게시물 통계 (조회수, 좋아요, 댓글, 생성일)

### 7.3 CreatePost.tsx (작성 페이지)

**주요 기능:**
- 제목 입력
- RichTextEditor 본문 작성
- 카테고리 선택
- 이미지/3D 모델/G-code 첨부
- 태그 관리

**트러블슈팅 전용 섹션 (Collapsible):**
- 프린터 정보 (모델, 펌웨어, 노즐, 베드)
- 필라멘트 정보 (종류, 브랜드, 건조 여부)
- 슬라이서 설정 (종류, 속도, 온도, 리트랙션, 높이)
- 증상 태그 (20가지 선택)

### 7.4 EditPost.tsx (수정 페이지)

CreatePost와 동일한 구조, 기존 데이터로 폼 초기화

---

## 8. 데이터 흐름

### 8.1 게시물 조회 흐름

```
Community.tsx
    ↓
getPosts(options)
    ├─ community_posts 조회 (필터/정렬/페이지네이션)
    ├─ getProfilesMap() → 작성자 정보 배치 조회
    ├─ getModelsMap() → 모델 정보 배치 조회
    ├─ community_post_likes → 현재 사용자 좋아요 여부
    └─ PaginatedPosts 반환
```

### 8.2 게시물 상세 조회 흐름

```
CommunityPost.tsx
    ├─ getPost(postId, userId)
    │   ├─ community_posts 조회
    │   ├─ view_count 증가
    │   ├─ 작성자/모델 정보 조회
    │   └─ 좋아요 여부 확인
    │
    └─ getComments(postId, userId)
        ├─ 최상위 댓글 조회
        ├─ 대댓글 조회
        ├─ 작성자 정보 배치 조회
        └─ 트리 구조로 변환
```

### 8.3 게시물 작성 흐름

```
CreatePost.tsx
    ├─ 이미지 업로드
    │   └─ uploadPostImage(userId, file) → 공개 URL
    │
    ├─ G-code 업로드
    │   ├─ 파일 업로드
    │   └─ 세그먼트 데이터 생성
    │
    └─ createPost(userId, input)
        ├─ community_posts INSERT
        ├─ 작성자 정보 추가
        └─ CommunityPost 반환
```

### 8.4 좋아요 토글 흐름

```
togglePostLike(postId, userId)
    ├─ community_post_likes 조회
    ├─ 좋아요 추가 또는 삭제
    ├─ community_posts.like_count 업데이트
    └─ { liked, likeCount } 반환
```

---

## 9. 트러블슈팅 증상 태그

```typescript
const SYMPTOM_TAGS = [
  'stringing',           // 스트링잉
  'layer_shift',         // 레이어 밀림
  'warping',             // 뒤틀림/휨
  'bed_adhesion',        // 베드 접착 불량
  'under_extrusion',     // 압출 부족
  'over_extrusion',      // 과압출
  'z_banding',           // Z 밴딩
  'ghosting',            // 고스팅/울림
  'elephant_foot',       // 코끼리발
  'bridging',            // 브릿징 불량
  'support_issues',      // 서포트 문제
  'first_layer',         // 첫층 문제
  'clogging',            // 막힘/클로깅
  'heat_creep',          // 히트 크립
  'wet_filament',        // 습한 필라멘트
  'layer_separation',    // 레이어 분리
  'blobs',               // 블롭/덩어리
  'zits',                // 지트/돌기
  'gaps',                // 갭/빈틈
  'infill_issues',       // 인필 문제
];
```

---

## 10. 국제화 (i18n) 키

주요 번역 키 네임스페이스: `community`

```
community.category.all
community.category.showcase
community.category.question
community.category.troubleshooting
community.category.tip
community.category.review
community.category.free

community.sort.latest
community.sort.popular
community.sort.views

community.write
community.noPosts
community.loginRequired
community.loadMore

community.comments
community.reply
community.commentPlaceholder
community.noComments

community.stats
community.totalPosts
community.totalComments
community.activeUsers
community.popularPosts
community.popularTags

community.deletePostTitle
community.deletePostDesc
community.deleteCommentTitle
community.deleteCommentDesc
```

---

## 11. 성능 최적화

### 11.1 Lazy Loading

- `ModelViewer` - 3D 뷰어 컴포넌트
- `GCodeEmbed` - G-code 임베드 컴포넌트
- `GCodeViewerReportModal` - 확대 모달

### 11.2 배치 쿼리

- `getProfilesMap()` - 작성자 정보 일괄 조회
- `getModelsMap()` - 모델 정보 일괄 조회

### 11.3 캐싱된 카운트

- `like_count`, `comment_count`, `view_count` 등은 비정규화하여 저장
- 빠른 목록 조회 가능

### 11.4 인덱스 활용

- `created_at DESC` - 최신순 정렬
- `tags GIN` - 태그 필터링
- `category` - 카테고리 필터링

---

## 12. 보안

### 12.1 RLS (Row Level Security)

- 모든 테이블에 RLS 활성화
- 작성자만 수정/삭제 가능
- 좋아요는 사용자당 1회 제한

### 12.2 XSS 방지

- `ContentRenderer`의 HTML Sanitizer
- script 태그 제거
- 이벤트 핸들러 제거

### 12.3 파일 업로드 검증

- 파일 타입 체크
- 파일 크기 제한
- 소유자만 삭제 가능

---

## 13. 마이그레이션 히스토리

| 날짜 | 파일 | 내용 |
|------|------|------|
| 2026-01-10 | community_tables.sql | 6개 핵심 테이블, 스토리지 버킷 생성 |
| 2026-01-12 | add_model_to_community_posts.sql | model_id 컬럼 추가 |
| 2026-01-12 | add_gcode_files_to_community_posts.sql | gcode_segment_data 확장 |

---

## 14. 백엔드 로직 상세

### 14.1 사용자 인증 (AuthContext)

**위치:** `packages/shared/src/contexts/AuthContext.tsx`

#### 제공되는 인터페이스

```typescript
interface AuthContextType {
  user: User | null;                    // Supabase User 객체
  session: Session | null;              // Supabase Session
  userRole: "admin" | "user" | null;    // 사용자 역할
  isAdmin: boolean;                     // 관리자 여부
  loading: boolean;                     // 로딩 상태
  needsProfileSetup: boolean;           // 프로필 설정 필요 여부
  profileCheckComplete: boolean;        // 프로필 체크 완료 여부
  signUp: (email, password, displayName?, phone?) => Promise<{ error: any }>;
  signIn: (email, password) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithApple: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  checkProfileSetup: () => Promise<void>;
}
```

#### 사용 방법

```typescript
import { useAuth } from "@shared/contexts/AuthContext";

function MyComponent() {
  const { user, loading } = useAuth();

  if (loading) return <Spinner />;
  if (!user) return <LoginRequired />;

  return <div>환영합니다, {user.email}</div>;
}
```

#### 프로필 정보 조회

커뮤니티에서는 `profiles` 테이블에서 display_name, avatar_url을 조회합니다.

```typescript
// 단일 사용자 프로필 조회
async function getProfileInfo(userId: string): Promise<ProfileInfo> {
  const { data } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    id: data.user_id,
    username: data.display_name || 'Unknown',
    avatar_url: data.avatar_url,
  };
}

// 배치 조회 (N+1 쿼리 방지)
async function getProfilesMap(userIds: string[]): Promise<Map<string, ProfileInfo>> {
  const { data } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url')
    .in('user_id', userIds);

  // Map으로 변환하여 O(1) 조회
}
```

---

### 14.2 게시물 작성 로직

**위치:** `packages/web/src/pages/CreatePost.tsx`

#### Import 구조

```typescript
// Services (shared 패키지)
import {
  createPost,
  uploadPostImage,
  type PostCategory,
  type CreatePostInput,
  type TroubleshootingMeta,
  SYMPTOM_TAGS,
} from "@shared/services/supabaseService/community";

// G-code 세그먼트 서비스 (web 패키지)
import { createCommunitySegments } from "@/lib/api/gcode";
import { saveCommunitySegmentData, linkSegmentsToPost } from "@/lib/gcodeSegmentService";
```

#### 게시물 작성 흐름

```
1. 사용자 입력 수집
   ├─ title, content, category
   ├─ tags (최대 5개)
   ├─ troubleshooting_meta (트러블슈팅 카테고리)
   └─ 첨부 파일 (이미지, 3D 모델, G-code)

2. 이미지 업로드 (선택)
   └─ uploadPostImage(userId, file) → 공개 URL 반환

3. G-code 세그먼트 생성 (선택)
   ├─ createCommunitySegments(file) → 세그먼트 데이터
   └─ saveCommunitySegmentData(segments) → DB 저장

4. createPost(userId, input) 호출
   ├─ community_posts INSERT
   └─ 작성자 정보 조회하여 반환

5. G-code 세그먼트 연결 (선택)
   └─ linkSegmentsToPost(segmentIds, postId)

6. 성공 시 상세 페이지로 이동
   └─ navigate(`/community/${post.id}`)
```

#### CreatePostInput 타입

```typescript
interface CreatePostInput {
  title: string;                          // 게시물 제목
  content: string;                        // 본문 (HTML)
  category: PostCategory;                 // 카테고리
  images?: string[];                      // 이미지 URL 배열
  tags?: string[];                        // 태그 배열
  model_id?: string;                      // AI 모델 ID (선택)
  troubleshooting_meta?: TroubleshootingMeta;  // 트러블슈팅 메타
}
```

#### 실제 저장 로직

```typescript
// community.ts - createPost 함수
export async function createPost(userId: string, input: CreatePostInput): Promise<CommunityPost | null> {
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
      troubleshooting_meta: input.troubleshooting_meta || null,
    })
    .select('*')
    .single();

  if (error) return null;

  // 작성자 정보 추가
  const author = await getProfileInfo(userId);
  return { ...data, author } as CommunityPost;
}
```

---

### 14.3 게시물 조회 로직

#### 목록 조회 (getPosts)

```typescript
export async function getPosts(options: GetPostsOptions = {}): Promise<PaginatedPosts> {
  const { category, tag, search, sortBy = 'latest', isSolved, page = 1, limit = 20, userId } = options;

  // 1. 기본 쿼리
  let query = supabase
    .from('community_posts')
    .select('*', { count: 'exact' });

  // 2. 필터 적용
  if (category) query = query.eq('category', category);
  if (tag) query = query.contains('tags', [tag]);
  if (search) query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
  if (isSolved !== undefined) query = query.eq('is_solved', isSolved);

  // 3. 정렬 적용
  switch (sortBy) {
    case 'popular': query = query.order('like_count', { ascending: false }); break;
    case 'views': query = query.order('view_count', { ascending: false }); break;
    case 'helpful': query = query.order('helpful_count', { ascending: false }); break;
    case 'unsolved':
      query = query.order('is_solved', { ascending: true })
                   .order('created_at', { ascending: false });
      break;
    default:  // 'latest'
      query = query.order('is_pinned', { ascending: false })
                   .order('created_at', { ascending: false });
  }

  // 4. 페이지네이션
  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);

  // 5. 데이터 조회
  const { data, error, count } = await query;

  // 6. 작성자 정보 배치 조회 (N+1 방지)
  const userIds = [...new Set(data.map(p => p.user_id))];
  const profileMap = await getProfilesMap(userIds);

  // 7. 모델 정보 배치 조회
  const modelIds = [...new Set(data.map(p => p.model_id).filter(Boolean))];
  const modelMap = await getModelsMap(modelIds);

  // 8. 좋아요 여부 확인 (로그인한 경우)
  if (userId) {
    const { data: likes } = await supabase
      .from('community_post_likes')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', data.map(p => p.id));

    const likedPostIds = new Set(likes?.map(l => l.post_id));
    // ... is_liked 추가
  }

  return { posts, total: count, page, limit, totalPages };
}
```

#### 단일 게시물 조회 (getPost)

```typescript
export async function getPost(postId: string, userId?: string): Promise<CommunityPost | null> {
  // 1. 게시물 조회
  const { data } = await supabase
    .from('community_posts')
    .select('*')
    .eq('id', postId)
    .single();

  // 2. 작성자 정보 조회
  const author = await getProfileInfo(data.user_id);

  // 3. 모델 정보 조회 (첨부된 경우)
  if (data.model_id) {
    const model = await getModelInfo(data.model_id);
    // ...
  }

  // 4. 조회수 증가
  await supabase
    .from('community_posts')
    .update({ view_count: (data.view_count || 0) + 1 })
    .eq('id', postId);

  // 5. 좋아요 여부 확인
  if (userId) {
    const { data: like } = await supabase
      .from('community_post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    // ... is_liked 추가
  }

  return post;
}
```

---

### 14.4 댓글 로직

#### 댓글 목록 조회 (getComments)

```typescript
export async function getComments(postId: string, userId?: string): Promise<PostComment[]> {
  // 1. 최상위 댓글 조회
  const { data: comments } = await supabase
    .from('community_comments')
    .select('*')
    .eq('post_id', postId)
    .is('parent_id', null)
    .order('created_at', { ascending: true });

  // 2. 대댓글 조회
  const { data: replies } = await supabase
    .from('community_comments')
    .select('*')
    .eq('post_id', postId)
    .not('parent_id', 'is', null)
    .order('created_at', { ascending: true });

  // 3. 작성자 정보 배치 조회
  const allComments = [...comments, ...replies];
  const userIds = [...new Set(allComments.map(c => c.user_id))];
  const profileMap = await getProfilesMap(userIds);

  // 4. 대댓글을 부모에 매핑
  const repliesByParent = replies.reduce((acc, reply) => {
    if (!acc[reply.parent_id]) acc[reply.parent_id] = [];
    acc[reply.parent_id].push(reply);
    return acc;
  }, {});

  // 5. 좋아요 여부 확인 (로그인한 경우)
  // ...

  return comments;
}
```

#### 댓글 작성 (createComment)

```typescript
export async function createComment(
  postId: string,
  userId: string,
  content: string,
  parentId?: string
): Promise<PostComment | null> {
  // 1. 댓글 INSERT
  const { data } = await supabase
    .from('community_comments')
    .insert({
      post_id: postId,
      user_id: userId,
      content,
      parent_id: parentId || null,
    })
    .select('*')
    .single();

  // 2. 작성자 정보 조회
  const author = await getProfileInfo(userId);

  // 3. 게시물 comment_count 증가
  const { data: post } = await supabase
    .from('community_posts')
    .select('comment_count')
    .eq('id', postId)
    .single();

  await supabase
    .from('community_posts')
    .update({ comment_count: (post?.comment_count || 0) + 1 })
    .eq('id', postId);

  return { ...data, author };
}
```

---

### 14.5 좋아요 토글 로직

```typescript
export async function togglePostLike(postId: string, userId: string): Promise<{ liked: boolean; likeCount: number } | null> {
  // 1. 현재 좋아요 상태 확인
  const { data: existingLike } = await supabase
    .from('community_post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingLike) {
    // 2a. 좋아요 취소
    await supabase
      .from('community_post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);

    // 3a. like_count 감소
    const { data: currentPost } = await supabase
      .from('community_posts')
      .select('like_count')
      .eq('id', postId)
      .single();

    await supabase
      .from('community_posts')
      .update({ like_count: Math.max(0, (currentPost?.like_count || 1) - 1) })
      .eq('id', postId);

    return { liked: false, likeCount: Math.max(0, (currentPost?.like_count || 1) - 1) };
  } else {
    // 2b. 좋아요 추가
    await supabase
      .from('community_post_likes')
      .insert({ post_id: postId, user_id: userId });

    // 3b. like_count 증가
    const { data: currentPost } = await supabase
      .from('community_posts')
      .select('like_count')
      .eq('id', postId)
      .single();

    await supabase
      .from('community_posts')
      .update({ like_count: (currentPost?.like_count || 0) + 1 })
      .eq('id', postId);

    return { liked: true, likeCount: (currentPost?.like_count || 0) + 1 };
  }
}
```

---

### 14.6 이미지 업로드 로직

```typescript
export async function uploadPostImage(userId: string, file: File): Promise<string | null> {
  // 1. 파일명 생성
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}.${fileExt}`;

  // 2. Storage에 업로드
  const { data, error } = await supabase.storage
    .from('community-images')
    .upload(fileName, file);

  if (error) return null;

  // 3. 공개 URL 반환
  const { data: { publicUrl } } = supabase.storage
    .from('community-images')
    .getPublicUrl(data.path);

  return publicUrl;
}
```

---

### 14.7 통계 조회 로직

```typescript
export async function getCommunityStats(): Promise<CommunityStats> {
  // 총 게시물 수
  const { count: totalPosts } = await supabase
    .from('community_posts')
    .select('*', { count: 'exact', head: true });

  // 총 댓글 수
  const { count: totalComments } = await supabase
    .from('community_comments')
    .select('*', { count: 'exact', head: true });

  // 총 좋아요 수
  const { count: totalLikes } = await supabase
    .from('community_post_likes')
    .select('*', { count: 'exact', head: true });

  // 활동 사용자 수 (게시물 작성자 기준)
  const { data: users } = await supabase
    .from('community_posts')
    .select('user_id');
  const uniqueUsers = new Set(users?.map(u => u.user_id));

  // 오늘 작성된 게시물 수
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count: todayPosts } = await supabase
    .from('community_posts')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today.toISOString());

  return { totalPosts, totalComments, totalLikes, totalUsers: uniqueUsers.size, todayPosts };
}
```

---

### 14.8 헬퍼 함수 (내부)

| 함수 | 설명 |
|------|------|
| `getProfilesMap(userIds)` | 여러 사용자 프로필 배치 조회 (N+1 방지) |
| `getProfileInfo(userId)` | 단일 사용자 프로필 조회 |
| `getModelsMap(modelIds)` | 여러 AI 모델 정보 배치 조회 |
| `getModelInfo(modelId)` | 단일 AI 모델 정보 조회 |

모든 헬퍼 함수는 **RLS 오류 안전**하게 설계되어 있습니다 (try-catch로 보호).

---

## 15. 미사용 API 함수 (향후 기능용)

아래 함수들은 `community.ts`에 구현되어 있으나, 현재 UI에서 사용하지 않습니다.
향후 커뮤니티 기능 확장 시 활용될 예정입니다.

### 15.1 markPostSolved

**역할:** 게시물의 해결 상태를 표시합니다.

**위치:** `packages/shared/src/services/supabaseService/community.ts:1032`

```typescript
export async function markPostSolved(
  postId: string,
  userId: string,
  isSolved: boolean
): Promise<boolean>
```

**파라미터:**
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| postId | string | 게시물 ID |
| userId | string | 작성자 ID (권한 검증용) |
| isSolved | boolean | 해결됨 여부 |

**동작:**
1. 작성자 권한 확인 (본인 게시물만 변경 가능)
2. `community_posts.is_solved` 필드 업데이트
3. 성공 여부 반환

**사용 시나리오:**
- 질문/트러블슈팅 게시물에서 문제가 해결되었을 때
- "해결됨" 배지 표시 및 미해결 필터에서 제외

---

### 15.2 acceptAnswer

**역할:** 댓글을 정답으로 채택합니다.

**위치:** `packages/shared/src/services/supabaseService/community.ts:1058`

```typescript
export async function acceptAnswer(
  postId: string,
  commentId: string,
  userId: string
): Promise<boolean>
```

**파라미터:**
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| postId | string | 게시물 ID |
| commentId | string | 채택할 댓글 ID |
| userId | string | 게시물 작성자 ID (권한 검증용) |

**동작:**
1. 게시물 작성자 권한 확인
2. 기존 채택된 답변 취소 (있는 경우)
3. 새 댓글을 정답으로 채택 (`community_comments.is_accepted = true`)
4. 게시물에 채택된 답변 ID 저장 (`community_posts.accepted_answer_id`)
5. 게시물을 해결됨 상태로 변경 (`community_posts.is_solved = true`)

**사용 시나리오:**
- 질문 게시물에서 가장 도움이 된 댓글 선택
- 채택된 답변은 상단에 하이라이트 표시

---

### 15.3 unacceptAnswer

**역할:** 정답 채택을 취소합니다.

**위치:** `packages/shared/src/services/supabaseService/community.ts:1111`

```typescript
export async function unacceptAnswer(
  postId: string,
  userId: string
): Promise<boolean>
```

**파라미터:**
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| postId | string | 게시물 ID |
| userId | string | 게시물 작성자 ID (권한 검증용) |

**동작:**
1. 게시물 작성자 권한 확인
2. 현재 채택된 댓글의 `is_accepted` 해제
3. 게시물의 `accepted_answer_id` 초기화
4. (선택) 게시물의 `is_solved` 상태 유지 또는 해제

**사용 시나리오:**
- 더 나은 답변이 달렸을 때 기존 채택 취소
- 실수로 잘못된 답변을 채택했을 때 취소

---

### 15.4 togglePostHelpful

**역할:** 게시물에 "도움이 됨" 투표를 토글합니다.

**위치:** `packages/shared/src/services/supabaseService/community.ts:1149`

```typescript
export async function togglePostHelpful(
  postId: string,
  userId: string
): Promise<{ voted: boolean; helpfulCount: number } | null>
```

**파라미터:**
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| postId | string | 게시물 ID |
| userId | string | 투표하는 사용자 ID |

**반환값:**
```typescript
{
  voted: boolean;      // 투표 상태 (true: 투표함, false: 취소함)
  helpfulCount: number; // 현재 총 유용함 투표 수
}
```

**동작:**
1. `community_post_helpful` 테이블에서 기존 투표 확인
2. 투표가 있으면 삭제 (취소), 없으면 추가
3. `community_posts.helpful_count` 업데이트
4. 새로운 상태 반환

**사용 시나리오:**
- "좋아요"와 별개로 "도움이 됐어요" 피드백
- 팁/가이드 게시물의 유용성 평가
- helpful 정렬 기준 제공

---

### 15.5 toggleCommentHelpful

**역할:** 댓글에 "도움이 됨" 투표를 토글합니다.

**위치:** `packages/shared/src/services/supabaseService/community.ts:1206`

```typescript
export async function toggleCommentHelpful(
  commentId: string,
  userId: string
): Promise<{ voted: boolean; helpfulCount: number } | null>
```

**파라미터:**
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| commentId | string | 댓글 ID |
| userId | string | 투표하는 사용자 ID |

**반환값:**
```typescript
{
  voted: boolean;      // 투표 상태
  helpfulCount: number; // 현재 총 유용함 투표 수
}
```

**동작:**
1. `community_comment_helpful` 테이블에서 기존 투표 확인
2. 투표가 있으면 삭제, 없으면 추가
3. `community_comments.helpful_count` 업데이트
4. 새로운 상태 반환

**사용 시나리오:**
- 질문에 대한 답변의 유용성 평가
- 정답 채택 전에 다른 사용자들의 피드백 수집
- 유용한 댓글 상단 정렬 기준

---

### 15.6 관련 데이터베이스 테이블

이 미사용 함수들이 사용하는 테이블:

| 테이블 | 함수 | 설명 |
|--------|------|------|
| `community_posts.is_solved` | markPostSolved | 해결 상태 |
| `community_posts.accepted_answer_id` | acceptAnswer, unacceptAnswer | 채택된 답변 ID |
| `community_comments.is_accepted` | acceptAnswer, unacceptAnswer | 댓글 채택 여부 |
| `community_post_helpful` | togglePostHelpful | 게시물 유용함 투표 |
| `community_comment_helpful` | toggleCommentHelpful | 댓글 유용함 투표 |
| `community_posts.helpful_count` | togglePostHelpful | 유용함 투표 수 (캐시) |
| `community_comments.helpful_count` | toggleCommentHelpful | 유용함 투표 수 (캐시) |

---

### 15.7 UI 구현 가이드

향후 이 기능들을 UI에 추가할 때 참고:

#### 해결됨 표시 (markPostSolved)
```tsx
// CommunityPost.tsx에 추가
{isAuthor && (post.category === 'question' || post.category === 'troubleshooting') && (
  <Button
    variant="outline"
    onClick={() => markPostSolved(post.id, user.id, !post.is_solved)}
  >
    {post.is_solved ? '미해결로 변경' : '해결됨으로 표시'}
  </Button>
)}
```

#### 정답 채택 (acceptAnswer)
```tsx
// 댓글 옆에 채택 버튼 추가
{isPostAuthor && !comment.is_accepted && (
  <Button
    size="sm"
    onClick={() => acceptAnswer(post.id, comment.id, user.id)}
  >
    정답으로 채택
  </Button>
)}
```

#### 도움이 됨 투표 (togglePostHelpful)
```tsx
// 좋아요 버튼 옆에 추가
<Button
  variant="ghost"
  className={post.is_helpful_voted ? "text-green-500" : ""}
  onClick={() => togglePostHelpful(post.id, user.id)}
>
  <ThumbsUp className="w-4 h-4 mr-1" />
  도움됨 {post.helpful_count}
</Button>
```

---

## 16. 확장 가능성

### 향후 기능 아이디어

1. **실시간 알림** - 댓글/좋아요 알림 (WebSocket/MQTT)
2. **신고/차단** - 부적절한 게시물/댓글 신고
3. **모더레이션** - 관리자 삭제/숨기기
4. **검색 고도화** - Elasticsearch 통합
5. **추천 시스템** - 사용자 선호도 기반
6. **소셜 기능** - 팔로우, DM, 뱃지
7. **커뮤니티 이벤트** - 주간 챌린지, 공모전
8. **정답 채택 시스템 활성화** - 15.2, 15.3 함수 UI 연결
9. **도움이 됨 투표 시스템** - 15.4, 15.5 함수 UI 연결
