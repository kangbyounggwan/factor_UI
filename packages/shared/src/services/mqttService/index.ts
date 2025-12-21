import { createSharedMqttClient, onDashStatusMessage as onDashStatus } from "../../component/mqtt";

// Singleton client for app/web
const client = createSharedMqttClient();

export async function mqttConnect(): Promise<void> {
  await client.connect();
}

// 민감한 정보 마스킹 유틸리티
function maskSensitiveData(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;

  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    // URL 관련 필드는 존재 여부만 표시
    if (['input', 'streamUrl', 'url', 'play_url_webrtc', 'rtsp_base', 'webrtc_base'].includes(key)) {
      masked[key] = value ? '[MASKED]' : null;
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

export async function mqttPublish(topic: string, message: unknown, qos: 0 | 1 | 2 = 1, retain = false): Promise<void> {
  // 토픽에서 UUID 마스킹
  const maskedTopic = topic.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '***');
  console.log('[MQTT][PUBLISH] Topic:', maskedTopic);

  // 메시지에서 민감한 정보 마스킹
  if (typeof message === 'object' && message !== null) {
    console.log('[MQTT][PUBLISH] Message:', JSON.stringify(maskSensitiveData(message), null, 2));
  } else {
    console.log('[MQTT][PUBLISH] Message:', message);
  }

  console.log('[MQTT][PUBLISH] QoS:', qos, 'Retain:', retain);
  await client.publish(topic, message, qos, retain);
  console.log('[MQTT][PUBLISH] Published successfully');
}

export async function mqttSubscribe(topic: string, handler: (topic: string, payload: any) => void, qos: 0 | 1 | 2 = 1): Promise<void> {
  await client.subscribe(topic, handler, qos);
}


export async function mqttUnsubscribe(topic: string, handler?: (topic: string, payload: any) => void): Promise<void> {
  await client.unsubscribe(topic, handler);
}

// Convenience helpers
export function onDashStatusMessage(listener: (uuid: string, data: any) => void) {
  return onDashStatus(listener);
}

// === Control publish (facade for consumers) ===
export async function publishControlHome(deviceSerial: string, axes: string | string[] = 'XYZ') {
  const axesString = Array.isArray(axes) ? axes.join('') : axes;
  const topic = `control/${deviceSerial}`;
  const payload = { type: 'home' as const, axes: axesString };
  await mqttPublish(topic, payload, 1, false);
}

export async function publishControlPause(deviceSerial: string) {
  const topic = `control/${deviceSerial}`;
  const payload = { type: 'pause' as const };
  await mqttPublish(topic, payload, 1, false);
}

export async function publishControlResume(deviceSerial: string) {
  const topic = `control/${deviceSerial}`;
  const payload = { type: 'resume' as const };
  await mqttPublish(topic, payload, 1, false);
}

export async function publishControlCancel(deviceSerial: string) {
  const topic = `control/${deviceSerial}`;
  const payload = { type: 'cancel' as const };
  await mqttPublish(topic, payload, 1, false);
}


// === Dashboard move (axis jog) ===
export type MoveMode = 'relative' | 'absolute';
export type DashboardMovePayload = {
  type: 'move';
  mode: MoveMode;
  x?: number;
  y?: number;
  z?: number;
  e?: number;
  feedrate?: number; // mm/min
};

export async function publishDashboardMove(
  deviceSerial: string,
  params: {
    mode: MoveMode;
    x?: number;
    y?: number;
    z?: number;
    e?: number;
    feedrate?: number; // mm/min, default 1000
  }
) {
  const topic = `control/${deviceSerial}`;
  const { mode, feedrate = 1000, x, y, z, e } = params;
  const payload: DashboardMovePayload = { type: 'move', mode };
  if (x != null) payload.x = x;
  if (y != null) payload.y = y;
  if (z != null) payload.z = z;
  if (e != null) payload.e = e;
  if (feedrate != null) payload.feedrate = feedrate;
  console.log('[MQTT][TX]', topic, payload);
  await mqttPublish(topic, payload, 1, false);
}

// === Dashboard set temperature ===
export type SetTemperaturePayload = {
  type: 'set_temperature';
  tool: number; // bed: -1, nozzle0:0, nozzle1:1, ...
  temperature: number; // °C
  wait?: boolean; // default false
};

export async function publishDashboardSetTemperature(
  deviceSerial: string,
  params: { tool: number; temperature: number; wait?: boolean }
) {
  const topic = `control/${deviceSerial}`;
  const { tool, temperature, wait = false } = params;
  const payload: SetTemperaturePayload = { type: 'set_temperature', tool, temperature };
  if (wait) payload.wait = true;
  console.log('[MQTT][TX]', topic, payload);
  await mqttPublish(topic, payload, 1, false);
}

// === Feed Rate 설정 (프린팅 중 이송 속도 조절) ===
// 플러그인 control.py의 set_feed_rate 함수와 연동
// M220 S<factor> 명령어 사용, 범위: 10% ~ 500%
export type SetFeedRatePayload = {
  type: 'set_feed_rate';
  factor: number; // percentage (10-500%)
};

/**
 * Feed Rate(이송 속도) 설정 - M220 명령어
 * @param deviceSerial - 디바이스 UUID
 * @param factor - 백분율 (10-500%, 기본 100%)
 */
export async function publishSetFeedRate(
  deviceSerial: string,
  factor: number
) {
  const topic = `control/${deviceSerial}`;
  const payload: SetFeedRatePayload = { type: 'set_feed_rate', factor };
  console.log('[MQTT][TX]', topic, payload);
  await mqttPublish(topic, payload, 1, false);
}

// === SD Upload (chunk/commit) ===
type SdUploadChunkBase = {
  type: 'sd_upload_chunk';
  upload_id: string;
  index: number;
  data_b64: string;
  size: number;
};

// New topic for G-code ingestion (prefix)
const TOPIC_GCODE_IN = 'octoprint/gcode_in';

export async function publishSdUploadChunkFirst(
  deviceSerial: string,
  params: SdUploadChunkBase & { name: string; total_size: number; upload_traget?: 'sd' | 'local' }
) {
  // Map to new protocol: send start + first chunk (seq 0)
  const totalChunks = Math.max(1, Math.ceil(params.total_size / Math.max(1, params.size)));
  // 파일명 검증 - undefined나 빈 문자열이면 경고
  if (!params.name || params.name.trim() === '') {
    console.error('[GCODE][ERROR] filename is empty or undefined!', { params_name: params.name });
  }

  const startPayload = {
    action: 'start' as const,
    job_id: params.upload_id,
    filename: params.name,
    name: params.name, // 하위 호환성을 위해 name 필드도 함께 전송
    total_chunks: totalChunks,
    // include user intention if provided (sd/local)
    ...(params.upload_traget ? { upload_traget: params.upload_traget } : {}),
  };
  const topic = `${TOPIC_GCODE_IN}/${deviceSerial}`;
  console.log('[GCODE][START] ========================================');
  console.log('[GCODE][START] FILENAME:', startPayload.filename);
  console.log('[GCODE][START] Full payload:', JSON.stringify(startPayload, null, 2));
  console.log('[GCODE][START] ========================================');
  await mqttPublish(topic, startPayload, 1, false);

  const firstChunkPayload = {
    action: 'chunk' as const,
    job_id: params.upload_id,
    seq: params.index,
    data_b64: params.data_b64,
  };
  console.log('[MQTT][TX]', topic, { ...firstChunkPayload, data_b64: `[${params.data_b64.length}b64]` });
  await mqttPublish(topic, firstChunkPayload, 1, false);
}

export async function publishSdUploadChunk(
  deviceSerial: string,
  params: SdUploadChunkBase
) {
  // Map to new protocol: chunk message
  const chunkPayload = {
    action: 'chunk' as const,
    job_id: params.upload_id,
    seq: params.index,
    data_b64: params.data_b64,
  };
  const topic = `${TOPIC_GCODE_IN}/${deviceSerial}`;
  console.log('[MQTT][TX]', topic, { ...chunkPayload, data_b64: `[${params.data_b64.length}b64]` });
  await mqttPublish(topic, chunkPayload, 1, false);
}

export async function publishSdUploadCommit(deviceSerial: string, uploadId: string, target: 'sd' | 'local' = 'sd') {
  // Map to new protocol: end (target from caller, default sd)
  const endPayload = { action: 'end' as const, job_id: uploadId, target };
  const topic = `${TOPIC_GCODE_IN}/${deviceSerial}`;
  console.log('[GCODE][END]', {
    device: deviceSerial,
    job_id: endPayload.job_id,
    target,
    ts: new Date().toISOString(),
  });
  console.log('[MQTT][TX]', topic, endPayload);
  await mqttPublish(topic, endPayload, 1, false);
}

// Optional: cancel API for callers (kept in same file per single-file change rule)
export async function publishSdUploadCancel(deviceSerial: string, uploadId: string) {
  const cancelPayload = { action: 'cancel' as const, job_id: uploadId };
  const topic = `${TOPIC_GCODE_IN}/${deviceSerial}`;
  console.log('[MQTT][TX]', topic, cancelPayload);
  await mqttPublish(topic, cancelPayload, 1, false);
}

// === G-code print command (trigger printing of an existing file) ===
export async function publishGcodePrint(
  deviceSerial: string,
  params: { filename: string; origin: 'local' | 'sdcard'; job_id?: string }
) {
  const topic = `${TOPIC_GCODE_IN}/${deviceSerial}`;
  const base = (params.filename.split('/')?.pop() || params.filename).replace(/\.[^/.]+$/, '');
  const jobId = params.job_id ?? base;
  const payload = { action: 'print' as const, filename: params.filename, origin: params.origin, job_id: jobId };
  console.log('[MQTT][TX]', topic, payload);
  await mqttPublish(topic, payload, 1, false);
}

// 결과 대기 유틸리티: control_result/sd_upload 수신 대기
export async function waitForSdUploadResult(
  deviceSerial: string,
  onProgress?: (progress: { uploadId: string; stage: string; name: string; receivedBytes: number; totalBytes: number; percent: number }) => void,
  timeoutMs = 120000
): Promise<{ ok: boolean; message?: string }> {
  return new Promise(async (resolve) => {
    const topic = `control_result/${deviceSerial}`;
    console.log('[MQTT][SD] Subscribing to topic:', topic);
    const handler = (t: string, payload: any) => {
      console.log('[MQTT][SD] Received message on topic:', t);
      let parsed: any = payload;
      try {
        if (typeof payload === 'string') parsed = JSON.parse(payload);
        else if (payload instanceof Uint8Array) parsed = JSON.parse(new TextDecoder().decode(payload));
      } catch {}
      console.log('[MQTT][SD][RX]', parsed);
      // SD 업로드 진행률 처리
      if (parsed?.action === 'sd_upload_progress') {
        try {
          const progressData = JSON.parse(parsed.message);
          const { upload_id, stage, name, received_bytes, total_bytes, percent } = progressData;
          
          const progressInfo = {
            uploadId: upload_id,
            stage,
            name,
            receivedBytes: received_bytes,
            totalBytes: total_bytes,
            percent
          };
          
          // 콘솔 출력
          if (stage === 'mqtt_chunk') {
            console.log('📥 MQTT 청크 수신:', {
              uploadId: upload_id,
              fileName: name,
              progress: `${percent}% (${received_bytes}/${total_bytes} bytes)`,
              timestamp: new Date(parsed.timestamp).toLocaleTimeString()
            });
          } else if (stage === 'to_printer') {
            console.log('🖨️ 프린터 전송:', {
              uploadId: upload_id,
              fileName: name,
              progress: `${percent}% (${received_bytes}/${total_bytes} bytes)`,
              timestamp: new Date(parsed.timestamp).toLocaleTimeString()
            });
          } else {
            console.log('📊 SD 업로드 진행률:', {
              uploadId: upload_id,
              stage,
              fileName: name,
              progress: `${percent}% (${received_bytes}/${total_bytes} bytes)`,
              timestamp: new Date(parsed.timestamp).toLocaleTimeString()
            });
          }
          
          // 콜백 호출
          if (onProgress) {
            onProgress(progressInfo);
          }
        } catch (parseError) {
          console.warn('SD 업로드 진행률 파싱 실패:', parsed.message, parseError);
        }
        return; // 진행률 메시지는 resolve하지 않음
      }
      
      // SD 업로드 완료 처리
      if (parsed?.type === 'control_result' && parsed?.action === 'sd_upload') {
        resolve({ ok: Boolean(parsed?.ok), message: parsed?.message });
      }
    };
    try {
      await mqttSubscribe(topic, handler, 1);
    } catch {}
    setTimeout(async () => {
      try { await mqttUnsubscribe(topic, handler); } catch {}
      resolve({ ok: false, message: '응답 시간 초과' });
    }, timeoutMs);
  });
}

// === Camera Streaming ===
export type CameraStartOptions = {
  deviceUuid: string;
  streamUrl: string;
  fps?: number;
  width?: number;
  height?: number;
  bitrateKbps?: number;
  encoder?: 'libx264' | 'h264_omx' | 'h264_v4l2m2m';
  forceMjpeg?: boolean;
  lowLatency?: boolean;
  rtspBase?: string;
  webrtcBase?: string;
};

/**
 * 카메라 스트리밍 시작 명령 전송
 * @param options - 카메라 스트리밍 옵션
 */
export async function publishCameraStart(options: CameraStartOptions): Promise<void> {
  console.log('[CAM][MQTT] ========== publishCameraStart CALLED ==========');

  const {
    deviceUuid,
    streamUrl,
    fps = 20,
    width = 1280,
    height = 720,
    bitrateKbps = 1800,
    encoder = 'libx264',
    forceMjpeg = true,
    lowLatency = true,
    rtspBase = 'rtsp://factor.io.kr:8554',
    webrtcBase = 'https://factor.io.kr/webrtc'
  } = options;

  // 로그에서 민감한 정보 마스킹
  console.log('[CAM][MQTT] Config:', {
    hasStreamUrl: !!streamUrl,
    fps,
    width,
    height,
    encoder
  });

  const topic = `camera/${deviceUuid}/cmd`;
  const payload = {
    type: 'camera',
    action: 'start',
    options: {
      name: `cam-${deviceUuid}`,
      input: streamUrl,
      fps,
      width,
      height,
      bitrateKbps,
      encoder,
      forceMjpeg,
      lowLatency,
      rtsp_base: rtspBase,
      webrtc_base: webrtcBase
    }
  };

  console.log('[CAM][MQTT] Publishing camera start command...');

  await mqttPublish(topic, payload, 1, false);

  console.log('[CAM][MQTT] ✅ Camera start command published');
}

/**
 * 카메라 스트리밍 정지 명령 전송
 * @param deviceUuid - 디바이스 UUID
 */
export async function publishCameraStop(deviceUuid: string): Promise<void> {
  const topic = `camera/${deviceUuid}/cmd`;
  const payload = {
    type: 'camera',
    action: 'stop',
    options: {
      name: `cam-${deviceUuid}`
    }
  };

  console.log('[CAM][MQTT] stop payload', payload);
  await mqttPublish(topic, payload, 1, false);
}

export type CameraStateCallback = (state: {
  running: boolean;
  webrtcUrl: string | null;
  status: 'offline' | 'online';
}) => void;

/**
 * 카메라 상태 구독
 * @param deviceUuid - 디바이스 UUID
 * @param onStateChange - 상태 변경 시 호출되는 콜백 (running 상태, WebRTC URL)
 * @returns 구독 해제 함수
 */
export async function subscribeCameraState(
  deviceUuid: string,
  onStateChange: CameraStateCallback
): Promise<() => Promise<void>> {
  await mqttConnect();

  const topic = `camera/${deviceUuid}/state`;
  console.log('[CAM][STATE] Subscribing to topic:', topic);

  const handler = (_t: string, payload: any) => {
    try {
      // 로그에서 민감한 정보 마스킹
      console.log('[CAM][STATE] Message received on topic:', _t.replace(deviceUuid, '***'));
      const msg = typeof payload === 'string' ? JSON.parse(payload) : payload;

      // 상태 판단
      const running = !!(msg?.running);
      const status = running ? 'online' : 'offline';

      // WebRTC URL 추출
      const webrtcUrl =
        msg?.webrtc?.play_url_webrtc ||
        msg?.play_url_webrtc ||
        (typeof msg?.url === 'string' && !msg.url.endsWith('.m3u8') ? msg.url : null);

      console.log('[CAM][STATE] Extracted state:', { running, hasUrl: !!webrtcUrl, status });
      onStateChange({ running, webrtcUrl, status });
    } catch (e) {
      console.warn('[CAM][STATE] parse error', e);
    }
  };

  await mqttSubscribe(topic, handler, 1);
  console.log('[CAM][STATE] Subscription established for topic:', topic);

  // 구독 해제 함수 반환
  return async () => {
    try {
      console.log('[CAM][STATE] Unsubscribing from topic:', topic);
      await mqttUnsubscribe(topic, handler);
    } catch (e) {
      console.warn('[CAM][STATE] unsubscribe error', e);
    }
  };
}

// === GCode Upload Result (OctoPrint에서 업로드 완료 후 결과 전송) ===
export type GCodeUploadResult = {
  type: 'upload_result';
  job_id: string;
  success: boolean;
  filename: string;
  timestamp: number;
  target?: 'local' | 'sd';      // 성공 시
  file_size?: number;           // 성공 시 (바이트)
  error?: string;               // 실패 시
};

export type GCodeUploadResultCallback = (result: GCodeUploadResult) => void;

// 전역 리스너 관리 (여러 컴포넌트에서 동시에 수신 가능)
const gcodeUploadResultListeners = new Map<string, Set<GCodeUploadResultCallback>>();
const gcodeUploadResultSubscribed = new Set<string>();

/**
 * GCode 업로드 결과 구독
 * OctoPrint 플러그인이 octoprint/gcode_out/{device_uuid} 토픽으로 업로드 결과를 전송
 * @param deviceUuid - 디바이스 UUID
 * @param onResult - 업로드 결과 수신 시 호출되는 콜백
 * @returns 구독 해제 함수
 */
export async function subscribeGCodeUploadResult(
  deviceUuid: string,
  onResult: GCodeUploadResultCallback
): Promise<() => Promise<void>> {
  await mqttConnect();

  const topic = `octoprint/gcode_out/${deviceUuid}`;

  // 리스너 등록
  if (!gcodeUploadResultListeners.has(deviceUuid)) {
    gcodeUploadResultListeners.set(deviceUuid, new Set());
  }
  gcodeUploadResultListeners.get(deviceUuid)!.add(onResult);

  // 이미 구독 중이면 리스너만 추가
  if (gcodeUploadResultSubscribed.has(topic)) {
    console.log('[GCODE][RESULT] Already subscribed, adding listener for:', topic);
    return async () => {
      gcodeUploadResultListeners.get(deviceUuid)?.delete(onResult);
    };
  }

  console.log('[GCODE][RESULT] Subscribing to topic:', topic);

  const handler = (_t: string, payload: any) => {
    try {
      console.log('%c[MQTT]%c%c[GCODE]%c%c[RESULT]%c',
        "background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;", "",
        "background: #9C27B0; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;", "",
        "background: #FF9800; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-left: 4px;",
        "color: #FF9800; font-weight: bold;", { topic: _t, payload });

      let parsed: any = payload;
      if (typeof payload === 'string') {
        parsed = JSON.parse(payload);
      } else if (payload instanceof Uint8Array) {
        parsed = JSON.parse(new TextDecoder().decode(payload));
      }

      // upload_result 타입만 처리
      if (parsed?.type === 'upload_result') {
        const result: GCodeUploadResult = {
          type: 'upload_result',
          job_id: parsed.job_id,
          success: Boolean(parsed.success),
          filename: parsed.filename,
          timestamp: parsed.timestamp,
          target: parsed.target,
          file_size: parsed.file_size,
          error: parsed.error,
        };

        // 모든 리스너에게 전달
        gcodeUploadResultListeners.get(deviceUuid)?.forEach(listener => {
          try {
            listener(result);
          } catch (err) {
            console.error('[GCODE][RESULT] Listener error:', err);
          }
        });

        // 전역 이벤트도 발생 (다른 컴포넌트에서 수신 가능)
        try {
          window.dispatchEvent(new CustomEvent('gcode_upload_result', {
            detail: { deviceUuid, result }
          }));
        } catch {}
      }
    } catch (e) {
      console.warn('[GCODE][RESULT] parse error', e);
    }
  };

  await mqttSubscribe(topic, handler, 1);
  gcodeUploadResultSubscribed.add(topic);
  console.log('[GCODE][RESULT] Subscription established for topic:', topic);

  // 구독 해제 함수 반환
  return async () => {
    gcodeUploadResultListeners.get(deviceUuid)?.delete(onResult);

    // 더 이상 리스너가 없으면 구독 해제
    if (gcodeUploadResultListeners.get(deviceUuid)?.size === 0) {
      try {
        console.log('[GCODE][RESULT] Unsubscribing from topic:', topic);
        await mqttUnsubscribe(topic, handler);
        gcodeUploadResultSubscribed.delete(topic);
        gcodeUploadResultListeners.delete(deviceUuid);
      } catch (e) {
        console.warn('[GCODE][RESULT] unsubscribe error', e);
      }
    }
  };
}

/**
 * 특정 job_id에 대한 업로드 결과 대기 (Promise)
 * @param deviceUuid - 디바이스 UUID
 * @param jobId - 대기할 job_id
 * @param timeoutMs - 타임아웃 (기본 120초)
 * @returns 업로드 결과
 */
export async function waitForGCodeUploadResult(
  deviceUuid: string,
  jobId: string,
  timeoutMs = 120000
): Promise<GCodeUploadResult> {
  return new Promise(async (resolve, reject) => {
    let unsubscribe: (() => Promise<void>) | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const cleanup = async () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (unsubscribe) await unsubscribe();
    };

    const handler: GCodeUploadResultCallback = (result) => {
      if (result.job_id === jobId) {
        cleanup();
        resolve(result);
      }
    };

    try {
      unsubscribe = await subscribeGCodeUploadResult(deviceUuid, handler);

      timeoutId = setTimeout(async () => {
        await cleanup();
        reject(new Error(`GCode upload result timeout for job_id: ${jobId}`));
      }, timeoutMs);
    } catch (err) {
      await cleanup();
      reject(err);
    }
  });
}
