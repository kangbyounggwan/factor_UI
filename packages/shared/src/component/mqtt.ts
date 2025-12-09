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
      console.log("%c[MQTT]%c Client ID 생성 및 저장:", "background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;", "color: #4CAF50; font-weight: bold;", clientId);
    } catch (error) {
      console.warn('MQTT Client ID 저장 실패:', error);
    }
  } else {
    console.log("%c[MQTT]%c Client ID 복원:", "background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;", "color: #4CAF50; font-weight: bold;", clientId);
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
  private inert = false;
  private readonly connectTimeoutMs = 10000;

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
      this.inert = true;
      try { console.warn("[MQTT] broker URL 미설정: MQTT 기능 비활성화(inert)"); } catch {}
    }
    // 고정 clientId 충돌 방지: 탭별 랜덤 suffix를 한 번만 부여
    const suffix = Math.random().toString(16).slice(2, 8);
    this.effectiveClientId = `${this.options.clientId}-${suffix}`;
  }

  private log(...args: any[]) {
    if (this.options.debug) console.log("%c[MQTT]%c", "background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;", "", ...args);
  }

  private getDefaultPortForProtocol(protocol: string): number | undefined {
    const proto = protocol.replace(/:$/, "");
    switch (proto) {
      case "ws": return 80;
      case "wss": return 443;
      case "mqtt": return 1883;
      case "mqtts": return 8883;
      default: return undefined;
    }
  }

  public getBrokerInfo(): { host: string; port?: number; url: string } {
    const url = this.options?.brokerUrl ?? "";
    if (!url) return { host: "", port: undefined, url: "" };
    try {
      const u = new URL(url);
      const host = u.hostname;
      const parsedPort = u.port ? Number(u.port) : this.getDefaultPortForProtocol(u.protocol);
      const port = Number.isFinite(parsedPort) ? parsedPort : undefined;
      return { host, port, url };
    } catch {
      // URL 파싱 실패 시 원본을 host로 반환
      return { host: url, port: undefined, url };
    }
  }

  private openClientWithTimeout(timeoutMs = this.connectTimeoutMs): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (this.inert) return resolve(false);
      try {
        const connectOpts: IClientOptions = {
          clientId: this.effectiveClientId,
          username: this.options.username || undefined,
          password: this.options.password || undefined,
          reconnectPeriod: this.options.reconnectPeriodMs,
          clean: true,
          keepalive: 60,
          resubscribe: true,
        };

        this.client = mqtt.connect(this.options.brokerUrl, connectOpts);

        const onConnect = () => {
          this.connected = true;
          cleanup();
          resolve(true);
        };
        const onCloseOrError = () => {
          this.connected = false;
          cleanup();
          resolve(false);
        };
        const cleanup = () => {
          try { this.client?.off?.("connect", onConnect); } catch {}
          try { this.client?.off?.("close", onCloseOrError); } catch {}
          try { this.client?.off?.("offline", onCloseOrError); } catch {}
          try { this.client?.off?.("error", onCloseOrError); } catch {}
        };

        this.client.on("connect", onConnect);
        this.client.on("close", onCloseOrError);
        this.client.on("offline", onCloseOrError);
        this.client.on("reconnect", () => this.log("reconnecting..."));
        this.client.on("error", (err) => { this.log("error", err); onCloseOrError(); });

        this.client.on("packetreceive", (packet: any) => {
          if (packet?.cmd === "puback") {
            try { console.log("%c[MQTT]%c%c[PUBACK]%c", "background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;", "", "background: #2196F3; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;", "", { messageId: packet.messageId }); } catch {}
          }
        });
        this.client.on("message", (topic, payload) => {
          const textOrBytes = (payload as any)?.toString?.() ?? payload;
          for (const [pattern, fns] of this.handlers.entries()) {
            if (topicMatches(pattern, topic)) {
              fns.forEach((fn) => { try { fn(topic, textOrBytes); } catch {} });
            }
          }
        });

        setTimeout(() => {
          if (!this.connected) {
            try { console.log('[MQTT] connect timeout', this.getBrokerInfo()); } catch {}
            resolve(false);
          }
        }, timeoutMs);
      } catch {
        this.connected = false;
        resolve(false);
      }
    });
  }

  async connect(): Promise<boolean> {
    if (this.inert) return false;
    if (this.connected && this.client) return true;
    if (this.connectPromise) { await this.connectPromise; return this.connected; }

    this.connectPromise = (async () => {
      const _ok = await this.openClientWithTimeout(this.connectTimeoutMs);
      this.connectPromise = null;
      return;
    })();

    await this.connectPromise;
    return this.connected;
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
    const ok = await this.connect();
    if (!ok || !this.client) { this.log("subscribe skipped (not connected):", topic); return; }
    await new Promise<void>((res) => {
      this.client!.subscribe(topic, { qos }, (_err) => res());
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
    await new Promise<void>((res) => {
      this.client?.unsubscribe(topic, (_err) => res());
    });
  }

  async publish(topic: string, message: unknown, qos: 0 | 1 | 2 = 0, retain = false) {
    const ok = await this.connect();
    if (!ok || !this.client) { this.log("publish skipped (not connected):", topic); return; }
    const payload = typeof message === "string" ? message : JSON.stringify(message);
    await new Promise<void>((res) => {
      this.client!.publish(topic, payload, { qos, retain }, (_err) => {
        if (qos > 0) { try { console.log("%c[MQTT]%c%c[PUBLISH-ACKED]%c", "background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;", "", "background: #FF9800; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;", "", { topic, qos }); } catch {} }
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

// ============================================================
// PrinterStatusManager: 프린터 상태 관리 통합 클래스
// - 캐시 관리 (메모리)
// - DB 동기화
// - MQTT 타임아웃 체크
// - 프린트 히스토리 관리
// ============================================================
class PrinterStatusManager {
  // 프린터별 마지막 상태 캐시
  private statusCache = new Map<string, string>();
  // 프린터별 마지막 MQTT 메시지 수신 시간
  private lastMessageTime = new Map<string, number>();
  // 타임아웃 체크 인터벌 ID
  private timeoutCheckInterval: ReturnType<typeof setInterval> | null = null;
  // 설정
  private readonly TIMEOUT_MS = 30000; // 30초
  private readonly CHECK_INTERVAL_MS = 10000; // 10초마다 체크

  // 프린트 히스토리 관리
  // deviceUuid → { jobId, printerId, lastStatus }
  private activeJobs = new Map<string, { jobId: string; printerId: string; lastStatus: string }>();

  /**
   * MQTT 페이로드에서 상태값 추출 및 매핑
   */
  extractStatus(parsed: any): string {
    // state.flags.printing을 우선 확인 (가장 정확한 상태)
    const flags = parsed?.state?.flags;
    if (flags?.printing) return 'printing';
    if (flags?.paused) return 'paused';
    if (flags?.error) return 'error';

    // connection 배열에서 상태 추출: ["Printing", "/dev/ttyUSB0", 115200, {...}]
    const connectionArr = Array.isArray(parsed?.connection) ? parsed.connection : null;
    const connectionState = connectionArr?.[0];
    // state.text에서 상태 추출
    const stateText = parsed?.state?.text;
    // 우선순위: connection[0] > state.text
    const rawState = (connectionState ?? stateText ?? '').toLowerCase();

    // 상태 매핑 (OctoPrint → DB 상태)
    switch (rawState) {
      case 'printing': return 'printing';
      case 'paused': return 'paused';
      case 'operational':
      case 'ready': return 'idle';
      case 'offline':
      case 'closed':
      case 'closed_with_error': return 'disconnected';
      case 'error': return 'error';
      default: return 'idle'; // 연결되어 있지만 상태 불명
    }
  }

  /**
   * 메시지 수신 시간 업데이트
   */
  updateMessageTime(deviceUuid: string): void {
    this.lastMessageTime.set(deviceUuid, Date.now());
  }

  /**
   * 프린터 상태를 DB와 동기화
   */
  async syncToDb(deviceUuid: string, newStatus: string): Promise<void> {
    if (!supabase) return;

    // 캐시와 비교 (같으면 스킵)
    if (this.statusCache.get(deviceUuid) === newStatus) return;

    try {
      // DB에서 현재 상태 조회
      const { data: printer, error: selectError } = await supabase
        .from('printers')
        .select('id, status')
        .eq('device_uuid', deviceUuid)
        .maybeSingle();

      if (selectError || !printer) return;

      // DB 상태와 동일하면 캐시만 업데이트
      if (printer.status === newStatus) {
        this.statusCache.set(deviceUuid, newStatus);
        return;
      }

      // DB 업데이트
      const { error: updateError } = await supabase
        .from('printers')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', printer.id);

      if (!updateError) {
        this.statusCache.set(deviceUuid, newStatus);
        console.log(`[MQTT] ✅ 상태 동기화: ${deviceUuid} → ${newStatus}`);
      }
    } catch (error) {
      console.error('[MQTT] DB 동기화 실패:', error);
    }
  }

  /**
   * 타임아웃 체크 시작
   */
  startTimeoutCheck(): void {
    if (this.timeoutCheckInterval) return;

    this.timeoutCheckInterval = setInterval(async () => {
      const now = Date.now();

      for (const [deviceUuid, lastTime] of this.lastMessageTime.entries()) {
        const elapsed = now - lastTime;

        if (elapsed >= this.TIMEOUT_MS) {
          console.log(`[MQTT] ⏰ Timeout: ${deviceUuid} (${Math.round(elapsed / 1000)}s)`);
          await this.syncToDb(deviceUuid, 'disconnected').catch(() => {});
        }
      }
    }, this.CHECK_INTERVAL_MS);

    console.log('[MQTT] ⏱️ 타임아웃 체크 시작');
  }

  /**
   * 타임아웃 체크 중지
   */
  stopTimeoutCheck(): void {
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
      this.timeoutCheckInterval = null;
      console.log('[MQTT] ⏱️ 타임아웃 체크 중지');
    }
  }

  /**
   * 모든 캐시 및 상태 초기화
   */
  clear(): void {
    this.statusCache.clear();
    this.lastMessageTime.clear();
    this.activeJobs.clear();
    this.stopTimeoutCheck();
  }

  // ============================================================
  // Phase 2: 프린트 히스토리 관리
  // ============================================================

  /**
   * 프린팅 상태 변경 감지 및 히스토리 관리
   * - idle/operational → printing: 새 job 생성
   * - printing → paused/cancelled/completed/failed: job 상태 업데이트
   */
  async handlePrintStatusChange(
    deviceUuid: string,
    newStatus: string,
    parsed: any
  ): Promise<void> {
    if (!supabase) return;

    const activeJob = this.activeJobs.get(deviceUuid);
    const prevStatus = activeJob?.lastStatus || this.statusCache.get(deviceUuid) || 'idle';

    // 상태가 동일하면 스킵
    if (prevStatus === newStatus) return;

    // 디버그: 상태 변경 감지
    console.log(`[MQTT] 📊 Status change detected: ${deviceUuid.slice(0, 8)}... ${prevStatus} → ${newStatus}`);
    if (parsed?.job?.file) {
      console.log(`[MQTT] 📄 Job file info:`, parsed.job.file);
    }

    try {
      // 프린터 ID 조회
      const { data: printer } = await supabase
        .from('printers')
        .select('id, user_id')
        .eq('device_uuid', deviceUuid)
        .maybeSingle();

      if (!printer) return;

      // Case 1: 프린팅 시작 (idle/operational → printing)
      if (newStatus === 'printing' && !activeJob) {
        const jobFile = parsed?.job?.file;
        const fileName = jobFile?.name || jobFile?.display || 'Unknown';

        // model_print_history에 새 레코드 생성
        const { data: newJob, error } = await supabase
          .from('model_print_history')
          .insert({
            user_id: printer.user_id,
            printer_id: printer.id,
            print_status: 'printing',
            started_at: new Date().toISOString(),
            print_settings: {
              file_name: fileName,
              file_size: jobFile?.size,
              estimated_time: parsed?.job?.estimatedPrintTime,
            },
          })
          .select('id')
          .single();

        if (!error && newJob) {
          this.activeJobs.set(deviceUuid, {
            jobId: newJob.id,
            printerId: printer.id,
            lastStatus: 'printing',
          });
          console.log(`[MQTT] 🖨️ Print job started: ${newJob.id} for ${deviceUuid}`);
        }
      }

      // Case 2: 프린팅 상태 변경 (printing → paused/cancelled/completed/failed)
      else if (activeJob && ['paused', 'cancelled', 'completed', 'failed', 'idle', 'error'].includes(newStatus)) {
        // DB 상태 매핑
        let dbStatus = newStatus;
        if (newStatus === 'idle') dbStatus = 'completed'; // idle로 돌아가면 완료
        if (newStatus === 'error') dbStatus = 'failed';

        const updateData: any = {
          print_status: dbStatus,
        };

        // 완료/실패/취소 시 완료 시간 기록
        if (['completed', 'failed', 'cancelled'].includes(dbStatus)) {
          updateData.completed_at = new Date().toISOString();

          // 활성 job 제거
          this.activeJobs.delete(deviceUuid);
        }

        // 에러 메시지 저장
        if (dbStatus === 'failed' && parsed?.state?.error) {
          updateData.error_message = parsed.state.error;
        }

        await supabase
          .from('model_print_history')
          .update(updateData)
          .eq('id', activeJob.jobId);

        // lastStatus 업데이트
        if (this.activeJobs.has(deviceUuid)) {
          this.activeJobs.get(deviceUuid)!.lastStatus = newStatus;
        }

        console.log(`[MQTT] 🖨️ Print job ${activeJob.jobId} status: ${dbStatus}`);
      }

      // Case 3: 재개 (paused → printing)
      else if (activeJob && prevStatus === 'paused' && newStatus === 'printing') {
        await supabase
          .from('model_print_history')
          .update({ print_status: 'printing' })
          .eq('id', activeJob.jobId);

        activeJob.lastStatus = 'printing';
        console.log(`[MQTT] 🖨️ Print job ${activeJob.jobId} resumed`);
      }
    } catch (error) {
      console.error('[MQTT] Print history error:', error);
    }
  }

  /**
   * 활성 job ID 조회
   */
  getActiveJobId(deviceUuid: string): string | null {
    return this.activeJobs.get(deviceUuid)?.jobId || null;
  }
}

// 전역 싱글턴 인스턴스
const printerStatusManager = new PrinterStatusManager();

export function onDashStatusMessage(listener: DashStatusListener) {
  dashStatusListeners.add(listener);
  return () => dashStatusListeners.delete(listener);
}

export async function startDashStatusSubscriptionsForUser(userId: string, opts?: { forceRefresh?: boolean }) {
  const mqttClient = createSharedMqttClient();
  await mqttClient.connect();
  // 신규 프린터 등록 시 캐시 갱신 옵션
  const deviceUuids = await getUserDeviceUuidsCached(userId, { forceRefresh: opts?.forceRefresh });
  const subscribedTopics: string[] = [];
  for (const uuid of deviceUuids) {
    const topic = `octoprint/status/${uuid}`;
    if (dashStatusSubscribed.has(topic)) continue;
    const handler = (t: string, payload: any) => {
      let parsed: any = payload;
      try {
        if (typeof payload === 'string') parsed = JSON.parse(payload);
        else if (payload instanceof Uint8Array) parsed = JSON.parse(new TextDecoder().decode(payload));
      } catch {}
      // console.log('[MQTT][octoprint/status]', t, parsed);
      // 주제에서 uuid 추출하여 리스너 호출 (마지막 세그먼트 사용)
      const parts = t.split('/');
      const id = parts[parts.length - 1] || uuid;

      // 마지막 메시지 수신 시간 업데이트 (타임아웃 체크용)
      printerStatusManager.updateMessageTime(id);

      const flags = parsed?.state?.flags;
      const isConnected = Boolean(flags && (flags.operational || flags.printing || flags.paused || flags.ready || flags.error));
      // 온도 포맷 표준화: temperatures.{bed,chamber,tool0} 사용
      const temps: any = parsed?.temperatures ?? parsed?.temperature ?? undefined;
      const temperature_info = temps
        ? {
            bed: temps.bed ? { actual: temps.bed.actual ?? 0, target: temps.bed.target ?? 0, offset: temps.bed.offset ?? 0 } : undefined,
            chamber: temps.chamber ? { actual: temps.chamber.actual ?? null, target: temps.chamber.target ?? null, offset: temps.chamber.offset ?? 0 } : undefined,
            tool: temps.tool0 ? { tool0: { actual: temps.tool0.actual ?? 0, target: temps.tool0.target ?? 0, offset: temps.tool0.offset ?? 0 } } : undefined,
          }
        : undefined;

      // 연결 정보 표준화: connection 배열([state, port, baudrate]) 지원
      const connArr: any = Array.isArray((parsed as any)?.connection) ? (parsed as any).connection : null;
      const connection = connArr && connArr.length >= 3
        ? {
            state: String(connArr[0]),
            port: String(connArr[1]),
            baudrate: Number(connArr[2]),
            // 요청 사항: connection[3].name을 Printer Profile로 활용
            profile_name: (connArr[3] && (connArr[3].name ?? connArr[3].model)) ?? undefined,
          }
        : undefined;

      const isPrintingFlag = Boolean(flags?.printing);
      const progressRaw: any = parsed?.progress ?? {};
      const jobRaw: any = parsed?.job ?? {};

      const sdRaw: any = parsed?.sd ?? {};
      // sd.local: 배열 또는 object(dict) 모두 지원 → 배열로 표준화
      let sdLocalArr: any[] = [];
      if (Array.isArray(sdRaw?.local)) {
        sdLocalArr = sdRaw.local.map((v: any) => ({
          name: v?.name ? String(v.name) : undefined,
          display: v?.display ? String(v.display) : (v?.name ? String(v.name) : undefined),
          size: v?.size != null ? Number(v.size) : undefined,
          date: v?.date ?? null,
          estimatedPrintTime: typeof v?.analysis?.estimatedPrintTime === 'number' ? v.analysis.estimatedPrintTime : undefined,
          user: v?.user,
          path: v?.path,
        }));
      } else if (sdRaw && sdRaw.local && typeof sdRaw.local === 'object') {
        sdLocalArr = Object.entries(sdRaw.local).map(([key, v]: [string, any]) => ({
          name: String(v?.name ?? key),
          display: v?.display ? String(v.display) : undefined,
          size: v?.size != null ? Number(v.size) : undefined,
          date: v?.date ?? null,
          estimatedPrintTime: typeof v?.analysis?.estimatedPrintTime === 'number' ? v.analysis.estimatedPrintTime : undefined,
          user: v?.user,
          path: v?.path,
        }));
      }
      // sd.sdcard: array
      const sdCardArr = Array.isArray(sdRaw?.sdcard)
        ? sdRaw.sdcard.map((f: any) => ({
            name: String(f?.name ?? f?.display ?? ''),
            size: Number(f?.size) || 0,
            display: f?.display ? String(f.display) : undefined,
            date: f?.date ?? null,
          }))
        : [];

      // 진행률 보정: completion(null) → 0, 필요 시 file_pct 또는 파일 진행률로 보조 계산
      const completionPctRaw = typeof progressRaw?.completion === 'number'
        ? progressRaw.completion
        : (typeof progressRaw?.file_pct === 'number' ? progressRaw.file_pct : null);
      const completion01 = typeof completionPctRaw === 'number'
        ? (completionPctRaw / 100)
        : (
            (typeof progressRaw?.filepos === 'number' && typeof jobRaw?.file?.size === 'number' && jobRaw.file.size > 0)
              ? (progressRaw.filepos / jobRaw.file.size)
              : 0
          );

      const mapped = {
        connected: isConnected,
        // 루트에도 유지하되, 상세 페이지 호환을 위해 printer_status 내부에도 동일 필드를 채움
        printing: isPrintingFlag,
        printer_status: {
          state: parsed?.state?.text,
          flags: flags ?? {},
          current_file: jobRaw?.file?.name,
          printing: isPrintingFlag,
          error_message: parsed?.state?.error ?? parsed?.error ?? undefined,
        },
        progress: {
          // 0..100 입력은 0..1로, null/미정은 0으로 보정
          completion: completion01,
          print_time_left: progressRaw?.printTimeLeft ?? progressRaw?.time_left ?? undefined,
          print_time: progressRaw?.printTime ?? progressRaw?.time ?? undefined,
          file_position: progressRaw?.file_position ?? progressRaw?.filepos ?? undefined,
          file_size: jobRaw?.file?.size ?? undefined,
          filament_used: jobRaw?.filament ?? jobRaw?.filament_used ?? undefined,
          // 상세 화면 활성 판단용 플래그
          active: isPrintingFlag || Boolean(progressRaw?.active),
        },
        sd: {
          local: sdLocalArr,
          sdcard: sdCardArr,
        },
        temperature_info,
        connection,
      } as any;

      // DB 프린터 상태 업데이트 (페이로드에서 상태 추출)
      const extractedStatus = printerStatusManager.extractStatus(parsed);
      if (id) {
        printerStatusManager.syncToDb(id, extractedStatus).catch(() => {});

        // Phase 2: 프린트 히스토리 관리 (상태 변경 감지)
        printerStatusManager.handlePrintStatusChange(id, extractedStatus, parsed).catch(() => {});
      }

      dashStatusListeners.forEach((fn) => { try { fn(id, mapped); } catch {} });
    };
    await mqttClient.subscribe(topic, handler);
    dashStatusSubscribed.add(topic);
    dashStatusTopicHandlers.set(topic, handler);
    subscribedTopics.push(topic);

    // 구독 시작 시 마지막 메시지 시간 초기화 (타임아웃 체크 대상으로 등록)
    printerStatusManager.updateMessageTime(uuid);
  }
  if (subscribedTopics.length > 0) {
    console.log('%c[MQTT]%c%c[SUB]%c started for octoprint/status topics:', "background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;", "", "background: #9C27B0; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;", "color: #9C27B0; font-weight: bold;", subscribedTopics);

    // 구독 시작 시 타임아웃 체크도 시작
    printerStatusManager.startTimeoutCheck();
  }
}

export async function stopDashStatusSubscriptions() {
  if (dashStatusSubscribed.size === 0) return;
  const mqttClient = createSharedMqttClient();

  const topics = Array.from(dashStatusSubscribed);
  for (const topic of topics) {
    const handler = dashStatusTopicHandlers.get(topic);
    try {
      await mqttClient.unsubscribe(topic, handler);
    } catch {}
    dashStatusTopicHandlers.delete(topic);
    dashStatusSubscribed.delete(topic);
  }

  // 구독 해제 시 캐시 및 타임아웃 정리
  printerStatusManager.clear();

  console.log('%c[MQTT]%c%c[SUB]%c stopped for topics:', "background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;", "", "background: #9C27B0; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;", "color: #9C27B0; font-weight: bold;", topics);
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

// 공유 MQTT 클라이언트 강제 종료 (로그아웃 등에서 사용)
export async function disconnectSharedMqtt() {
  if (sharedMqtt) {
    try { await sharedMqtt.disconnect(true); } catch {}
    sharedMqtt = null;
  }
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

  // printers 테이블도 조회 (device_uuid 또는 id 컬럼 사용)
  const { data: printers } = await supabase
    .from('printers')
    .select('id, device_uuid')
    .eq('user_id', userId);

  const printerUuids = Array.from(new Set((printers || [])
    .map((r: any) => r?.device_uuid || r?.id) // device_uuid가 없으면 id 사용
    .filter((v: any): v is string => Boolean(v))));

  // clients와 printers의 UUID를 합침
  uuids = Array.from(new Set([...uuids, ...printerUuids]));

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
    const info = mqttClient.getBrokerInfo?.() ?? { host: '', port: undefined };
    if (topics.length > 0) {
      console.log('%c[MQTT]%c%c[SUB]%c%c[USER]%c started for topics:', "background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;", "", "background: #9C27B0; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;", "", "background: #607D8B; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;", "color: #4CAF50; font-weight: bold;", topics, { broker_host: info.host, broker_port: info.port });
    } else {
      console.log('[MQTT][SUB][USER] no devices to subscribe', { userId, broker_host: info.host, broker_port: info.port });
    }
  } catch {}

  return async () => {
    for (const unSub of unsubscribers) {
      // eslint-disable-next-line no-await-in-loop
      await unSub().catch(() => {});
    }
    try {
      const info = mqttClient.getBrokerInfo?.() ?? { host: '', port: undefined };
      if (topics.length > 0) console.log('[MQTT][SUB][USER] stopped for topics:', topics, { broker_host: info.host, broker_port: info.port });
    } catch {}
  };
}

// === SD 카드 목록 흐름 (로그인 후 전역/개별 구독에서 사용) ===

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
    try { console.log('%c[MQTT]%c%c[CTRL]%c%c[RX]%c', "background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;", "", "background: #F44336; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;", "", "background: #2196F3; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;", "color: #F44336; font-weight: bold;", { topic: t, deviceSerial, result }); } catch {}
    try { window.dispatchEvent(new CustomEvent('control_result', { detail: { deviceSerial, result } })); } catch {}
    onMessage(result);
  };
  await mqttClient.subscribe(topic, handler, qos);
  try { console.log('%c[MQTT]%c%c[CTRL]%c%c[SUB]%c started', "background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;", "", "background: #F44336; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;", "", "background: #9C27B0; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;", "color: #F44336; font-weight: bold;", { topic, qos }); } catch {}
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
      try { console.log('%c[MQTT]%c%c[CTRL]%c%c[RX]%c', "background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;", "", "background: #F44336; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;", "", "background: #2196F3; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;", "color: #F44336; font-weight: bold;", { topic: `control_result/${deviceSerial}`, deviceSerial, result: parsed }); } catch {}
      try { window.dispatchEvent(new CustomEvent('control_result', { detail: { deviceSerial, result: parsed } })); } catch {}
    },
    qos
  );
}


// === AI 모델 생성 완료/실패 알림 구독 ===
export type AIModelCompletedPayload = {
  model_id: string;
  status: 'completed';
  download_url: string;
  thumbnail_url?: string;
  stl_download_url?: string;
  model_name: string;
  generation_type: 'text_to_3d' | 'image_to_3d';
};

export type AIModelFailedPayload = {
  model_id: string;
  status: 'failed';
  error_message: string;
  generation_type: 'text_to_3d' | 'image_to_3d';
};

export type AIModelProgressPayload = {
  model_id: string;
  status: 'processing';
  progress: number; // 0-100
  message: string;
  generation_type: 'text_to_3d' | 'image_to_3d';
};

/**
 * AI 모델 생성 완료 알림 구독
 */
export async function subscribeAIModelCompleted(
  userId: string,
  onCompleted: (payload: AIModelCompletedPayload) => void,
  qos: 0 | 1 | 2 = 1
) {
  const mqttClient = createSharedMqttClient();
  await mqttClient.connect();
  const topic = `ai/model/completed/${userId}`;

  const handler: MqttMessageHandler = (t, payload) => {
    let parsed: any = payload;
    try {
      if (typeof payload === 'string') parsed = JSON.parse(payload);
      else if (payload instanceof Uint8Array) parsed = JSON.parse(new TextDecoder().decode(payload));
    } catch {}

    console.log('%c[MQTT]%c%c[AI-MODEL]%c%c[COMPLETED]%c',
      "background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;", "",
      "background: #FF9800; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;", "",
      "background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;",
      "color: #4CAF50; font-weight: bold;", parsed);

    onCompleted(parsed as AIModelCompletedPayload);
  };

  await mqttClient.subscribe(topic, handler, qos);
  console.log('%c[MQTT]%c%c[AI-MODEL]%c%c[SUB]%c started',
    "background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;", "",
    "background: #FF9800; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;", "",
    "background: #9C27B0; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;",
    "color: #FF9800; font-weight: bold;", { topic, qos });

  return async () => { await mqttClient.unsubscribe(topic, handler); };
}

/**
 * AI 모델 생성 실패 알림 구독
 */
export async function subscribeAIModelFailed(
  userId: string,
  onFailed: (payload: AIModelFailedPayload) => void,
  qos: 0 | 1 | 2 = 1
) {
  const mqttClient = createSharedMqttClient();
  await mqttClient.connect();
  const topic = `ai/model/failed/${userId}`;

  const handler: MqttMessageHandler = (t, payload) => {
    let parsed: any = payload;
    try {
      if (typeof payload === 'string') parsed = JSON.parse(payload);
      else if (payload instanceof Uint8Array) parsed = JSON.parse(new TextDecoder().decode(payload));
    } catch {}

    console.log('%c[MQTT]%c%c[AI-MODEL]%c%c[FAILED]%c',
      "background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;", "",
      "background: #FF9800; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;", "",
      "background: #F44336; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;",
      "color: #F44336; font-weight: bold;", parsed);

    onFailed(parsed as AIModelFailedPayload);
  };

  await mqttClient.subscribe(topic, handler, qos);
  console.log('%c[MQTT]%c%c[AI-MODEL]%c%c[SUB]%c started',
    "background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;", "",
    "background: #FF9800; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;", "",
    "background: #9C27B0; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;",
    "color: #FF9800; font-weight: bold;", { topic, qos });

  return async () => { await mqttClient.unsubscribe(topic, handler); };
}

/**
 * AI 모델 생성 진행률 알림 구독 (선택사항)
 */
export async function subscribeAIModelProgress(
  userId: string,
  onProgress: (payload: AIModelProgressPayload) => void,
  qos: 0 | 1 | 2 = 0
) {
  const mqttClient = createSharedMqttClient();
  await mqttClient.connect();
  const topic = `ai/model/progress/${userId}`;

  const handler: MqttMessageHandler = (t, payload) => {
    let parsed: any = payload;
    try {
      if (typeof payload === 'string') parsed = JSON.parse(payload);
      else if (payload instanceof Uint8Array) parsed = JSON.parse(new TextDecoder().decode(payload));
    } catch {}

    onProgress(parsed as AIModelProgressPayload);
  };

  await mqttClient.subscribe(topic, handler, qos);

  return async () => { await mqttClient.unsubscribe(topic, handler); };
}

// 공용: 한 번의 UUID 조회 후 상태/제어 구독을 모두 붙임
export async function subscribeAllForUser(userId: string, qos: 0 | 1 | 2 = 1) {
  // forceRefresh로 최초 한 번만 REST 호출하고, 이후 호출들은 캐시 사용
  await getUserDeviceUuidsCached(userId, { forceRefresh: true }).catch(() => undefined);
  try { await startDashStatusSubscriptionsForUser(userId); } catch {}
  let cr: null | (() => Promise<void>) = null;
  try { cr = await subscribeControlResultForUser(userId, qos).catch(() => null); } catch {}
  return cr; // 제어 구독 해제 핸들러(있으면)
}


