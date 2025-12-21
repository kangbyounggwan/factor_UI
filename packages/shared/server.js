import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import mqtt from 'mqtt';
import { createMqttProxy } from './mqttProxyServer.js';
// 브라우저 전용 supabase client.ts는 Node 환경에서 사용하지 않습니다.

async function resolveSupabaseEnv() {
  let url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  let key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && key && serviceKey) return { url, key, serviceKey, source: 'env' };

  // .env 탐색 (cwd → 상위)
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env'),
    path.resolve(process.cwd(), '..', '..', '.env'),
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, 'utf-8');
      for (const line of raw.split(/\r?\n/)) {
        const l = line.trim();
        if (!l || l.startsWith('#')) continue;
        const i = l.indexOf('=');
        if (i <= 0) continue;
        const k = l.slice(0, i).trim();
        const v = l.slice(i + 1).trim().replace(/^"|"$/g, '');
        if (k === 'SUPABASE_URL' || k === 'VITE_SUPABASE_URL') url = url || v;
        if (k === 'SUPABASE_ANON_KEY' || k === 'VITE_SUPABASE_ANON_KEY') key = key || v;
        if (k === 'SUPABASE_SERVICE_ROLE_KEY') serviceKey = serviceKey || v;
      }
      if (url && key) return { url, key, serviceKey, source: p };
    } catch {}
  }

  return { url: undefined, key: undefined, serviceKey: undefined, source: 'missing' };
}

async function supabasePasswordLogin(email, password) {
  const env = await resolveSupabaseEnv();
  if (!env.url || !env.key) {
    return { ok: false, status: 500, error: 'Supabase 환경 변수가 설정되지 않았습니다.' };
  }
  const endpoint = `${String(env.url).replace(/\/$/, '')}/auth/v1/token?grant_type=password`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.key },
    body: JSON.stringify({ email, password })
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const message = data?.error_description || data?.error || data?.message || `HTTP ${res.status}`;
    return { ok: false, status: res.status, error: message };
  }
  return { ok: true, status: res.status, data };
}

function normalizePayload(p) {
  const printerInput = p?.printer ?? p?.connection ?? {};
  const nestedConn = printerInput?.connection ?? {};
  const profile = printerInput?.profile ?? nestedConn?.profile ?? {};
  const model =  printerInput.connection[3].name ?? printerInput.connection[3].model ?? printerInput.profile?.model ?? null;
  const firmware = printerInput?.firmware ?? profile?.firmware ?? null;
  const printerUuid = p?.printer?.uuid ?? p?.printer?.UUID ?? printerInput?.uuid ?? null;
  const streamUrl = p?.camera?.stream_url ?? p?.camera?.streamURL ?? null;
  const registration = { is_new: p?.registration?.is_new === true };

  return {
    client:  { uuid: p?.client?.uuid ?? null },
    printer: { model: model, firmware, uuid: printerUuid },
    camera:  { uuid: p?.camera?.uuid ?? p?.camera?.UUID ?? null, resolution: p?.camera?.resolution ?? null },
    software:{ firmware_version: p?.software?.firmware_version ?? null, firmware: p?.software?.firmware ?? null, last_update: p?.software?.last_update ?? null, uuid: p?.software?.uuid ?? null },
    registration,
    extra: { camera_stream_url: streamUrl },
  };
}

async function getUserIdFromToken(env, accessToken) {
  const res = await fetch(`${String(env.url).replace(/\/$/, '')}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': env.key },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.id || null;
}

async function registerDeviceViaRest(env, accessToken, payload, userId) {
  // 서버 사이드에서 Supabase REST를 사용하여 upsert 수행
  const isNew = payload?.registration?.is_new === true;

  if (isNew) {
    // 신규 등록일 때만 clients/printers 생성(upsert)
    await sbUpsert(env, accessToken, 'clients', [{
      user_id: userId,
      device_uuid: payload.client.uuid,
      firmware_version: payload.software.firmware_version,
      firmware: payload.software.firmware,
      last_update: payload.software.last_update,
      software_uuid: payload.software.uuid,
      status: 'active',
    }], 'device_uuid');

    const base = {
      user_id: userId,
      device_uuid: payload.client.uuid,
      model: payload.printer.model,
      firmware: payload.printer.firmware,
      status: 'connected',
    };
    if (payload.client.uuid) {
      await sbUpsert(env, accessToken, 'printers', [{ ...base, printer_uuid: payload.client.uuid }], 'printer_uuid');
    } else {
      await sbUpsert(env, accessToken, 'printers', [{ ...base, printer_uuid: null }], 'device_uuid');
    }
  }

  // cameras: is_new면 upsert, 아니면 기존 행만 업데이트
  const streamUrl = payload?.extra?.camera_stream_url ?? null;
  if (isNew) {
    await sbUpsert(env, accessToken, 'cameras', [{
      user_id: userId,
      device_uuid: payload.client.uuid,
      resolution: payload.camera.resolution,
      ...(streamUrl ? { stream_url: streamUrl } : {}),
    }], 'device_uuid');
  } else {
    const values = {};
    if (streamUrl != null) values.stream_url = streamUrl;
    if (payload.camera?.resolution != null) values.resolution = payload.camera.resolution;
    if (Object.keys(values).length > 0) {
      await sbUpdate(env, accessToken, 'cameras', { device_uuid: payload.client.uuid }, values);
    }
  }
}

async function sbUpsert(env, accessToken, table, rows, onConflict) {
  const url = `${String(env.url).replace(/\/$/, '')}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': env.key,
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    let text = '';
    try { text = await res.text(); } catch {}
    throw new Error(`Upsert failed for ${table}: ${res.status} ${text}`);
  }
}

async function sbUpdate(env, accessToken, table, matchQuery, values) {
  const qs = Object.entries(matchQuery)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${encodeURIComponent(k)}=eq.${encodeURIComponent(String(v))}`)
    .join('&');
  const url = `${String(env.url).replace(/\/$/, '')}/rest/v1/${table}?${qs}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': env.key,
    },
    body: JSON.stringify(values),
  });
  if (!res.ok) {
    let text = '';
    try { text = await res.text(); } catch {}
    throw new Error(`Update failed for ${table}: ${res.status} ${text}`);
  }
}

async function fetchPrintersForUser(env, accessToken, userId) {
  const baseUrl = String(env.url).replace(/\/$/, '');
  const url =
    `${baseUrl}/rest/v1/printers` +
    `?select=id,model,status,group_id,device_uuid` +
    `&user_id=eq.${encodeURIComponent(userId)}` +
    `&order=model.asc`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'apikey': env.key,
    },
  });

  if (!res.ok) {
    let text = '';
    try { text = await res.text(); } catch {}
    console.warn('[FETCH] printers REST error:', res.status, text);
    return [];
  }

  const rows = await res.json();
  try { console.log('[FETCH] printers (REST) count:', Array.isArray(rows) ? rows.length : 0); } catch {}
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    device_uuid: (r && (r.device_uuid != null ? r.device_uuid : r.device_id)) ?? null,
    model: (r && r.model) ?? null,
  }));
}

// 플랜별 프린터 제한 상수
const PLAN_MAX_PRINTERS = {
  free: 1,
  pro: 5,
  enterprise: Infinity, // unlimited
};

// 프린터 개수 조회 함수
async function countPrintersForUser(env, accessToken, userId) {
  const baseUrl = String(env.url).replace(/\/$/, '');
  const url =
    `${baseUrl}/rest/v1/printers` +
    `?select=id` +
    `&user_id=eq.${encodeURIComponent(userId)}`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'apikey': env.key,
    },
  });

  if (!res.ok) {
    return 0;
  }

  const rows = await res.json();
  return Array.isArray(rows) ? rows.length : 0;
}

// 플랜 제한 체크 함수
async function checkPrinterLimit(env, accessToken, userId) {
  // 사용자 구독 정보 조회
  const subscription = await fetchSubscriptionForUser(env, userId);
  const planName = (subscription?.plan_name || subscription?.plan || 'free').toLowerCase();
  const maxPrinters = PLAN_MAX_PRINTERS[planName] ?? PLAN_MAX_PRINTERS.free;

  // 현재 프린터 개수 조회
  const currentCount = await countPrintersForUser(env, accessToken, userId);

  return {
    canAdd: currentCount < maxPrinters,
    currentCount,
    maxPrinters,
    planName,
  };
}

function safeRedact(obj) {
  try {
    const json = JSON.parse(JSON.stringify(obj || {}));
    // 간단한 마스킹 처리
    if (json.password) json.password = '***';
    if (json.access_token) json.access_token = '***';
    if (json.token) json.token = '***';
    if (json.user?.access_token) json.user.access_token = '***';
    if (json.user?.token) json.user.token = '***';
    if (json.user?.session?.access_token) json.user.session.access_token = '***';
    return json;
  } catch {
    return {};
  }
}

function safeStringify(obj) {
  try {
    return JSON.stringify(obj ?? {}, null, 2);
  } catch {
    return String(obj);
  }
}

function safeHeaderRedact(req) {
  try {
    const h = (req && (req.headers || {})) || {};
    const rawAuth = String(h['authorization'] || h['Authorization'] || '');
    let authorization;
    if (rawAuth) {
      if (rawAuth.toLowerCase().startsWith('bearer ')) {
        const token = rawAuth.slice(7);
        authorization = 'Bearer ' + (token.length > 12 ? `${token.slice(0, 4)}...${token.slice(-4)}` : '***');
      } else {
        authorization = rawAuth.length > 12 ? `${rawAuth.slice(0, 4)}...${rawAuth.slice(-4)}` : '***';
      }
    }
    return {
      authorization,
      'content-type': h['content-type'] || h['Content-Type'] || undefined,
      'x-trace-id': h['x-trace-id'] || h['X-Trace-Id'] || undefined,
    };
  } catch {
    return {};
  }
}

function extractAccessToken(req) {
  const authHeader = String(req.headers['authorization'] || '');
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const fromBody = req.body?.access_token || req.body?.token || null;
  const fromUser = req.body?.user?.access_token || req.body?.user?.token || req.body?.user?.session?.access_token || null;
  return bearer || fromBody || fromUser || null;
}

// API 키 추출 (X-API-Key 헤더 또는 api_key 쿼리 파라미터)
function extractApiKey(req) {
  const fromHeader = req.headers['x-api-key'] || req.headers['X-Api-Key'] || null;
  const fromQuery = req.query?.api_key || null;
  return fromHeader || fromQuery || null;
}

// SHA-256 해시 생성 (Node.js crypto 사용)
async function hashApiKey(apiKey) {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

// API 키로 사용자 ID 조회
async function getUserIdFromApiKey(env, apiKey) {
  const keyHash = await hashApiKey(apiKey);
  console.log('[API_KEY] Looking up hash:', keyHash);

  const url = `${String(env.url).replace(/\/$/, '')}/rest/v1/api_keys` +
    `?select=user_id,permissions,is_active,expires_at` +
    `&key_hash=eq.${encodeURIComponent(keyHash)}` +
    `&is_active=eq.true`;

  console.log('[API_KEY] Query URL:', url);

  // RLS 우회를 위해 service role key 사용
  const authKey = env.serviceKey || env.key;
  const res = await fetch(url, {
    headers: {
      'apikey': authKey,
      'Authorization': `Bearer ${authKey}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.warn('[API_KEY] Lookup failed:', res.status, text);
    return null;
  }

  const rows = await res.json();
  console.log('[API_KEY] Query result:', JSON.stringify(rows));
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const keyData = rows[0];

  // 만료 확인
  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
    console.warn('[API_KEY] Key expired');
    return null;
  }

  // 마지막 사용 시간 업데이트
  updateApiKeyLastUsed(env, keyHash).catch(() => {});

  return {
    userId: keyData.user_id,
    permissions: keyData.permissions || ['read'],
  };
}

// API 키 마지막 사용 시간 업데이트
async function updateApiKeyLastUsed(env, keyHash) {
  const url = `${String(env.url).replace(/\/$/, '')}/rest/v1/api_keys` +
    `?key_hash=eq.${encodeURIComponent(keyHash)}`;

  await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.key,
      'Authorization': `Bearer ${env.key}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ last_used_at: new Date().toISOString() }),
  });
}

// 사용자의 모든 프린터 상세 정보 조회
async function fetchPrintersDetailForUser(env, userId) {
  const baseUrl = String(env.url).replace(/\/$/, '');
  const url =
    `${baseUrl}/rest/v1/printers` +
    `?select=id,printer_uuid,device_uuid,name,model,manufacture_id,firmware,status,group_id,ip_address,port,created_at,updated_at` +
    `&user_id=eq.${encodeURIComponent(userId)}` +
    `&order=name.asc`;

  // RLS 우회를 위해 service role key 사용
  const authKey = env.serviceKey || env.key;
  const res = await fetch(url, {
    headers: {
      'apikey': authKey,
      'Authorization': `Bearer ${authKey}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.warn('[FETCH] printers detail error:', res.status, text);
    return [];
  }

  return await res.json();
}

// 사용자의 카메라 정보 조회
async function fetchCamerasForUser(env, userId) {
  const baseUrl = String(env.url).replace(/\/$/, '');
  const url =
    `${baseUrl}/rest/v1/cameras` +
    `?select=id,device_uuid,stream_url,resolution,created_at` +
    `&user_id=eq.${encodeURIComponent(userId)}`;

  // RLS 우회를 위해 service role key 사용
  const authKey = env.serviceKey || env.key;
  const res = await fetch(url, {
    headers: {
      'apikey': authKey,
      'Authorization': `Bearer ${authKey}`,
    },
  });

  if (!res.ok) {
    console.warn('[FETCH] cameras error:', res.status);
    return [];
  }

  return await res.json();
}

// 사용자의 구독 정보 조회
async function fetchSubscriptionForUser(env, userId) {
  const baseUrl = String(env.url).replace(/\/$/, '');
  const url =
    `${baseUrl}/rest/v1/subscriptions` +
    `?select=*` +
    `&user_id=eq.${encodeURIComponent(userId)}` +
    `&status=eq.active` +
    `&limit=1`;

  // RLS 우회를 위해 service role key 사용
  const authKey = env.serviceKey || env.key;
  const res = await fetch(url, {
    headers: {
      'apikey': authKey,
      'Authorization': `Bearer ${authKey}`,
    },
  });

  if (!res.ok) {
    return null;
  }

  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

// 사용자의 AI 모델 목록 조회
async function fetchAiModelsForUser(env, userId, limit = 20) {
  const baseUrl = String(env.url).replace(/\/$/, '');
  const url =
    `${baseUrl}/rest/v1/ai_generated_models` +
    `?select=id,name,prompt,source_type,status,thumbnail_url,created_at` +
    `&user_id=eq.${encodeURIComponent(userId)}` +
    `&order=created_at.desc` +
    `&limit=${limit}`;

  // RLS 우회를 위해 service role key 사용
  const authKey = env.serviceKey || env.key;
  const res = await fetch(url, {
    headers: {
      'apikey': authKey,
      'Authorization': `Bearer ${authKey}`,
    },
  });

  if (!res.ok) {
    return [];
  }

  return await res.json();
}

// 디바이스별 실시간 데이터 저장소 (전역)
const realtimeDataStore = new Map();

// 기본 프린터 데이터 템플릿
const createDefaultPrinterData = () => ({
  status: 'idle',
  connected: false,
  printing: false,
  error_message: null,
  temperature: { tool: { current: 0, target: 0 }, bed: { current: 0, target: 0 } },
  position: { x: 0, y: 0, z: 0, e: 0 },
  printProgress: { completion: 0, file_position: 0, file_size: 0, print_time: 0, print_time_left: 0, filament_used: 0 },
  lastUpdated: null
});

// 디바이스별 데이터 가져오기 (없으면 생성)
const getDeviceData = (deviceUuid) => {
  if (!realtimeDataStore.has(deviceUuid)) {
    realtimeDataStore.set(deviceUuid, createDefaultPrinterData());
  }
  return realtimeDataStore.get(deviceUuid);
};

// 디바이스 데이터 업데이트
const updateDeviceData = (deviceUuid, updates) => {
  const data = getDeviceData(deviceUuid);
  Object.assign(data, updates, { lastUpdated: new Date().toISOString() });
  return data;
};

// MQTT 클라이언트 설정 및 realtimeDataStore 연동
let mqttClient = null;

function setupMqttSubscriber() {
  const mqttUrl = process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883';

  try {
    mqttClient = mqtt.connect(mqttUrl, {
      clientId: `factor-api-server-${Date.now()}`,
      clean: true,
      reconnectPeriod: 5000,
    });

    mqttClient.on('connect', () => {
      console.log('[MQTT] Connected to broker:', mqttUrl);
      // octoprint 상태 토픽 구독 (모든 디바이스)
      mqttClient.subscribe('octoprint/status/#', (err) => {
        if (err) {
          console.error('[MQTT] Subscribe error (octoprint/status):', err);
        } else {
          console.log('[MQTT] Subscribed to octoprint/status/#');
        }
      });
      // dash_status 토픽도 구독 (프린터 상태 브로드캐스트)
      mqttClient.subscribe('dash_status/#', (err) => {
        if (err) {
          console.error('[MQTT] Subscribe error (dash_status):', err);
        } else {
          console.log('[MQTT] Subscribed to dash_status/#');
        }
      });
      // control_result 토픽 구독 (제어 명령 응답)
      mqttClient.subscribe('control_result/#', (err) => {
        if (err) {
          console.error('[MQTT] Subscribe error (control_result):', err);
        } else {
          console.log('[MQTT] Subscribed to control_result/#');
        }
      });
    });

    // 제어 명령 응답 대기를 위한 콜백 저장소
    // key: `${deviceUuid}:${commandId}`, value: { resolve, reject, timeout }
    const controlResultCallbacks = new Map();

    mqttClient.on('message', (topic, message) => {
      try {
        let deviceUuid = null;
        let payload = null;

        // octoprint/status/{deviceUuid} 토픽 처리
        const octoprintMatch = topic.match(/^octoprint\/status\/(.+)$/);
        // dash_status/{deviceUuid} 토픽 처리
        const dashMatch = topic.match(/^dash_status\/(.+)$/);
        // control_result/{deviceUuid} 토픽 처리
        const controlResultMatch = topic.match(/^control_result\/(.+)$/);

        // control_result 메시지 처리 (제어 명령 응답)
        if (controlResultMatch) {
          deviceUuid = controlResultMatch[1];
          payload = JSON.parse(message.toString());
          console.log(`[MQTT] Control result received for ${deviceUuid}:`, payload);

          // 대기 중인 콜백이 있으면 호출
          const callbackKey = `${deviceUuid}:${payload.command_id || payload.action || 'unknown'}`;
          // 범용 키로도 확인 (command_id 없는 경우)
          const genericKey = `${deviceUuid}:*`;

          let callback = controlResultCallbacks.get(callbackKey);
          if (!callback) {
            callback = controlResultCallbacks.get(genericKey);
          }

          if (callback) {
            clearTimeout(callback.timeout);
            controlResultCallbacks.delete(callbackKey);
            controlResultCallbacks.delete(genericKey);
            callback.resolve(payload);
          }
          return;
        }

        if (octoprintMatch) {
          deviceUuid = octoprintMatch[1];
          payload = JSON.parse(message.toString());
        } else if (dashMatch) {
          deviceUuid = dashMatch[1];
          payload = JSON.parse(message.toString());
        } else {
          return;
        }

        if (!deviceUuid || !payload) return;

        // realtimeDataStore에 데이터 저장
        const deviceData = getDeviceData(deviceUuid);

        // dash_status 토픽 처리 (기존 앱에서 사용하는 데이터 구조)
        // payload 구조: { connected, printer_status: { state, flags, printing, error_message }, temperature_info: { tool, bed }, position, progress }
        if (dashMatch) {
          // connected 상태
          if (payload.connected !== undefined) {
            deviceData.connected = Boolean(payload.connected);
          }
          // printer_status
          if (payload.printer_status) {
            deviceData.status = payload.printer_status.state ?? 'idle';
            deviceData.printing = Boolean(payload.printer_status.printing);
            deviceData.error_message = payload.printer_status.error_message ?? null;
          }
          // temperature_info
          if (payload.temperature_info) {
            const tInfo = payload.temperature_info;
            const toolAny = tInfo.tool;
            const tool = toolAny?.tool0 ?? toolAny;
            if (tool) {
              deviceData.temperature.tool = {
                current: Number(tool.actual) || 0,
                target: Number(tool.target) || 0,
              };
            }
            if (tInfo.bed) {
              deviceData.temperature.bed = {
                current: Number(tInfo.bed.actual) || 0,
                target: Number(tInfo.bed.target) || 0,
              };
            }
          }
          // position
          if (payload.position) {
            deviceData.position = payload.position;
          }
          // progress
          if (payload.progress) {
            const p = payload.progress;
            deviceData.printProgress = {
              completion: typeof p.completion === 'number' ? p.completion : 0,
              file_position: p.file_position ?? 0,
              file_size: p.file_size ?? 0,
              print_time: p.print_time ?? 0,
              print_time_left: p.print_time_left ?? 0,
              filament_used: p.filament_used ?? 0,
            };
          }
        }

        // octoprint/status 토픽 처리 (OctoPrint 데이터 구조)
        if (octoprintMatch) {
          if (payload.state) {
            deviceData.status = payload.state.flags?.printing ? 'printing' :
                                payload.state.flags?.operational ? 'idle' : 'disconnected';
            deviceData.connected = payload.state.flags?.operational || false;
            deviceData.printing = payload.state.flags?.printing || false;
            deviceData.error_message = payload.state.flags?.error ? payload.state.text : null;
          }
          if (payload.temperatures) {
            if (payload.temperatures.tool0) {
              deviceData.temperature.tool = {
                current: payload.temperatures.tool0.actual || 0,
                target: payload.temperatures.tool0.target || 0,
              };
            }
            if (payload.temperatures.bed) {
              deviceData.temperature.bed = {
                current: payload.temperatures.bed.actual || 0,
                target: payload.temperatures.bed.target || 0,
              };
            }
          }
          if (payload.progress && typeof payload.progress === 'object') {
            deviceData.printProgress = {
              completion: payload.progress.completion || 0,
              file_position: payload.progress.filepos || 0,
              file_size: payload.progress.file_size || 0,
              print_time: payload.progress.print_time || 0,
              print_time_left: payload.progress.time_left || 0,
              filament_used: payload.job?.filament?.length || 0,
            };
          }
          if (payload.axes?.current) {
            deviceData.position = {
              x: payload.axes.current.x || 0,
              y: payload.axes.current.y || 0,
              z: payload.axes.current.z || 0,
              e: payload.axes.current.e || 0,
            };
          }
        }

        deviceData.lastUpdated = new Date().toISOString();

        // 디버그 로그 (최초 수신 시에만)
        if (!deviceData._logged) {
          console.log(`[MQTT] First data received for device: ${deviceUuid} (topic: ${topic})`);
          deviceData._logged = true;
        }
      } catch (err) {
        // JSON 파싱 오류 무시 (간헐적 깨진 메시지)
      }
    });

    mqttClient.on('error', (err) => {
      console.error('[MQTT] Connection error:', err.message);
    });

    mqttClient.on('close', () => {
      console.log('[MQTT] Connection closed, will reconnect...');
    });

  } catch (err) {
    console.error('[MQTT] Setup error:', err.message);
  }
}

function mountRest(app) {
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'email, password가 필요합니다.' });
      }
      const result = await supabasePasswordLogin(email, password);
      if (!result.ok) {
        return res.status(result.status || 401).json({ success: false, message: result.error, status: result.status });
      }
      const { access_token, refresh_token, expires_in, token_type, user } = result.data || {};
      return res.json({ success: true, user, access_token, refresh_token, expires_in, token_type });
    } catch (error) {
      console.error('로그인 API 오류:', error);
      return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  });

  // Compatibility endpoint: /api/printer/register
  app.post('/api/printer/register', async (req, res) => {
    try {
      const env = await resolveSupabaseEnv();
      if (!env.url || !env.key) {
        return res.status(500).json({ success: false, message: 'Supabase 환경 변수가 설정되지 않았습니다.' });
      }

      const accessToken = extractAccessToken(req);
      if (!accessToken) {
        return res.status(401).json({ success: false, message: 'Authorization Bearer access_token이 필요합니다.' });
      }
      const userIdFromBody = req.body?.user?.id || req.body?.user_id || null;
      let userId = await getUserIdFromToken(env, accessToken).catch(() => null);
      if (!userId) userId = userIdFromBody;

      const p = req.body?.payload || req.body;
      try { console.log('[REGISTER] incoming payload (raw)\n' + safeStringify(safeRedact(p))); } catch {}
      if (!p || typeof p !== 'object') {
        return res.status(400).json({ success: false, message: 'payload가 필요합니다.' });
      }

      const payload = normalizePayload(p);
      try {
        console.log('[REGISTER] normalized payload\n' + safeStringify(payload));
        console.log('[REGISTER] derived fields', {
          model: payload?.printer?.model ?? null,
          firmware: payload?.printer?.firmware ?? null,
          client_uuid: payload?.client?.uuid ?? null,
        });
      } catch {}
      if (!payload.client?.uuid) {
        return res.status(400).json({ success: false, message: 'client.uuid(MAC)가 필요합니다.' });
      }

      // 신규 등록(is_new)일 때만 플랜 제한 체크
      const isNewRegistration = payload?.registration?.is_new === true;
      if (isNewRegistration) {
        const limitCheck = await checkPrinterLimit(env, accessToken, userId);
        console.log('[REGISTER] plan limit check:', limitCheck);

        if (!limitCheck.canAdd) {
          return res.status(403).json({
            success: false,
            message: `프린터 등록 한도에 도달했습니다. ${limitCheck.planName.toUpperCase()} 플랜은 최대 ${limitCheck.maxPrinters}대까지 등록 가능합니다. (현재: ${limitCheck.currentCount}대)`,
            code: 'PRINTER_LIMIT_REACHED',
            data: {
              currentCount: limitCheck.currentCount,
              maxPrinters: limitCheck.maxPrinters,
              planName: limitCheck.planName,
              upgradeRequired: true,
            },
          });
        }
      }

      await registerDeviceViaRest(env, accessToken, payload, userId);
      return res.json({ success: true, user_id: userId });
    } catch (error) {
      console.error('register API 오류:', error);
      return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  });

  app.get('/api/printers/summary', async (req, res) => {
    try {
      const env = await resolveSupabaseEnv();
      if (!env.url || !env.key) {
        return res.status(500).json({ success: false, message: 'Supabase 환경 변수가 설정되지 않았습니다.' });
      }

      const accessToken = extractAccessToken(req);
      if (!accessToken) {
        return res.status(401).json({ success: false, message: 'Authorization Bearer access_token이 필요합니다.' });
      }

      const userId = await getUserIdFromToken(env, accessToken).catch(() => null);
      try { console.log('[API][printers/summary] resolved userId:', userId); } catch {}
      if (!userId) {
        return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
      }

      const items = await fetchPrintersForUser(env, accessToken, userId);
      try { console.log('[API][printers/summary] items:', items); } catch {}
      return res.json({ success: true, items });
    } catch (error) {
      console.error('printers summary API 오류:', error);
      return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  });

  // ============================================
  // API Key 기반 엔드포인트 (External API)
  // ============================================

  // API 키 인증 미들웨어
  const apiKeyAuth = async (req, res, next) => {
    try {
      const apiKey = extractApiKey(req);
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: 'API key required',
          message: 'X-API-Key 헤더 또는 api_key 쿼리 파라미터가 필요합니다.',
        });
      }

      const env = await resolveSupabaseEnv();
      if (!env.url || !env.key) {
        return res.status(500).json({ success: false, error: 'Server configuration error' });
      }

      const keyData = await getUserIdFromApiKey(env, apiKey);
      if (!keyData) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key',
          message: 'API 키가 유효하지 않거나 만료되었습니다.',
        });
      }

      // 요청 객체에 사용자 정보 첨부
      req.apiKeyUserId = keyData.userId;
      req.apiKeyPermissions = keyData.permissions;
      req.supabaseEnv = env;

      next();
    } catch (error) {
      console.error('[API_KEY] Auth error:', error);
      return res.status(500).json({ success: false, error: 'Authentication failed' });
    }
  };

  // GET /api/v1/me - 현재 API 키 소유자 정보
  app.get('/api/v1/me', apiKeyAuth, async (req, res) => {
    try {
      const { apiKeyUserId, apiKeyPermissions, supabaseEnv } = req;

      // 사용자 기본 정보 조회
      const url = `${String(supabaseEnv.url).replace(/\/$/, '')}/rest/v1/user_roles` +
        `?select=role` +
        `&user_id=eq.${encodeURIComponent(apiKeyUserId)}`;

      const roleRes = await fetch(url, {
        headers: {
          'apikey': supabaseEnv.key,
          'Authorization': `Bearer ${supabaseEnv.key}`,
        },
      });

      const roles = roleRes.ok ? await roleRes.json() : [];
      const role = Array.isArray(roles) && roles.length > 0 ? roles[0].role : 'user';

      return res.json({
        success: true,
        data: {
          user_id: apiKeyUserId,
          role,
          permissions: apiKeyPermissions,
        },
      });
    } catch (error) {
      console.error('[API_KEY] /me error:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch user info' });
    }
  });

  // GET /api/v1/printers - 모든 프린터 정보 (MQTT 실시간 데이터 포함)
  app.get('/api/v1/printers', apiKeyAuth, async (req, res) => {
    try {
      const { apiKeyUserId, supabaseEnv } = req;
      const printers = await fetchPrintersDetailForUser(supabaseEnv, apiKeyUserId);

      // MQTT 실시간 데이터와 병합
      const printersWithRealtime = printers.map(printer => {
        const realtimeData = realtimeDataStore.get(printer.device_uuid);
        if (realtimeData) {
          return {
            ...printer,
            status: realtimeData.connected ? (realtimeData.printing ? 'printing' : 'idle') : 'disconnected',
            realtime: {
              connected: realtimeData.connected,
              printing: realtimeData.printing,
              temperature: realtimeData.temperature,
              position: realtimeData.position,
              printProgress: realtimeData.printProgress,
              lastUpdated: realtimeData.lastUpdated,
            }
          };
        }
        return printer;
      });

      return res.json({
        success: true,
        data: printersWithRealtime,
        count: printersWithRealtime.length,
      });
    } catch (error) {
      console.error('[API_KEY] /printers error:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch printers' });
    }
  });

  // GET /api/v1/printers/:deviceUuid - 특정 프린터 정보 (MQTT 실시간 데이터 포함)
  app.get('/api/v1/printers/:deviceUuid', apiKeyAuth, async (req, res) => {
    try {
      const { apiKeyUserId, supabaseEnv } = req;
      const { deviceUuid } = req.params;

      const baseUrl = String(supabaseEnv.url).replace(/\/$/, '');
      const url =
        `${baseUrl}/rest/v1/printers` +
        `?select=*` +
        `&user_id=eq.${encodeURIComponent(apiKeyUserId)}` +
        `&device_uuid=eq.${encodeURIComponent(deviceUuid)}`;

      const printerRes = await fetch(url, {
        headers: {
          'apikey': supabaseEnv.key,
          'Authorization': `Bearer ${supabaseEnv.key}`,
        },
      });

      if (!printerRes.ok) {
        return res.status(500).json({ success: false, error: 'Failed to fetch printer' });
      }

      const printers = await printerRes.json();
      if (!Array.isArray(printers) || printers.length === 0) {
        return res.status(404).json({ success: false, error: 'Printer not found' });
      }

      // MQTT 실시간 데이터와 병합
      const printer = printers[0];
      const realtimeData = realtimeDataStore.get(deviceUuid);
      if (realtimeData) {
        printer.status = realtimeData.connected ? (realtimeData.printing ? 'printing' : 'idle') : 'disconnected';
        printer.realtime = {
          connected: realtimeData.connected,
          printing: realtimeData.printing,
          temperature: realtimeData.temperature,
          position: realtimeData.position,
          printProgress: realtimeData.printProgress,
          lastUpdated: realtimeData.lastUpdated,
        };
      }

      return res.json({
        success: true,
        data: printer,
      });
    } catch (error) {
      console.error('[API_KEY] /printers/:id error:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch printer' });
    }
  });

  // GET /api/v1/cameras - 모든 카메라 정보
  app.get('/api/v1/cameras', apiKeyAuth, async (req, res) => {
    try {
      const { apiKeyUserId, supabaseEnv } = req;
      const cameras = await fetchCamerasForUser(supabaseEnv, apiKeyUserId);

      return res.json({
        success: true,
        data: cameras,
        count: cameras.length,
      });
    } catch (error) {
      console.error('[API_KEY] /cameras error:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch cameras' });
    }
  });

  // GET /api/v1/subscription - 구독 정보
  app.get('/api/v1/subscription', apiKeyAuth, async (req, res) => {
    try {
      const { apiKeyUserId, supabaseEnv } = req;
      const subscription = await fetchSubscriptionForUser(supabaseEnv, apiKeyUserId);

      return res.json({
        success: true,
        data: subscription || { plan: 'free', status: 'active' },
      });
    } catch (error) {
      console.error('[API_KEY] /subscription error:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch subscription' });
    }
  });

  // GET /api/v1/models - AI 생성 모델 목록
  app.get('/api/v1/models', apiKeyAuth, async (req, res) => {
    try {
      const { apiKeyUserId, supabaseEnv } = req;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const models = await fetchAiModelsForUser(supabaseEnv, apiKeyUserId, limit);

      return res.json({
        success: true,
        data: models,
        count: models.length,
      });
    } catch (error) {
      console.error('[API_KEY] /models error:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch models' });
    }
  });

  // GET /api/v1/overview - 전체 개요 (대시보드용)
  app.get('/api/v1/overview', apiKeyAuth, async (req, res) => {
    try {
      const { apiKeyUserId, supabaseEnv } = req;

      // 병렬로 모든 데이터 조회
      const [printers, cameras, subscription, models] = await Promise.all([
        fetchPrintersDetailForUser(supabaseEnv, apiKeyUserId),
        fetchCamerasForUser(supabaseEnv, apiKeyUserId),
        fetchSubscriptionForUser(supabaseEnv, apiKeyUserId),
        fetchAiModelsForUser(supabaseEnv, apiKeyUserId, 5),
      ]);

      // 프린터 상태 집계
      const printerStats = {
        total: printers.length,
        connected: printers.filter(p => p.status === 'connected').length,
        printing: printers.filter(p => p.status === 'printing').length,
        idle: printers.filter(p => p.status === 'idle').length,
        error: printers.filter(p => p.status === 'error').length,
      };

      return res.json({
        success: true,
        data: {
          user_id: apiKeyUserId,
          subscription: subscription || { plan: 'free', status: 'active' },
          printers: {
            stats: printerStats,
            items: printers,
          },
          cameras: {
            count: cameras.length,
            items: cameras,
          },
          recent_models: models,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[API_KEY] /overview error:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch overview' });
    }
  });

  // GET /api/v1/realtime/:deviceUuid - 특정 프린터의 실시간 데이터
  app.get('/api/v1/realtime/:deviceUuid', apiKeyAuth, async (req, res) => {
    try {
      const { deviceUuid } = req.params;
      const { apiKeyUserId, supabaseEnv } = req;

      // 사용자가 해당 프린터를 소유하고 있는지 확인
      const baseUrl = String(supabaseEnv.url).replace(/\/$/, '');
      const url = `${baseUrl}/rest/v1/printers` +
        `?select=device_uuid,name,model` +
        `&user_id=eq.${encodeURIComponent(apiKeyUserId)}` +
        `&device_uuid=eq.${encodeURIComponent(deviceUuid)}`;

      // RLS 우회를 위해 service role key 사용
      const authKey = supabaseEnv.serviceKey || supabaseEnv.key;
      const printerRes = await fetch(url, {
        headers: {
          'apikey': authKey,
          'Authorization': `Bearer ${authKey}`,
        },
      });

      if (!printerRes.ok) {
        return res.status(500).json({ success: false, error: 'Failed to fetch printer' });
      }

      const printers = await printerRes.json();
      if (!Array.isArray(printers) || printers.length === 0) {
        return res.status(404).json({ success: false, error: 'Printer not found or access denied' });
      }

      const printer = printers[0];
      const realtimeData = realtimeDataStore.get(deviceUuid) || createDefaultPrinterData();

      res.json({
        success: true,
        data: {
          device_uuid: deviceUuid,
          name: printer.name,
          model: printer.model,
          ...realtimeData
        }
      });
    } catch (error) {
      console.error('[API] Realtime data error:', error);
      res.status(500).json({ success: false, error: 'Failed to get realtime data' });
    }
  });

  // GET /api/v1/realtime - 모든 프린터의 실시간 데이터
  app.get('/api/v1/realtime', apiKeyAuth, async (req, res) => {
    try {
      const { apiKeyUserId, supabaseEnv } = req;

      const printers = await fetchPrintersDetailForUser(supabaseEnv, apiKeyUserId);

      const result = printers.map(printer => {
        const realtimeData = realtimeDataStore.get(printer.device_uuid) || createDefaultPrinterData();
        return {
          device_uuid: printer.device_uuid,
          name: printer.name,
          model: printer.model,
          ...realtimeData
        };
      });

      res.json({ success: true, data: result, count: result.length });
    } catch (error) {
      console.error('[API] Realtime data error:', error);
      res.status(500).json({ success: false, error: 'Failed to get realtime data' });
    }
  });

  // ============================================
  // 프린터 제어 API (MQTT를 통한 제어 명령 전송)
  // ============================================

  // MQTT 명령 전송 헬퍼 함수
  // 기존 mqttService에서 사용하는 토픽: control/${deviceSerial}
  // 페이로드 형식: { type: 'command_type', ...params }
  // waitForResult: true면 control_result 응답을 대기 (기본 10초 타임아웃)
  const sendMqttCommand = (deviceUuid, commandType, payload = {}, options = {}) => {
    const { waitForResult = true, timeout = 10000 } = options;

    return new Promise((resolve, reject) => {
      if (!mqttClient || !mqttClient.connected) {
        reject(new Error('MQTT client not connected'));
        return;
      }

      // 기존 프론트엔드와 동일한 토픽 사용: control/{deviceUuid}
      const topic = `control/${deviceUuid}`;
      // mqttService와 동일한 페이로드 형식: { type: 'command', ...params }
      const message = JSON.stringify({ type: commandType, ...payload });

      // 응답 대기 설정
      if (waitForResult) {
        const callbackKey = `${deviceUuid}:*`;  // 범용 키 사용

        const timeoutId = setTimeout(() => {
          controlResultCallbacks.delete(callbackKey);
          // 타임아웃 시 요청 실패 처리
          reject(new Error(`프린터 응답 타임아웃 (${timeout / 1000}초). 프린터가 오프라인이거나 응답을 지원하지 않습니다.`));
        }, timeout);

        controlResultCallbacks.set(callbackKey, {
          resolve: (resultPayload) => {
            resolve({
              sent: true,
              result: resultPayload,
              message: '명령 전송 및 응답 수신 완료'
            });
          },
          reject,
          timeout: timeoutId
        });
      }

      mqttClient.publish(topic, message, { qos: 1 }, (err) => {
        if (err) {
          console.error(`[MQTT] Publish error to ${topic}:`, err);
          if (waitForResult) {
            const callbackKey = `${deviceUuid}:*`;
            const cb = controlResultCallbacks.get(callbackKey);
            if (cb) {
              clearTimeout(cb.timeout);
              controlResultCallbacks.delete(callbackKey);
            }
          }
          reject(err);
        } else {
          console.log(`[MQTT] Command sent to ${topic}:`, { type: commandType, ...payload });
          // 응답 대기하지 않으면 바로 resolve
          if (!waitForResult) {
            resolve({
              sent: true,
              result: null,
              message: '명령 전송 완료 (응답 대기 없음)'
            });
          }
        }
      });
    });
  };

  // POST /api/printer/:deviceUuid/temperature - 온도 설정 (노즐 + 베드)
  // mqttService 페이로드 형식: { type: 'set_temperature', tool: number, temperature: number }
  // tool: -1 = bed, 0 = nozzle0, 1 = nozzle1, ...
  // query param: wait=false 로 응답 대기 없이 바로 리턴 가능
  app.post('/api/printer/:deviceUuid/temperature', async (req, res) => {
    try {
      const { deviceUuid } = req.params;
      const { nozzle, bed } = req.body;
      const waitForResult = req.query.wait !== 'false';

      if (nozzle === undefined && bed === undefined) {
        return res.status(400).json({ success: false, error: 'nozzle 또는 bed 온도가 필요합니다.' });
      }

      const results = [];
      let lastMqttResult = null;
      if (nozzle !== undefined) {
        const nozzleTemp = Math.max(0, Math.min(300, Number(nozzle)));
        lastMqttResult = await sendMqttCommand(deviceUuid, 'set_temperature', { tool: 0, temperature: nozzleTemp }, { waitForResult });
        results.push({ tool: 0, temperature: nozzleTemp });
      }
      if (bed !== undefined) {
        const bedTemp = Math.max(0, Math.min(120, Number(bed)));
        lastMqttResult = await sendMqttCommand(deviceUuid, 'set_temperature', { tool: -1, temperature: bedTemp }, { waitForResult });
        results.push({ tool: -1, temperature: bedTemp });
      }

      res.json({
        success: true,
        message: lastMqttResult?.message || '온도 설정 명령 전송 완료',
        settings: results,
        mqtt_result: lastMqttResult?.result || null
      });
    } catch (error) {
      console.error('[API] Temperature control error:', error);
      res.status(500).json({ success: false, error: error.message || '온도 설정 실패' });
    }
  });

  // POST /api/printer/:deviceUuid/nozzle-temp - 노즐 온도 설정
  app.post('/api/printer/:deviceUuid/nozzle-temp', async (req, res) => {
    try {
      const { deviceUuid } = req.params;
      const { temperature } = req.body;
      const waitForResult = req.query.wait !== 'false';

      if (temperature === undefined) {
        return res.status(400).json({ success: false, error: 'temperature가 필요합니다.' });
      }

      const temp = Math.max(0, Math.min(300, Number(temperature)));
      const mqttResult = await sendMqttCommand(deviceUuid, 'set_temperature', { tool: 0, temperature: temp }, { waitForResult });

      res.json({
        success: true,
        message: mqttResult.message,
        temperature: temp,
        mqtt_result: mqttResult.result
      });
    } catch (error) {
      console.error('[API] Nozzle temp error:', error);
      res.status(500).json({ success: false, error: error.message || '노즐 온도 설정 실패' });
    }
  });

  // POST /api/printer/:deviceUuid/bed-temp - 베드 온도 설정
  app.post('/api/printer/:deviceUuid/bed-temp', async (req, res) => {
    try {
      const { deviceUuid } = req.params;
      const { temperature } = req.body;
      const waitForResult = req.query.wait !== 'false';

      if (temperature === undefined) {
        return res.status(400).json({ success: false, error: 'temperature가 필요합니다.' });
      }

      const temp = Math.max(0, Math.min(120, Number(temperature)));
      const mqttResult = await sendMqttCommand(deviceUuid, 'set_temperature', { tool: -1, temperature: temp }, { waitForResult });

      res.json({
        success: true,
        message: mqttResult.message,
        temperature: temp,
        mqtt_result: mqttResult.result
      });
    } catch (error) {
      console.error('[API] Bed temp error:', error);
      res.status(500).json({ success: false, error: error.message || '베드 온도 설정 실패' });
    }
  });

  // POST /api/printer/:deviceUuid/feed-rate - 피드 레이트 설정 (10-500%)
  app.post('/api/printer/:deviceUuid/feed-rate', async (req, res) => {
    try {
      const { deviceUuid } = req.params;
      const { rate } = req.body;
      const waitForResult = req.query.wait !== 'false';

      if (rate === undefined) {
        return res.status(400).json({ success: false, error: 'rate가 필요합니다. (10-500)' });
      }

      const feedRate = Math.max(10, Math.min(500, Number(rate)));
      const mqttResult = await sendMqttCommand(deviceUuid, 'set_feed_rate', { factor: feedRate }, { waitForResult });

      res.json({
        success: true,
        message: mqttResult.message,
        rate: feedRate,
        mqtt_result: mqttResult.result
      });
    } catch (error) {
      console.error('[API] Feed rate error:', error);
      res.status(500).json({ success: false, error: error.message || '피드 레이트 설정 실패' });
    }
  });

  // POST /api/printer/:deviceUuid/flow-rate - 플로우 레이트 설정 (10-200%)
  app.post('/api/printer/:deviceUuid/flow-rate', async (req, res) => {
    try {
      const { deviceUuid } = req.params;
      const { rate } = req.body;
      const waitForResult = req.query.wait !== 'false';

      if (rate === undefined) {
        return res.status(400).json({ success: false, error: 'rate가 필요합니다. (10-200)' });
      }

      const flowRate = Math.max(10, Math.min(200, Number(rate)));
      const mqttResult = await sendMqttCommand(deviceUuid, 'set_flow_rate', { factor: flowRate }, { waitForResult });

      res.json({
        success: true,
        message: mqttResult.message,
        rate: flowRate,
        mqtt_result: mqttResult.result
      });
    } catch (error) {
      console.error('[API] Flow rate error:', error);
      res.status(500).json({ success: false, error: error.message || '플로우 레이트 설정 실패' });
    }
  });

  // POST /api/printer/:deviceUuid/pause - 출력 일시정지
  app.post('/api/printer/:deviceUuid/pause', async (req, res) => {
    try {
      const { deviceUuid } = req.params;
      const waitForResult = req.query.wait !== 'false';
      const mqttResult = await sendMqttCommand(deviceUuid, 'pause', {}, { waitForResult });

      res.json({
        success: true,
        message: mqttResult.message,
        mqtt_result: mqttResult.result
      });
    } catch (error) {
      console.error('[API] Pause error:', error);
      res.status(500).json({ success: false, error: error.message || '일시정지 실패' });
    }
  });

  // POST /api/printer/:deviceUuid/resume - 출력 재개
  app.post('/api/printer/:deviceUuid/resume', async (req, res) => {
    try {
      const { deviceUuid } = req.params;
      const waitForResult = req.query.wait !== 'false';
      const mqttResult = await sendMqttCommand(deviceUuid, 'resume', {}, { waitForResult });

      res.json({
        success: true,
        message: mqttResult.message,
        mqtt_result: mqttResult.result
      });
    } catch (error) {
      console.error('[API] Resume error:', error);
      res.status(500).json({ success: false, error: error.message || '재개 실패' });
    }
  });

  // POST /api/printer/:deviceUuid/cancel - 출력 취소
  app.post('/api/printer/:deviceUuid/cancel', async (req, res) => {
    try {
      const { deviceUuid } = req.params;
      const waitForResult = req.query.wait !== 'false';
      const mqttResult = await sendMqttCommand(deviceUuid, 'cancel', {}, { waitForResult });

      res.json({
        success: true,
        message: mqttResult.message,
        mqtt_result: mqttResult.result
      });
    } catch (error) {
      console.error('[API] Cancel error:', error);
      res.status(500).json({ success: false, error: error.message || '취소 실패' });
    }
  });

  // POST /api/printer/:deviceUuid/home - 홈 이동
  // mqttService 형식: { type: 'home', axes: 'XYZ' }
  app.post('/api/printer/:deviceUuid/home', async (req, res) => {
    try {
      const { deviceUuid } = req.params;
      const { axes } = req.body; // 'XYZ', 'X', 'Y', 'Z', 'XY' 등 또는 undefined (전체)
      const waitForResult = req.query.wait !== 'false';

      // mqttService는 문자열 형식 ('XYZ')을 사용
      const axesStr = Array.isArray(axes) ? axes.join('').toUpperCase() : (axes || 'XYZ').toUpperCase();
      const mqttResult = await sendMqttCommand(deviceUuid, 'home', { axes: axesStr }, { waitForResult });

      res.json({
        success: true,
        message: mqttResult.message,
        axes: axesStr,
        mqtt_result: mqttResult.result
      });
    } catch (error) {
      console.error('[API] Home error:', error);
      res.status(500).json({ success: false, error: error.message || '홈 이동 실패' });
    }
  });

  // GET /api/printer/:deviceUuid/status - 프린터 상태 조회 (캐시된 MQTT 데이터)
  app.get('/api/printer/:deviceUuid/status', async (req, res) => {
    try {
      const { deviceUuid } = req.params;
      const realtimeData = realtimeDataStore.get(deviceUuid);

      if (!realtimeData) {
        return res.json({
          success: true,
          data: {
            device_uuid: deviceUuid,
            status: 'unknown',
            connected: false,
            message: '해당 디바이스의 실시간 데이터가 없습니다.',
          },
        });
      }

      res.json({
        success: true,
        data: {
          device_uuid: deviceUuid,
          ...realtimeData,
        },
      });
    } catch (error) {
      console.error('[API] Status error:', error);
      res.status(500).json({ success: false, error: error.message || '상태 조회 실패' });
    }
  });

  // POST /api/printer/:deviceUuid/gcode - G-code 명령 전송
  app.post('/api/printer/:deviceUuid/gcode', async (req, res) => {
    try {
      const { deviceUuid } = req.params;
      const { commands } = req.body; // string 또는 string[]
      const waitForResult = req.query.wait !== 'false';

      if (!commands) {
        return res.status(400).json({ success: false, error: 'commands가 필요합니다.' });
      }

      const gcodeCommands = Array.isArray(commands) ? commands : [commands];
      const mqttResult = await sendMqttCommand(deviceUuid, 'gcode', { commands: gcodeCommands }, { waitForResult });

      res.json({
        success: true,
        message: mqttResult.message,
        commands: gcodeCommands,
        mqtt_result: mqttResult.result
      });
    } catch (error) {
      console.error('[API] Gcode error:', error);
      res.status(500).json({ success: false, error: error.message || 'G-code 전송 실패' });
    }
  });

  // POST /api/printer/:deviceUuid/move - 축 이동
  // mqttService 형식: { type: 'move', mode: 'relative'|'absolute', x?, y?, z?, e?, feedrate? }
  app.post('/api/printer/:deviceUuid/move', async (req, res) => {
    try {
      const { deviceUuid } = req.params;
      const { x, y, z, e, feedrate, mode } = req.body;
      const waitForResult = req.query.wait !== 'false';

      if (x === undefined && y === undefined && z === undefined && e === undefined) {
        return res.status(400).json({ success: false, error: 'x, y, z, e 중 하나 이상 필요합니다.' });
      }

      // mqttService의 publishDashboardMove 형식과 일치
      const moveData = {
        mode: mode || 'relative', // 기본값 relative
      };
      if (x !== undefined) moveData.x = Number(x);
      if (y !== undefined) moveData.y = Number(y);
      if (z !== undefined) moveData.z = Number(z);
      if (e !== undefined) moveData.e = Number(e);
      if (feedrate !== undefined) moveData.feedrate = Number(feedrate);

      const mqttResult = await sendMqttCommand(deviceUuid, 'move', moveData, { waitForResult });

      res.json({
        success: true,
        message: mqttResult.message,
        move: moveData,
        mqtt_result: mqttResult.result
      });
    } catch (error) {
      console.error('[API] Move error:', error);
      res.status(500).json({ success: false, error: error.message || '이동 실패' });
    }
  });

  // ============================================
  // 카메라 WebRTC 상태 조회 API (MediaMTX API 활용)
  // ============================================

  // MediaMTX API 기본 주소 (환경변수 또는 기본값)
  const MEDIAMTX_API_URL = process.env.MEDIAMTX_API_URL || 'http://127.0.0.1:9997';

  // GET /api/camera/:deviceUuid/stream-status - 특정 카메라 스트림 상태 조회
  app.get('/api/camera/:deviceUuid/stream-status', async (req, res) => {
    try {
      const { deviceUuid } = req.params;
      const streamName = `cam-${deviceUuid}`;

      // MediaMTX API v3 호출 - /v3/paths/get/{name} 형식
      const apiUrl = `${MEDIAMTX_API_URL}/v3/paths/get/${encodeURIComponent(streamName)}`;
      console.log('[CAMERA] Checking stream status:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (response.status === 404) {
        // 스트림이 존재하지 않음
        return res.json({
          success: true,
          data: {
            device_uuid: deviceUuid,
            stream_name: streamName,
            status: 'offline',
            streaming: false,
            message: '스트림이 존재하지 않습니다.',
          },
        });
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.warn('[CAMERA] MediaMTX API error:', response.status, text);
        return res.status(502).json({
          success: false,
          error: 'MediaMTX API 오류',
          status: response.status,
        });
      }

      const pathData = await response.json();
      console.log('[CAMERA] Stream data:', pathData);

      // 스트림 상태 분석
      const hasSource = pathData.source !== null && pathData.source !== undefined;
      const hasReaders = (pathData.readers?.length || 0) > 0;
      const isReady = pathData.ready === true;

      res.json({
        success: true,
        data: {
          device_uuid: deviceUuid,
          stream_name: streamName,
          status: isReady ? 'online' : (hasSource ? 'connecting' : 'offline'),
          streaming: isReady && hasSource,
          ready: isReady,
          has_source: hasSource,
          readers_count: pathData.readers?.length || 0,
          source_type: pathData.source?.type || null,
          // WebRTC 플레이어 URL (프론트엔드에서 사용)
          webrtc_url: isReady ? `https://factor.io.kr/webrtc/${streamName}` : null,
          rtsp_url: isReady ? `rtsp://factor.io.kr:8554/${streamName}` : null,
        },
      });
    } catch (error) {
      console.error('[CAMERA] Stream status error:', error);
      res.status(500).json({ success: false, error: error.message || '스트림 상태 조회 실패' });
    }
  });

  // GET /api/cameras/streams - 모든 활성 스트림 목록 조회
  app.get('/api/cameras/streams', async (req, res) => {
    try {
      // MediaMTX API v3 - 모든 경로 조회
      const apiUrl = `${MEDIAMTX_API_URL}/v3/paths/list`;
      console.log('[CAMERA] Fetching all streams:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.warn('[CAMERA] MediaMTX API error:', response.status, text);
        return res.status(502).json({
          success: false,
          error: 'MediaMTX API 오류',
          status: response.status,
        });
      }

      const data = await response.json();
      const paths = data.items || [];

      // cam-* 패턴의 스트림만 필터링하고 상태 정보 추출
      const cameraStreams = paths
        .filter(p => p.name && p.name.startsWith('cam-'))
        .map(p => {
          const deviceUuid = p.name.replace('cam-', '');
          const hasSource = p.source !== null && p.source !== undefined;
          const isReady = p.ready === true;

          return {
            device_uuid: deviceUuid,
            stream_name: p.name,
            status: isReady ? 'online' : (hasSource ? 'connecting' : 'offline'),
            streaming: isReady && hasSource,
            ready: isReady,
            has_source: hasSource,
            readers_count: p.readers?.length || 0,
            source_type: p.source?.type || null,
            webrtc_url: isReady ? `https://factor.io.kr/webrtc/${p.name}` : null,
          };
        });

      res.json({
        success: true,
        data: cameraStreams,
        count: cameraStreams.length,
        total_paths: paths.length,
      });
    } catch (error) {
      console.error('[CAMERA] Streams list error:', error);
      res.status(500).json({ success: false, error: error.message || '스트림 목록 조회 실패' });
    }
  });
}

export function createApp({ staticDir, enableRest = true, enableWs = true } = {}) {
  const app = express();
  const server = http.createServer(app);
  const wss = enableWs ? new WebSocketServer({ noServer: true }) : null;

  // CORS는 nginx에서 처리 (X-API-Key 기반 동적 Origin 허용)
  // app.use(cors());
  app.use(express.json());
  app.get('/', (_req, res) => {
    res.type('text/plain').send('hellow factor cnrk');
  });
  // API 요청 로깅 (주소와 페이로드)
  app.use((req, _res, next) => {
    try {
      const url = String(req.originalUrl || req.url || "");
      if (url.startsWith('/api') || url.startsWith('/plugin')) {
        const body = safeRedact(req.body);
        const headers = safeHeaderRedact(req);
        console.log(`[API] ${req.method} ${url}\nHeaders: ${safeStringify(headers)}\n${safeStringify(body)}`);
      }
    } catch {}
    next();
  });
  if (staticDir) app.use(express.static(staticDir));
  if (enableRest) mountRest(app);

  const clients = new Set();
  const edgeClients = new Set();
  const webClients = new Set();

  // 레거시 호환을 위한 단일 printerData (마지막 업데이트된 프린터)
  let printerData = {
    status: 'idle',
    connected: false,
    printing: false,
    error_message: null,
    temperature: { tool: { current: 0, target: 0 }, bed: { current: 0, target: 0 } },
    position: { x: 0, y: 0, z: 0, e: 0 },
    printProgress: { completion: 0, file_position: 0, file_size: 0, print_time: 0, print_time_left: 0, filament_used: 0 }
  };

  function getWsUrlFromReq(req) {
    const protocol = req.socket.encrypted ? 'wss' : 'ws';
    const host = req.headers.host || `${req.socket.localAddress}:${req.socket.localPort}`;
    const pathStr = req.url || '/';
    return `${protocol}://${host}${pathStr}`;
  }

  function broadcastToWebClients(type, data) {
    const message = JSON.stringify({ type, data });
    webClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    });
  }

  function broadcastToRoomExcept(_roomId, _exceptWs, _payload) {}

  const wssOnConnection = (ws, req) => {
    const wsUrl = getWsUrlFromReq(req);
    const userAgent = (req.headers['user-agent'] || '').toString();
    const isEdgeClient = req.headers['x-client-type'] === 'edge' || userAgent.toLowerCase().includes('python') || userAgent.toLowerCase().includes('requests');

    clients.add(ws);
    if (isEdgeClient) edgeClients.add(ws); else webClients.add(ws);

    console.log('[WS] Client connected');
    console.log(' - URL     :', wsUrl);
    console.log(' - Type    :', isEdgeClient ? 'edge (collector)' : 'web (browser)');
    console.log(' - Address :', req.socket.remoteAddress);
    console.log(' - UA      :', userAgent);
    console.log(' - Counts  :', { total: clients.size, edge: edgeClients.size, web: webClients.size });

    // WebRTC 룸 메타 사용 제거됨

    if (isEdgeClient) {
      ws.send(JSON.stringify({ type: 'request_status', message: '현재 프린터 상태를 전송해주세요' }));
    } else {
      ws.send(JSON.stringify({ type: 'printer_status', data: printerData }));
      ws.send(JSON.stringify({ type: 'temperature_update', data: printerData.temperature }));
      ws.send(JSON.stringify({ type: 'position_update', data: printerData.position }));
      ws.send(JSON.stringify({ type: 'print_progress', data: printerData.printProgress }));
    }

    ws.on('message', (raw) => {
      try {
        const message = JSON.parse(raw);
        const { type, data, device_uuid } = message || {};
        if (!type) return;

        if (isEdgeClient) {
          // 디바이스 UUID가 있으면 디바이스별로 저장
          if (device_uuid) {
            const deviceData = getDeviceData(device_uuid);
            switch (type) {
              case 'printer_status':
                Object.assign(deviceData, data, { lastUpdated: new Date().toISOString() });
                break;
              case 'temperature_update':
                deviceData.temperature = { ...deviceData.temperature, ...data };
                deviceData.lastUpdated = new Date().toISOString();
                break;
              case 'position_update':
                deviceData.position = { ...deviceData.position, ...data };
                deviceData.lastUpdated = new Date().toISOString();
                break;
              case 'print_progress':
                deviceData.printProgress = { ...deviceData.printProgress, ...data };
                deviceData.lastUpdated = new Date().toISOString();
                break;
            }
          }

          // 레거시 호환: 전역 printerData도 업데이트
          switch (type) {
            case 'printer_status': printerData = { ...printerData, ...data }; broadcastToWebClients('printer_status', { ...printerData, device_uuid }); break;
            case 'temperature_update': printerData.temperature = { ...printerData.temperature, ...data }; broadcastToWebClients('temperature_update', { ...printerData.temperature, device_uuid }); break;
            case 'position_update': printerData.position = { ...printerData.position, ...data }; broadcastToWebClients('position_update', { ...printerData.position, device_uuid }); break;
            case 'print_progress': printerData.printProgress = { ...printerData.printProgress, ...data }; broadcastToWebClients('print_progress', { ...printerData.printProgress, device_uuid }); break;
            default: console.log('알 수 없는 메시지 타입:', type);
          }
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'acknowledgment', message: `${type} 데이터 수신 완료`, timestamp: new Date().toISOString() }));
          }
        } else {
          switch (type) {
            case 'ping': if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() })); break;
            // WebRTC 관련 메시지 처리 제거
            default: console.log('웹 클라이언트 메시지:', type);
          }
        }
      } catch (error) {
        console.error('메시지 파싱 오류:', error);
      }
    });

    ws.on('close', () => {
      clients.delete(ws); edgeClients.delete(ws); webClients.delete(ws);
      console.log('[WS] Client disconnected');
      console.log(' - Counts:', { total: clients.size, edge: edgeClients.size, web: webClients.size });
    });

    ws.on('error', (error) => { console.error('[WS] Client error on', wsUrl, error); });
  };

  if (wss) {
    wss.on('connection', wssOnConnection);

    // 기존 WebSocket 서버의 upgrade 핸들러 (MQTT Proxy가 아닌 경로)
    server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url, 'http://localhost');

      // MQTT Proxy가 아닌 모든 경로는 기존 WebSocket 서버가 처리
      if (url.pathname !== '/mqtt-proxy') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    });
  }

  app.get('/api/status', (req, res) => {
    res.json({
      server: 'running',
      timestamp: new Date().toISOString(),
      connections: { total: clients.size, edge: edgeClients.size, web: webClients.size },
      printerData
    });
  });

  app.get('/api/printer', (req, res) => { res.json(printerData); });

  app.post('/api/printer/update', (req, res) => {
    const { type, data } = req.body;
    if (type && data) {
      printerData = { ...printerData, ...(type === 'printer_status' ? data : {}) };
      res.json({ success: true, message: `${type} 데이터 업데이트 완료` });
    } else {
      res.status(400).json({ success: false, message: 'type과 data가 필요합니다' });
    }
  });

  // MQTT Proxy 추가
  let mqttProxyWss = null;
  if (enableWs) {
    try {
      mqttProxyWss = createMqttProxy(server);
      console.log('[Server] MQTT Proxy enabled on /mqtt-proxy');
    } catch (err) {
      console.error('[Server] Failed to create MQTT Proxy:', err.message);
    }
  }

  // MQTT 구독 시작 (실시간 데이터 수집)
  setupMqttSubscriber();

  return { app, server, wss, mqttProxyWss };
}

// Vite 개발 서버(5173)에서 REST만 사용하기 위한 라우터
export function createRestMiddleware() {
  return async function restMiddleware(req, res, next) {
    try {
      if (!req || !res || !req.url) return next();
      if (req.method !== 'POST') return next();
      if (!req.url.startsWith('/api/auth/login')) return next();

      const body = await readJsonBody(req);
      // 미들웨어에서도 요청 로깅
      try { console.log(`[API] ${req.method} ${req.url}\n${safeStringify(safeRedact(body))}`); } catch {}
      const email = body?.email;
      const password = body?.password;
      if (!email || !password) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, message: 'email, password가 필요합니다.' }));
        return;
      }

      const result = await supabasePasswordLogin(email, password);
      res.setHeader('Content-Type', 'application/json');
      if (!result.ok) {
        res.statusCode = result.status || 401;
        res.end(JSON.stringify({ success: false, message: result.error, status: result.status }));
        return;
      }
      const { access_token, refresh_token, expires_in, token_type, user } = result.data || {};
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, user, access_token, refresh_token, expires_in, token_type }));
    } catch (error) {
      console.error('REST 로그인 API 오류:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, message: '서버 오류가 발생했습니다.' }));
    }
  }
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    try {
      let buf = '';
      req.on('data', (c) => { buf += c; if (buf.length > 1e6) { try { req.destroy(); } catch {} } });
      req.on('end', () => {
        try { resolve(buf ? JSON.parse(buf) : {}); } catch { resolve({}); }
      });
      req.on('error', () => resolve({}));
    } catch { resolve({}); }
  });
}

// CLI 실행 지원: 현재 작업 디렉토리의 dist를 정적 폴더로 서빙
const scriptPath = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] === scriptPath ||
                   process.argv[1]?.endsWith('server.js') ||
                   process.argv[1]?.includes('packages/shared/server.js') ||
                   process.env.pm_id !== undefined;  // PM2 환경 감지
if (isDirectRun) {
  const args = new Set(process.argv.slice(2));
  const portArgIndex = process.argv.findIndex((a) => a === '--port');
  const hostArgIndex = process.argv.findIndex((a) => a === '--host');
  const portVal = portArgIndex > -1 ? Number(process.argv[portArgIndex + 1]) : undefined;
  const hostVal = hostArgIndex > -1 ? String(process.argv[hostArgIndex + 1]) : undefined;
  const PORT = portVal || Number(process.env.PORT) || 3000;
  const HOST = hostVal || process.env.HOST || '0.0.0.0';
  const enableRest = args.has('--rest') || (!args.has('--ws') && !args.has('--rest'));
  const enableWs = args.has('--ws') || (!args.has('--ws') && !args.has('--rest'));
  const staticDir = path.resolve(process.cwd(), 'dist');
  const { server } = createApp({ staticDir, enableRest, enableWs });
  server.listen(PORT, HOST, () => {
    const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
    console.log('==============================================');
    console.log(`🚀 Server listening`);
    console.log(` - Bind Address : ${HOST}`);
    console.log(` - Port         : ${PORT}`);
    if (enableRest) console.log(` - REST API     : http://${displayHost}:${PORT}/api (bound ${HOST})`);
    if (enableWs) console.log(` - WebSocket    : ws://${displayHost}:${PORT} (bound ${HOST})`);
    if (staticDir) console.log(` - Static Dir   : ${staticDir}`);
    console.log('==============================================');
  });
}


