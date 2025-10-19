import { createSharedMqttClient, onDashStatusMessage as onDashStatus } from "../../component/mqtt";

// Singleton client for app/web
const client = createSharedMqttClient();

export async function mqttConnect(): Promise<void> {
  await client.connect();
}

export async function mqttPublish(topic: string, message: unknown, qos: 0 | 1 | 2 = 1, retain = false): Promise<void> {
  await client.publish(topic, message, qos, retain);
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
  const startPayload = {
    action: 'start' as const,
    job_id: params.upload_id,
    filename: params.name,
    total_chunks: totalChunks,
    // include user intention if provided (sd/local)
    ...(params.upload_traget ? { upload_traget: params.upload_traget } : {}),
  };
  const topic = `${TOPIC_GCODE_IN}/${deviceSerial}`;
  console.log('[GCODE][START]', {
    device: deviceSerial,
    job_id: startPayload.job_id,
    filename: startPayload.filename,
    total_chunks: startPayload.total_chunks,
    upload_traget: (startPayload as any).upload_traget ?? 'sd',
    ts: new Date().toISOString(),
  });
  console.log('[MQTT][TX]', topic, startPayload);
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
    const handler = (t: string, payload: any) => {
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

  console.log('[CAM][MQTT] start payload', payload);
  await mqttPublish(topic, payload, 1, false);
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
  const handler = (_t: string, payload: any) => {
    try {
      const msg = typeof payload === 'string' ? JSON.parse(payload) : payload;

      // 상태 판단
      const running = !!(msg?.running);
      const status = running ? 'online' : 'offline';

      // WebRTC URL 추출
      const webrtcUrl =
        msg?.webrtc?.play_url_webrtc ||
        msg?.play_url_webrtc ||
        (typeof msg?.url === 'string' && !msg.url.endsWith('.m3u8') ? msg.url : null);

      onStateChange({ running, webrtcUrl, status });
    } catch (e) {
      console.warn('[CAM][STATE] parse error', e);
    }
  };

  await mqttSubscribe(topic, handler, 1);

  // 구독 해제 함수 반환
  return async () => {
    try {
      await mqttUnsubscribe(topic, handler);
    } catch (e) {
      console.warn('[CAM][STATE] unsubscribe error', e);
    }
  };
}
