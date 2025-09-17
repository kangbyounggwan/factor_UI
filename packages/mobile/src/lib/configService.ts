import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { bluetoothService } from './bluetoothService';

export interface PrinterConfig {
  name: string;
  type: string;
  port: string;
  baudrate: number;
  dimensions: {
    x: number;
    y: number;
    z: number;
  };
  extruder: {
    count: number;
    hotend_temp_max: number;
    bed_temp_max: number;
  };
  features: {
    auto_leveling: boolean;
    filament_sensor: boolean;
    power_recovery: boolean;
  };
}

export interface SystemConfig {
  network: {
    hostname: string;
    wifi_country: string;
  };
  octoprint: {
    port: number;
    api_key: string;
  };
  camera: {
    enabled: boolean;
    resolution: string;
    framerate: number;
  };
  printer: PrinterConfig;
}

class ConfigService {
  private configPath = 'printer_config.json';

  async loadConfig(): Promise<SystemConfig | null> {
    try {
      // 먼저 로컬 파일에서 시도
      const localConfig = await this.loadLocalConfig();
      if (localConfig) {
        return localConfig;
      }

      // 로컬에 없으면 라즈베리파이에서 가져오기
      return await this.loadRemoteConfig();
    } catch (error) {
      console.error('설정 로드 실패:', error);
      return null;
    }
  }

  async saveConfig(config: SystemConfig): Promise<boolean> {
    try {
      // 로컬에 저장
      const saved = await this.saveLocalConfig(config);
      
      // 라즈베리파이에도 전송
      if (saved && bluetoothService.isConnected()) {
        await this.saveRemoteConfig(config);
      }
      
      return saved;
    } catch (error) {
      console.error('설정 저장 실패:', error);
      return false;
    }
  }

  private async loadLocalConfig(): Promise<SystemConfig | null> {
    try {
      const result = await Filesystem.readFile({
        path: this.configPath,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      });
      
      return JSON.parse(result.data as string);
    } catch (error) {
      console.log('로컬 설정 파일이 없습니다');
      return null;
    }
  }

  private async saveLocalConfig(config: SystemConfig): Promise<boolean> {
    try {
      await Filesystem.writeFile({
        path: this.configPath,
        data: JSON.stringify(config, null, 2),
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      });
      
      return true;
    } catch (error) {
      console.error('로컬 설정 저장 실패:', error);
      return false;
    }
  }

  private async loadRemoteConfig(): Promise<SystemConfig | null> {
    try {
      const response = await bluetoothService.sendCommand('GET_CONFIG');
      if (response) {
        return JSON.parse(response);
      }
      return null;
    } catch (error) {
      console.error('원격 설정 로드 실패:', error);
      return null;
    }
  }

  private async saveRemoteConfig(config: SystemConfig): Promise<boolean> {
    try {
      const command = `SET_CONFIG:${JSON.stringify(config)}`;
      const response = await bluetoothService.sendCommand(command);
      return response === 'SUCCESS';
    } catch (error) {
      console.error('원격 설정 저장 실패:', error);
      return false;
    }
  }

  async getDefaultConfig(): Promise<SystemConfig> {
    return {
      network: {
        hostname: 'printverse-pi',
        wifi_country: 'KR'
      },
      octoprint: {
        port: 5000,
        api_key: ''
      },
      camera: {
        enabled: true,
        resolution: '1280x720',
        framerate: 30
      },
      printer: {
        name: '3D Printer',
        type: 'Generic RepRap',
        port: '/dev/ttyUSB0',
        baudrate: 115200,
        dimensions: {
          x: 220,
          y: 220,
          z: 250
        },
        extruder: {
          count: 1,
          hotend_temp_max: 260,
          bed_temp_max: 80
        },
        features: {
          auto_leveling: false,
          filament_sensor: false,
          power_recovery: false
        }
      }
    };
  }

  async resetConfig(): Promise<boolean> {
    const defaultConfig = await this.getDefaultConfig();
    return await this.saveConfig(defaultConfig);
  }

  async exportConfig(): Promise<string | null> {
    try {
      const config = await this.loadConfig();
      if (config) {
        return JSON.stringify(config, null, 2);
      }
      return null;
    } catch (error) {
      console.error('설정 내보내기 실패:', error);
      return null;
    }
  }

  async importConfig(configJson: string): Promise<boolean> {
    try {
      const config = JSON.parse(configJson) as SystemConfig;
      return await this.saveConfig(config);
    } catch (error) {
      console.error('설정 가져오기 실패:', error);
      return false;
    }
  }
}

export const configService = new ConfigService();