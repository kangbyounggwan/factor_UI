/**
 * AI 워크플로우 API 서비스
 * 3단계 프로세스: Modelling → Optimization → G-code Generation
 */

import {
  ProcessModellingRequest,
  ProcessModellingResponse,
  OptimizeModelRequest,
  OptimizeModelResponse,
  GenerateGcodeRequest,
  GenerateGcodeResponse,
} from '../types/aiModelType';

// AI 서버 응답 타입
interface AIServerResponse {
  status: 'ok' | 'error';
  data?: {
    task_id?: string;
    remesh_task_id?: string;
    result_glb_url?: string;
    download_url?: string;
    local_path?: string;
    uploaded_local_path?: string;
    raw?: any;
  };
  error?: string;
  message?: string;
}

// AI 서버 베이스 URL (환경 변수로 설정)
const AI_API_BASE_URL = process.env.NEXT_PUBLIC_AI_API_URL ||
  (typeof window !== 'undefined' && (window as any).VITE_AI_PYTHON_URL) ||
  'http://127.0.0.1:7000';

/**
 * Step 1: 3D 모델 생성 (text/image to 3D)
 * POST /v1/process/modelling
 */
export async function processModelling(
  request: ProcessModellingRequest
): Promise<ProcessModellingResponse> {
  const formData = new FormData();

  if (request.generation_type === 'text_to_3d' && request.prompt) {
    formData.append('prompt', request.prompt);
    formData.append('type', 'text_to_3d');
  } else if (request.generation_type === 'image_to_3d' && request.image) {
    if (request.image instanceof File) {
      formData.append('image', request.image);
    } else {
      formData.append('image_url', request.image);
    }
    formData.append('type', 'image_to_3d');
  } else {
    throw new Error('Invalid request: missing prompt or image');
  }

  const response = await fetch(`${AI_API_BASE_URL}/v1/process/modelling`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`Modelling failed: ${error.message || response.statusText}`);
  }

  const result: AIServerResponse = await response.json();

  // 응답 검증
  if (result.status !== 'ok' || !result.data) {
    throw new Error(`Modelling failed: ${result.error || result.message || 'Unknown error'}`);
  }

  // result_glb_url 또는 download_url 추출
  const modelUrl = result.data.result_glb_url || result.data.download_url;
  if (!modelUrl) {
    throw new Error('Modelling failed: No model URL in response');
  }

  return {
    model_url: modelUrl,
    format: 'glb',
    dimensions: undefined, // 필요시 raw 데이터에서 추출
    metadata: result.data,
  };
}

/**
 * Step 2: 모델 최적화 (Blender로 GLB → STL 변환)
 * POST /v1/process/clean-model
 */
export async function optimizeModel(
  request: OptimizeModelRequest
): Promise<OptimizeModelResponse> {
  const response = await fetch(`${AI_API_BASE_URL}/v1/process/clean-model`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_url: request.model_url,
      source_format: request.source_format,
      target_format: request.target_format || 'stl',
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`Optimization failed: ${error.message || response.statusText}`);
  }

  const data = await response.json();

  return {
    optimized_url: data.optimized_url || data.model_url,
    format: data.format || request.target_format || 'stl',
    file_size: data.file_size,
  };
}

/**
 * Step 3: G-code 생성 (CuraEngine로 STL → G-code)
 * POST /v1/process/generate-gcode
 */
export async function generateGcode(
  request: GenerateGcodeRequest
): Promise<GenerateGcodeResponse> {
  const response = await fetch(`${AI_API_BASE_URL}/v1/process/generate-gcode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_url: request.model_url,
      printer_id: request.printer_id,
      print_settings: request.print_settings,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`G-code generation failed: ${error.message || response.statusText}`);
  }

  const data = await response.json();

  return {
    gcode_file_id: data.gcode_file_id,
    gcode_url: data.gcode_url,
    estimated_time: data.estimated_time,
    filament_length: data.filament_length,
  };
}

/**
 * 전체 워크플로우 실행 (3단계 순차 실행)
 * 각 단계별로 콜백 함수를 호출하여 진행 상황을 업데이트할 수 있음
 */
export async function runCompleteWorkflow(
  initialRequest: ProcessModellingRequest & { printer_id: string },
  callbacks?: {
    onModellingComplete?: (result: ProcessModellingResponse) => void;
    onOptimizationStart?: () => void;
    onOptimizationComplete?: (result: OptimizeModelResponse) => void;
    onGcodeGenerationStart?: () => void;
    onGcodeGenerationComplete?: (result: GenerateGcodeResponse) => void;
    onError?: (error: Error, step: 'modelling' | 'optimization' | 'gcode') => void;
  }
) {
  try {
    // Step 1: 3D 모델 생성
    const modellingResult = await processModelling({
      generation_type: initialRequest.generation_type,
      prompt: initialRequest.prompt,
      image: initialRequest.image,
    });

    callbacks?.onModellingComplete?.(modellingResult);

    // Step 2: 모델 최적화
    callbacks?.onOptimizationStart?.();

    const optimizationResult = await optimizeModel({
      model_url: modellingResult.model_url,
      source_format: modellingResult.format,
      target_format: 'stl',
    });

    callbacks?.onOptimizationComplete?.(optimizationResult);

    // Step 3: G-code 생성
    callbacks?.onGcodeGenerationStart?.();

    const gcodeResult = await generateGcode({
      model_url: optimizationResult.optimized_url,
      printer_id: initialRequest.printer_id,
      print_settings: {
        // 기본 설정 (사용자가 커스터마이즈 가능)
        layer_height: 0.2,
        infill: 20,
        support: true,
      },
    });

    callbacks?.onGcodeGenerationComplete?.(gcodeResult);

    return {
      modelling: modellingResult,
      optimization: optimizationResult,
      gcode: gcodeResult,
    };
  } catch (error) {
    // 에러 발생 시 어느 단계에서 발생했는지 파악
    if (error instanceof Error) {
      const step = error.message.includes('Modelling')
        ? 'modelling'
        : error.message.includes('Optimization')
        ? 'optimization'
        : 'gcode';

      callbacks?.onError?.(error, step);
    }

    throw error;
  }
}

/**
 * 워크플로우 상태 폴링 (선택적 - 서버에서 비동기 처리하는 경우)
 */
export async function checkWorkflowStatus(workflowId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  current_step: 'modelling' | 'optimization' | 'gcode_generation';
  progress: number;
  result?: any;
  error?: string;
}> {
  const response = await fetch(`${AI_API_BASE_URL}/v1/workflow/${workflowId}/status`);

  if (!response.ok) {
    throw new Error('Failed to check workflow status');
  }

  return response.json();
}
