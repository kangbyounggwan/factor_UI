export type TemperatureInfo = {
  tool: { current: number; target: number } | Record<string, { current: number; target: number }>;
  bed: { current: number; target: number };
};

export type Progress = {
  completion: number;
  file_position?: number;
  file_size?: number;
  print_time?: number;
  print_time_left?: number;
  filament_used?: number;
};

// Legacy/호환 타입 (웹/모바일 훅 등에서 사용 중)
export type PrinterStatus = {
  status: 'connected' | 'disconnected' | 'printing' | 'error';
  connected: boolean;
  printing: boolean;
  error_message: string | null;
};

export type TemperatureData = {
  tool: { current: number; target: number };
  bed: { current: number; target: number };
};

export type PositionData = { x: number; y: number; z: number; e: number };

export type PrintProgressData = {
  completion: number;
  file_position: number;
  file_size: number;
  print_time: number;
  print_time_left: number;
  filament_used: number;
};

// 프린터 상세 상태 타입 (OctoPrint 기반)
export type PrinterState =
  | 'idle'           // 대기 중 (operational, ready)
  | 'printing'       // 출력 중
  | 'paused'         // 일시정지
  | 'error'          // 오류
  | 'connecting'     // 연결 중
  | 'disconnected'   // 연결 끊김
  | 'disconnect'     // 연결 끊김 (legacy)
  | 'operational';   // 작동 가능 (idle과 동일)

// 프린터 상태 플래그
export interface PrinterStateFlags {
  operational?: boolean;  // 작동 가능
  ready?: boolean;        // 준비 완료
  printing?: boolean;     // 출력 중
  paused?: boolean;       // 일시정지
  error?: boolean;        // 오류
  pausing?: boolean;      // 일시정지 중
  cancelling?: boolean;   // 취소 중
  closedOrError?: boolean; // 연결 끊김 또는 오류
}

// 프린터 상태 정보 (라벨 + 스타일)
export interface PrinterStatusInfo {
  label: string;
  badgeClass: string;
}

export interface Printer {
  id: string;
  created_at: string;
  name: string;
  model: string;
  status: string;
  user_id: string;
  metadata?: any;
  location?: string;
  description?: string;
  ip_address?: string;
  image_url?: string;
}

