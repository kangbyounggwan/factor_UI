import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createMqttProxy } from './mqttProxyServer.js';
// 브라우저 전용 supabase client.ts는 Node 환경에서 사용하지 않습니다.

async function resolveSupabaseEnv() {
  let url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  let key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (url && key) return { url, key, source: 'env' };

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
      }
      if (url && key) return { url, key, source: p };
    } catch {}
  }

  return { url: undefined, key: undefined, source: 'missing' };
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
}

export function createApp({ staticDir, enableRest = true, enableWs = true } = {}) {
  const app = express();
  const server = http.createServer(app);
  const wss = enableWs ? new WebSocketServer({ noServer: true }) : null;

  app.use(cors());
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
        const { type, data } = message || {};
        if (!type) return;

        if (isEdgeClient) {
          switch (type) {
            // WebRTC 관련 메시지 처리 제거
            case 'printer_status': printerData = { ...printerData, ...data }; broadcastToWebClients('printer_status', printerData); break;
            case 'temperature_update': printerData.temperature = { ...printerData.temperature, ...data }; broadcastToWebClients('temperature_update', printerData.temperature); break;
            case 'position_update': printerData.position = { ...printerData.position, ...data }; broadcastToWebClients('position_update', printerData.position); break;
            case 'print_progress': printerData.printProgress = { ...printerData.printProgress, ...data }; broadcastToWebClients('print_progress', printerData.printProgress); break;
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
if (fileURLToPath(import.meta.url) === process.argv[1]) {
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


