/**
 * Gemini API Service
 * 사용자의 프롬프트 또는 이미지에서 의미있는 짧은 파일명을 생성하는 서비스
 */

const BASE_URL = 'https://generativelanguage.googleapis.com/v1/models';

const TEXT_MODELS = ['gemini-2.0-flash'];
const VISION_MODELS = ['gemini-2.0-flash'];
export interface GenerateFilenameOptions {
    prompt?: string;        // 사용자가 입력한 원본 프롬프트
    imageUrl?: string;      // 이미지 URL (image-to-3D용)
    modelName?: string;     // AI가 생성한 모델명 (fallback)
}

/**
 * 프롬프트 또는 이미지에서 짧은 파일명 생성 (Gemini 사용)
 */
export async function generateShortFilename(options: GenerateFilenameOptions): Promise<string> {
    const { prompt, imageUrl, modelName } = options;
    const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
        console.warn('[geminiService] No API key provided');
        if (modelName) return extractFallbackFilename(modelName);
        return `model_${Date.now().toString(36).slice(-4)}`;
    }

    // 프롬프트가 있으면 텍스트 기반으로 처리
    if (prompt) {
        return generateFilenameFromTextWithFallback(prompt, apiKey);
    }

    // 이미지가 있으면 Vision API로 처리
    if (imageUrl) {
        return generateFilenameFromImageWithFallback(imageUrl, apiKey);
    }

    // 둘 다 없으면 모델명에서 추출 (fallback)
    if (modelName) {
        return extractFallbackFilename(modelName);
    }

    console.warn('[geminiService] No input provided, using random filename');
    return `model_${Date.now().toString(36).slice(-4)}`;
}

/**
 * 텍스트 처리 (Fallback 지원)
 */
async function generateFilenameFromTextWithFallback(inputText: string, apiKey: string): Promise<string> {
    for (const model of TEXT_MODELS) {
        try {
            const result = await generateFilenameFromText(inputText, apiKey, model);
            if (result) return result;
        } catch (e) {
            console.warn(`[geminiService] Failed with model ${model}, trying next...`, e);
        }
    }
    return extractFallbackFilename(inputText);
}

/**
 * 이미지 처리 (Fallback 지원)
 */
async function generateFilenameFromImageWithFallback(imageUrl: string, apiKey: string): Promise<string> {
    for (const model of VISION_MODELS) {
        try {
            const result = await generateFilenameFromImage(imageUrl, apiKey, model);
            if (result) return result;
        } catch (e) {
            console.warn(`[geminiService] Failed with model ${model}, trying next...`, e);
        }
    }
    return `model_${Date.now().toString(36).slice(-4)}`;
}

/**
 * 텍스트 프롬프트에서 파일명 생성 (단일 모델)
 */
async function generateFilenameFromText(inputText: string, apiKey: string, modelName: string): Promise<string | null> {
    const url = `${BASE_URL}/${modelName}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: `You are a filename generator. Extract the main subject/object from the user's 3D model request and return ONLY a short English filename.

Rules:
- EXACTLY 2 words that summarize the subject
- Lowercase only
- Connect words with an underscore (_)
- No file extension
- Translate to English if input is in another language

User's request: "${inputText}"

Examples:
- "귀여운 눈사람 만들어줘" → "cute_snowman"
- "날개 달린 드래곤" → "winged_dragon"
- "고양이 피규어" → "cat_figure"
- "cute bunny for 3D printing" → "cute_bunny"
- "realistic human hand" → "human_hand"

Return ONLY the filename:`
                }]
            }],
            generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 50,
            }
        })
    });

    if (!response.ok) {
        // 404나 400 에러면 다른 모델 시도를 위해 에러 throw
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const filename = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || '';

    if (filename && filename.length > 0 && filename.length <= 30) {
        console.log(`[geminiService] Generated filename from prompt (${modelName}):`, filename);
        return filename;
    }
    return null;
}

/**
 * 이미지에서 Gemini Vision API로 파일명 생성 (단일 모델)
 */
async function generateFilenameFromImage(imageUrl: string, apiKey: string, modelName: string): Promise<string | null> {
    // 이미지를 Base64로 변환
    const imageBase64 = await fetchImageAsBase64(imageUrl);
    if (!imageBase64) return null;

    const url = `${BASE_URL}/${modelName}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    {
                        text: `Look at this image and identify the main object/subject. Return ONLY a short English filename for a 3D model of this object.

Rules:
- EXACTLY 2 words that summarize the subject
- Lowercase only
- Connect words with an underscore (_)
- No file extension

Examples:
- Image of a cat → "walking_cat"
- Image of a cup → "white_cup"
- Image of a dragon figurine → "dragon_statue"

Return ONLY the filename:`
                    },
                    {
                        inline_data: {
                            mime_type: imageBase64.mediaType,
                            data: imageBase64.data
                        }
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 50,
            }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vision API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const filename = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || '';

    if (filename && filename.length > 0 && filename.length <= 30) {
        console.log(`[geminiService] Generated filename from image (${modelName}):`, filename);
        return filename;
    }
    return null;
}

/**
 * 이미지 URL을 Base64로 변환
 */
async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mediaType: string } | null> {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            console.error('[geminiService] Failed to fetch image:', response.status);
            return null;
        }

        const blob = await response.blob();
        const mediaType = blob.type || 'image/jpeg';

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
                const data = base64.split(',')[1];
                resolve({ data, mediaType });
            };
            reader.onerror = () => {
                console.error('[geminiService] FileReader error');
                resolve(null);
            };
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('[geminiService] Error fetching image:', error);
        return null;
    }
}

/**
 * fallback으로 파일명 추출
 */
function extractFallbackFilename(text: string): string {
    // 의미없는 단어 제거
    const stopWords = ['text', 'to', '3d', 'image', 'printable', 'print', 'model', 'with', 'for', 'the', 'a', 'an'];

    // 단어 분리
    const words = text
        .toLowerCase()
        .split(/[_\-\s]+/)
        .filter(w => w.length > 2 && !stopWords.includes(w));

    // 첫 번째 의미있는 단어 반환
    const filename = words[0] || `model_${Date.now().toString(36).slice(-4)}`;

    console.log('[geminiService] Fallback filename:', filename);
    return filename.replace(/[^a-z0-9_]/g, '').slice(0, 20);
}

/**
 * 파일명에 .gcode 확장자 추가
 */
export function toGcodeFilename(shortName: string): string {
    return `${shortName}.gcode`;
}

/**
 * 채팅 제목 생성 (첫 메시지 요약)
 * - 15자 이하면 그대로 반환
 * - 15자 초과면 AI로 요약
 */
export async function generateChatTitle(firstMessage: string): Promise<string> {
    // 15자 이하면 그대로 사용
    const cleanedMessage = firstMessage.replace(/\s+/g, ' ').trim();
    if (cleanedMessage.length <= 15) {
        return cleanedMessage;
    }

    const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
        console.warn('[geminiService] No API key, using truncated title');
        return cleanedMessage.substring(0, 15) + '...';
    }

    try {
        const modelName = TEXT_MODELS[0];
        const url = `${BASE_URL}/${modelName}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `다음 사용자 질문을 10자 이내의 짧은 제목으로 요약해주세요.
핵심 키워드만 포함하고, 조사나 불필요한 단어는 제외합니다.
반드시 한국어로 응답하세요.

사용자 질문: "${firstMessage}"

예시:
- "가성비 좋은 3D 프린터 추천해줘" → "가성비 프린터 추천"
- "PLA와 ABS의 차이점이 뭐야?" → "PLA vs ABS 차이"
- "베드 레벨링 하는 방법 알려줘" → "베드 레벨링 방법"
- "필라멘트가 압출이 안되는데 어떻게 해야해?" → "필라멘트 압출 문제"

제목만 반환하세요:`
                    }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 30,
                }
            })
        });

        if (!response.ok) {
            console.warn('[geminiService] Title generation API error, using fallback');
            return cleanedMessage.substring(0, 15) + '...';
        }

        const data = await response.json();
        const title = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

        if (title && title.length > 0 && title.length <= 20) {
            console.log('[geminiService] Generated chat title:', title);
            return title;
        }

        return cleanedMessage.substring(0, 15) + '...';
    } catch (error) {
        console.error('[geminiService] Error generating chat title:', error);
        return cleanedMessage.substring(0, 15) + '...';
    }
}
