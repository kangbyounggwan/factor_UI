# STL 파일 업로드 및 썸네일 생성 가이드

이 가이드는 STL 파일을 업로드하고 자동으로 썸네일을 생성하여 Supabase에 저장하는 기능을 설명합니다.

## 📋 개요

- **STL 파일 업로드**: 3D 프린팅용 STL 파일을 업로드
- **자동 썸네일 생성**: Three.js를 사용하여 브라우저에서 3D 렌더링 후 썸네일 이미지 생성
- **Supabase 저장**: STL 파일과 썸네일을 Supabase Storage에 저장하고 메타데이터를 DB에 저장
- **3D 미리보기**: 업로드된 STL 파일을 3D 뷰어로 확인

## 🏗️ 구조

### 1. 데이터베이스 스키마

**테이블: `stl_files`**

```sql
CREATE TABLE public.stl_files (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_url TEXT,
  thumbnail_path TEXT,
  thumbnail_url TEXT,
  triangle_count INTEGER,
  bounding_box JSONB,
  status TEXT DEFAULT 'uploaded',
  upload_date TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. 스토리지 버킷

- **`stl-files`**: STL 파일 저장 (비공개, 최대 100MB)
- **`stl-thumbnails`**: 썸네일 이미지 저장 (공개, 최대 5MB)

### 3. 핵심 파일

```
packages/
├── shared/
│   └── src/
│       └── utils/
│           └── stlThumbnail.ts          # STL 썸네일 생성 유틸리티
├── web/
│   ├── src/
│   │   ├── components/
│   │   │   ├── STLUpload.tsx            # STL 업로드 컴포넌트
│   │   │   └── ModelViewer.tsx          # 3D 모델 뷰어 (STL 지원)
│   │   └── pages/
│   │       └── STLManager.tsx           # 사용 예제 페이지
│   └── supabase/
│       └── migrations/
│           └── 20251015130000_stl_files.sql  # DB 마이그레이션
└── mobile/
    └── (동일한 구조)
```

## 🚀 사용 방법

### 1. 마이그레이션 실행

```bash
cd packages/web
npx supabase migration up
```

또는 Supabase 대시보드에서 SQL 에디터로 직접 실행:
- `packages/web/supabase/migrations/20251015130000_stl_files.sql`

### 2. 컴포넌트 사용

#### 기본 사용

```tsx
import { STLUpload } from "@/components/STLUpload";
import ModelViewer from "@/components/ModelViewer";
import { useState } from "react";

function MyPage() {
  const [selectedFile, setSelectedFile] = useState(null);

  return (
    <div>
      {/* STL 업로드 */}
      <STLUpload onFileSelect={setSelectedFile} />

      {/* 3D 뷰어 */}
      <ModelViewer
        stlUrl={selectedFile?.storage_url}
        height={600}
      />
    </div>
  );
}
```

#### 전체 예제

[STLManager.tsx](packages/web/src/pages/STLManager.tsx) 파일을 참고하세요.

### 3. 유틸리티 함수 직접 사용

```tsx
import { generateSTLThumbnail, getSTLInfo } from "@shared/utils/stlThumbnail";

// 썸네일 생성
const file = document.querySelector('input[type="file"]').files[0];
const thumbnailBlob = await generateSTLThumbnail(file, 400, 400);

// STL 정보 추출
const info = await getSTLInfo(file);
console.log(info.triangleCount);
console.log(info.boundingBox); // { x, y, z } in mm
```

## 🔧 기능 상세

### STL 썸네일 생성 (stlThumbnail.ts)

**`generateSTLThumbnail(file, width, height)`**

- STL 파일을 파싱하고 Three.js로 렌더링
- 오프스크린 캔버스에서 PNG 이미지 생성
- 모델을 자동으로 중앙 정렬 및 스케일 조정
- 조명과 머티리얼 자동 설정

**`getSTLInfo(file)`**

- STL 파일의 삼각형 개수 계산
- 바운딩 박스 크기 추출 (mm 단위)

### STLUpload 컴포넌트

**주요 기능:**

1. ✅ 파일 선택 및 검증 (.stl만 허용, 최대 100MB)
2. ✅ 썸네일 자동 생성 (400x400px)
3. ✅ Supabase Storage에 업로드
   - STL 파일 → `stl-files` 버킷
   - 썸네일 → `stl-thumbnails` 버킷
4. ✅ 메타데이터 DB 저장
5. ✅ 업로드 진행률 표시
6. ✅ 파일 목록 조회/삭제/다운로드

**Props:**

```tsx
interface STLUploadProps {
  onFileSelect?: (file: STLFile) => void;  // 파일 선택 시 콜백
}
```

### ModelViewer 컴포넌트 (업데이트됨)

**새로운 Props:**

```tsx
interface ModelViewerProps {
  stlUrl?: string;              // STL 파일 URL (추가됨)
  showDemo?: boolean;           // 데모 오브젝트 표시
  height?: number | string;     // 뷰어 높이
  placeholderMessage?: string;  // 안내 문구
}
```

**사용 예제:**

```tsx
<ModelViewer
  stlUrl="https://your-supabase-url/storage/v1/object/public/stl-files/..."
  height={600}
/>
```

## 🔐 보안 정책 (RLS)

### stl_files 테이블

- **SELECT**: 본인 파일 또는 공개 파일만 조회 가능
- **INSERT**: 본인 파일만 삽입 가능
- **UPDATE**: 본인 파일만 수정 가능
- **DELETE**: 본인 파일만 삭제 가능

### Storage

**stl-files 버킷:**
- 사용자별 폴더 구조: `{user_id}/{timestamp}_{filename}`
- 본인 폴더만 접근 가능

**stl-thumbnails 버킷:**
- 공개 읽기 가능 (썸네일은 누구나 볼 수 있음)
- 업로드는 본인 폴더만 가능

## 📊 업로드 프로세스

```
1. 파일 선택 (STL, max 100MB)
   ↓
2. 썸네일 생성 (Three.js 렌더링)
   ↓
3. STL 정보 추출 (삼각형 수, 바운딩 박스)
   ↓
4. STL 파일 업로드 → Supabase Storage (stl-files)
   ↓
5. 썸네일 업로드 → Supabase Storage (stl-thumbnails)
   ↓
6. 메타데이터 저장 → DB (stl_files 테이블)
   ↓
7. 완료 ✅
```

## 🎨 UI/UX

- **진행률 표시**: 각 단계별 진행률 표시 (10% → 100%)
- **썸네일 미리보기**: 업로드된 파일 목록에 썸네일 표시
- **파일 정보**: 크기, 삼각형 수, 바운딩 박스 크기 표시
- **3D 미리보기**: 선택한 파일을 3D 뷰어로 확인
- **반응형**: 모바일/태블릿/데스크톱 모두 지원

## 🐛 트러블슈팅

### 1. "Missing Supabase environment variables" 오류

`.env` 파일에 다음 환경 변수를 추가하세요:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. 썸네일 생성 실패

- Three.js와 three-stdlib이 설치되어 있는지 확인
- STL 파일이 올바른 형식인지 확인 (Binary 또는 ASCII STL)

### 3. 업로드 권한 오류

- Supabase RLS 정책이 올바르게 설정되어 있는지 확인
- 사용자가 로그인되어 있는지 확인

### 4. 3D 모델이 표시되지 않음

- `stl-files` 버킷의 공개 URL 설정 확인
- 브라우저 콘솔에서 CORS 오류 확인
- STL 파일이 정상적으로 업로드되었는지 확인

## 📦 의존성

```json
{
  "three": "^0.180.0",
  "three-stdlib": "^2.36.0",
  "@react-three/fiber": "^8.18.0",
  "@react-three/drei": "^9.122.0",
  "@supabase/supabase-js": "^2.50.3"
}
```

## 🔄 향후 개선 사항

- [ ] 여러 각도에서의 썸네일 생성
- [ ] 썸네일 크기 커스터마이징
- [ ] STL 파일 압축
- [ ] 슬라이싱 미리보기 (레이어별)
- [ ] 3D 프린터로 직접 전송
- [ ] 공개 갤러리 기능

## 📝 라이선스

이 프로젝트는 FACTOR HIBRID의 일부입니다.

---

**작성일**: 2025-10-15
**버전**: 1.0.0
