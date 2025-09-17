import { bluetoothService } from './bluetoothService';

// 설비정보 타입 정의
export interface EquipmentInfo {
  equipment: {
    printer: PrinterInfo;
    camera: CameraInfo;
    software: SoftwareInfo;
  };
  _raw?: EquipmentInfoEnvelope;
}

export interface EquipmentInfoEnvelope {
  opId?: string;
  deviceId?: string;     // BLE MAC
  device_id?: string;    // 혹시 다른 표기
  totalLen?: number;
  type?: string;         // "get_equipment_info_result" 등
  preview?: string;
}

export interface PrinterInfo {
  uuid?: string;
  status: boolean;
  model: string;
  firmware: string;
  serial_port: string;
  baud_rate: number;
  message?: string;
}

export interface CameraInfo {
  status: boolean;
  model: string;
  resolution: string;
  fps: number;
  stream_url: string;
  message?: string;
}

export interface SystemInfo {
  platform: string;
  python_version: string;
  uptime: number;
}

export interface SoftwareInfo {
  firmware_version: string;
  api_version: string;
  last_update: string;
  update_available: boolean;
  system?: SystemInfo;
}

class EquipmentService {
  /**
   * 설비정보 조회
   */
  async getEquipmentInfo(): Promise<EquipmentInfo | null> {
    try {
      // EquipmentSettingsChar UUID를 사용하여 설비정보 요청
      const res = await bluetoothService.sendJsonCommandInChunks('get_equipment_info', {}, 15000, 20, 'equipment');
      if (!res || typeof res !== 'object') return null;
      const obj: any = res;
      // 원본(obj)과 data 모두를 보존: 기존 코드 호환을 위해 data를 평탄화하고 _raw에 원본 보관
      if (obj?.data && typeof obj.data === 'object') {
        return { ...obj.data, _raw: obj } as any;
      }
      return obj ?? null;
    } catch (error) {
      console.error('설비정보 조회 실패:', error);
      return null;
    }
  }

  /**
   * 프린터 상태 조회
   */
  async getPrinterStatus(): Promise<PrinterInfo | null> {
    try {
      const equipmentInfo = await this.getEquipmentInfo();
      return equipmentInfo?.equipment?.printer ?? null;
    } catch (error) {
      console.error('프린터 상태 조회 실패:', error);
      return null;
    }
  }

  /**
   * 카메라 상태 조회
   */
  async getCameraStatus(): Promise<CameraInfo | null> {
    try {
      const equipmentInfo = await this.getEquipmentInfo();
      return equipmentInfo?.equipment?.camera ?? null;
    } catch (error) {
      console.error('카메라 상태 조회 실패:', error);
      return null;
    }
  }

  /**
   * 소프트웨어 정보 조회
   */
  async getSoftwareInfo(): Promise<SoftwareInfo | null> {
    try {
      const equipmentInfo = await this.getEquipmentInfo();
      return equipmentInfo?.equipment?.software ?? null;
    } catch (error) {
      console.error('소프트웨어 정보 조회 실패:', error);
      return null;
    }
  }
}

export const equipmentService = new EquipmentService();
