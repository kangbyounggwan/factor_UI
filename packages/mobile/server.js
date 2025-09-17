import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// CORS 설정
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// 연결된 모든 클라이언트 관리
const clients = new Set();
const edgeClients = new Set(); // 수집 장치 클라이언트
const webClients = new Set();  // 웹 브라우저 클라이언트

// WebRTC 시그널링용 룸 관리
// roomId -> Set<WebSocket>
const rooms = new Map();
// 클라이언트 메타: ws -> { roomId?: string, role?: 'publisher' | 'viewer' | 'unknown' }
const clientMeta = new Map();

// 프린터 데이터 상태 (서버에서 관리)
let printerData = {
  status: 'idle',
  connected: false,
  printing: false,
  error_message: null,
  temperature: {
    tool: { current: 0, target: 0 },
    bed: { current: 0, target: 0 }
  },
  position: { x: 0, y: 0, z: 0, e: 0 },
  printProgress: {
    completion: 0,
    file_position: 0,
    file_size: 0,
    print_time: 0,
    print_time_left: 0,
    filament_used: 0
  }
};

function getWsUrlFromReq(req) {
  const protocol = req.socket.encrypted ? 'wss' : 'ws';
  const host = req.headers.host || `${req.socket.localAddress}:${req.socket.localPort}`;
  const pathStr = req.url || '/';
  return `${protocol}://${host}${pathStr}`;
}

// WebSocket 연결 처리
wss.on('connection', (ws, req) => {
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

  // 기본 메타 등록
  clientMeta.set(ws, { roomId: undefined, role: 'unknown' });

  if (isEdgeClient) {
    // 엣지 클라이언트에게 현재 상태 요청
    ws.send(JSON.stringify({
      type: 'request_status',
      message: '현재 프린터 상태를 전송해주세요'
    }));
  } else {
    // 웹 클라이언트에게 현재 상태 전송
    ws.send(JSON.stringify({ type: 'printer_status', data: printerData }));
    ws.send(JSON.stringify({ type: 'temperature_update', data: printerData.temperature }));
    ws.send(JSON.stringify({ type: 'position_update', data: printerData.position }));
    ws.send(JSON.stringify({ type: 'print_progress', data: printerData.printProgress }));
  }

  // 메시지 수신 처리
  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw);
      handleMessage(ws, data, isEdgeClient);
    } catch (error) {
      console.error('메시지 파싱 오류:', error);
    }
  });

  // 연결 해제 처리
  ws.on('close', (code, reason) => {
    clients.delete(ws);
    edgeClients.delete(ws);
    webClients.delete(ws);
    // 룸 정리
    const meta = clientMeta.get(ws);
    if (meta?.roomId) {
      leaveRoom(ws, meta.roomId);
    }
    clientMeta.delete(ws);
    console.log('[WS] Client disconnected');
    console.log(' - URL   :', wsUrl);
    console.log(' - Code  :', code, 'Reason:', reason?.toString());
    console.log(' - Counts:', { total: clients.size, edge: edgeClients.size, web: webClients.size });
  });

  // 에러 처리
  ws.on('error', (error) => {
    console.error('[WS] Client error on', wsUrl, error);
  });
});

// 메시지 처리 함수
function handleMessage(ws, message, isEdgeClient) {
  const { type, data } = message || {};
  if (!type) return;

  if (isEdgeClient) {
    // 엣지 클라이언트(수집 장치)로부터 받은 데이터 처리
    switch (type) {
      // --- WebRTC 시그널링 (엣지 퍼블리셔 지원) ---
      case 'webrtc_join': {
        const { roomId, role } = data || {};
        if (!roomId) return;
        joinRoom(ws, roomId, role);
        broadcastToRoomExcept(roomId, ws, { type: 'webrtc_peer_joined', data: { roomId } });
        break;
      }
      case 'webrtc_leave': {
        const { roomId } = data || {};
        if (!roomId) return;
        leaveRoom(ws, roomId);
        broadcastToRoomExcept(roomId, ws, { type: 'webrtc_peer_left', data: { roomId } });
        break;
      }
      case 'webrtc_offer':
      case 'webrtc_answer':
      case 'webrtc_ice_candidate': {
        const { roomId } = data || {};
        if (!roomId) return;
        broadcastToRoomExcept(roomId, ws, { type, data });
        break;
      }
      case 'printer_status':
        printerData = { ...printerData, ...data };
        broadcastToWebClients('printer_status', printerData);
        break;
      case 'temperature_update':
        printerData.temperature = { ...printerData.temperature, ...data };
        broadcastToWebClients('temperature_update', printerData.temperature);
        break;
      case 'position_update':
        printerData.position = { ...printerData.position, ...data };
        broadcastToWebClients('position_update', printerData.position);
        break;
      case 'print_progress':
        printerData.printProgress = { ...printerData.printProgress, ...data };
        broadcastToWebClients('print_progress', printerData.printProgress);
        break;
      default:
        console.log('알 수 없는 메시지 타입:', type);
    }

    // 엣지 클라이언트에게 확인 응답
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'acknowledgment',
        message: `${type} 데이터 수신 완료`,
        timestamp: new Date().toISOString()
      }));
    }
  } else {
    // 웹 클라이언트(브라우저)로부터 받은 메시지 처리
    switch (type) {
      case 'ping':
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
        break;
      // --- WebRTC 시그널링 ---
      case 'webrtc_join': {
        const { roomId, role } = data || {};
        if (!roomId) return;
        joinRoom(ws, roomId, role);
        // 현재 룸의 다른 클라이언트에게 참가 알림
        broadcastToRoomExcept(roomId, ws, { type: 'webrtc_peer_joined', data: { roomId } });
        break;
      }
      case 'webrtc_leave': {
        const { roomId } = data || {};
        if (!roomId) return;
        leaveRoom(ws, roomId);
        broadcastToRoomExcept(roomId, ws, { type: 'webrtc_peer_left', data: { roomId } });
        break;
      }
      case 'webrtc_offer':
      case 'webrtc_answer':
      case 'webrtc_ice_candidate': {
        const { roomId } = data || {};
        if (!roomId) return;
        // 같은 룸 내 다른 피어들에게 전달 (SFU 없이 단순 브로드캐스트)
        broadcastToRoomExcept(roomId, ws, { type, data });
        break;
      }
      default:
        console.log('웹 클라이언트 메시지:', type);
    }
  }
}

// 웹 클라이언트들에게 데이터 브로드캐스트
function broadcastToWebClients(type, data) {
  const message = JSON.stringify({ type, data });
  webClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// 모든 클라이언트에게 브로드캐스트
function broadcastToAll(type, data) {
  const message = JSON.stringify({ type, data });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// 특정 룸의 다른 참여자에게만 전달
function broadcastToRoomExcept(roomId, exceptWs, payload) {
  const participants = rooms.get(roomId);
  if (!participants) return;
  const message = JSON.stringify(payload);
  participants.forEach((client) => {
    if (client !== exceptWs && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function joinRoom(ws, roomId, role) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  const participants = rooms.get(roomId);
  // 합류자에게 기존 참가자 존재 알림 (단순히 peer_joined 이벤트로 통지)
  participants.forEach((existing) => {
    if (existing !== ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'webrtc_peer_joined', data: { roomId } }));
      } catch {}
    }
  });

  participants.add(ws);
  const meta = clientMeta.get(ws) || { roomId: undefined, role: 'unknown' };
  meta.roomId = roomId;
  meta.role = role === 'publisher' || role === 'viewer' ? role : 'unknown';
  clientMeta.set(ws, meta);
  console.log('[WS][RTC] joinRoom:', roomId, 'role:', meta.role, 'participants:', rooms.get(roomId).size);
}

function leaveRoom(ws, roomId) {
  const set = rooms.get(roomId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) {
      rooms.delete(roomId);
    }
  }
  const meta = clientMeta.get(ws) || { roomId: undefined, role: 'unknown' };
  if (meta.roomId === roomId) {
    meta.roomId = undefined;
    meta.role = 'unknown';
    clientMeta.set(ws, meta);
  }
  console.log('[WS][RTC] leaveRoom:', roomId, 'remaining:', rooms.get(roomId)?.size || 0);
}

// 상태 확인 API
app.get('/api/status', (req, res) => {
  res.json({
    server: 'running',
    timestamp: new Date().toISOString(),
    connections: {
      total: clients.size,
      edge: edgeClients.size,
      web: webClients.size
    },
    printerData
  });
});

// 프린터 데이터 조회 API
app.get('/api/printer', (req, res) => {
  res.json(printerData);
});

// 프린터 데이터 업데이트 API (테스트/관리용)
app.post('/api/printer/update', (req, res) => {
  const { type, data } = req.body;
  if (type && data) {
    handleMessage(null, { type, data }, true);
    res.json({ success: true, message: `${type} 데이터 업데이트 완료` });
  } else {
    res.status(400).json({ success: false, message: 'type과 data가 필요합니다' });
  }
});

// SPA 라우팅을 위한 catch-all 핸들러
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다`);
  console.log(`🌐 웹 서버: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket 서버: ws://localhost:${PORT}`);
  console.log(`📊 상태 확인: http://localhost:${PORT}/api/status`);
});

// 서버 종료 시 정리
process.on('SIGINT', () => {
  console.log('\n🛑 서버를 종료합니다...');
  wss.close();
  server.close();
  process.exit(0);
});
