# AI Chat 3D 모델링 기능 이식 계획

## 개요

AI Chat 페이지에 3D 모델링 도구를 추가하여 텍스트 또는 이미지를 기반으로 3D 모델을 생성하는 기능을 구현합니다.

- **Text-to-3D**: 텍스트 프롬프트만 입력하여 3D 모델 생성
- **Image-to-3D**: 이미지를 업로드하여 3D 모델 생성
- **하이브리드**: 이미지 + 텍스트 설명으로 더 정확한 3D 모델 생성

---

## 1. 기존 AI.tsx 구현 분석

### 1.1 사용하는 서비스/훅

| 서비스 | 경로 | 역할 |
|--------|------|------|
| `aiService.ts` | `@shared/services/aiService.ts` | API 호출 (postTextTo3D, postImageTo3D, pollTaskUntilComplete) |
| `aiStorage.ts` | `@shared/services/supabaseService/aiStorage.ts` | Supabase Storage 업로드/다운로드 |
| `aiModel.ts` | `@shared/services/supabaseService/aiModel.ts` | DB CRUD (createAIModel, updateAIModel) |
| `useAIImageUpload.ts` | `@shared/hooks/useAIImageUpload.ts` | 이미지 업로드 관리 훅 |

### 1.2 주요 함수

```typescript
// aiService.ts
postTextTo3D(payload, asyncMode)     // Text-to-3D API
postImageTo3D(formData, asyncMode)   // Image-to-3D API
pollTaskUntilComplete(taskId, onProgress)  // 진행률 폴링
extractGLBUrl(result)                // GLB URL 추출
extractSTLUrl(result)                // STL URL 추출
extractThumbnailUrl(result)          // 썸네일 URL 추출
buildPrintablePrompt(prompt)         // 3D 프린팅 최적화 프롬프트
buildCommon(symmetry, style, polycount) // 공통 설정

// aiStorage.ts
downloadAndUploadModel(glbUrl)       // GLB → Supabase
downloadAndUploadSTL(stlUrl)         // STL → Supabase
downloadAndUploadThumbnail(thumbUrl) // Thumbnail → Supabase

// aiModel.ts
createAIModel(data)                  // DB 레코드 생성
updateAIModel(id, data)              // DB 레코드 업데이트
```

### 1.3 데이터 흐름

```
[사용자 입력] → [검증] → [DB 생성 (processing)]
     ↓
[API 호출 (async)] → [task_id 반환]
     ↓
[폴링 (5초 간격)] → [진행률 UI 업데이트]
     ↓
[완료] → [URL 추출] → [Supabase 업로드]
     ↓
[DB 업데이트 (completed)] → [UI 렌더링 (ModelViewer)]
```

---

## 2. AI Chat 이식 전략

### 2.1 입력 방식 결정 로직

```
┌─────────────────────────────────────────────────────────┐
│                  3D 모델링 도구 선택                      │
│                  (selectedTool === 'modeling')           │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    [이미지만 있음]   [텍스트만 있음]   [이미지+텍스트]
           │               │               │
           ▼               ▼               ▼
    Image-to-3D      Text-to-3D      Image-to-3D
                                    + 텍스트 힌트
```

### 2.2 UI 흐름

1. **도구 선택**: "3D 모델링" 버튼 클릭
2. **입력**:
   - 이미지 업로드 (선택적)
   - 텍스트 프롬프트 입력 (선택적, 이미지 없으면 필수)
3. **생성 시작**: 전송 버튼 클릭
4. **진행 표시**: 채팅 메시지에 진행률 표시
5. **결과 표시**: 생성된 3D 모델 미리보기 + 다운로드 버튼

---

## 3. 구현 상세

### 3.1 상태 추가 (AIChat.tsx)

```typescript
// 3D 모델링 관련 상태
const [is3DGenerating, setIs3DGenerating] = useState(false);
const [generation3DProgress, setGeneration3DProgress] = useState(0);
const [generation3DStatus, setGeneration3DStatus] = useState('');

// 3D 설정 (기본값 사용, 필요시 설정 UI 추가)
const default3DSettings = {
  symmetryMode: 'auto' as const,
  artStyle: 'realistic' as const,
  targetPolycount: 30000,
};
```

### 3.2 Message 인터페이스 확장

```typescript
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  images?: string[];
  files?: FileInfo[];
  reportId?: string;
  isGcodeError?: boolean;

  // 3D 모델링 관련 추가
  is3DModel?: boolean;           // 3D 모델 생성 메시지인지
  modelId?: string;              // ai_generated_models.id
  glbUrl?: string;               // GLB 다운로드 URL
  stlUrl?: string;               // STL 다운로드 URL
  thumbnailUrl?: string;         // 썸네일 URL
  modelName?: string;            // 모델 이름
  generation3DProgress?: number; // 진행률 (생성 중)
  generation3DStatus?: string;   // 상태 메시지
  generation3DError?: string;    // 에러 메시지
}
```

### 3.3 핵심 함수: handle3DModelGeneration

```typescript
const handle3DModelGeneration = async (
  prompt: string,
  imageFile?: File | null,
  imageUrl?: string
) => {
  if (!user?.id) {
    toast({ title: t('common.loginRequired'), variant: 'destructive' });
    return;
  }

  // 1. 사용자 메시지 추가
  const userMessage: Message = {
    id: `user-${Date.now()}`,
    role: 'user',
    content: prompt || t('aiChat.modeling.imageToModel', '이미지로 3D 모델 생성'),
    timestamp: new Date(),
    images: imageUrl ? [imageUrl] : undefined,
  };
  setMessages(prev => [...prev, userMessage]);

  // 2. AI 응답 (진행 중) 메시지 추가
  const assistantMessageId = `assistant-3d-${Date.now()}`;
  const assistantMessage: Message = {
    id: assistantMessageId,
    role: 'assistant',
    content: t('aiChat.modeling.generating', '3D 모델을 생성하고 있습니다...'),
    timestamp: new Date(),
    is3DModel: true,
    generation3DProgress: 0,
    generation3DStatus: t('aiChat.modeling.initializing', '초기화 중...'),
  };
  setMessages(prev => [...prev, assistantMessage]);

  setIsLoading(true);
  setIs3DGenerating(true);

  try {
    // 3. 구독 플랜 확인
    // canGenerateAiModel(userPlan, monthlyAiUsage) 확인

    // 4. 생성 타입 결정
    const generationType = imageFile || imageUrl ? 'image_to_3d' : 'text_to_3d';

    // 5. DB에 모델 레코드 생성
    const { data: modelRecord, error: createError } = await createAIModel({
      user_id: user.id,
      generation_type: generationType,
      prompt: prompt || undefined,
      source_image_url: imageUrl || undefined,
      art_style: default3DSettings.artStyle,
      target_polycount: default3DSettings.targetPolycount,
      symmetry_mode: default3DSettings.symmetryMode,
      status: 'processing',
      model_name: 'Generating...',
      file_format: 'glb',
      storage_path: '',
    });

    if (createError || !modelRecord) {
      throw new Error('Failed to create model record');
    }

    // 6. API 호출
    let result: AIModelResponse;

    if (generationType === 'text_to_3d') {
      // Text-to-3D
      const optimizedPrompt = buildPrintablePrompt(prompt);
      const payload = {
        task: 'text_to_3d' as const,
        prompt: optimizedPrompt,
        ...buildCommon(
          default3DSettings.symmetryMode,
          default3DSettings.artStyle,
          default3DSettings.targetPolycount,
          user.id
        ),
      };
      const initResult = await postTextTo3D(payload, true);
      const taskId = initResult.data?.task_id;

      if (!taskId) throw new Error('No task_id returned');

      result = await pollTaskUntilComplete(taskId, (progress, status) => {
        // 진행률 업데이트
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, generation3DProgress: progress, generation3DStatus: status }
            : msg
        ));
      });

    } else {
      // Image-to-3D
      const form = new FormData();
      form.append('task', 'image_to_3d');

      if (imageFile) {
        form.append('image_file', imageFile);
      } else if (imageUrl) {
        // URL에서 파일 가져오기
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const file = new File([blob], 'image.png', { type: blob.type });
        form.append('image_file', file);
      }

      form.append('json', JSON.stringify({
        ...buildCommon(
          default3DSettings.symmetryMode,
          default3DSettings.artStyle,
          default3DSettings.targetPolycount,
          user.id
        ),
        prompt: prompt || BASE_3D_PRINT_PROMPT,
      }));

      const initResult = await postImageTo3D(form, true);
      const taskId = initResult.data?.task_id;

      if (!taskId) throw new Error('No task_id returned');

      result = await pollTaskUntilComplete(taskId, (progress, status) => {
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, generation3DProgress: progress, generation3DStatus: status }
            : msg
        ));
      });
    }

    // 7. URL 추출
    const glbUrl = extractGLBUrl(result);
    const stlUrl = extractSTLUrl(result);
    const thumbnailUrl = extractThumbnailUrl(result);
    const metadata = extractMetadata(result);

    if (!glbUrl) {
      throw new Error('No GLB URL in result');
    }

    // 8. Supabase Storage에 업로드
    const { publicUrl: supabaseGlbUrl } = await downloadAndUploadModel(glbUrl, user.id);
    const { publicUrl: supabaseStlUrl } = stlUrl
      ? await downloadAndUploadSTL(stlUrl, user.id)
      : { publicUrl: null };
    const { publicUrl: supabaseThumbnailUrl } = thumbnailUrl
      ? await downloadAndUploadThumbnail(thumbnailUrl, user.id)
      : { publicUrl: null };

    // 9. 모델 이름 생성 (Claude AI)
    const modelName = await generateShortFilename({
      prompt: prompt || undefined,
      imageUrl: imageUrl || undefined,
    });

    // 10. DB 업데이트
    await updateAIModel(modelRecord.id, {
      status: 'completed',
      model_name: modelName,
      storage_path: supabaseGlbUrl,
      download_url: supabaseGlbUrl,
      stl_storage_path: supabaseStlUrl || undefined,
      stl_download_url: supabaseStlUrl || undefined,
      thumbnail_url: supabaseThumbnailUrl || undefined,
      generation_metadata: metadata,
    });

    // 11. 메시지 업데이트 (완료)
    setMessages(prev => prev.map(msg =>
      msg.id === assistantMessageId
        ? {
            ...msg,
            content: t('aiChat.modeling.completed', '3D 모델이 생성되었습니다!'),
            is3DModel: true,
            modelId: modelRecord.id,
            glbUrl: supabaseGlbUrl,
            stlUrl: supabaseStlUrl || undefined,
            thumbnailUrl: supabaseThumbnailUrl || undefined,
            modelName: modelName,
            generation3DProgress: 100,
            generation3DStatus: t('aiChat.modeling.done', '완료'),
          }
        : msg
    ));

    toast({
      title: t('aiChat.modeling.success', '3D 모델 생성 완료'),
      description: modelName,
    });

  } catch (error) {
    console.error('[AIChat] 3D generation error:', error);

    // 에러 메시지 업데이트
    setMessages(prev => prev.map(msg =>
      msg.id === assistantMessageId
        ? {
            ...msg,
            content: t('aiChat.modeling.failed', '3D 모델 생성에 실패했습니다.'),
            generation3DError: String(error),
            generation3DProgress: 0,
          }
        : msg
    ));

    toast({
      title: t('aiChat.modeling.error', '3D 모델 생성 실패'),
      description: String(error),
      variant: 'destructive',
    });
  } finally {
    setIsLoading(false);
    setIs3DGenerating(false);
  }
};
```

### 3.4 메시지 전송 핸들러 수정 (handleSubmit)

```typescript
const handleSubmit = async () => {
  // ...기존 검증...

  if (chatMode === 'modeling') {
    // 3D 모델링 모드
    const imageFile = uploadedImages.length > 0
      ? await urlToFile(uploadedImages[0])
      : null;

    await handle3DModelGeneration(
      input,
      imageFile,
      uploadedImages[0] || undefined
    );

    setInput('');
    setUploadedImages([]);
    return;
  }

  // ...기존 로직 (general, troubleshoot, gcode)...
};
```

### 3.5 3D 모델 메시지 렌더링 컴포넌트

```tsx
// 새 컴포넌트: Model3DMessageCard.tsx
interface Model3DMessageCardProps {
  message: Message;
  onDownloadGLB?: () => void;
  onDownloadSTL?: () => void;
  onOpenViewer?: () => void;
}

function Model3DMessageCard({ message, onDownloadGLB, onDownloadSTL, onOpenViewer }: Model3DMessageCardProps) {
  const { t } = useTranslation();

  // 생성 중
  if (message.generation3DProgress !== undefined && message.generation3DProgress < 100 && !message.generation3DError) {
    return (
      <div className="mt-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm font-medium">{message.generation3DStatus}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${message.generation3DProgress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {message.generation3DProgress}%
        </p>
      </div>
    );
  }

  // 에러
  if (message.generation3DError) {
    return (
      <div className="mt-4 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-medium">{t('aiChat.modeling.error')}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {message.generation3DError}
        </p>
      </div>
    );
  }

  // 완료
  if (message.glbUrl || message.stlUrl) {
    return (
      <div className="mt-4 p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20">
        {/* 썸네일 */}
        {message.thumbnailUrl && (
          <div className="mb-3">
            <img
              src={message.thumbnailUrl}
              alt={message.modelName || '3D Model'}
              className="w-full h-48 object-contain rounded-lg bg-black/5"
            />
          </div>
        )}

        {/* 모델 이름 */}
        <h4 className="font-semibold text-foreground mb-3">
          {message.modelName || '3D Model'}
        </h4>

        {/* 액션 버튼들 */}
        <div className="flex flex-wrap gap-2">
          {message.glbUrl && (
            <Button size="sm" variant="outline" className="gap-2" onClick={onDownloadGLB}>
              <Download className="w-4 h-4" />
              GLB
            </Button>
          )}
          {message.stlUrl && (
            <Button size="sm" variant="outline" className="gap-2" onClick={onDownloadSTL}>
              <Download className="w-4 h-4" />
              STL
            </Button>
          )}
          <Button size="sm" variant="default" className="gap-2" onClick={onOpenViewer}>
            <Box className="w-4 h-4" />
            {t('aiChat.modeling.view3D', '3D 보기')}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
```

### 3.6 메시지 렌더링에 통합

```tsx
// AIChat.tsx 메시지 렌더링 부분
{message.is3DModel && (
  <Model3DMessageCard
    message={message}
    onDownloadGLB={() => window.open(message.glbUrl, '_blank')}
    onDownloadSTL={() => window.open(message.stlUrl, '_blank')}
    onOpenViewer={() => {
      // 3D 뷰어 모달 또는 새 탭 열기
      setModelViewerUrl(message.glbUrl || message.stlUrl || null);
      setShowModelViewer(true);
    }}
  />
)}
```

---

## 4. 파일 변경 목록

### 4.1 수정할 파일

| 파일 | 변경 내용 |
|------|----------|
| `AIChat.tsx` | 상태 추가, handle3DModelGeneration 함수, 메시지 렌더링 수정 |
| `ko.ts` / `en.ts` | 3D 모델링 관련 번역 키 추가 |

### 4.2 새로 생성할 파일

| 파일 | 내용 |
|------|------|
| `Model3DMessageCard.tsx` | 3D 모델 메시지 카드 컴포넌트 |
| `Model3DViewerModal.tsx` | 3D 뷰어 모달 (기존 ModelViewer 재사용) |

### 4.3 재사용할 기존 파일

| 파일 | 용도 |
|------|------|
| `aiService.ts` | API 호출 함수들 |
| `aiStorage.ts` | Supabase Storage 업로드 |
| `aiModel.ts` | DB CRUD |
| `ModelViewer.tsx` | 3D 모델 뷰어 (Three.js) |

---

## 5. i18n 키 추가

### ko.ts
```typescript
aiChat: {
  // ...기존 키...
  modeling: {
    generating: '3D 모델을 생성하고 있습니다...',
    initializing: '초기화 중...',
    processing: '모델 생성 중...',
    completed: '3D 모델이 생성되었습니다!',
    done: '완료',
    failed: '3D 모델 생성에 실패했습니다.',
    success: '3D 모델 생성 완료',
    error: '3D 모델 생성 실패',
    view3D: '3D 보기',
    downloadGLB: 'GLB 다운로드',
    downloadSTL: 'STL 다운로드',
    imageToModel: '이미지로 3D 모델 생성',
    textToModel: '텍스트로 3D 모델 생성',
    enterPrompt: '만들고 싶은 3D 모델을 설명해주세요',
    uploadImage: '이미지를 업로드하면 더 정확한 모델을 생성할 수 있습니다',
  },
}
```

### en.ts
```typescript
aiChat: {
  // ...existing keys...
  modeling: {
    generating: 'Generating 3D model...',
    initializing: 'Initializing...',
    processing: 'Processing model...',
    completed: '3D model has been generated!',
    done: 'Done',
    failed: 'Failed to generate 3D model.',
    success: '3D Model Generated',
    error: '3D Model Generation Failed',
    view3D: 'View 3D',
    downloadGLB: 'Download GLB',
    downloadSTL: 'Download STL',
    imageToModel: 'Generate 3D model from image',
    textToModel: 'Generate 3D model from text',
    enterPrompt: 'Describe the 3D model you want to create',
    uploadImage: 'Upload an image for more accurate model generation',
  },
}
```

---

## 6. 구현 순서

### Phase 1: 기본 구조 (1일)
1. [ ] Message 인터페이스 확장
2. [ ] 상태 변수 추가
3. [ ] handle3DModelGeneration 함수 구현
4. [ ] handleSubmit에 modeling 모드 분기 추가

### Phase 2: UI 컴포넌트 (0.5일)
1. [ ] Model3DMessageCard 컴포넌트 생성
2. [ ] 메시지 렌더링에 통합
3. [ ] 진행률 표시 UI

### Phase 3: 3D 뷰어 (0.5일)
1. [ ] Model3DViewerModal 컴포넌트 생성
2. [ ] ModelViewer 재사용
3. [ ] 모달 열기/닫기 로직

### Phase 4: 마무리 (0.5일)
1. [ ] i18n 번역 추가
2. [ ] 에러 처리 보완
3. [ ] 테스트 및 디버깅

---

## 7. 고려사항

### 7.1 구독 플랜 제한
- Free: 5개/월
- Pro: 50개/월
- Premium: 무제한
- `canGenerateAiModel()` 함수로 확인

### 7.2 타임아웃
- 초기 API 요청: 10분
- 폴링 간격: 5초
- 최대 폴링 시간: 30분

### 7.3 메모리 관리
- Blob URL 사용 시 `URL.revokeObjectURL()` 호출
- 컴포넌트 언마운트 시 정리

### 7.4 에러 복구
- 네트워크 오류 시 재시도 버튼 제공
- DB 레코드는 생성되었지만 API 실패 시 status: 'failed' 업데이트

---

## 8. 테스트 시나리오

1. **Text-to-3D**
   - 텍스트만 입력하여 3D 모델 생성
   - 진행률 표시 확인
   - GLB/STL 다운로드 확인

2. **Image-to-3D**
   - 이미지만 업로드하여 3D 모델 생성
   - 다양한 이미지 형식 테스트 (PNG, JPG, WebP)

3. **Hybrid (Image + Text)**
   - 이미지 + 텍스트 설명으로 생성
   - 텍스트가 모델에 반영되는지 확인

4. **에러 케이스**
   - 네트워크 오류
   - 서버 타임아웃
   - 잘못된 이미지 형식

5. **구독 제한**
   - Free 플랜에서 5개 초과 시도
   - 제한 메시지 표시 확인
