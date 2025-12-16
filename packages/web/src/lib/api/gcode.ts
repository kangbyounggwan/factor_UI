/**
 * G-code API Client
 * 백엔드 G-code 분석 API 호출
 */

export interface LayerSegmentData {
  layerNum: number;
  z: number;
  extrusionData: string;  // Base64 encoded Float32Array
  travelData: string;     // Base64 encoded Float32Array
  wipeData?: string;      // Base64 encoded Float32Array (optional, for Bambu Lab slicers)
  supportData?: string;   // Base64 encoded Float32Array (optional, support structures)
  extrusionCount: number;
  travelCount: number;
  wipeCount?: number;     // optional
  supportCount?: number;  // optional
}

export interface TemperatureData {
  layer: number;
  nozzleTemp: number | null;
  bedTemp: number | null;
}

export interface GCodeAnalysisResponse {
  analysis_id: string;
  status: string;
  segments: {
    layers: LayerSegmentData[];
    metadata: {
      boundingBox: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
        minZ: number;
        maxZ: number;
      };
      layerCount: number;
      totalFilament: number;
      printTime: number;
      layerHeight: number;
      firstLayerHeight: number;
      estimatedTime: string;
      filamentType: string | null;
      slicer: string;
      slicerVersion: string | null;
    };
    temperatures: TemperatureData[];
  };
  llm_analysis_started: boolean;
  message?: string;
  stream_url?: string;
}

const API_BASE_URL = import.meta.env.VITE_AI_PYTHON_URL || 'http://localhost:7000';

/**
 * G-code 분석 API 호출 (Float32Array 형식)
 */
export async function analyzeGCodeWithSegments(
  gcodeContent: string,
  options: {
    binaryFormat?: boolean;
    language?: 'ko' | 'en';
  } = {}
): Promise<GCodeAnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/gcode/analyze-with-segments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gcode_content: gcodeContent,
      binary_format: options.binaryFormat ?? true,
      language: options.language ?? 'ko',
    }),
  });

  if (!response.ok) {
    throw new Error(`API 호출 실패: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Base64 디코딩 → Float32Array 변환
 */
export function decodeFloat32Array(base64Data: string): Float32Array {
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Float32Array(bytes.buffer);
}
