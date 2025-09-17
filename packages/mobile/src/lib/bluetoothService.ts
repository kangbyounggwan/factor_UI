// 블루투스 연결관리 및 서비스 포멧 제공 기능 제공



import { BleClient, BleDevice, numbersToDataView, dataViewToNumbers } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';

export interface RaspberryPiDevice {
  deviceId: string;
  name?: string;
  rssi?: number;
  connected: boolean;
}

// 마지막 연결 장치 저장 키
const LAST_DEVICE_ID_KEY = 'ble:lastDeviceId';



class BluetoothService {
  private connectedDevice: BleDevice | null = null;
  private isScanning = false;
  private overrideServiceUUID?: string;
  private overrideWifiRegisterCharUUID?: string;
  private overrideEquipmentSettingsCharUUID?: string;
  private lastDiscoveredDevices: Map<string, RaspberryPiDevice> = new Map();
  private hasInitialized = false;
  private initializingPromise: Promise<void> | null = null;
  private uuidsResolved = false;
  private uuidsResolvingPromise: Promise<void> | null = null;
  private inflightLocks: Map<string, Promise<void>> = new Map();

  private async withOperationLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.inflightLocks.get(key) || Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((r) => (release = r));
    this.inflightLocks.set(key, prev.then(() => next));
    try {
      await prev;
      return await fn();
    } finally {
      release();
      // 清理: 현재 next가 완료되면 키를 제거 (짧은 지연으로 체인 해제)
      setTimeout(() => {
        if (this.inflightLocks.get(key) === next) this.inflightLocks.delete(key);
      }, 0);
    }
  }

  // ----- 공통 헬퍼 -----
  private async sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
  private withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms)),
    ]);
  }

  private async waitUntilBleReady(deviceId: string, timeoutMs: number = 15000): Promise<boolean> {
    const getServicesFn = (BleClient as any).getServices?.bind(BleClient);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        if (getServicesFn) {
          const gatt = await getServicesFn(deviceId);
          // 로그는 최초 1회 정도만 찍히도록 필요 시 조정 가능
          if (Array.isArray(gatt) && gatt.length > 0) {
            // 자동 UUID 추정 시도
            await this.autoResolveUuidsFromGatt(deviceId);
          }
        }
      } catch {}
      // 준비 완료 조건: 서비스와 Wi‑Fi 특성 UUID가 식별됨
      if (this.overrideServiceUUID && this.overrideWifiRegisterCharUUID) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    return false;
  }

  /**
   * 연결/본딩 상태 초기화(가장 중요):
   * - 연결돼 있으면 disconnect
   * - removeBond/unbond API가 존재하면 본딩(페어링) 해제 시도
   */
  async resetBondAndConnection(deviceId: string): Promise<void> {
    try {
      try { await BleClient.disconnect(deviceId); } catch {}
      const anyApi = BleClient as unknown as Record<string, (args?: any) => Promise<any>>;
      if (typeof anyApi.removeBond === 'function') {
        await anyApi.removeBond({ deviceId });
      } else if (typeof anyApi.unbond === 'function') {
        await anyApi.unbond({ deviceId });
      } else {
        // 플러그인 구현이 없을 수 있음
        console.info('[BLE] removeBond/unbond 미탑재: 스킵');
      }
    } catch (e) {
      console.warn('resetBondAndConnection 실패:', e);
    }
  }

  private async ensureDeviceDiscovered(targetId: string, scanWindowMs: number = 3000): Promise<boolean> {
    if (this.lastDiscoveredDevices.has(targetId)) return true;
    let seen = false;
    try {
      await BleClient.requestLEScan({ services: [] }, (result) => {
        const id = result?.device?.deviceId;
        if (!id) return;
        const device: RaspberryPiDevice = {
          deviceId: id,
          name: result.device.name || 'Unknown Device',
          rssi: result.rssi,
          connected: false,
        };
        this.lastDiscoveredDevices.set(id, device);
        if (id === targetId) seen = true;
      });
      await new Promise((r) => setTimeout(r, scanWindowMs));
    } catch {}
    try { await BleClient.stopLEScan(); } catch {}
    return seen || this.lastDiscoveredDevices.has(targetId);
  }

  private async ensureAdapterEnabled(): Promise<void> {
    try {
      const isEnabledFn = (BleClient as any).isEnabled?.bind(BleClient);
      const enableFn = (BleClient as any).enableBluetooth?.bind(BleClient);
      if (isEnabledFn) {
        const enabled = await isEnabledFn();
        if (!enabled && enableFn) {
          await enableFn();
        }
      }
    } catch {}
  }

  private async ensureScanPermissionWithPrompt(): Promise<void> {
    try {
      await BleClient.requestLEScan({ services: [] }, () => {});
      await new Promise((r) => setTimeout(r, 200));
    } finally {
      try { await BleClient.stopLEScan(); } catch {}
    }
  }

  private async ensurePermissions(): Promise<void> {
    try {
      const check = (BleClient as any).checkPermissions?.bind(BleClient);
      const request = (BleClient as any).requestPermissions?.bind(BleClient);
      if (check && request) {
        const current = await check();
        const need = ['location','bluetooth','bluetoothScan','bluetoothConnect']
          .filter((k) => (current?.[k] ?? 'prompt') !== 'granted');
        if (need.length > 0) {
          const res = await request();
          const remain = ['location','bluetooth','bluetoothScan','bluetoothConnect']
            .filter((k) => (res?.[k] ?? 'prompt') !== 'granted');
          if (remain.length > 0) {
            throw new Error('BLE_PERMISSION_DENIED');
          }
        }
        return;
      }
    } catch {}
    await this.ensureScanPermissionWithPrompt();
  }

  async initialize(): Promise<void> {
    if (this.hasInitialized) {
      console.log('블루투스 이미 초기화됨');
      return;
    }
    if (this.initializingPromise) {
      await this.initializingPromise;
      return;
    }
    this.initializingPromise = (async () => {
      try {
        if (Capacitor.getPlatform() !== 'android') {
          throw new Error('이 기능은 Android에서만 지원됩니다');
        }
        await BleClient.initialize();
        await this.ensureAdapterEnabled();
        await this.ensurePermissions();

        this.hasInitialized = true;
        console.log('블루투스 초기화 완료');
      } catch (error) {
        console.error('블루투스 초기화 실패:', error);
        throw error;
      } finally {
        this.initializingPromise = null;
      }
    })();
    await this.initializingPromise;
  }

  // 권한은 initialize() 또는 앱 레벨에서 일괄 처리

  async scanForDevices(onDeviceFound: (device: RaspberryPiDevice) => void): Promise<void> {
    if (this.isScanning) {
      console.log('이미 스캔 중입니다');
      return;
    }

    try {
      this.isScanning = true;
      
      await BleClient.requestLEScan(
        {
          services: [], // 모든 장치 스캔
        },
        (result) => {
          const device: RaspberryPiDevice = {
            deviceId: result.device.deviceId,
            name: result.device.name,
            rssi: result.rssi,
            connected: false
          };

          // 최근 발견 장치 캐시 업데이트
          this.lastDiscoveredDevices.set(device.deviceId, device);

          // 이름이 없는 디바이스는 목록에 표기하지 않음
          if (!device.name || String(device.name).trim().length === 0) {
            return;
          }

          onDeviceFound(device);
        }
      );

      // 10초 후 스캔 중지
      setTimeout(() => {
        this.stopScanning();
      }, 10000);

    } catch (error) {
      console.error('장치 스캔 실패:', error);
      this.isScanning = false;
      throw error;
    }
  }

  /**
   * 스캔 전 본딩/캐시 정리 포함 스캔(이름 없는 장치 제외)
   * - knownDeviceId 제공 시 우선 resetBondAndConnection 수행
   * - scanWindow 기본 10초
   */
  async scanWithReset(params: { knownDeviceId?: string; services?: string[]; scanWindowMs?: number; onDeviceFound: (device: RaspberryPiDevice) => void; }): Promise<void> {
    const { knownDeviceId, services = [], scanWindowMs = 10000, onDeviceFound } = params;
    try {
      if (knownDeviceId) {
        await this.resetBondAndConnection(knownDeviceId);
      }
    } catch {}

    if (this.isScanning) {
      try { await BleClient.stopLEScan(); } catch {}
      this.isScanning = false;
    }

    this.isScanning = true;
    try {
      await BleClient.requestLEScan({ services }, (result) => {
        const id = result?.device?.deviceId;
        const name = result?.device?.name ?? 'Unknown Device';
        if (!id || !name || String(name).trim().length === 0) return; // 이름 없는 장치는 제외
        const device: RaspberryPiDevice = { deviceId: id, name, rssi: result.rssi, connected: false };
        this.lastDiscoveredDevices.set(id, device);
        onDeviceFound(device);
      });
      await this.sleep(scanWindowMs);
    } finally {
      try { await BleClient.stopLEScan(); } catch {}
      this.isScanning = false;
    }
  }

  // 현재 연결된 장치 카드 정보 반환 (없으면 null)
  getConnectedDeviceCard(): RaspberryPiDevice | null {
    const deviceId = this.getConnectedDeviceId();
    if (!deviceId) return null;
    const cached = this.lastDiscoveredDevices.get(deviceId);
    return {
      deviceId,
      name: cached?.name || 'Unknown Device',
      rssi: cached?.rssi,
      connected: true,
    };
  }

  // UI에서 직접 disconnect 후 필요 시 scanForDevices 호출 권장

  async stopScanning(): Promise<void> {
    if (this.isScanning) {
      await BleClient.stopLEScan();
      this.isScanning = false;
      console.log('스캔 중지됨');
    }
  }

  async connectToDevice(deviceId: string, opts?: { connectMs?: number; servicesMs?: number; settleMs?: number }): Promise<boolean> {
    try {
      // 반드시 BLE 스캔으로 확인된 장치에만 연결 허용
      const discovered = await this.ensureDeviceDiscovered(deviceId, 2500);
      if (!discovered) {
        console.warn('BLE 스캔에서 확인되지 않은 장치입니다. 연결을 중단합니다:', deviceId);
        return false;
      }
      const connectMs = opts?.connectMs ?? 15000;
      const servicesMs = opts?.servicesMs ?? 15000;
      const settleMs = opts?.settleMs ?? 500;

      // 연결에 타임아웃 적용
      try {
        await this.withTimeout(BleClient.connect(deviceId), connectMs, 'connect');
      } catch (e) {
        try { await BleClient.disconnect(deviceId); } catch {}
        throw e;
      }
      this.connectedDevice = { deviceId } as BleDevice;
      console.log('장치 연결 성공:', deviceId);
      // 예기치 않은 GATT 끊김 리스너 등록
      try {
        const onDisconnected = (BleClient as any).onDisconnected?.bind(BleClient);
        if (onDisconnected) {
          onDisconnected(deviceId, () => {
            console.warn('[BLE] onDisconnected:', deviceId);
            this.connectedDevice = null;
            this.uuidsResolved = false;
            this.uuidsResolvingPromise = null;
            try {
              window.dispatchEvent(new CustomEvent('ble:disconnected', { detail: { deviceId } }));
            } catch {}
          });
        }
      } catch (e) {
        console.warn('onDisconnected 등록 실패:', e);
      }
      try { localStorage.setItem(LAST_DEVICE_ID_KEY, deviceId); } catch {}
      // 연결 직후 안정화 대기
      await this.sleep(settleMs);

      // GATT 서비스/특성 구조 로그 및 준비 대기
      try {
        const getServicesFn = (BleClient as any).getServices?.bind(BleClient);
        if (getServicesFn) {
          const gatt = await this.withTimeout(getServicesFn(deviceId), servicesMs, 'getServices');
          const list: any[] = Array.isArray(gatt) ? (gatt as any[]) : [];
          const summary = list.map((s: any) => ({
            service: s?.uuid,
            characteristics: (s?.characteristics || []).map((c: any) => c?.uuid)
          }));
          console.log('[BLE GATT] services:', JSON.stringify(summary));
        } else {
          console.warn('GATT 나열 실패: BleClient.getServices 미구현');
        }
      } catch (e) {
        console.warn('GATT 나열 실패 (플러그인 구현 여부 확인 필요):', e);
      }
      // 커스텀 서비스/특성 준비될 때까지 최대 대기 (페어링/본딩 진행 시간 포함)
      const ready = await this.waitUntilBleReady(deviceId, Math.max(servicesMs, 15000));
      if (ready) {
        this.uuidsResolved = true;
        try {
          window.dispatchEvent(new CustomEvent('ble:connected', { detail: { deviceId } }));
        } catch {}
        return true;
      }
      console.warn('BLE 준비 미완료: 커스텀 서비스/특성 UUID를 확인하지 못했습니다.');
      return false;
    } catch (error) {
      console.error('장치 연결 실패:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connectedDevice) {
      try {
        await BleClient.disconnect(this.connectedDevice.deviceId);
        try {
          window.dispatchEvent(new CustomEvent('ble:disconnected', { detail: { deviceId: this.connectedDevice.deviceId } }));
        } catch {}
        this.connectedDevice = null;
        console.log('장치 연결 해제됨');
        try { localStorage.removeItem(LAST_DEVICE_ID_KEY); } catch {}
        this.uuidsResolved = false;
        this.uuidsResolvingPromise = null;
      } catch (error) {
        console.error('연결 해제 실패:', error);
      }
    }
  }

  // 앱 재진입/탭 전환 시 마지막 연결 장치로 자동 복원 시도
  async restoreLastConnection(): Promise<boolean> {
    try {
      if (this.connectedDevice) return true;
      const lastId = localStorage.getItem(LAST_DEVICE_ID_KEY);
      if (!lastId) return false;
      console.log('이전 연결 복원 시도:', lastId);
      // BLE 광고로 실제 발견된 경우에만 복원 허용 (클래식 접속 내역/시스템 목록 차단)
      const seenNow = await this.ensureDeviceDiscovered(lastId, 2000);
      if (!seenNow) {
        console.warn('복원 차단: 현재 BLE 광고에서 장치를 확인하지 못했습니다.');
        return false;
      }
      // 1) 네이티브에서 이미 연결 상태인지 먼저 확인 후 인계
      try {
        const isConnectedFn = (BleClient as any).isConnected?.bind(BleClient);
        if (isConnectedFn) {
          const already = await isConnectedFn(lastId);
          if (already) {
            this.connectedDevice = { deviceId: lastId } as BleDevice;
            try { window.dispatchEvent(new CustomEvent('ble:connected', { detail: { deviceId: lastId } })); } catch {}
            console.log('기존 네이티브 연결 인계 성공:', lastId);
            // 연결 인계 후 GATT/UUID 자동 추정
            try { await this.autoResolveUuidsFromGatt(lastId); } catch {}
            return true;
          }
        }
      } catch (e) {
        console.warn('기존 연결 확인 실패(isConnected):', e);
      }
      // 2) 기존 연결이 아니면 일반 연결 시도
      return await this.connectToDevice(lastId);
    } catch (e) {
      console.warn('이전 연결 복원 실패:', e);
      return false;
    }
  }

  // ----- 공통 유틸 -----
  private ensureConnectedDeviceId(): string {
    if (!this.connectedDevice) {
      throw new Error('연결된 장치가 없습니다');
    }
    return this.connectedDevice.deviceId;
  }

  // 런타임 UUID 오버라이드 설정 (디버그/수동 지정용)
  setUuids(overrides: {
    serviceUUID?: string;
    wifiRegisterCharUUID?: string;
    equipmentSettingsCharUUID?: string;
  }): void {
    if (overrides.serviceUUID) this.overrideServiceUUID = overrides.serviceUUID;
    if (overrides.wifiRegisterCharUUID) this.overrideWifiRegisterCharUUID = overrides.wifiRegisterCharUUID;
    if (overrides.equipmentSettingsCharUUID) this.overrideEquipmentSettingsCharUUID = overrides.equipmentSettingsCharUUID;
    console.log('[BLE UUID OVERRIDE]', {
      serviceUUID: this.overrideServiceUUID,
      wifiRegisterCharUUID: this.overrideWifiRegisterCharUUID,
      equipmentSettingsCharUUID: this.overrideEquipmentSettingsCharUUID,
    });
  }

  // 128-bit 커스텀 UUID 판별 (표준 16-bit base 0000xxxx-... 제외)
  private isCustom128Uuid(uuid: string | undefined | null): boolean {
    if (!uuid) return false;
    const u = String(uuid).toLowerCase();
    return u.includes('-') && !u.startsWith('0000');
  }

  // 연결 후 서비스 목록에서 목표 서비스/특성을 매칭하고 오버라이드에 반영
  // 서비스/특성 매칭 후 오버라이드 반영 (수동 고정이 필요할 때만 호출)
  async matchAndSetCustomUuids(params: {
    serviceUUID: string;
    wifiRegisterCharUUID?: string;
    equipmentSettingsCharUUID?: string;
  }): Promise<{ ok: boolean; message?: string; matched?: { serviceUUID: string; wifiRegisterCharUUID?: string; equipmentSettingsCharUUID?: string } }> {
    const deviceId = this.getConnectedDeviceId();
    if (!deviceId) return { ok: false, message: '연결된 장치가 없습니다' };

    try {
      const getServicesFn = (BleClient as any).getServices?.bind(BleClient);
      if (!getServicesFn) return { ok: false, message: 'getServices 미구현' };

      const services = await getServicesFn(deviceId);
      const summarized = (services || []).map((s: any) => ({
        service: s?.uuid,
        characteristics: (s?.characteristics || []).map((c: any) => c?.uuid)
      }));
      console.log('[GATT services]', JSON.stringify(summarized));

      const targetService = (services || []).find((s: any) =>
        this.isCustom128Uuid(s?.uuid) && String(s?.uuid).toLowerCase() === params.serviceUUID.toLowerCase()
      );
      if (!targetService) {
        return { ok: false, message: '커스텀 서비스가 보이지 않음(서버 GATT 등록 확인 요망)' };
      }

      const allChars: string[] = (targetService.characteristics || [])
        .map((c: any) => String(c?.uuid))
        .filter((u: string) => this.isCustom128Uuid(u));

      const matched: { serviceUUID: string; wifiRegisterCharUUID?: string; equipmentSettingsCharUUID?: string } = {
        serviceUUID: String(targetService.uuid)
      };

      if (params.wifiRegisterCharUUID) {
        matched.wifiRegisterCharUUID = allChars.find(
          (u) => u.toLowerCase() === params.wifiRegisterCharUUID!.toLowerCase()
        );
      }

      if (params.equipmentSettingsCharUUID) {
        matched.equipmentSettingsCharUUID = allChars.find(
          (u) => u.toLowerCase() === params.equipmentSettingsCharUUID!.toLowerCase()
        );
      }

      console.log('[MATCHED]', JSON.stringify(matched));

      // 적용: 서비스는 반드시 설정, 특성은 발견된 경우만 설정
      this.setUuids({
        serviceUUID: matched.serviceUUID,
        wifiRegisterCharUUID: matched.wifiRegisterCharUUID,
        equipmentSettingsCharUUID: matched.equipmentSettingsCharUUID,
      });

      return { ok: true, matched };
    } catch (e) {
      console.error('서비스 매칭 실패:', e);
      return { ok: false, message: '서비스 매칭 실패' };
    }
  }

  private getWifiUuids(): { serviceUUID: string; characteristicUUID: string } {
    const serviceUUID = this.overrideServiceUUID || '';
    const characteristicUUID = this.overrideWifiRegisterCharUUID || '';
    // 표준 서비스/특성(0x1800/0x2A00 등)으로의 쓰기 방지 가드
    const svc = serviceUUID.toLowerCase();
    const chr = characteristicUUID.toLowerCase();
    if (svc.startsWith('00001800') || svc.startsWith('00001801') || chr.startsWith('00002a00')) {
      console.warn('[BLE GUARD] 표준 서비스/특성으로 쓰기 시도 차단:', { serviceUUID, characteristicUUID });
    }
    if (!serviceUUID || !characteristicUUID) {
      throw new Error('UUID 미지정: 서비스/특성 UUID가 아직 준비되지 않았습니다');
    }
    return { serviceUUID, characteristicUUID };
  }

  private getEquipmentUuids(): { serviceUUID: string; characteristicUUID: string } {
    const serviceUUID = this.overrideServiceUUID || '';
    const characteristicUUID = this.overrideEquipmentSettingsCharUUID || '';
    // 표준 서비스/특성(0x1800/0x2A00 등)으로의 쓰기 방지 가드
    const svc = serviceUUID.toLowerCase();
    const chr = characteristicUUID.toLowerCase();
    if (svc.startsWith('00001800') || svc.startsWith('00001801') || chr.startsWith('00002a00')) {
      console.warn('[BLE GUARD] 표준 서비스/특성으로 쓰기 시도 차단:', { serviceUUID, characteristicUUID });
    }
    if (!serviceUUID || !characteristicUUID) {
      throw new Error('UUID 미지정: 서비스/특성 UUID가 아직 준비되지 않았습니다');
    }
    return { serviceUUID, characteristicUUID };
  }



  // 톰캣으로 BLE 전송/수신 로그를 전달 (환경에 맞게 URL 변경)
  private async forwardBleLog(log: {
    direction: 'TX' | 'RX';
    serviceUUID: string;
    characteristicUUID: string;
    payloadText?: string;
    responseText?: string;
    deviceId?: string;
    timestamp: number;
  }): Promise<void> {
    try {
      await fetch('http://localhost:8080/api/ble/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log),
      });
    } catch {}
  }

  private async writeJsonAndRead(serviceUUID: string, characteristicUUID: string, payload: unknown): Promise<unknown> {
    // 유지: 일부 환경에서 read가 허용되는 경우를 대비해 남겨두되,
    // 기본 경로는 notify 기반으로 아래 AndWaitNotify를 사용합니다.
    const deviceId = this.ensureConnectedDeviceId();

    const text = JSON.stringify(payload ?? {});
    const bytes = new TextEncoder().encode(text);

    const svc = serviceUUID.toLowerCase();
    const chr = characteristicUUID.toLowerCase();
    if (svc.startsWith('00001800') || svc.startsWith('00001801') || chr.startsWith('00002a00')) {
      throw new Error('표준 서비스/특성으로 쓰기 차단: ' + serviceUUID + ' / ' + characteristicUUID);
    }

    try {
      console.log('[BLE TX]', JSON.stringify({ deviceId, serviceUUID, characteristicUUID, payload: JSON.parse(text) }));
    } catch {
      console.log('[BLE TX]', JSON.stringify({ deviceId, serviceUUID, characteristicUUID, payloadText: text }));
    }
    this.forwardBleLog({ direction: 'TX', serviceUUID, characteristicUUID, payloadText: text, deviceId, timestamp: Date.now() });

    await BleClient.write(deviceId, serviceUUID, characteristicUUID, numbersToDataView(Array.from(bytes)));

    const response = await BleClient.read(deviceId, serviceUUID, characteristicUUID);
    const responseArray = dataViewToNumbers(response);
    const responseText = new TextDecoder().decode(new Uint8Array(responseArray));

    console.log('[BLE RX]', JSON.stringify({ deviceId, serviceUUID, characteristicUUID, response: responseText }));
    this.forwardBleLog({ direction: 'RX', serviceUUID, characteristicUUID, responseText, deviceId, timestamp: Date.now() });

    try { return JSON.parse(responseText); } catch { return responseText; }
  }

  /**
   * notify 패턴: 알림으로 응답 수신 (구독/조립/파싱)
   */
  private async WaitNotify(serviceUUID: string, characteristicUUID: string, timeoutMs: number = 15000): Promise<unknown> {
    const opId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const deviceId = this.ensureConnectedDeviceId();
    const lockKey = `${deviceId}|${serviceUUID}|${characteristicUUID}`;
    return await this.withOperationLock(lockKey, async () => {
    let resolved = false;
    let lastValue: string | undefined;
    // 바이트 단위 누적 버퍼
    const byteChunks: Uint8Array[] = [];
    let totalLen = 0;
    const stop = async () => {
      try {
        console.log('[BLE JSON STOP]', JSON.stringify({ opId, deviceId, serviceUUID, characteristicUUID }));
        await BleClient.stopNotifications(deviceId, serviceUUID, characteristicUUID);
        console.log('[BLE JSON STOP_OK]', JSON.stringify({ opId, deviceId }));
      } catch (e) {
        console.warn('[BLE JSON STOP_ERR]', JSON.stringify({ opId, deviceId, error: String((e as any)?.message || e) }));
      }
    };

    const waitForNotify = new Promise<unknown>((resolve, reject) => {
      try {
        // MTU 517 시도(지원시)
        try {
          const anyBle = BleClient as unknown as Record<string, any>;
          const reqMtu = anyBle.requestMtu?.bind(BleClient);
          if (reqMtu) {
            (async () => {
              try {
                await reqMtu(deviceId, 517);
                console.log('[BLE MTU]', JSON.stringify({ opId, deviceId, mtu: 517, mode: 'positional' }));
              } catch {
                try {
                  await reqMtu({ deviceId, mtu: 517 });
                  console.log('[BLE MTU]', JSON.stringify({ opId, deviceId, mtu: 517, mode: 'object' }));
                } catch {}
              }
            })();
          }
        } catch {}

        // SUB 로그
        console.log('[BLE JSON SUB]', JSON.stringify({ opId, deviceId, serviceUUID, characteristicUUID }));
        let chunkSeq = 0;
        BleClient.startNotifications(deviceId, serviceUUID, characteristicUUID, (value) => {
          if (resolved) return;
          const arr = dataViewToNumbers(value);
          const chunk = new Uint8Array(arr);

          // 원복: 청크 누적 및 조립
          byteChunks.push(chunk);
          totalLen += chunk.length;
          console.log('[BLE JSON RX]', JSON.stringify({ opId, deviceId, serviceUUID, characteristicUUID, chunkLen: chunk.length, totalLen }));
          // 상세 청크 로깅: HEX/Base64
          try {
            chunkSeq += 1;
            const hex = Array.from(chunk).map((b) => b.toString(16).padStart(2, '0')).join('');
            let base64 = '';
            try {
              base64 = btoa(String.fromCharCode.apply(null, Array.from(chunk)));
            } catch (e) {
              try { console.warn('[ble chunk base64 error]', JSON.stringify({ opId, idx: chunkSeq, error: String((e as any)?.message || e) })); } catch {}
            }
            console.log('[ble chunk]', JSON.stringify({ opId, idx: chunkSeq, len: chunk.length, hex, base64 }));
            // 누적된 모든 청크 요약 로그(조립 전 상태 확인용)
            try {
              const collected = byteChunks.map((c, i) => ({
                idx: i + 1,
                len: c.length,
                hex: Array.from(c.slice(0, 32)).map((b) => b.toString(16).padStart(2, '0')).join('')
              }));
              console.log('[ble chunk]', JSON.stringify({ opId, collectedCount: collected.length, totalLen, collected }));
            } catch (e) {
              try { console.warn('[ble chunk collected log error]', JSON.stringify({ opId, error: String((e as any)?.message || e) })); } catch {}
            }
          } catch (e) {
            try { console.warn('[ble chunk log error]', JSON.stringify({ opId, error: String((e as any)?.message || e) })); } catch {}
          }
          // 미리보기 및 서버 로그 포워딩(성능 위해 최근 청크만 텍스트화)
          try {
            const preview = new TextDecoder().decode(chunk);
            lastValue = preview;
            this.forwardBleLog({ direction: 'RX', serviceUUID, characteristicUUID, responseText: preview, deviceId, timestamp: Date.now() });
          } catch (e) {
            try { console.warn('[BLE JSON preview decode error]', JSON.stringify({ opId, error: String((e as any)?.message || e) })); } catch {}
          }

          // 누적 바이트를 한 번에 디코드하여 완전한 JSON인지 확인
          try {
            const merged = new Uint8Array(totalLen);
            let offset = 0;
            for (const c of byteChunks) { merged.set(c, offset); offset += c.length; }
            const decoded = new TextDecoder().decode(merged);
            const parsed = JSON.parse(decoded);
            // 메타데이터를 포함한 래퍼로 반환
            const envelope = (parsed && typeof parsed === 'object')
              ? {
                  ...(parsed as Record<string, unknown>),
                  opId,
                  deviceId,
                  serviceUUID,
                  characteristicUUID,
                  totalLen,
                  preview: decoded.slice(0, 200),
                }
              : {
                  value: parsed,
                  opId,
                  deviceId,
                  serviceUUID,
                  characteristicUUID,
                  totalLen,
                  preview: decoded.slice(0, 200),
                };
            resolved = true;

            // 최종 JSON 결과 로그 추가
            console.log('[BLE RESULT JSON]', JSON.stringify({
              opId,
              deviceId,
              serviceUUID,
              characteristicUUID,
              totalLen,
              result: envelope
            }));

            try {
              console.log('[BLE JSON RX_OK]', JSON.stringify({
                opId,
                deviceId,
                totalLen,
                type: (parsed as any)?.type,
                data: (parsed as any)?.data,
                preview: decoded.slice(0, 200)
              }));
            } catch {}
            resolve(envelope);
          } catch (e) {
            // 아직 완전하지 않음 → 다음 청크 대기 (부분 JSON)
            try { console.debug('[BLE JSON RX_INCOMPLETE]', JSON.stringify({ opId, totalLen, note: 'awaiting more chunks' })); } catch {}
          }
        }).then(async () => {
          try {
            // CCCD 설정 직후 약간의 안정화 대기 (레이스 방지)
            await this.sleep(500);
            console.log('[BLE JSON SUB_OK]', JSON.stringify({ opId, deviceId, serviceUUID, characteristicUUID }));
          } catch (e) {
            console.error('[BLE JSON SUB_ERR]', JSON.stringify({ opId, deviceId, error: String((e as any)?.message || e) }));
            reject(e);
          }
        }).catch(reject);
      } catch (e) {
        reject(e);
      }
    });

    try {
      const result = await this.withTimeout(waitForNotify, timeoutMs, 'notify');
      return result;
    } finally {
      await stop();
      if (!resolved) {
        console.warn('[BLE JSON TIMEOUT]', JSON.stringify({ opId, deviceId, serviceUUID, characteristicUUID, timeoutMs, lastValue }));
      }
    }
    });
  }

  /**
   * 문자열 명령 전송/응답(레거시 호환). 네트워크 설정 등에서 사용.
   * - 상세 로그: UUID, deviceId, payload, 응답/에러 포함
   */
  private async writeTextAndRead(serviceUUID: string, characteristicUUID: string, text: string): Promise<string> {
    const deviceId = this.ensureConnectedDeviceId();

    // 상세 TX 로그
    console.log('[BLE CMD TX]', JSON.stringify({ deviceId, serviceUUID, characteristicUUID, payloadText: text }));
    this.forwardBleLog({
      direction: 'TX',
      serviceUUID,
      characteristicUUID,
      payloadText: text,
      deviceId,
      timestamp: Date.now(),
    });

    try {
      const bytes = new TextEncoder().encode(text);
      await BleClient.write(
        deviceId,
        serviceUUID,
        characteristicUUID,
        numbersToDataView(Array.from(bytes))
      );

      const response = await BleClient.read(deviceId, serviceUUID, characteristicUUID);
      const responseArray = dataViewToNumbers(response);
      const responseText = new TextDecoder().decode(new Uint8Array(responseArray));

      // 상세 RX 로그
      console.log('[BLE CMD RX]', JSON.stringify({ deviceId, serviceUUID, characteristicUUID, responseText }));
      this.forwardBleLog({
        direction: 'RX',
        serviceUUID,
        characteristicUUID,
        responseText,
        deviceId,
        timestamp: Date.now(),
      });
      return responseText;
    } catch (error) {
      // 에러 상세 로그(UUID/페이로드 포함)
      console.error('[BLE CMD ERROR]', JSON.stringify({
        deviceId,
        serviceUUID,
        characteristicUUID,
        payloadText: text,
        error: String((error as any)?.message || error)
      }));
      throw error;
    }
  }


  /**
   * 청크 단위로 JSON 명령 전송 (대용량 데이터용)
   */
  async sendJsonCommandInChunks(type: string, data: unknown = {}, timeoutMs: number = 15000, chunkSize: number = 512, uuidType: 'wifi' | 'equipment' = 'wifi'): Promise<unknown> {
    await this.ensureUuidsResolved();
    const deviceId = this.getConnectedDeviceId();
    if (!deviceId) throw new Error('연결된 장치가 없습니다');
    const { serviceUUID, characteristicUUID } = uuidType === 'equipment' ? this.getEquipmentUuids() : this.getWifiUuids();
    
    const payload = { type, data, timestamp: Date.now() };
    const jsonString = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(jsonString);
    
    console.log('[BLE CHUNK START]', JSON.stringify({
      deviceId,
      serviceUUID,
      characteristicUUID,
      totalBytes: bytes.length,
      chunkSize,
      totalChunks: Math.ceil(bytes.length / chunkSize)
    }));

    // 청크로 분할
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < bytes.length; i += chunkSize) {
      chunks.push(bytes.slice(i, i + chunkSize));
    }

    // 청크 전송
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isLastChunk = i === chunks.length - 1;
      
      try {
        await BleClient.writeWithoutResponse(
          deviceId,
          serviceUUID,
          characteristicUUID,
          numbersToDataView(Array.from(chunk)),
          { timeout: timeoutMs }
        );
        
        console.log('[BLE CHUNK SENT]', JSON.stringify({
          chunkIndex: i + 1,
          totalChunks: chunks.length,
          chunkSize: chunk.length,
          isLastChunk
        }));
        
        // 마지막 청크가 아니면 약간의 지연
        if (!isLastChunk) {
          await this.sleep(50); // 50ms 지연
        }
      } catch (error) {
        console.error('[BLE CHUNK ERROR]', JSON.stringify({
          chunkIndex: i + 1,
          error: String((error as any)?.message || error)
        }));
        throw error;
      }
    }

    // 기존의 WaitNotify 함수를 활용하여 응답 대기
    // (청크 조립 로직은 이미 구현되어 있음)
    return await this.WaitNotify(serviceUUID, characteristicUUID, timeoutMs);
  }



  // 연결된 장치의 GATT로부터 서비스/특성 UUID를 자동 추정(선택)
  private async autoResolveUuidsFromGatt(deviceId: string): Promise<void> {
    try {
      const getServicesFn = (BleClient as any).getServices?.bind(BleClient);
      if (!getServicesFn) return;
      const services = await getServicesFn(deviceId);
      if (!services || services.length === 0) return;

      const isStandardService = (uuid: string): boolean => {
        const u = uuid.toLowerCase();
        // Bluetooth SIG 16-bit Assigned Numbers use the 0000xxxx-0000-1000-8000-00805f9b34fb base
        return u.startsWith('0000');
      };

      // 1) 128-bit(커스텀) 서비스 중 표준(0x1800/0x1801 등) 제외하여 선택
      let pickedService: any = undefined;
      const customServices = services.filter((s: any) => {
        const id = String(s?.uuid || '').toLowerCase();
        return id.includes('-') && !isStandardService(id);
      });
      pickedService = customServices[0];

      // 2) 그래도 없으면 모든 서비스 중에서 쓰기 가능한 캐릭터리스틱을 가진 서비스 선택 (표준 제외 우선)
      const getWritableChars = (s: any) => (s?.characteristics || [])
        .filter((c: any) => (c?.properties?.write || c?.properties?.writeWithoutResponse) && !c?.properties?.signedWrite);
      if (!pickedService) {
        const nonStd = services.filter((s: any) => !isStandardService(String(s?.uuid || '').toLowerCase()));
        pickedService = nonStd.find((s: any) => getWritableChars(s).length > 0) || services.find((s: any) => getWritableChars(s).length > 0) || services[0];
      }
      if (!pickedService) return;

      this.overrideServiceUUID = pickedService.uuid;

      // 캐릭터리스틱 선택: 쓰기 가능한 것을 우선, 그다음 읽기/알림 순
      const characteristics = (pickedService.characteristics || []).filter((c: any) => c?.uuid);
      const writable = characteristics.filter((c: any) => (c?.properties?.write || c?.properties?.writeWithoutResponse) && !c?.properties?.signedWrite);
      const notifies = characteristics.filter((c: any) => c?.properties?.notify || c?.properties?.indicate);

      // 패턴: write → notify 응답
      // - wifiRegisterChar: write 가능 + notify 가능
      // - equipmentSettingsChar: notify 가능(없으면 write 가능)
      const wifiChar = characteristics.find((c: any) => (c?.properties?.write || c?.properties?.writeWithoutResponse) && (c?.properties?.notify || c?.properties?.indicate))
        || (writable[0] || notifies[0] || characteristics[0]);
      const eqChar = notifies.find((c: any) => c?.uuid !== wifiChar?.uuid)
        || writable.find((c: any) => c?.uuid !== wifiChar?.uuid)
        || characteristics.find((c: any) => c?.uuid !== wifiChar?.uuid)
        || notifies[0] || writable[0] || characteristics[0];

      this.overrideWifiRegisterCharUUID = wifiChar?.uuid || this.overrideWifiRegisterCharUUID;
      this.overrideEquipmentSettingsCharUUID = eqChar?.uuid || this.overrideEquipmentSettingsCharUUID;

      console.log('[BLE UUID AUTO-RESOLVED]', JSON.stringify({
        serviceUUID: this.overrideServiceUUID,
        wifiRegisterCharUUID: this.overrideWifiRegisterCharUUID,
        equipmentSettingsCharUUID: this.overrideEquipmentSettingsCharUUID,
      }));
    } catch (e) {
      console.warn('UUID 자동 추정 실패:', e);
    }
  }

  private async ensureUuidsResolved(): Promise<void> {
    if (this.uuidsResolved) return;
    if (!this.connectedDevice) return;
    if (!this.uuidsResolvingPromise) {
      this.uuidsResolvingPromise = (async () => {
        await this.autoResolveUuidsFromGatt(this.connectedDevice!.deviceId);
        this.uuidsResolved = true;
      })();
    }
    // 최대 대기 1500ms
    try {
      await Promise.race([
        this.uuidsResolvingPromise,
        new Promise((resolve) => setTimeout(resolve, 1500))
      ]);
    } catch {}
  }





  // 문자열 기반 임시 명령 전송은 제거. 상위 레이어에서 JSON API를 사용하세요.

  isConnected(): boolean {
    return this.connectedDevice !== null;
  }

  getConnectedDevice(): BleDevice | null {
    return this.connectedDevice;
  }

  getConnectedDeviceId(): string | null {
    return this.connectedDevice?.deviceId ?? null;
  }
}

export const bluetoothService = new BluetoothService();