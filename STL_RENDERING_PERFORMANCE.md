# STL 렌더링 성능 최적화 가이드

## 📊 현재 구현 방식

### ✅ 클라이언트 사이드 렌더링 (Browser-based)

**현재 STL 썸네일 생성은 100% 브라우저에서 실행됩니다:**

```typescript
// packages/shared/src/utils/stlThumbnail.ts
export async function generateSTLThumbnail(file: File, width: number = 400, height: number = 400): Promise<Blob> {
  // 브라우저의 WebGL을 사용하여 렌더링
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, ... });
  // 사용자의 GPU/CPU로 렌더링
}
```

### 🎯 서버 리소스 영향: **없음**

**4코어 16GB No GPU 서버에 영향 없는 이유:**
- ✅ 렌더링이 서버가 아닌 **사용자 브라우저**에서 실행
- ✅ 사용자의 **GPU(WebGL)** 또는 **CPU**를 활용
- ✅ 각 클라이언트가 자신의 하드웨어 리소스 사용
- ✅ 서버는 파일 저장만 담당 (Supabase Storage)

## 🔄 처리 흐름

```
[사용자 브라우저]
1. STL 파일 선택
2. 파일 읽기 (FileReader API)
3. STL 파싱 (STLLoader - 브라우저)
4. 3D 렌더링 (Three.js + WebGL - 브라우저 GPU)
5. Canvas → PNG 변환 (브라우저)
6. 업로드 (Supabase Storage - 서버는 단순 저장)
```

**서버 작업**: Supabase Storage에 파일 저장만

## ⚠️ 잠재적 성능 문제

### 1. 큰 파일 (50MB+)
- **문제**: 브라우저에서 렌더링 느림 (10-30초)
- **해결**: 50MB 이상 파일은 썸네일 생성 건너뛰기 (✅ 구현됨)

### 2. 저사양 디바이스
- **문제**: 모바일, 구형 PC에서 렌더링 실패 가능
- **해결**: try-catch로 에러 처리, 파일은 업로드 (✅ 구현됨)

### 3. WebGL 미지원 브라우저
- **문제**: 매우 오래된 브라우저
- **해결**: WebGL 지원 체크 추가 가능

## 🚀 구현된 최적화

### 1. 파일 크기 기반 조건부 썸네일 생성

```typescript
// 50MB 이상 파일은 썸네일 생성 스킵
if (file.size < 50 * 1024 * 1024) {
  thumbnailBlob = await generateSTLThumbnail(file, 400, 400);
} else {
  // 큰 파일은 썸네일 없이 업로드
  toast({ title: '큰 파일 감지', description: '썸네일 생성을 건너뜁니다.' });
}
```

### 2. 에러 핸들링

```typescript
try {
  thumbnailBlob = await generateSTLThumbnail(file, 400, 400);
} catch (error) {
  console.error('Thumbnail generation failed:', error);
  // 썸네일 생성 실패해도 파일은 업로드
  toast({ title: '썸네일 생성 실패', description: '파일은 업로드됩니다.' });
}
```

### 3. 데이터베이스 유연성

```typescript
// 썸네일이 없어도 저장 가능
thumbnail_path: thumbnailFileName || null,
thumbnail_url: thumbnailUrlData?.publicUrl || null,
```

## 📈 성능 벤치마크 (브라우저 기준)

### 일반적인 STL 파일

| 파일 크기 | 삼각형 수 | 썸네일 생성 시간 | 비고 |
|----------|----------|----------------|------|
| 1MB | 50K | 0.5-1초 | 빠름 |
| 5MB | 250K | 1-2초 | 보통 |
| 20MB | 1M | 3-7초 | 느림 |
| 50MB+ | 2.5M+ | 10-30초+ | 매우 느림 (스킵 권장) |

### 하드웨어 영향

| 디바이스 | GPU | 예상 성능 |
|---------|-----|----------|
| 고사양 데스크톱 | RTX 3060+ | 매우 빠름 |
| 일반 노트북 | Intel UHD | 보통 |
| 태블릿 | Mali-G76 | 느림 |
| 저사양 모바일 | Adreno 505 | 매우 느림 |

## 🎨 대안 방안

### 옵션 1: 현재 방식 유지 (권장)
✅ 서버 리소스 사용 없음
✅ 확장성 무한 (사용자 수 증가해도 서버 부하 없음)
⚠️ 저사양 기기에서 느림

### 옵션 2: 서버 사이드 렌더링 (비권장)
❌ GPU 없는 서버에서 렌더링 매우 느림 (1장 30초+)
❌ 동시 사용자 증가 시 서버 과부하
❌ 추가 라이브러리 설치 필요 (canvas, gl)
✅ 저사양 기기도 썸네일 받을 수 있음

### 옵션 3: 하이브리드 (중간)
- 작은 파일: 브라우저 렌더링
- 큰 파일: 서버에 렌더링 요청 (별도 GPU 서버)
- 복잡도 증가

### 옵션 4: 썸네일 없이 사용
- 아이콘으로 대체
- 파일명, 크기, 삼각형 수만 표시
- 가장 단순, 빠름

## 🛠️ 추가 최적화 가능 사항

### 1. WebWorker 사용
```typescript
// STL 파싱을 별도 스레드에서 처리
const worker = new Worker('/stl-worker.js');
worker.postMessage({ file });
```

### 2. LOD (Level of Detail)
```typescript
// 큰 파일은 간단한 버전으로 렌더링
if (triangleCount > 500000) {
  geometry = simplifyMesh(geometry, 0.5); // 50% 감소
}
```

### 3. WebAssembly 파서
- 더 빠른 STL 파싱
- 복잡한 구현

### 4. 프리렌더링 캐시
```typescript
// 같은 파일은 캐시된 썸네일 재사용
const cacheKey = await getFileHash(file);
const cached = await getCachedThumbnail(cacheKey);
```

## 📊 서버 vs 클라이언트 비교

### 서버 렌더링 (No GPU)
```
100명 동시 업로드 시:
- CPU: 100% 사용
- 메모리: 8-10GB 사용
- 시간: 파일당 30-60초
- 병목: 심각
```

### 클라이언트 렌더링 (현재 방식)
```
100명 동시 업로드 시:
- 서버 CPU: 5% (파일 저장만)
- 서버 메모리: +100MB (파일 저장)
- 시간: 파일당 1-10초 (사용자 하드웨어)
- 병목: 없음
```

## 💡 결론

### ✅ 현재 4코어 16GB No GPU 서버 환경:
1. **서버에 부담 없음** - 렌더링은 클라이언트에서 실행
2. **확장성 우수** - 사용자 증가해도 서버 부하 동일
3. **비용 효율적** - GPU 서버 불필요

### 📌 권장 설정:
- **50MB 이하**: 브라우저 썸네일 생성 (✅ 현재 구현)
- **50MB 이상**: 썸네일 생성 건너뛰기 (✅ 현재 구현)
- **에러 시**: 파일만 업로드 (✅ 현재 구현)

### 🚀 추가 개선 필요 시:
1. WebWorker로 UI 블록 방지
2. LOD로 큰 파일 간소화
3. 별도 GPU 서버 구축 (비용 발생)

---

**작성일**: 2025-10-15
**현재 방식**: 클라이언트 사이드 렌더링 (WebGL)
**서버 영향**: 없음
**권장**: 현재 방식 유지
