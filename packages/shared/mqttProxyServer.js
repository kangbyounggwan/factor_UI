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

// 프린터별 수집 상태 추적 (printer_id -> boolean)
const printerCollectionStatus = new Map();

// UUID -> printer_id 캐시 (device_uuid -> id)
const uuidToPrinterIdCache = new Map();

/**
 * UUID로 printer_id 찾기 (캐시 사용)
 */
async function getPrinterIdByUuid(device_uuid) {
  if (!supabase) return null;

  // 캐시 확인
  if (uuidToPrinterIdCache.has(device_uuid)) {
    return uuidToPrinterIdCache.get(device_uuid);
  }

  // DB에서 조회
  try {
    const { data, error } = await supabase
      .from('printers')
      .select('id')
      .eq('device_uuid', device_uuid)
      .single();

    if (error || !data) {
      return null;
    }

    // 캐시 저장
    uuidToPrinterIdCache.set(device_uuid, data.id);
    return data.id;
  } catch (error) {
    console.error(`[MqttProxy] Error finding printer by UUID:`, error.message);
    return null;
  }
}

/**
 * 온도 데이터를 printer_temperature_logs에 직접 저장
 */
async function saveTemperatureToDB(data) {
  if (!supabase) {
    console.error('[MqttProxy] Supabase client not configured');
    return;
  }

  const { printer_id, temperature_info } = data;

  // printers 테이블 status 기반으로 수집 여부 결정
  const shouldCollect = printerCollectionStatus.get(printer_id);

  if (!shouldCollect) {
    // 로그 스팸 방지 - 첫 스킵만 로그
    if (Math.random() < 0.001) {
      console.log(`[MqttProxy] ⏭️  Skipping save - printer ${printer_id} not in PRINTING status`);
    }
    return;
  }

  // 온도 데이터 추출
  const tool = temperature_info?.tool?.tool0 ?? temperature_info?.tool;
  const bed = temperature_info?.bed;

  console.log(`[MqttProxy] 🌡️  Temperature data - tool: ${JSON.stringify(tool)}, bed: ${JSON.stringify(bed)}`);

  if (!tool && !bed) {
    console.log('[MqttProxy] ⏭️  Skipping save - no temperature data');
    return; // 온도 데이터 없으면 스킵
  }

  try {
    // printer_temperature_logs에 INSERT
    const { error } = await supabase
      .from('printer_temperature_logs')
      .insert({
        printer_id,
        nozzle_temp: tool?.actual || 0,
        nozzle_target: tool?.target || 0,
        bed_temp: bed?.actual || 0,
        bed_target: bed?.target || 0,
        recorded_at: new Date().toISOString(),
      });

    if (error) {
      console.error(`[MqttProxy] ❌ Failed to insert temperature log:`, error.message);
    } else {
      console.log(`[MqttProxy] ✅ Saved temperature for printer ${printer_id} (nozzle: ${tool?.actual}°C, bed: ${bed?.actual}°C)`);
    }
  } catch (error) {
    console.error('[MqttProxy] ❌ Error saving temperature:', error.message);
  }
}

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
  // 서버는 mosquitto에 직접 연결 (localhost:1883)
  const mqttBrokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

  console.log(`[MqttProxy] Connecting to MQTT broker: ${mqttBrokerUrl}`);

  const mqttClient = mqtt.connect(mqttBrokerUrl, {
    username: process.env.VITE_MQTT_USERNAME || '',
    password: process.env.VITE_MQTT_PASSWORD || '',
    clientId: `factor-server-proxy-${process.pid}`,
    reconnectPeriod: 5000,
    clean: true,
    keepalive: 60,
    will: {
      topic: 'server/status',
      payload: 'Server disconnected',
      qos: 1,
      retain: false
    }
  });

  mqttClient.on('connect', () => {
    console.log('[MqttProxy] ✅ Connected to MQTT broker:', mqttBrokerUrl);
    // DB 상태 업데이트는 클라이언트(mqtt.ts)에서 처리
  });

  mqttClient.on('error', (err) => {
    console.error('[MqttProxy] MQTT error:', err.message);
  });

  mqttClient.on('reconnect', () => {
    console.log('[MqttProxy] Reconnecting to MQTT broker...');
  });

  mqttClient.on('close', () => {
    console.log('[MqttProxy] ⚠️  Connection closed');
  });

  mqttClient.on('disconnect', (packet) => {
    console.log('[MqttProxy] ⚠️  Disconnected:', packet);
  });

  mqttClient.on('offline', () => {
    console.warn('[MqttProxy] ⚠️  Client went offline');
  });

  // Supabase Realtime: printers 테이블 status 변경 모니터링
  if (supabase) {
    console.log('[MqttProxy] 📡 Subscribing to printers table status changes...');

    supabase
      .channel('printers_status_monitor')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'printers',
        },
        (payload) => {
          const { id: printer_id, status } = payload.new;
          const oldStatus = payload.old.status;

          if (status !== oldStatus) {
            console.log(`[MqttProxy] 🔄 Printer ${printer_id} status changed: ${oldStatus} → ${status}`);

            // printing 상태일 때만 온도 수집 활성화
            if (status === 'printing') {
              printerCollectionStatus.set(printer_id, true);
              console.log(`[MqttProxy] ✅ Temperature collection STARTED for printer ${printer_id}`);
            } else {
              printerCollectionStatus.set(printer_id, false);
              console.log(`[MqttProxy] ⏸️  Temperature collection STOPPED for printer ${printer_id}`);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log(`[MqttProxy] 📡 Realtime subscription status:`, status);
      });
  }

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

  // 온도 데이터 버퍼 (프린터별 3초마다 저장)
  const temperatureBuffers = new Map(); // printer_id -> { lastSave, data }

  // MQTT 메시지를 WebSocket 클라이언트들에게 전달
  mqttClient.on('message', async (topic, payload) => {
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

    // 온도 데이터 3초마다 DB로 저장 (프린터 상태 업데이트는 클라이언트 mqtt.ts에서 처리)
    try {
      const data = JSON.parse(payload.toString());

      // 프린터 UUID 추출 (topic에서: octoprint/status/{device_uuid})
      const match = topic.match(/octoprint\/status\/([^\/]+)/);
      if (!match) return;

      const device_uuid = match[1];

      // 온도 정보가 있는 메시지만 처리
      if (!data.temperature_info) return;

      // UUID로 printer_id 조회
      const printer_id = await getPrinterIdByUuid(device_uuid);
      if (!printer_id) {
        console.warn(`[MqttProxy] ⚠️  Printer not found for UUID: ${device_uuid}`);
        return;
      }

      // 버퍼 초기화 (printer_id 기반)
      if (!temperatureBuffers.has(printer_id)) {
        temperatureBuffers.set(printer_id, {
          lastSave: 0,
          data: null,
        });
      }

      const buffer = temperatureBuffers.get(printer_id);
      const now = Date.now();

      // 최신 데이터 저장
      buffer.data = {
        printer_id: printer_id, // 실제 DB의 printer_id
        temperature_info: data.temperature_info,
        state: data.state,
        flags: data.flags,
      };

      // 3초마다 온도 데이터만 저장
      if (now - buffer.lastSave >= 3000) {
        buffer.lastSave = now;

        // 온도 데이터 저장 (비동기)
        saveTemperatureToDB(buffer.data).catch(err => {
          console.error(`[MqttProxy] Failed to save temperature for ${printer_id}:`, err.message);
        });
      }
    } catch (err) {
      // MQTT 메시지 파싱 실패는 무시 (온도 데이터가 아닐 수 있음)
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
