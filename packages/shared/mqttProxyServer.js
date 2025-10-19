// MQTT Proxy WebSocket Server
// 클라이언트의 WebSocket 요청을 MQTT 브로커로 중계

import { WebSocketServer } from 'ws';
import mqtt from 'mqtt';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// .env 파일 로드
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// 성능 모니터링
const stats = {
  totalMessages: 0,
  totalClients: 0,
  messageLatencies: [],
};

export function createMqttProxy(server) {
  const wss = new WebSocketServer({
    noServer: true, // 수동 upgrade 처리
    perMessageDeflate: false, // 레이턴시 감소를 위해 압축 비활성화
  });

  // HTTP 서버의 upgrade 이벤트를 가로채서 /mqtt-proxy 경로만 처리
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, 'http://localhost');

    if (url.pathname === '/mqtt-proxy') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
    // 다른 경로는 기존 WebSocket 서버가 처리
  });

  console.log('[MqttProxy] Starting MQTT Proxy Server...');

  // MQTT 클라이언트 초기화 (서버에서 단일 연결)
  const mqttClient = mqtt.connect(process.env.VITE_MQTT_URL, {
    username: process.env.VITE_MQTT_USERNAME || '',
    password: process.env.VITE_MQTT_PASSWORD || '',
    clientId: 'factor-server-proxy',
    reconnectPeriod: 3000,
    clean: true,
    keepalive: 60,
  });

  mqttClient.on('connect', () => {
    console.log('[MqttProxy] Connected to MQTT broker:', process.env.VITE_MQTT_URL);
  });

  mqttClient.on('error', (err) => {
    console.error('[MqttProxy] MQTT error:', err.message);
  });

  mqttClient.on('reconnect', () => {
    console.log('[MqttProxy] Reconnecting to MQTT broker...');
  });

  // 연결된 클라이언트 관리
  const clients = new Map();

  // 토픽별 구독자 추적 (메모리 최적화)
  const topicSubscribers = new Map();

  wss.on('connection', async (ws, req) => {
    const startTime = Date.now();

    // JWT 토큰 검증
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(1008, 'Missing token');
      return;
    }

    // Supabase로 토큰 검증
    let userId;

    if (!supabase) {
      console.error('[MqttProxy] Supabase not configured');
      ws.close(1011, 'Server configuration error');
      return;
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('[MqttProxy] Auth failed:', error?.message);
      ws.close(1008, 'Unauthorized');
      return;
    }

    userId = user.id;
    const clientInfo = {
      userId,
      subscriptions: new Set(),
      connectedAt: new Date(),
    };

    clients.set(ws, clientInfo);
    stats.totalClients++;

    console.log(`[MqttProxy] Client connected: ${userId} (total: ${clients.size})`);
    console.log(`[MqttProxy] Connection established in ${Date.now() - startTime}ms`);

    // 클라이언트로부터 메시지 수신
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const client = clients.get(ws);

        switch (msg.type) {
          case 'subscribe': {
            const { topic } = msg;

            // 토픽 구독자 추가
            if (!topicSubscribers.has(topic)) {
              topicSubscribers.set(topic, new Set());

              // MQTT 브로커에 구독 (처음 구독하는 경우만)
              mqttClient.subscribe(topic, (err) => {
                if (err) {
                  console.error(`[MqttProxy] Subscribe failed: ${topic}`, err);
                  ws.send(JSON.stringify({
                    type: 'error',
                    message: `Subscribe failed: ${err.message}`,
                  }));
                } else {
                  console.log(`[MqttProxy] Subscribed to: ${topic}`);
                }
              });
            }

            topicSubscribers.get(topic).add(ws);
            client.subscriptions.add(topic);

            // 구독 확인 응답
            ws.send(JSON.stringify({
              type: 'subscribed',
              topic,
            }));

            break;
          }

          case 'publish': {
            const { topic, payload, timestamp } = msg;
            const publishTime = Date.now();

            // MQTT 브로커에 발행
            mqttClient.publish(topic, JSON.stringify(payload), (err) => {
              if (err) {
                console.error(`[MqttProxy] Publish failed: ${topic}`, err);
              } else {
                // 발행 레이턴시 측정
                const latency = Date.now() - publishTime;
                if (latency > 50) {
                  console.warn(`[MqttProxy] High publish latency: ${latency}ms`);
                }
              }
            });

            break;
          }

          case 'unsubscribe': {
            const { topic } = msg;
            const subscribers = topicSubscribers.get(topic);

            if (subscribers) {
              subscribers.delete(ws);
              client.subscriptions.delete(topic);

              // 더 이상 구독자가 없으면 MQTT 구독 취소
              if (subscribers.size === 0) {
                mqttClient.unsubscribe(topic);
                topicSubscribers.delete(topic);
                console.log(`[MqttProxy] Unsubscribed from: ${topic}`);
              }
            }

            break;
          }

          default:
            console.warn(`[MqttProxy] Unknown message type: ${msg.type}`);
        }
      } catch (err) {
        console.error('[MqttProxy] Message parse error:', err);
      }
    });

    // 클라이언트 연결 종료
    ws.on('close', () => {
      const client = clients.get(ws);

      if (client) {
        console.log(`[MqttProxy] Client disconnected: ${client.userId}`);

        // 구독 정리
        client.subscriptions.forEach(topic => {
          const subscribers = topicSubscribers.get(topic);
          if (subscribers) {
            subscribers.delete(ws);

            // 더 이상 구독자가 없으면 MQTT 구독 취소
            if (subscribers.size === 0) {
              mqttClient.unsubscribe(topic);
              topicSubscribers.delete(topic);
            }
          }
        });

        clients.delete(ws);
      }

      console.log(`[MqttProxy] Total clients: ${clients.size}`);
    });

    ws.on('error', (err) => {
      console.error('[MqttProxy] WebSocket error:', err.message);
    });
  });

  // MQTT 메시지를 WebSocket 클라이언트들에게 전달
  mqttClient.on('message', (topic, payload) => {
    const receiveTime = Date.now();
    const subscribers = topicSubscribers.get(topic);

    if (subscribers && subscribers.size > 0) {
      const message = JSON.stringify({
        type: 'message',
        topic,
        payload: payload.toString(),
        timestamp: receiveTime, // 클라이언트에서 레이턴시 측정용
      });

      let sent = 0;
      subscribers.forEach(ws => {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(message);
          sent++;
        }
      });

      stats.totalMessages++;

      // 통계 로깅 (1000개마다)
      if (stats.totalMessages % 1000 === 0) {
        console.log(`[MqttProxy] Messages relayed: ${stats.totalMessages}`);
        console.log(`[MqttProxy] Active subscriptions: ${topicSubscribers.size}`);
        console.log(`[MqttProxy] Active clients: ${clients.size}`);
      }
    }
  });

  // 성능 통계 엔드포인트
  wss.on('listening', () => {
    console.log('[MqttProxy] WebSocket server listening on /mqtt-proxy');
  });

  // 주기적인 성능 리포트
  setInterval(() => {
    if (clients.size > 0) {
      console.log('[MqttProxy] Performance Report:');
      console.log(`  - Active clients: ${clients.size}`);
      console.log(`  - Active topics: ${topicSubscribers.size}`);
      console.log(`  - Total messages: ${stats.totalMessages}`);
      console.log(`  - Messages/min: ${stats.totalMessages / ((Date.now() - wss._startTime) / 60000)}`);
    }
  }, 60000); // 1분마다

  wss._startTime = Date.now();

  return wss;
}
