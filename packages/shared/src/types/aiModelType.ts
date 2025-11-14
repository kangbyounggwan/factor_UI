// AI 생성 모델 타입 정의
export type GenerationType = 'text_to_3d' | 'image_to_3d' | 'text_to_image';

export type ModelStatus = 'processing' | 'completed' | 'failed' | 'archived';

export type PrintStatus = 'queued' | 'printing' | 'completed' | 'failed' | 'cancelled';

// AI 워크플로우 단계 상태
export type WorkflowStep = 'modelling' | 'optimization' | 'gcode_generation';

export type WorkflowStepStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ModelDimensions {
  x?: number;
  y?: number;
  z?: number;
}

export interface GenerationMetadata {
  [key: string]: any;
}

export interface PrintSettings {
  layer_height?: number;
  infill?: number;
  support?: boolean;
  bed_temperature?: number;
  nozzle_temperature?: number;
  print_speed?: number;
  [key: string]: any;
}

// AI 생성 모델 테이블 타입
export interface AIGeneratedModel {
  // 기본 정보
  id: string;
  user_id: string;

  // 생성 정보
  generation_type: GenerationType;
  prompt?: string;
  source_image_url?: string;

  // AI 설정
  art_style?: string;
  target_polycount?: number;
  symmetry_mode?: string;

  // 파일 정보
  model_name: string;
  file_format: string;
  storage_path: string;
  download_url?: string;
  file_size?: number;
  thumbnail_url?: string;

  // STL 파일 정보 (추가 포맷)
  stl_storage_path?: string;
  stl_download_url?: string;

  // GCode 파일 정보
  gcode_url?: string;

  // 메타데이터
  model_dimensions?: ModelDimensions;
  generation_metadata?: GenerationMetadata;

  // 상태 및 태그
  status: ModelStatus;
  tags?: string[];
  is_favorite: boolean;
  is_public: boolean;

  // 프린터 연동 통계
  printed_count: number;
  last_printed_at?: string;

  // 시간 정보
  created_at: string;
  updated_at: string;
}

// 모델 출력 이력 테이블 타입
export interface ModelPrintHistory {
  id: string;
  model_id: string;
  printer_id?: string;
  user_id: string;

  // 출력 정보
  print_status: PrintStatus;
  print_settings?: PrintSettings;
  gcode_file_id?: string;

  // 통계
  print_time?: string;
  filament_used?: number;

  // 에러 정보
  error_message?: string;

  // 시간
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

// AI 워크플로우 상태 (클라이언트 사이드에서 사용)
export interface AIWorkflowState {
  model_id: string;
  current_step: WorkflowStep;
  steps: {
    modelling: WorkflowStepStatus;
    optimization: WorkflowStepStatus;
    gcode_generation: WorkflowStepStatus;
  };

  // 각 단계별 결과
  modelling_result?: {
    model_url: string;
    format: string;
  };
  optimization_result?: {
    optimized_url: string;
    format: string;
  };
  gcode_result?: {
    gcode_file_id: string;
    gcode_url: string;
  };

  error?: string;
  updated_at: string;
}

// API 요청/응답 타입들
export interface CreateModelRequest {
  generation_type: GenerationType;
  prompt?: string;
  source_image_url?: string;
  art_style?: string;
  target_polycount?: number;
  symmetry_mode?: string;
  model_name: string;
}

export interface ProcessModellingRequest {
  prompt?: string;
  image?: File | string;
  generation_type: GenerationType;
}

export interface ProcessModellingResponse {
  model_url: string;
  format: string;
  dimensions?: ModelDimensions;
  metadata?: GenerationMetadata;
}

export interface OptimizeModelRequest {
  model_url: string;
  source_format: string;
  target_format?: string;
}

export interface OptimizeModelResponse {
  optimized_url: string;
  format: string;
  file_size?: number;
}

export interface GenerateGcodeRequest {
  model_url: string;
  printer_id: string;
  print_settings?: PrintSettings;
}

export interface GenerateGcodeResponse {
  gcode_file_id: string;
  gcode_url: string;
  estimated_time?: string;
  filament_length?: number;
}

// 사용자 모델 통계
export interface UserModelStats {
  total_models: number;
  total_storage_bytes: number;
  favorite_count: number;
  public_count: number;
  total_prints: number;
}
