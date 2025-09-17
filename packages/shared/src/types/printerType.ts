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


