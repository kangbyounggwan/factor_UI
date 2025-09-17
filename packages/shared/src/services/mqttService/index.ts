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

export async function publishDashboardGetStatus(deviceId: string) {
  const topic = `DASHBOARD/${deviceId}`;
  const payload = { type: "get_status" } as const;
  console.log('[MQTT][TX]', topic, payload);
  await mqttPublish(topic, payload, 1, false);
}

export async function publishDashboardGetStatusStop(deviceId: string) {
  const topic = `DASHBOARD/${deviceId}`;
  const payload = { type: "get_status_stop" } as const;
  console.log('[MQTT][TX]', topic, payload);
  await mqttPublish(topic, payload, 1, false);
}

export async function publishDashboardCommand(deviceId: string, cmd: string) {
  const topic = `dashboard/${deviceId}`;
  const payload = { type: "command", cmd } as const;
  await mqttPublish(topic, payload, 1, false);
}

export async function publishAdminCommand(deviceId: string, cmd: string) {
  const topic = `ADMIN_COMMAND/${deviceId}`;
  const payload = { type: "command", cmd } as const;
  await mqttPublish(topic, payload, 1, false);
}

export async function publishAdminMcode(deviceId: string, cmd: string) {
  const topic = `ADMIN_COMMAND/MCOD_MODE/${deviceId}`;
  const payload = { type: "command", cmd } as const;
  await mqttPublish(topic, payload, 1, false);
}



// === Control publish (facade for consumers) ===
export async function publishControlHome(deviceSerial: string, axes: string | string[] = 'XYZ') {
  const axesString = Array.isArray(axes) ? axes.join('') : axes;
  const topic = `control/home/${deviceSerial}`;
  const payload = { axes: axesString } as const;
  await mqttPublish(topic, payload, 0, false);
}

export async function publishControlPause(deviceSerial: string) {
  const topic = `control/pause/${deviceSerial}`;
  const payload = {};
  await mqttPublish(topic, payload, 0, false);
}

export async function publishControlResume(deviceSerial: string) {
  const topic = `control/resume/${deviceSerial}`;
  const payload = {};
  await mqttPublish(topic, payload, 0, false);
}

export async function publishControlCancel(deviceSerial: string) {
  const topic = `control/cancel/${deviceSerial}`;
  const payload = {};
  await mqttPublish(topic, payload, 0, false);
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
  const topic = `DASHBOARD/${deviceSerial}`;
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
  const topic = `DASHBOARD/${deviceSerial}`;
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

export async function publishSdUploadChunkFirst(
  deviceSerial: string,
  params: SdUploadChunkBase & { name: string; total_size: number }
) {
  const topic = `DASHBOARD/${deviceSerial}`;
  const payload = params;
  console.log('[MQTT][TX]', topic, { ...payload, data_b64: `[${payload.data_b64.length}b64]` });
  await mqttPublish(topic, payload, 1, false);
}

export async function publishSdUploadChunk(
  deviceSerial: string,
  params: SdUploadChunkBase
) {
  const topic = `DASHBOARD/${deviceSerial}`;
  const payload = params;
  console.log('[MQTT][TX]', topic, { ...payload, data_b64: `[${payload.data_b64.length}b64]` });
  await mqttPublish(topic, payload, 1, false);
}

export async function publishSdUploadCommit(deviceSerial: string, uploadId: string) {
  const topic = `DASHBOARD/${deviceSerial}`;
  const payload = { type: 'sd_upload_commit' as const, upload_id: uploadId };
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
