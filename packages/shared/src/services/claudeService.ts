/**
 * Claude API Service
 * 사용자의 프롬프트 또는 이미지에서 의미있는 짧은 파일명을 생성하는 서비스
 *
 * ⚠ API 키는 클라이언트에 두지 않는다.
 * 브라우저는 서버의 /api/ai/filename 프록시만 호출하며, Claude API 키는
 * 서버 환경변수(CLAUDE_API_KEY)에만 존재한다. 프록시가 없거나 실패하면
 * 로컬 fallback 규칙으로 파일명을 만든다.
 */

const FILENAME_API_URL = '/api/ai/filename';
const REQUEST_TIMEOUT_MS = 15000;

interface GenerateFilenameOptions {
  prompt?: string;        // 사용자가 입력한 원본 프롬프트
  imageUrl?: string;      // 이미지 URL (image-to-3D용)
  modelName?: string;     // AI가 생성한 모델명 (fallback)
}

/**
 * 프롬프트 또는 이미지에서 짧은 파일명 생성
 * @param options.prompt 사용자가 입력한 원본 프롬프트 (예: "귀여운 눈사람 만들어줘")
 * @param options.imageUrl 이미지 URL (image-to-3D에서 사용)
 * @param options.modelName AI 모델명 (fallback용)
 * @returns 짧은 파일명 (예: "snowman")
 */
export async function generateShortFilename(options: GenerateFilenameOptions): Promise<string> {
  const { prompt, imageUrl, modelName } = options;

  // 프롬프트가 있으면 텍스트 기반으로 처리
  if (prompt) {
    return (await requestFilename({ prompt })) || extractFallbackFilename(prompt);
  }

  // 이미지가 있으면 Vision API로 처리
  if (imageUrl) {
    return (await requestFilename({ imageUrl })) || randomFilename();
  }

  // 모델명에서 추출 (fallback)
  if (modelName) {
    return (await requestFilename({ prompt: modelName })) || extractFallbackFilename(modelName);
  }

  console.warn('[claudeService] No input provided, using random filename');
  return randomFilename();
}

/**
 * 서버 프록시에 파일명 생성을 요청한다.
 * 실패 시 null 을 반환하여 호출부가 fallback 을 쓰도록 한다.
 */
async function requestFilename(body: { prompt?: string; imageUrl?: string }): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(FILENAME_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn('[claudeService] 파일명 프록시 응답 실패:', response.status);
      return null;
    }

    const data = await response.json();
    const filename = typeof data?.filename === 'string' ? data.filename : '';

    if (filename && filename.length <= 30) {
      console.log('[claudeService] Generated filename:', filename);
      return filename;
    }

    return null;
  } catch (error) {
    console.warn('[claudeService] 파일명 프록시 호출 오류:', error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function randomFilename(): string {
  return `model_${Date.now().toString(36).slice(-4)}`;
}

/**
 * Claude API 없이 fallback으로 파일명 추출
 */
function extractFallbackFilename(modelName: string): string {
  // 의미없는 단어 제거
  const stopWords = ['text', 'to', '3d', 'image', 'printable', 'print', 'model', 'with', 'for', 'the', 'a', 'an'];

  // 단어 분리
  const words = modelName
    .toLowerCase()
    .split(/[_\-\s]+/)
    .filter(w => w.length > 2 && !stopWords.includes(w));

  // 첫 번째 의미있는 단어 반환
  const filename = words[0] || randomFilename();

  console.log('[claudeService] Fallback filename:', filename);
  return filename.replace(/[^a-z0-9_]/g, '').slice(0, 20);
}

// toGcodeFilename 함수는 utils/filename.ts로 이동됨
// 하위 호환성을 위해 re-export
export { toGcodeFilename } from '../utils/filename';
