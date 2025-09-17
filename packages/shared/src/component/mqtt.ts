import mqtt, { type MqttClient, type IClientOptions } from "mqtt";
import { supabase } from "../integrations/supabase/client";

// 플랫폼 감지 함수
function getPlatform(): 'web' | 'mobile' {
  // Capacitor 환경 확인
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    return 'mobile';
  }
  // User Agent 확인
  if (typeof navigator !== 'undefined') {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('capacitor') || userAgent.includes('cordova')) {
      return 'mobile';
    }
  }
  return 'web';
}

// 사용자 ID가 포함된 MQTT client ID 생성 함수 (영구 저장)
export function createMqttClientId(uid?: string): string {
  const platform = getPlatform();
  const storageKey = uid ? `mqtt_client_id_${platform}_${uid}` : `mqtt_client_id_${platform}`;
  
  // localStorage에서 기존 clientId 확인
  let clientId = localStorage.getItem(storageKey);
  
  if (!clientId) {
    // 새로운 clientId 생성
    const random8 = Math.random().toString(16).slice(2, 10);
    if (uid) {
      clientId = `factor-${platform}-${uid}-${random8}`;
    } else {
      clientId = `factor-${platform}-${random8}`;
    }
    
    // localStorage에 저장
    try {
      localStorage.setItem(storageKey, clientId);
      console.log(`MQTT Client ID 생성 및 저장: ${clientId}`);
    } catch (error) {
      console.warn('MQTT Client ID 저장 실패:', error);
    }
  } else {
    console.log(`MQTT Client ID 복원: ${clientId}`);
  }
  
  return clientId;
}

// 사용자별 MQTT client ID 삭제 함수 (로그아웃 시 사용)
export function clearMqttClientId(uid?: string): void {
  const platform = getPlatform();
  const storageKey = uid ? `mqtt_client_id_${platform}_${uid}` : `mqtt_client_id_${platform}`;
  
  try {
    localStorage.removeItem(storageKey);
    console.log(`MQTT Client ID 삭제: ${storageKey}`);
  } catch (error) {
    console.warn('MQTT Client ID 삭제 실패:', error);
  }
}

export type MqttMessageHandler = (topic: string, payload: Uint8Array | string) => void;

export interface MqttBridgeOptions {
  brokerUrl?: string;
  username?: string;
  password?: string;
  clientId?: string;
  reconnectPeriodMs?: number;
  debug?: boolean;
}

export class MqttBridge {
  private client: MqttClient | null = null;
  private connected = false;
  private handlers = new Map<string, Set<MqttMessageHandler>>();
  private options: Required<MqttBridgeOptions>;
  private connectPromise: Promise<void> | null = null;
  private effectiveClientId: string;

  constructor(opts: MqttBridgeOptions = {}) {
    this.options = {
      brokerUrl: (opts.brokerUrl ?? (import.meta as any).env?.VITE_MQTT_URL ?? "").trim(),
      username: opts.username ?? (import.meta as any).env?.VITE_MQTT_USERNAME ?? "",
      password: opts.password ?? (import.meta as any).env?.VITE_MQTT_PASSWORD ?? "",
      clientId: opts.clientId ?? (import.meta as any).env?.VITE_MQTT_CLIENT_ID ?? createMqttClientId(),
      reconnectPeriodMs: opts.reconnectPeriodMs ?? 3000,
      debug: opts.debug ?? false,
    } as Required<MqttBridgeOptions>;
    if (!this.options.brokerUrl) {
      throw new Error("VITE_MQTT_URL이 설정되어 있지 않습니다.");
    }
    // 고정 clientId 충돌 방지: 탭별 랜덤 suffix를 한 번만 부여
    const suffix = Math.random().toString(16).slice(2, 8);
    this.effectiveClientId = `${this.options.clientId}-${suffix}`;
  }

  private log(...args: any[]) {
    if (this.options.debug) console.log("[MQTT]", ...args);
  }

  async connect(): Promise<void> {
    if (this.connected && this.client) return;
    if (this.connectPromise) return this.connectPromise;

    const connectOpts: IClientOptions = {
      clientId: this.effectiveClientId,
      username: this.options.username || undefined,
      password: this.options.password || undefined,
      reconnectPeriod: this.options.reconnectPeriodMs,
      clean: true,
      keepalive: 60,
      resubscribe: true,
    };

    this.connectPromise = new Promise((resolve, reject) => {
      try {
        this.client = mqtt.connect(this.options.brokerUrl, connectOpts);

        this.client.on("connect", () => {
          this.connected = true;
          this.log("connected");
          this.connectPromise = null;
          resolve(undefined);
        });

        this.client.on("reconnect", () => this.log("reconnecting..."));
        this.client.on("error", (err) => {
          this.log("error", err);
        });

        // PUBACK / SUBACK 등 패킷 수신 로깅
        this.client.on("packetreceive", (packet: any) => {
          if (packet?.cmd === "puback") {
            console.log("[MQTT][PUBACK]", { messageId: packet.messageId });
          }
        });

        this.client.on("message", (topic, payload) => {
          const textOrBytes = (payload as any)?.toString?.() ?? payload;
          // 지원: 와일드카드 패턴(+, #) 매칭
          for (const [pattern, fns] of this.handlers.entries()) {
            if (topicMatches(pattern, topic)) {
              fns.forEach((fn) => {
                try { fn(topic, textOrBytes); } catch {}
              });
            }
          }
        });
      } catch (e) {
        this.connectPromise = null;
        reject(e);
      }
    });
    return this.connectPromise;
  }

  async disconnect(force = true) {
    if (!this.client) return;
    await new Promise<void>((res) => {
      try {
        this.client?.end(force, {}, () => {
          this.connected = false;
          this.client = null;
          res();
        });
      } catch {
        this.connected = false;
        this.client = null;
        res();
      }
    });
  }

  async subscribe(topic: string, handler?: MqttMessageHandler, qos: 0 | 1 | 2 = 0) {
    await this.connect();
    await new Promise<void>((res, rej) => {
      this.client!.subscribe(topic, { qos }, (err) => (err ? rej(err) : res()));
    });
    if (handler) {
      if (!this.handlers.has(topic)) this.handlers.set(topic, new Set());
      this.handlers.get(topic)!.add(handler);
    }
  }

  async unsubscribe(topic: string, handler?: MqttMessageHandler) {
    if (handler) {
      this.handlers.get(topic)?.delete(handler);
    }
    await new Promise<void>((res, rej) => {
      this.client?.unsubscribe(topic, (err) => (err ? rej(err) : res()));
    });
  }

  async publish(topic: string, message: unknown, qos: 0 | 1 | 2 = 0, retain = false) {
    await this.connect();
    const payload = typeof message === "string" ? message : JSON.stringify(message);
    await new Promise<void>((res, rej) => {
      this.client!.publish(topic, payload, { qos, retain }, (err) => {
        if (err) return rej(err);
        // qos 1/2 완료 시 콜백 호출됨 -> puback/pubcomp 완료 의미
        if (qos > 0) {
          console.log("[MQTT][PUBLISH-ACKED]", { topic, qos });
        }
        res();
      });
    });
  }
}

// 전역 구독 관리 (중복 방지 및 해제 지원)
const dashStatusSubscribed = new Set<string>();
const dashStatusTopicHandlers = new Map<string, MqttMessageHandler>();
type DashStatusListener = (uuid: string, data: any) => void;
const dashStatusListeners = new Set<DashStatusListener>();

export function onDashStatusMessage(listener: DashStatusListener) {
  dashStatusListeners.add(listener);
  return () => dashStatusListeners.delete(listener);
}

export async function startDashStatusSubscriptionsForUser(userId: string) {
  const mqttClient = createSharedMqttClient();
  await mqttClient.connect();
  const deviceUuids = await getUserDeviceUuidsCached(userId);
  const subscribedTopics: string[] = [];
  for (const uuid of deviceUuids) {
    const topic = `dash_status/${uuid}`;
    if (dashStatusSubscribed.has(topic)) continue;
    const handler = (t: string, payload: any) => {
      let parsed: any = payload;
      try {
        if (typeof payload === 'string') parsed = JSON.parse(payload);
        else if (payload instanceof Uint8Array) parsed = JSON.parse(new TextDecoder().decode(payload));
      } catch {}
      console.log('[MQTT][dash_status]', t, parsed);
      // 주제에서 uuid 추출하여 리스너 호출
      const parts = t.split('/');
      const id = parts.length >= 2 ? parts[1] : uuid;
      dashStatusListeners.forEach((fn) => {
        try { fn(id, parsed); } catch {}
      });
    };
    await mqttClient.subscribe(topic, handler);
    dashStatusSubscribed.add(topic);
    dashStatusTopicHandlers.set(topic, handler);
    subscribedTopics.push(topic);
  }
  if (subscribedTopics.length > 0) {
    console.log('[MQTT][SUB] started for dash_status topics:', subscribedTopics);
  }

  // 로그인 시 1회 get_status 전송 (대시보드 진입 여부와 무관)
  if (deviceUuids.length > 0) {
    try {
      await Promise.all(
        deviceUuids.map((uuid) =>
          mqttClient.publish(`DASHBOARD/${uuid}`, { type: "get_status" }, 1, false)
        )
      );
      console.log('[MQTT][TX] initial get_status sent', { count: deviceUuids.length });
    } catch (e) {
      console.warn('[MQTT][TX] initial get_status failed', e);
    }
  }
}

export async function stopDashStatusSubscriptions() {
  if (dashStatusSubscribed.size === 0) return;
  const mqttClient = createSharedMqttClient();

  // 세션 종료 시 1회 get_status_stop 전송
  try {
    const uuids = Array.from(dashStatusSubscribed)
      .map((t) => t.split('/')[1])
      .filter(Boolean);
    if (uuids.length > 0) {
      await Promise.all(
        uuids.map((uuid) =>
          mqttClient.publish(`DASHBOARD/${uuid}`, { type: "get_status_stop" }, 1, false)
        )
      );
      console.log('[MQTT][TX] get_status_stop sent', { count: uuids.length });
    }
  } catch (e) {
    console.warn('[MQTT][TX] get_status_stop failed', e);
  }
  const topics = Array.from(dashStatusSubscribed);
  for (const topic of topics) {
    const handler = dashStatusTopicHandlers.get(topic);
    try {
      await mqttClient.unsubscribe(topic, handler);
    } catch {}
    dashStatusTopicHandlers.delete(topic);
    dashStatusSubscribed.delete(topic);
  }
  console.log('[MQTT][SUB] stopped for topics:', topics);
}

// 간단한 MQTT 토픽 패턴 매칭: '+'는 1레벨, '#'는 나머지 전부
function topicMatches(pattern: string, topic: string): boolean {
  if (pattern === topic) return true;
  const p = pattern.split('/');
  const t = topic.split('/');
  for (let i = 0, j = 0; i < p.length; i += 1, j += 1) {
    const pp = p[i];
    const tt = t[j];
    if (pp === '#') return true;
    if (pp === '+') {
      if (tt == null) return false;
      continue;
    }
    if (tt == null) return false;
    if (pp !== tt) return false;
  }
  // 패턴을 다 소비했고 토픽도 모두 소비했는지 확인
  return p[p.length - 1] === '#' || p.length === t.length;
}

let sharedMqtt: MqttBridge | null = null;
export function createSharedMqttClient(options?: MqttBridgeOptions) {
  if (!sharedMqtt) sharedMqtt = new MqttBridge(options);
  return sharedMqtt;
}

// 사용자 ID가 포함된 MQTT client 생성 함수 (영구 저장)
export function createUserMqttClient(uid: string, options?: Omit<MqttBridgeOptions, 'clientId'>) {
  const clientId = createMqttClientId(uid);
  return new MqttBridge({ ...options, clientId });
}

// 사용자별 MQTT client ID를 강제로 새로 생성하는 함수
export function regenerateMqttClientId(uid?: string): string {
  const platform = getPlatform();
  const storageKey = uid ? `mqtt_client_id_${platform}_${uid}` : `mqtt_client_id_${platform}`;
  
  // 기존 clientId 삭제
  try {
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.warn('기존 MQTT Client ID 삭제 실패:', error);
  }
  
  // 새로운 clientId 생성
  return createMqttClientId(uid);
}

// === User-Device UUID cache & helpers ===
const USER_DEVICE_CACHE_TTL_MS = 60_000; // 60 seconds
const userDeviceUuidCache = new Map<string, { uuids: string[]; expiresAt: number }>();

async function fetchUserDeviceUuidsRaw(userId: string): Promise<string[]> {
  const { data: clients } = await supabase
    .from('clients')
    .select('device_uuid')
    .eq('user_id', userId);
  let uuids = Array.from(new Set((clients || [])
    .map((r: any) => r?.device_uuid)
    .filter((v: any): v is string => Boolean(v))));
  if (uuids.length === 0) {
    const { data: printers } = await supabase
      .from('printers')
      .select('device_uuid')
      .eq('user_id', userId);
    uuids = Array.from(new Set((printers || [])
      .map((r: any) => r?.device_uuid)
      .filter((v: any): v is string => Boolean(v))));
  }
  return uuids;
}

export async function getUserDeviceUuidsCached(
  userId: string,
  opts?: { forceRefresh?: boolean }
): Promise<string[]> {
  const force = opts?.forceRefresh === true;
  const now = Date.now();
  const cached = userDeviceUuidCache.get(userId);
  if (!force && cached && cached.expiresAt > now) return cached.uuids;
  const uuids = await fetchUserDeviceUuidsRaw(userId);
  userDeviceUuidCache.set(userId, { uuids, expiresAt: now + USER_DEVICE_CACHE_TTL_MS });
  return uuids;
}

export function clearUserDeviceUuidCache(userId?: string) {
  if (userId) userDeviceUuidCache.delete(userId);
  else userDeviceUuidCache.clear();
}

// === Common helper: subscribe topics for all user's devices ===
type Unsubscriber = () => Promise<void>;

export async function subscribeTopicsForUser(
  userId: string,
  makeTopic: (uuid: string) => string,
  makeHandler: (uuid: string) => MqttMessageHandler,
  qos: 0 | 1 | 2 = 1
): Promise<Unsubscriber> {
  const mqttClient = createSharedMqttClient();
  await mqttClient.connect();
  const uuids = await getUserDeviceUuidsCached(userId);
  const unsubscribers: Array<Unsubscriber> = [];
  const topics: string[] = [];

  for (const uuid of uuids) {
    const topic = makeTopic(uuid);
    const handler = makeHandler(uuid);
    // eslint-disable-next-line no-await-in-loop
    await mqttClient.subscribe(topic, handler, qos);
    topics.push(topic);
    unsubscribers.push(async () => {
      try { await mqttClient.unsubscribe(topic, handler); } catch {}
    });
  }

  try {
    if (topics.length > 0) console.log('[MQTT][SUB][USER] started for topics:', topics);
    else console.log('[MQTT][SUB][USER] no devices to subscribe', { userId });
  } catch {}

  return async () => {
    for (const unSub of unsubscribers) {
      // eslint-disable-next-line no-await-in-loop
      await unSub().catch(() => {});
    }
    try { if (topics.length > 0) console.log('[MQTT][SUB][USER] stopped for topics:', topics); } catch {}
  };
}

// === SD 카드 목록 흐름 (로그인 후 전역/개별 구독에서 사용) ===
export type SdListResult = {
  type: "sd_list_result";
  ok: boolean;
  files: Array<{ name: string; size: number }>;
  timestamp?: number;
};

export async function subscribeSdListResultAll(
  onMessage?: (deviceSerial: string, result: SdListResult) => void,
  qos: 0 | 1 | 2 = 1
) {
  const mqttClient = createSharedMqttClient();
  await mqttClient.connect();
  const topic = `sd_list_result/+`;
  const handler: MqttMessageHandler = (topicStr, payload) => {
    let parsed: any = payload;
    try {
      
      if (typeof payload === 'string') parsed = JSON.parse(payload);
      else if (payload instanceof Uint8Array) parsed = JSON.parse(new TextDecoder().decode(payload));
    } catch {}
    console.log('[MQTT][SdListResult]', parsed);
    if (parsed?.type !== 'sd_list_result') return;
    const parts = topicStr.split('/');
    const deviceSerial = parts[parts.length - 1] || '';
    const result = parsed as SdListResult;
    try { console.log('[MQTT][SD][RX]', { topic: topicStr, deviceSerial, ok: result?.ok, files: Array.isArray(result?.files) ? result.files.length : undefined }); } catch {}
    try { window.dispatchEvent(new CustomEvent('sd_list_result', { detail: { deviceSerial, result } })); } catch {}
    if (onMessage) onMessage(deviceSerial, result);
  };
  await mqttClient.subscribe(topic, handler, qos);
  try { console.log('[MQTT][SD][SUB] started wildcard', { topic, qos }); } catch {}
  return async () => { await mqttClient.unsubscribe(topic, handler); };
}

// 사용자 기준으로 해당 사용자의 디바이스에 한해 sd_list_result 구독
export async function subscribeSdListResultForUser(
  userId: string,
  qos: 0 | 1 | 2 = 1
) {
  return subscribeTopicsForUser(
    userId,
    (uuid) => `sd_list_result/${uuid}`,
    (deviceSerial) => (_t, payload) => {
      let parsed: any = payload;
      try {
        if (typeof payload === 'string') parsed = JSON.parse(payload);
        else if (payload instanceof Uint8Array) parsed = JSON.parse(new TextDecoder().decode(payload));
      } catch {}
      try { window.dispatchEvent(new CustomEvent('sd_list_result', { detail: { deviceSerial, result: parsed } })); } catch {}
    },
    qos
  );
}

export async function subscribeSdListResult(
  deviceSerial: string,
  onMessage: (result: SdListResult) => void,
  qos: 0 | 1 | 2 = 1
) {
  const mqttClient = createSharedMqttClient();
  await mqttClient.connect();
  const topic = `sd_list_result/${deviceSerial}`;
  const handler: MqttMessageHandler = (_t, payload) => {
    let parsed: any = payload;
    try {
      if (typeof payload === 'string') parsed = JSON.parse(payload);
      else if (payload instanceof Uint8Array) parsed = JSON.parse(new TextDecoder().decode(payload));
    } catch {}
    // if (parsed?.type !== 'sd_list_result') return;
    console.log('[MQTT][SdListResult]', parsed);
    const result = parsed as SdListResult;
    try { window.dispatchEvent(new CustomEvent('sd_list_result', { detail: { deviceSerial, result } })); } catch {}
    onMessage(result);
  };
  await mqttClient.subscribe(topic, handler, qos);
  try { console.log('[MQTT][SD][SUB] started', { topic, qos }); } catch {}
  return async () => { await mqttClient.unsubscribe(topic, handler); };
}

export async function publishRequestSdList(deviceSerial: string) {
  const mqttClient = createSharedMqttClient();
  await mqttClient.publish(`sd_list/${deviceSerial}`, { type: 'sd_list' }, 0, false);
}

export async function startSdListFlow(
  deviceSerial: string,
  onMessage: (result: SdListResult) => void
) {
  const unsubscribe = await subscribeSdListResult(deviceSerial, onMessage);
  await publishRequestSdList(deviceSerial);
  return unsubscribe;
}

// === 프린터 제어 결과 구독 ===
export type ControlResult = {
  type?: string;
  ok?: boolean;
  action?: string;
  message?: string;
  [key: string]: any;
};

export async function subscribeControlResult(
  deviceSerial: string,
  onMessage: (result: ControlResult) => void,
  qos: 0 | 1 | 2 = 1
) {
  const mqttClient = createSharedMqttClient();
  await mqttClient.connect();
  const topic = `control_result/${deviceSerial}`;
  const handler: MqttMessageHandler = (t, payload) => {
    let parsed: any = payload;
    try {
      if (typeof payload === 'string') parsed = JSON.parse(payload);
      else if (payload instanceof Uint8Array) parsed = JSON.parse(new TextDecoder().decode(payload));
    } catch {}
    const result = parsed as ControlResult;
    try { console.log('[MQTT][CTRL][RX]', { topic: t, deviceSerial, result }); } catch {}
    try { window.dispatchEvent(new CustomEvent('control_result', { detail: { deviceSerial, result } })); } catch {}
    onMessage(result);
  };
  await mqttClient.subscribe(topic, handler, qos);
  try { console.log('[MQTT][CTRL][SUB] started', { topic, qos }); } catch {}
  return async () => { await mqttClient.unsubscribe(topic, handler); };
}

export async function subscribeControlResultForUser(userId: string, qos: 0 | 1 | 2 = 1) {
  return subscribeTopicsForUser(
    userId,
    (uuid) => `control_result/${uuid}`,
    (deviceSerial) => (_t, payload) => {
      let parsed: any = payload;
      try {
        if (typeof payload === 'string') parsed = JSON.parse(payload);
        else if (payload instanceof Uint8Array) parsed = JSON.parse(new TextDecoder().decode(payload));
      } catch {}
      try { console.log('[MQTT][CTRL][RX]', { topic: `control_result/${deviceSerial}`, deviceSerial, result: parsed }); } catch {}
      try { window.dispatchEvent(new CustomEvent('control_result', { detail: { deviceSerial, result: parsed } })); } catch {}
    },
    qos
  );
}


