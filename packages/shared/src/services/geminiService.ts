/**
 * Gemini API Service
 * 사용자의 프롬프트 또는 이미지에서 의미있는 짧은 파일명을 생성하는 서비스
 */

const BASE_URL = 'https://generativelanguage.googleapis.com/v1/models';

const TEXT_MODELS = ['gemini-2.5-flash-lite'];
const VISION_MODELS = ['gemini-2.5-flash-lite'];
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

// ========== G-Code Analysis Chat ==========

import type { CollectedInfo, ChatMessage } from '@shared/types/gcodeAnalysisTypes';

/**
 * G-code 파일에서 기본 정보 추출
 */
function extractGCodeInfo(gcodeContent: string): {
    slicer?: string;
    nozzleTemp?: number;
    bedTemp?: number;
    layerHeight?: number;
    filamentType?: string;
} {
    const result: {
        slicer?: string;
        nozzleTemp?: number;
        bedTemp?: number;
        layerHeight?: number;
        filamentType?: string;
    } = {};

    // 첫 1000줄만 분석 (성능)
    const lines = gcodeContent.split('\n').slice(0, 1000);

    for (const line of lines) {
        const trimmed = line.trim();

        // 슬라이서 감지
        if (!result.slicer) {
            if (trimmed.includes('PrusaSlicer') || trimmed.includes('Prusa')) {
                result.slicer = 'PrusaSlicer';
            } else if (trimmed.includes('Cura') || trimmed.includes('CURA')) {
                result.slicer = 'Cura';
            } else if (trimmed.includes('Simplify3D')) {
                result.slicer = 'Simplify3D';
            } else if (trimmed.includes('Slic3r')) {
                result.slicer = 'Slic3r';
            } else if (trimmed.includes('OrcaSlicer')) {
                result.slicer = 'OrcaSlicer';
            } else if (trimmed.includes('BambuStudio') || trimmed.includes('Bambu')) {
                result.slicer = 'BambuStudio';
            }
        }

        // 노즐 온도 (M104/M109)
        if (!result.nozzleTemp) {
            const nozzleMatch = trimmed.match(/M10[49]\s+S(\d+)/);
            if (nozzleMatch) {
                const temp = parseInt(nozzleMatch[1]);
                if (temp > 150 && temp < 350) {
                    result.nozzleTemp = temp;
                }
            }
        }

        // 베드 온도 (M140/M190)
        if (!result.bedTemp) {
            const bedMatch = trimmed.match(/M1[49]0\s+S(\d+)/);
            if (bedMatch) {
                const temp = parseInt(bedMatch[1]);
                if (temp > 0 && temp < 150) {
                    result.bedTemp = temp;
                }
            }
        }

        // 레이어 높이
        if (!result.layerHeight) {
            const layerMatch = trimmed.match(/layer_height\s*=\s*([\d.]+)/i) ||
                               trimmed.match(/Layer height:\s*([\d.]+)/i);
            if (layerMatch) {
                result.layerHeight = parseFloat(layerMatch[1]);
            }
        }

        // 필라멘트 타입
        if (!result.filamentType) {
            const filamentMatch = trimmed.match(/filament_type\s*=\s*(\w+)/i) ||
                                  trimmed.match(/FILAMENT_TYPE:(\w+)/i) ||
                                  trimmed.match(/Material:\s*(\w+)/i);
            if (filamentMatch) {
                result.filamentType = filamentMatch[1].toUpperCase();
            }
        }

        // 모든 정보를 찾으면 중단
        if (result.slicer && result.nozzleTemp && result.bedTemp && result.layerHeight && result.filamentType) {
            break;
        }
    }

    return result;
}

interface GCodeChatContext {
    messages: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
    collectedInfo: CollectedInfo;
    gcodeFileName?: string;
    gcodeContent?: string; // G-code 파일 내용 (앞부분만 전달)
}

const GCODE_ANALYSIS_SYSTEM_PROMPT = `당신은 3D 프린터 G-code 분석 전문가 AI 어시스턴트입니다. 친근하고 자연스러운 대화를 통해 사용자를 돕습니다.

핵심 역할:
- G-code 파일 분석 전 필요한 정보를 자연스러운 대화로 수집
- 사용자의 질문에 전문적이지만 이해하기 쉽게 답변
- 한국어로 대화

대화 스타일:
- 템플릿처럼 딱딱한 질문 나열 대신, 친구와 대화하듯 자연스럽게
- 사용자가 제공한 정보에 맞춰 유연하게 대응
- 이미 파일에서 추출된 정보가 있다면 확인만 하고 추가 질문은 필요시에만

분석에 도움되는 정보 (필수 아님):
- 프린터 모델 (예: Ender-3, Prusa MK3S)
- 필라멘트 종류 (PLA, ABS, PETG 등)
- 노즐 직경 (보통 0.4mm)

분석 시작 트리거:
"분석 시작", "분석해줘", "시작", "분석", "analyze" 등의 의도가 감지되면 분석 준비

응답 형식:
- 자연스러운 대화체 (마크다운 사용 가능)
- 정보 수집 시 마지막에 (사용자에게 보이지 않음):
  [COLLECTED_INFO]{"printerName":"...", "filamentType":"...", ...}[/COLLECTED_INFO]
- 분석 시작 준비되면:
  [READY_TO_ANALYZE]true[/READY_TO_ANALYZE]`;

/**
 * G-code 분석용 대화 함수
 */
export async function chatForGCodeAnalysis(
    userMessage: string,
    context: GCodeChatContext
): Promise<{ response: string; collectedInfo: CollectedInfo; readyToAnalyze: boolean }> {
    const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
        console.warn('[geminiService] No API key for chat');
        return {
            response: 'API 키가 설정되지 않았습니다. 바로 분석을 진행합니다.',
            collectedInfo: context.collectedInfo,
            readyToAnalyze: true
        };
    }

    const modelName = TEXT_MODELS[0];
    const url = `${BASE_URL}/${modelName}:generateContent?key=${apiKey}`;

    // 시스템 프롬프트 + 컨텍스트 구성
    let systemContext = GCODE_ANALYSIS_SYSTEM_PROMPT;

    if (context.gcodeFileName) {
        systemContext += `\n\n[현재 선택된 파일: ${context.gcodeFileName}]`;
    }

    // G-code 파일 내용 요약 추가 (앞부분 500줄만)
    if (context.gcodeContent) {
        const lines = context.gcodeContent.split('\n');
        const preview = lines.slice(0, 500).join('\n');
        const gcodeInfo = extractGCodeInfo(context.gcodeContent);

        systemContext += `\n\n[G-code 파일 정보]
- 총 라인 수: ${lines.length}줄
- 감지된 슬라이서: ${gcodeInfo.slicer || '알 수 없음'}
- 노즐 온도: ${gcodeInfo.nozzleTemp || '확인 필요'}°C
- 베드 온도: ${gcodeInfo.bedTemp || '확인 필요'}°C
- 레이어 높이: ${gcodeInfo.layerHeight || '확인 필요'}mm
- 필라멘트: ${gcodeInfo.filamentType || '확인 필요'}

[G-code 시작 부분 (처음 500줄)]
\`\`\`gcode
${preview}
\`\`\``;
    }

    // 대화 히스토리 구성
    const contents = [
        { role: 'user', parts: [{ text: systemContext }] },
        { role: 'model', parts: [{ text: '네, 알겠습니다. G-code 분석 어시스턴트로서 도와드리겠습니다.' }] },
        ...context.messages,
        { role: 'user', parts: [{ text: userMessage }] }
    ];

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1024,
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[geminiService] Chat API error:', response.status, errorText);
            return {
                response: '죄송합니다. 일시적인 오류가 발생했습니다. 바로 분석을 진행하시겠습니까?',
                collectedInfo: context.collectedInfo,
                readyToAnalyze: false
            };
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // 수집된 정보 파싱
        let updatedInfo = { ...context.collectedInfo };
        const infoMatch = responseText.match(/\[COLLECTED_INFO\](.*?)\[\/COLLECTED_INFO\]/s);
        if (infoMatch) {
            try {
                const parsed = JSON.parse(infoMatch[1]);
                updatedInfo = { ...updatedInfo, ...parsed };
            } catch (e) {
                console.warn('[geminiService] Failed to parse collected info:', e);
            }
        }

        // 분석 준비 상태 확인
        const readyMatch = responseText.match(/\[READY_TO_ANALYZE\](true|false)\[\/READY_TO_ANALYZE\]/);
        const readyToAnalyze = readyMatch ? readyMatch[1] === 'true' : false;

        // 마커 제거한 응답
        const cleanResponse = responseText
            .replace(/\[COLLECTED_INFO\].*?\[\/COLLECTED_INFO\]/s, '')
            .replace(/\[READY_TO_ANALYZE\].*?\[\/READY_TO_ANALYZE\]/s, '')
            .trim();

        return {
            response: cleanResponse,
            collectedInfo: updatedInfo,
            readyToAnalyze
        };
    } catch (error) {
        console.error('[geminiService] Chat error:', error);
        return {
            response: '네트워크 오류가 발생했습니다. 다시 시도해 주세요.',
            collectedInfo: context.collectedInfo,
            readyToAnalyze: false
        };
    }
}

// 파일 메타데이터 타입 (geminiService용)
export interface FileMetadataForChat {
    printer_model?: string | null;
    nozzle_temperature?: number | null;
    bed_temperature?: number | null;
    layer_height?: number | null;
    filament_used_m?: number | null;
    print_time_formatted?: string | null;
}

/**
 * G-code 분석 초기 인사 메시지 생성
 * fileMetadata가 있으면 이미 알고 있는 정보를 표시하고 바로 분석 가능하도록 안내
 */
export function getInitialGCodeChatMessage(
    fileName: string,
    fileMetadata?: FileMetadataForChat | null
): string {
    // 설비 정보가 있는 경우 - 이미 알고 있는 정보 표시
    if (fileMetadata) {
        const knownInfo: string[] = [];

        if (fileMetadata.printer_model) {
            knownInfo.push(`프린터: **${fileMetadata.printer_model}**`);
        }
        if (fileMetadata.layer_height) {
            knownInfo.push(`레이어 높이: **${fileMetadata.layer_height}mm**`);
        }
        if (fileMetadata.nozzle_temperature) {
            knownInfo.push(`노즐 온도: **${fileMetadata.nozzle_temperature}°C**`);
        }
        if (fileMetadata.bed_temperature) {
            knownInfo.push(`베드 온도: **${fileMetadata.bed_temperature}°C**`);
        }
        if (fileMetadata.filament_used_m) {
            knownInfo.push(`필라멘트 사용량: **${fileMetadata.filament_used_m.toFixed(2)}m**`);
        }
        if (fileMetadata.print_time_formatted) {
            knownInfo.push(`예상 출력 시간: **${fileMetadata.print_time_formatted}**`);
        }

        if (knownInfo.length > 0) {
            return `안녕하세요! 👋 **${fileName}** 파일을 선택해 주셨네요.

파일에서 다음 정보를 확인했어요:
${knownInfo.map(info => `• ${info}`).join('\n')}

이 설정으로 바로 분석을 시작할까요? 아니면 다른 궁금한 점이 있으신가요?

**분석 시작** 이라고 말씀해 주시거나, 특정 부분에 대해 질문해 주세요! 🚀`;
        }
    }

    // 설비 정보가 없는 경우 - 자연스러운 대화로 정보 요청
    return `안녕하세요! 👋 **${fileName}** 파일을 선택해 주셨네요.

G-code를 분석하기 전에, 어떤 프린터와 재료를 사용하시는지 알려주시면 더 정확한 분석이 가능해요.

물론 바로 분석을 원하시면 **분석 시작** 이라고 말씀해 주셔도 됩니다! 🚀`;
}
