/**
 * Claude API Service
 * 사용자의 프롬프트 또는 이미지에서 의미있는 짧은 파일명을 생성하는 서비스
 */

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

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
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;

  // 프롬프트가 있으면 텍스트 기반으로 처리
  if (prompt) {
    return generateFilenameFromText(prompt, apiKey);
  }

  // 이미지가 있으면 Vision API로 처리
  if (imageUrl) {
    return generateFilenameFromImage(imageUrl, apiKey);
  }

  // 모델명에서 추출 (fallback)
  if (modelName) {
    return generateFilenameFromText(modelName, apiKey);
  }

  console.warn('[claudeService] No input provided, using random filename');
  return `model_${Date.now().toString(36).slice(-4)}`;
}

/**
 * 텍스트 프롬프트에서 파일명 생성
 */
async function generateFilenameFromText(inputText: string, apiKey?: string): Promise<string> {
  if (!apiKey) {
    console.warn('[claudeService] No API key, using fallback extraction');
    return extractFallbackFilename(inputText);
  }

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 50,
        messages: [
          {
            role: 'user',
            content: `You are a filename generator. Extract the main subject/object from the user's 3D model request and return ONLY a short English filename.

Rules:
- 1-2 words maximum
- Lowercase only
- No spaces (use underscore if needed)
- No file extension
- Translate to English if input is in another language

User's request: "${inputText}"

Examples:
- "귀여운 눈사람 만들어줘" → "snowman"
- "날개 달린 드래곤" → "dragon"
- "고양이 피규어" → "cat"
- "cute bunny for 3D printing" → "bunny"
- "realistic human hand" → "hand"
- "Text-to-3D__3D-printable_snowman" → "snowman"

Return ONLY the filename:`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[claudeService] API error:', response.status, errorText);
      return extractFallbackFilename(inputText);
    }

    const data = await response.json();
    const filename = data.content?.[0]?.text?.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || '';

    if (filename && filename.length > 0 && filename.length <= 30) {
      console.log('[claudeService] Generated filename from prompt:', filename);
      return filename;
    }

    return extractFallbackFilename(inputText);
  } catch (error) {
    console.error('[claudeService] Error:', error);
    return extractFallbackFilename(inputText);
  }
}

/**
 * 이미지에서 Claude Vision API로 파일명 생성
 */
async function generateFilenameFromImage(imageUrl: string, apiKey?: string): Promise<string> {
  if (!apiKey) {
    console.warn('[claudeService] No API key, using default image filename');
    return `model_${Date.now().toString(36).slice(-4)}`;
  }

  try {
    // 이미지를 Base64로 변환
    const imageBase64 = await fetchImageAsBase64(imageUrl);
    if (!imageBase64) {
      console.warn('[claudeService] Failed to fetch image, using default filename');
      return `model_${Date.now().toString(36).slice(-4)}`;
    }

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 50,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: imageBase64.mediaType,
                  data: imageBase64.data,
                }
              },
              {
                type: 'text',
                text: `Look at this image and identify the main object/subject. Return ONLY a short English filename for a 3D model of this object.

Rules:
- 1-2 words maximum
- Lowercase only
- No spaces (use underscore if needed)
- No file extension

Examples:
- Image of a cat → "cat"
- Image of a cup → "cup"
- Image of a dragon figurine → "dragon"
- Image of a car → "car"
- Image of a shoe → "shoe"

Return ONLY the filename:`
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[claudeService] Vision API error:', response.status, errorText);
      return `model_${Date.now().toString(36).slice(-4)}`;
    }

    const data = await response.json();
    const filename = data.content?.[0]?.text?.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || '';

    if (filename && filename.length > 0 && filename.length <= 30) {
      console.log('[claudeService] Generated filename from image:', filename);
      return filename;
    }

    return `model_${Date.now().toString(36).slice(-4)}`;
  } catch (error) {
    console.error('[claudeService] Vision API error:', error);
    return `model_${Date.now().toString(36).slice(-4)}`;
  }
}

/**
 * 이미지 URL을 Base64로 변환
 */
async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mediaType: string } | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error('[claudeService] Failed to fetch image:', response.status);
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
        console.error('[claudeService] FileReader error');
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('[claudeService] Error fetching image:', error);
    return null;
  }
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
  const filename = words[0] || `model_${Date.now().toString(36).slice(-4)}`;

  console.log('[claudeService] Fallback filename:', filename);
  return filename.replace(/[^a-z0-9_]/g, '').slice(0, 20);
}

// toGcodeFilename 함수는 utils/filename.ts로 이동됨
// 하위 호환성을 위해 re-export
export { toGcodeFilename } from '../utils/filename';
