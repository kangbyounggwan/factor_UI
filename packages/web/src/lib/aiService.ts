// 타입 정의
export type Quality = 'low' | 'medium' | 'high';
export type Model = 'flux-kontext' | 'gpt-4';
export type Style = 'realistic' | 'abstract';
export type ImageDepth = 'auto' | 'manual';

// AI 서버 설정
const AI_PYTHON_URL: string = String(
  import.meta.env.VITE_AI_PYTHON_URL || 'http://127.0.0.1:7000'
).replace(/\/+$/, '');
const AI_ENDPOINT: string = `${AI_PYTHON_URL}/v1/process/modelling`;
const REQUEST_TIMEOUT = 120000; // 2분
const POLL_INTERVAL = 5000; // 5초마다 폴링

// 공통 설정 빌더
export function buildCommon(model: string, quality: Quality, style?: string, userId?: string) {
  return {
    model,
    quality,
    style,
    output: { format: 'glb', unit: 'mm', scale: 1 },
    printer: { device_uuid: undefined, auto_slice: false, print: false },
    metadata: { session_id: undefined, source: 'web', user_id: userId },
  } as const;
}

// 타임아웃 지원 fetch
async function fetchWithTimeout(url: string, options: RequestInit, timeout: number = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.');
    }
    throw error;
  }
}

// 텍스트 → 3D (async_mode 지원)
export async function postTextTo3D(payload: unknown, asyncMode: boolean = false) {
  if (!AI_ENDPOINT) {
    throw new Error('AI 서버 주소가 설정되지 않았습니다. (VITE_AI_PYTHON_URL 환경변수 확인)');
  }

  console.log('[postTextTo3D] Request payload:', JSON.stringify(payload, null, 2));
  console.log('[postTextTo3D] Async mode:', asyncMode);

  const url = asyncMode ? `${AI_ENDPOINT}?async_mode=true` : AI_ENDPOINT;

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });

  console.log('[postTextTo3D] Response status:', res.status, res.statusText);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[postTextTo3D] Error response:', text);
    throw new Error(`AI 서버 요청 실패: ${res.status} ${text || res.statusText}`);
  }

  try {
    const result = await res.json();
    console.log('[postTextTo3D] Response data:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('[postTextTo3D] JSON parse error:', error);
    return {};
  }
}

// 이미지 → 3D (async_mode 지원)
export async function postImageTo3D(form: FormData, asyncMode: boolean = false) {
  if (!AI_ENDPOINT) {
    throw new Error('AI 서버 주소가 설정되지 않았습니다. (VITE_AI_PYTHON_URL 환경변수 확인)');
  }

  // FormData 내용 로깅
  console.log('[postImageTo3D] Request FormData entries:');
  for (const [key, value] of form.entries()) {
    if (value instanceof File) {
      console.log(`  ${key}: File(${value.name}, ${value.size} bytes, ${value.type})`);
    } else {
      console.log(`  ${key}:`, value);
    }
  }
  console.log('[postImageTo3D] Async mode:', asyncMode);

  const url = asyncMode ? `${AI_ENDPOINT}?async_mode=true` : AI_ENDPOINT;

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    body: form,
  });

  console.log('[postImageTo3D] Response status:', res.status, res.statusText);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[postImageTo3D] Error response:', text);
    throw new Error(`AI 서버 요청 실패: ${res.status} ${text || res.statusText}`);
  }

  try {
    const result = await res.json();
    console.log('[postImageTo3D] Response data:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('[postImageTo3D] JSON parse error:', error);
    return {};
  }
}

// 진행률 조회 (GET /v1/process/modelling/{task_id})
export async function getTaskProgress(taskId: string): Promise<TaskProgressResponse> {
  if (!AI_ENDPOINT) {
    throw new Error('AI 서버 주소가 설정되지 않았습니다.');
  }

  const url = `${AI_ENDPOINT}/${taskId}`;
  console.log('[getTaskProgress] Fetching progress for task:', taskId);

  const res = await fetchWithTimeout(url, {
    method: 'GET',
  }, 10000); // 10초 타임아웃

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[getTaskProgress] Error response:', text);
    throw new Error(`진행률 조회 실패: ${res.status} ${text || res.statusText}`);
  }

  const result = await res.json();
  console.log('[getTaskProgress] Progress data:', JSON.stringify(result, null, 2));
  return result;
}

// 진행률 폴링 (완료될 때까지 반복 조회)
export async function pollTaskUntilComplete(
  taskId: string,
  onProgress?: (progress: number, status: string) => void
): Promise<AIModelResponse> {
  console.log('[pollTaskUntilComplete] Starting polling for task:', taskId);

  while (true) {
    const progressData = await getTaskProgress(taskId);

    // 진행률 콜백 호출
    if (onProgress && progressData.data) {
      const progress = progressData.data.progress || 0;
      const status = progressData.data.status || 'PROCESSING';
      onProgress(progress, status);
    }

    // 완료 상태 체크
    if (progressData.data?.status === 'SUCCEEDED') {
      console.log('[pollTaskUntilComplete] Task completed successfully');
      return progressData as AIModelResponse;
    }

    // 실패 상태 체크
    if (progressData.data?.status === 'FAILED' || progressData.status === 'error') {
      const error = progressData.error || progressData.message || 'Task failed';
      console.error('[pollTaskUntilComplete] Task failed:', error);
      throw new Error(error);
    }

    // 5초 대기
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

// 진행률 응답 타입
export interface TaskProgressResponse {
  status?: 'ok' | 'error';
  data?: {
    task_id?: string;
    status?: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
    progress?: number; // 0-100
    message?: string;
    // 완료 시 추가 데이터
    result_glb_url?: string;
    download_url?: string;
    thumbnail_url?: string;
    raw?: unknown;
  };
  error?: string;
  message?: string;
}

// API 응답 타입 정의 (Python 서버 실제 응답 구조)
export interface AIModelResponse {
  status?: 'ok' | 'error';
  data?: {
    task_id?: string;
    remesh_task_id?: string;
    status?: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
    progress?: number;
    result_glb_url?: string;         // Meshy AI의 원격 URL (폴백)
    download_url?: string;           // 로컬 서버 다운로드 경로 (레거시)
    glb_download_url?: string;       // GLB 파일 다운로드 URL (Python 서버)
    stl_download_url?: string;       // STL 파일 다운로드 URL (Python 서버)
    thumbnail_url?: string;          // 썸네일 URL (Meshy 원본 - 백업)
    thumbnail_download_url?: string; // 썸네일 다운로드 URL (Python 서버 - 우선)
    glb_file_size?: number;          // GLB 파일 크기
    stl_file_size?: number;          // STL 파일 크기
    thumbnail_file_size?: number;    // 썸네일 파일 크기
    local_path?: string;
    uploaded_local_path?: string;
    cleaned_glb_path?: string;       // 정리된 GLB 경로
    stl_path?: string;               // STL 경로
    thumbnail_path?: string;         // 썸네일 경로
    raw?: {
      image_to_3d?: unknown;
      remesh?: unknown;
    };
    request_payload?: unknown;
    file_size?: number;
  };
  error?: string;
  message?: string;
  // 하위 호환성을 위해 최상위 레벨 필드도 유지
  task_id?: string;
  remesh_task_id?: string;
  result_glb_url?: string;
  download_url?: string;
  glb_download_url?: string;
  stl_download_url?: string;
  thumbnail_url?: string;
  thumbnail_download_url?: string;
  local_path?: string;
  uploaded_local_path?: string;
  raw?: unknown;
  request_payload?: unknown;
}

// GLB URL 추출 헬퍼 (Python 서버 응답 구조에 맞춤)
export function extractGLBUrl(result: AIModelResponse): string | null {
  if (!result) {
    console.warn('[aiService] No result provided');
    return null;
  }

  // 디버깅: 응답 전체 구조 출력
  console.log('[aiService] Full response:', JSON.stringify(result, null, 2));

  // 에러 응답 체크
  if (result.status === 'error' || result.error) {
    console.error('[aiService] Error in AI response:', result.error || result.message);
    return null;
  }

  // Python 서버 응답 구조: { status: 'ok', data: { glb_download_url: '...' } }
  const glbDownloadUrl = result.data?.glb_download_url || result.glb_download_url;
  const downloadUrl = result.data?.download_url || result.download_url;
  const resultGlbUrl = result.data?.result_glb_url || result.result_glb_url;

  // 우선순위:
  // 1. glb_download_url (새로운 명시적 GLB URL)
  // 2. download_url (레거시 로컬 Python 서버 다운로드 경로)
  // 3. result_glb_url (Meshy AI 원격 URL - 폴백)
  if (glbDownloadUrl) {
    // glb_download_url이 상대 경로인 경우 (예: /files/cleaned_xxx.glb)
    if (glbDownloadUrl.startsWith('/')) {
      const fullUrl = `${AI_PYTHON_URL}${glbDownloadUrl}`;
      console.log('[aiService] Using local Python server GLB (glb_download_url):', fullUrl);
      return fullUrl;
    }
    // 이미 전체 URL인 경우
    console.log('[aiService] Using full glb_download_url:', glbDownloadUrl);
    return glbDownloadUrl;
  }

  if (downloadUrl) {
    // download_url이 상대 경로인 경우 (예: /files/remeshed_xxx.glb)
    if (downloadUrl.startsWith('/')) {
      const fullUrl = `${AI_PYTHON_URL}${downloadUrl}`;
      console.log('[aiService] Using local Python server GLB (relative):', fullUrl);
      return fullUrl;
    }
    // 이미 전체 URL인 경우
    console.log('[aiService] Using full download URL:', downloadUrl);
    return downloadUrl;
  }

  // 폴백: Meshy AI 원격 URL
  if (resultGlbUrl) {
    console.log('[aiService] Using Meshy AI remote URL:', resultGlbUrl);
    return resultGlbUrl;
  }

  console.warn('[aiService] No GLB URL found in response. Available keys:', Object.keys(result));
  return null;
}

// STL URL 추출 헬퍼
export function extractSTLUrl(result: AIModelResponse): string | null {
  if (!result) {
    console.warn('[aiService] No result provided');
    return null;
  }

  // 에러 응답 체크
  if (result.status === 'error' || result.error) {
    console.error('[aiService] Error in AI response:', result.error || result.message);
    return null;
  }

  // Python 서버 응답 구조: { status: 'ok', data: { stl_download_url: '...' } }
  const stlDownloadUrl = result.data?.stl_download_url || result.stl_download_url;

  if (stlDownloadUrl) {
    // stl_download_url이 상대 경로인 경우 (예: /files/cleaned_xxx.stl)
    if (stlDownloadUrl.startsWith('/')) {
      const fullUrl = `${AI_PYTHON_URL}${stlDownloadUrl}`;
      console.log('[aiService] Using local Python server STL:', fullUrl);
      return fullUrl;
    }
    // 이미 전체 URL인 경우
    console.log('[aiService] Using full stl_download_url:', stlDownloadUrl);
    return stlDownloadUrl;
  }

  console.warn('[aiService] No STL URL found in response. Available keys:', Object.keys(result));
  return null;
}

// 썸네일 URL 추출 헬퍼
export function extractThumbnailUrl(result: AIModelResponse): string | null {
  if (!result) return null;

  const data = result.data || result;

  // 우선순위:
  // 1. data.thumbnail_download_url (Python 서버에서 로컬 저장한 썸네일 - 최우선)
  // 2. data.thumbnail_url (Meshy 원본 - 백업)
  // 3. raw.remesh.thumbnail_url (레거시)
  // 4. raw.image_to_3d.thumbnail_url (레거시)
  const thumbnailUrl =
    data.thumbnail_download_url ||
    data.thumbnail_url ||
    data.raw?.remesh?.thumbnail_url ||
    data.raw?.image_to_3d?.thumbnail_url ||
    null;

  if (thumbnailUrl) {
    console.log('[aiService] Found thumbnail URL:', thumbnailUrl);

    // 상대 경로인 경우 전체 URL로 변환 (Python 서버)
    if (thumbnailUrl.startsWith('/')) {
      const fullUrl = `${AI_PYTHON_URL}${thumbnailUrl}`;
      console.log('[aiService] Converting to full URL:', fullUrl);
      return fullUrl;
    }
  }

  return thumbnailUrl;
}

// 메타데이터 추출 헬퍼
export function extractMetadata(result: AIModelResponse) {
  if (!result) return null;

  // Python 서버 응답 구조: { status: 'ok', data: { ... } }
  const data = result.data || result;

  return {
    task_id: data.task_id,
    remesh_task_id: data.remesh_task_id,
    local_path: data.local_path,
    uploaded_local_path: data.uploaded_local_path,
    request_payload: data.request_payload,
    raw: data.raw,
  };
}

// STL 업로드 및 슬라이싱 API
export interface SlicingSettings {
  layer_height?: string;
  line_width?: string;
  infill_sparse_density?: string;
  wall_line_count?: string;
  top_layers?: string;
  bottom_layers?: string;
  speed_print?: string;
  support_enable?: string;
  support_angle?: string;
  adhesion_type?: string;
  material_diameter?: string;
  material_flow?: string;
}

export interface PrinterDefinition {
  version: number;
  name: string;
  overrides: {
    machine_width?: { default_value: number };
    machine_depth?: { default_value: number };
    machine_height?: { default_value: number };
    [key: string]: { default_value: number | string } | undefined;
  };
}

export interface SlicingResponse {
  status: 'ok' | 'error';
  data?: {
    task_id: string;
    input_stl: string;
    gcode_path: string;
    gcode_url: string;
    cura_settings: Record<string, string>;
  };
  error?: string;
}

export async function uploadSTLAndSlice(
  stlBlob: Blob,
  filename: string,
  curaSettings?: SlicingSettings,
  printerDefinition?: PrinterDefinition
): Promise<SlicingResponse> {
  const SLICE_ENDPOINT = `${AI_PYTHON_URL}/v1/process/upload-stl-and-slice`;

  const formData = new FormData();
  formData.append('model_file', stlBlob, filename);

  if (curaSettings) {
    formData.append('cura_settings_json', JSON.stringify(curaSettings));
  }

  if (printerDefinition) {
    formData.append('printer_definition_json', JSON.stringify(printerDefinition));
  }

  try {
    // 최종 요청 데이터를 하나의 JSON으로 표시
    const requestPayload = {
      endpoint: SLICE_ENDPOINT,
      method: 'POST',
      content_type: 'multipart/form-data',
      fields: {
        model_file: {
          filename: filename,
          size: stlBlob.size,
          type: stlBlob.type || 'application/octet-stream',
          content: '[BINARY FILE DATA]'
        },
        cura_settings_json: curaSettings || null,
        printer_definition_json: printerDefinition || null
      }
    };

    console.log('[aiService] ========================================');
    console.log('[aiService] 📤 FINAL REQUEST TO SERVER:');
    console.log(JSON.stringify(requestPayload, null, 2));
    console.log('[aiService] ========================================');

    const response = await fetchWithTimeout(SLICE_ENDPOINT, {
      method: 'POST',
      body: formData,
    }, 180000); // 3분 타임아웃 (슬라이싱은 시간이 걸릴 수 있음)

    console.log('[aiService] Response status:', response.status, response.statusText);
    console.log('[aiService] Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      // 에러 응답 본문 읽기
      let errorBody: any;
      const contentType = response.headers.get('content-type');

      try {
        if (contentType?.includes('application/json')) {
          errorBody = await response.json();
        } else {
          errorBody = await response.text();
        }
      } catch (e) {
        errorBody = 'Could not parse error response';
      }

      console.error('[aiService] Error response body:', errorBody);

      throw new Error(`HTTP error! status: ${response.status}, body: ${JSON.stringify(errorBody)}`);
    }

    const result = await response.json();
    console.log('[aiService] Slicing response:', result);

    return result;
  } catch (error) {
    console.error('[aiService] Slicing failed:', error);
    if (error instanceof Error) {
      console.error('[aiService] Error message:', error.message);
      console.error('[aiService] Error stack:', error.stack);
    }
    throw error;
  }
}


