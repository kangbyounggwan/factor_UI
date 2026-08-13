/**
 * AI 보조 텍스트 생성 서비스 (파일명 · 채팅 제목)
 *
 * ⚠ API 키는 클라이언트에 두지 않는다.
 * 과거에는 VITE_GEMINI_API_KEY 를 브라우저에서 직접 사용했으나, VITE_ 접두사
 * 환경변수는 빌드 시 JS 번들에 그대로 포함되어 외부에 노출된다.
 * 현재는 서버의 /api/ai/* 프록시만 호출하며, 실제 API 키는 서버 환경변수에만
 * 존재한다. 프록시가 없거나 실패하면 로컬 fallback 규칙을 사용한다.
 *
 * 모듈명은 기존 import 경로 호환을 위해 유지한다.
 */

const FILENAME_API_URL = '/api/ai/filename';
const CHAT_TITLE_API_URL = '/api/ai/chat-title';
const REQUEST_TIMEOUT_MS = 15000;

export interface GenerateFilenameOptions {
    prompt?: string;        // 사용자가 입력한 원본 프롬프트
    imageUrl?: string;      // 이미지 URL (image-to-3D용)
    modelName?: string;     // AI가 생성한 모델명 (fallback)
}

/**
 * 서버 프록시 호출 공통 처리. 실패 시 null 을 돌려 호출부가 fallback 을 쓰게 한다.
 */
async function postJson(url: string, body: unknown): Promise<any | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        if (!response.ok) {
            console.warn('[aiService] 프록시 응답 실패:', url, response.status);
            return null;
        }
        return await response.json();
    } catch (error) {
        console.warn('[aiService] 프록시 호출 오류:', url, error);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * 프롬프트 또는 이미지에서 짧은 파일명 생성
 */
export async function generateShortFilename(options: GenerateFilenameOptions): Promise<string> {
    const { prompt, imageUrl, modelName } = options;
    const source = prompt || modelName;

    if (prompt || modelName) {
        const data = await postJson(FILENAME_API_URL, { prompt: source });
        const filename = typeof data?.filename === 'string' ? data.filename : '';
        if (filename && filename.length <= 30) return filename;
        return extractFallbackFilename(source as string);
    }

    if (imageUrl) {
        const data = await postJson(FILENAME_API_URL, { imageUrl });
        const filename = typeof data?.filename === 'string' ? data.filename : '';
        if (filename && filename.length <= 30) return filename;
        return randomFilename();
    }

    console.warn('[aiService] No input provided, using random filename');
    return randomFilename();
}

/**
 * 채팅 제목 생성 (첫 메시지 요약)
 * - 15자 이하면 그대로 반환
 * - 15자 초과면 AI로 요약
 */
export async function generateChatTitle(firstMessage: string): Promise<string> {
    const cleanedMessage = firstMessage.replace(/\s+/g, ' ').trim();
    if (cleanedMessage.length <= 15) {
        return cleanedMessage;
    }

    const truncated = cleanedMessage.substring(0, 15) + '...';
    const data = await postJson(CHAT_TITLE_API_URL, { message: cleanedMessage });
    const title = typeof data?.title === 'string' ? data.title.trim() : '';

    if (title && title.length <= 20) {
        console.log('[aiService] Generated chat title:', title);
        return title;
    }
    return truncated;
}

function randomFilename(): string {
    return `model_${Date.now().toString(36).slice(-4)}`;
}

/**
 * AI 호출 없이 fallback으로 파일명 추출
 */
function extractFallbackFilename(text: string): string {
    const stopWords = ['text', 'to', '3d', 'image', 'printable', 'print', 'model', 'with', 'for', 'the', 'a', 'an'];

    const words = (text || '')
        .toLowerCase()
        .split(/[_\-\s]+/)
        .filter(w => w.length > 2 && !stopWords.includes(w));

    const filename = words[0] || randomFilename();

    console.log('[aiService] Fallback filename:', filename);
    return filename.replace(/[^a-z0-9_]/g, '').slice(0, 20);
}

// toGcodeFilename 함수는 utils/filename.ts로 이동됨
// 하위 호환성을 위해 re-export
export { toGcodeFilename } from '../utils/filename';
