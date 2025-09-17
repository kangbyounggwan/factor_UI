// 블루투스 데이터 전송 및 처리 기능 제공

import { bluetoothService } from './bluetoothService';

export interface WiFiNetwork {
  ssid: string;
  security: string;
  signal: number;
  connected: boolean;
}

export interface NetworkConfig {
  wifi: {
    ssid: string;
    password: string;
    dhcp: boolean;
    staticIP?: string;
    gateway?: string;
    dns?: string;
  };
  ethernet: {
    dhcp: boolean;
    staticIP?: string;
    gateway?: string;
    dns?: string;
  };
}

function isOk(res: any): boolean {
  if (!res || typeof res !== 'object') return false;
  if (typeof (res as any).ok === 'boolean') return Boolean((res as any).ok);
  if ((res as any).status === 'SUCCESS') return true;
  const d = (res as any).data;
  if (d && typeof d === 'object') {
    if (typeof d.ok === 'boolean') return Boolean(d.ok);
    if ((d as any).status === 'SUCCESS') return true;
  }
  return false;
}

class NetworkConfigService {
  async scanWiFiNetworks(): Promise<WiFiNetwork[]> {
    try {
      const result = await bluetoothService.sendJsonCommandInChunks('wifi_scan', {}, 20000, 20);
      let list: any[] = [];
      if (Array.isArray(result)) list = result;
      else if (result && typeof result === 'object') {
        const obj: any = result;
        if (Array.isArray(obj.networks)) list = obj.networks;
        else if (obj.type === 'wifi_scan_result' && Array.isArray(obj.data)) list = obj.data;
      }
      return list.map((n: any) => ({
        ssid: n?.ssid ?? '',
        security: n?.security ?? 'UNKNOWN',
        signal: (typeof n?.signal === 'number' ? n.signal : (typeof n?.rssi === 'number' ? n.rssi : -100)),
        connected: Boolean(n?.connected),
      } as WiFiNetwork));
    } catch (error) {
      console.error('WiFi 스캔 실패:', error);
      return [];
    }
  }

  async connectToWiFi(ssid: string, password: string): Promise<boolean> {
    try {
      const res = await bluetoothService.sendJsonCommandInChunks('wifi_register', { ssid, password }, 15000, 20);
      return isOk(res);
    } catch (error) {
      console.error('WiFi 연결 실패:', error);
      return false;
    }
  }

  async setStaticIP(config: {
    networkInterface: 'wifi' | 'ethernet';
    ip: string;
    gateway: string;
    dns: string;
  }): Promise<boolean> {
    try {
      const res = await bluetoothService.sendJsonCommandInChunks('set_static_ip', config, 15000, 20);
      return isOk(res);
    } catch (error) {
      console.error('고정 IP 설정 실패:', error);
      return false;
    }
  }

  async enableDHCP(networkInterface: 'wifi' | 'ethernet'): Promise<boolean> {
    try {
      const res = await bluetoothService.sendJsonCommandInChunks('enable_dhcp', { networkInterface }, 15000, 20);
      return isOk(res);
    } catch (error) {
      console.error('DHCP 활성화 실패:', error);
      return false;
    }
  }

  async getNetworkStatus(): Promise<{ wifi: any; ethernet: any } | null> {
    try {
      const res = await bluetoothService.sendJsonCommandInChunks('get_network_status', {}, 15000, 20);
      if (!res || typeof res !== 'object') return null;
      const obj: any = res;
      if (obj.type === 'get_network_status_result' && obj.data) return obj.data;
      return (obj.data ?? obj) ?? null;
    } catch (error) {
      console.error('네트워크 상태 조회 실패:', error);
      return null;
    }
  }

  async restartNetworking(): Promise<boolean> {
    try {
      const res = await bluetoothService.sendJsonCommandInChunks('restart_networking', {}, 15000, 20);
      return isOk(res);
    } catch (error) {
      console.error('네트워킹 재시작 실패:', error);
      return false;
    }
  }
}

export const networkConfigService = new NetworkConfigService();