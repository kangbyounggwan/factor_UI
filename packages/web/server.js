const express = require('express');
const path = require('path');
const cors = require('cors');
const app = express();

// MQTT 클라이언트 설정 (mqtt.js 사용)
const mqtt = require('mqtt');

// MQTT 브로커 설정 (환경 변수 또는 기본값)
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://factor.io.kr:1883';
const MQTT_USERNAME = process.env.MQTT_USERNAME || '';
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || '';

let mqttClient = null;

// MQTT 연결 함수
function connectMqtt() {
  if (mqttClient && mqttClient.connected) {
    return Promise.resolve(mqttClient);
  }

  return new Promise((resolve, reject) => {
    const options = {
      clientId: `factor-web-server-${Date.now()}`,
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 5000,
    };

    if (MQTT_USERNAME) {
      options.username = MQTT_USERNAME;
      options.password = MQTT_PASSWORD;
    }

    mqttClient = mqtt.connect(MQTT_BROKER_URL, options);

    mqttClient.on('connect', () => {
      console.log('[MQTT] Connected to broker:', MQTT_BROKER_URL);
      resolve(mqttClient);
    });

    mqttClient.on('error', (err) => {
      console.error('[MQTT] Connection error:', err.message);
      reject(err);
    });

    // 30초 타임아웃
    setTimeout(() => {
      if (!mqttClient.connected) {
        reject(new Error('MQTT connection timeout'));
      }
    }, 30000);
  });
}

// MQTT 메시지 발행 함수
async function publishMqtt(topic, payload) {
  await connectMqtt();
  return new Promise((resolve, reject) => {
    const message = JSON.stringify(payload);
    mqttClient.publish(topic, message, { qos: 1 }, (err) => {
      if (err) {
        console.error('[MQTT] Publish error:', err);
        reject(err);
      } else {
        console.log('[MQTT] Published to', topic, ':', payload);
        resolve();
      }
    });
  });
}

// 미들웨어
app.use(cors());
app.use(express.json());

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'dist')));

// ============================================
// 프린터 제어 API 엔드포인트
// ============================================

/**
 * @api {post} /api/printer/:deviceUuid/temperature 노즐/베드 온도 설정
 * @apiParam {String} deviceUuid 프린터 디바이스 UUID
 * @apiBody {Number} tool 대상 (-1: 베드, 0: 노즐0, 1: 노즐1, ...)
 * @apiBody {Number} temperature 설정 온도 (°C)
 * @apiBody {Boolean} [wait=false] 온도 도달까지 대기 여부
 */
app.post('/api/printer/:deviceUuid/temperature', async (req, res) => {
  try {
    const { deviceUuid } = req.params;
    const { tool, temperature, wait = false } = req.body;

    // 유효성 검사
    if (tool === undefined || tool === null) {
      return res.status(400).json({ error: 'tool is required (-1: bed, 0: nozzle0, 1: nozzle1, ...)' });
    }
    if (temperature === undefined || temperature === null) {
      return res.status(400).json({ error: 'temperature is required' });
    }
    if (typeof temperature !== 'number' || temperature < 0 || temperature > 500) {
      return res.status(400).json({ error: 'temperature must be a number between 0 and 500' });
    }

    const topic = `control/${deviceUuid}`;
    const payload = {
      type: 'set_temperature',
      tool: Number(tool),
      temperature: Number(temperature),
    };
    if (wait) {
      payload.wait = true;
    }

    await publishMqtt(topic, payload);

    res.json({
      success: true,
      message: `Temperature set to ${temperature}°C for ${tool === -1 ? 'bed' : `nozzle${tool}`}`,
      payload,
    });
  } catch (error) {
    console.error('[API] Temperature set error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @api {post} /api/printer/:deviceUuid/nozzle-temp 노즐 온도 간편 설정
 * @apiParam {String} deviceUuid 프린터 디바이스 UUID
 * @apiBody {Number} temperature 설정 온도 (°C)
 * @apiBody {Number} [nozzle=0] 노즐 번호 (0, 1, ...)
 */
app.post('/api/printer/:deviceUuid/nozzle-temp', async (req, res) => {
  try {
    const { deviceUuid } = req.params;
    const { temperature, nozzle = 0 } = req.body;

    if (temperature === undefined || temperature === null) {
      return res.status(400).json({ error: 'temperature is required' });
    }
    if (typeof temperature !== 'number' || temperature < 0 || temperature > 350) {
      return res.status(400).json({ error: 'temperature must be a number between 0 and 350' });
    }

    const topic = `control/${deviceUuid}`;
    const payload = {
      type: 'set_temperature',
      tool: Number(nozzle),
      temperature: Number(temperature),
    };

    await publishMqtt(topic, payload);

    res.json({
      success: true,
      message: `Nozzle${nozzle} temperature set to ${temperature}°C`,
      payload,
    });
  } catch (error) {
    console.error('[API] Nozzle temp error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @api {post} /api/printer/:deviceUuid/bed-temp 베드 온도 간편 설정
 * @apiParam {String} deviceUuid 프린터 디바이스 UUID
 * @apiBody {Number} temperature 설정 온도 (°C)
 */
app.post('/api/printer/:deviceUuid/bed-temp', async (req, res) => {
  try {
    const { deviceUuid } = req.params;
    const { temperature } = req.body;

    if (temperature === undefined || temperature === null) {
      return res.status(400).json({ error: 'temperature is required' });
    }
    if (typeof temperature !== 'number' || temperature < 0 || temperature > 150) {
      return res.status(400).json({ error: 'temperature must be a number between 0 and 150' });
    }

    const topic = `control/${deviceUuid}`;
    const payload = {
      type: 'set_temperature',
      tool: -1, // bed
      temperature: Number(temperature),
    };

    await publishMqtt(topic, payload);

    res.json({
      success: true,
      message: `Bed temperature set to ${temperature}°C`,
      payload,
    });
  } catch (error) {
    console.error('[API] Bed temp error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @api {post} /api/printer/:deviceUuid/feed-rate 피드 레이트(이송 속도) 설정
 * @apiParam {String} deviceUuid 프린터 디바이스 UUID
 * @apiBody {Number} factor 속도 비율 (10-500%, 기본 100%)
 * @apiDescription M220 명령어를 사용하여 프린팅 중 이송 속도를 조절합니다.
 */
app.post('/api/printer/:deviceUuid/feed-rate', async (req, res) => {
  try {
    const { deviceUuid } = req.params;
    const { factor } = req.body;

    if (factor === undefined || factor === null) {
      return res.status(400).json({ error: 'factor is required (percentage, 10-500)' });
    }
    if (typeof factor !== 'number' || factor < 10 || factor > 500) {
      return res.status(400).json({ error: 'factor must be a number between 10 and 500' });
    }

    const topic = `control/${deviceUuid}`;
    const payload = {
      type: 'set_feed_rate',
      factor: Number(factor),
    };

    await publishMqtt(topic, payload);

    res.json({
      success: true,
      message: `Feed rate set to ${factor}%`,
      payload,
    });
  } catch (error) {
    console.error('[API] Feed rate error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @api {post} /api/printer/:deviceUuid/flow-rate 플로우 레이트(압출량) 설정
 * @apiParam {String} deviceUuid 프린터 디바이스 UUID
 * @apiBody {Number} factor 압출량 비율 (10-200%, 기본 100%)
 * @apiDescription M221 명령어를 사용하여 프린팅 중 압출량을 조절합니다.
 */
app.post('/api/printer/:deviceUuid/flow-rate', async (req, res) => {
  try {
    const { deviceUuid } = req.params;
    const { factor } = req.body;

    if (factor === undefined || factor === null) {
      return res.status(400).json({ error: 'factor is required (percentage, 10-200)' });
    }
    if (typeof factor !== 'number' || factor < 10 || factor > 200) {
      return res.status(400).json({ error: 'factor must be a number between 10 and 200' });
    }

    const topic = `control/${deviceUuid}`;
    const payload = {
      type: 'set_flow_rate',
      factor: Number(factor),
    };

    await publishMqtt(topic, payload);

    res.json({
      success: true,
      message: `Flow rate set to ${factor}%`,
      payload,
    });
  } catch (error) {
    console.error('[API] Flow rate error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @api {post} /api/printer/:deviceUuid/control 프린터 제어 (일시정지/재개/취소)
 * @apiParam {String} deviceUuid 프린터 디바이스 UUID
 * @apiBody {String} action 동작 (pause, resume, cancel, home)
 * @apiBody {String} [axes=XYZ] home 동작 시 축 지정
 */
app.post('/api/printer/:deviceUuid/control', async (req, res) => {
  try {
    const { deviceUuid } = req.params;
    const { action, axes = 'XYZ' } = req.body;

    const validActions = ['pause', 'resume', 'cancel', 'home'];
    if (!action || !validActions.includes(action)) {
      return res.status(400).json({ error: `action must be one of: ${validActions.join(', ')}` });
    }

    const topic = `control/${deviceUuid}`;
    const payload = { type: action };

    if (action === 'home') {
      payload.axes = axes;
    }

    await publishMqtt(topic, payload);

    res.json({
      success: true,
      message: `Printer ${action} command sent`,
      payload,
    });
  } catch (error) {
    console.error('[API] Control error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @api {post} /api/printer/:deviceUuid/pause 프린팅 일시정지
 * @apiParam {String} deviceUuid 프린터 디바이스 UUID
 * @apiDescription 현재 진행 중인 프린팅 작업을 일시정지합니다.
 */
app.post('/api/printer/:deviceUuid/pause', async (req, res) => {
  try {
    const { deviceUuid } = req.params;
    const topic = `control/${deviceUuid}`;
    const payload = { type: 'pause' };

    await publishMqtt(topic, payload);

    res.json({
      success: true,
      message: 'Print paused',
      payload,
    });
  } catch (error) {
    console.error('[API] Pause error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @api {post} /api/printer/:deviceUuid/resume 프린팅 재개
 * @apiParam {String} deviceUuid 프린터 디바이스 UUID
 * @apiDescription 일시정지된 프린팅 작업을 재개합니다.
 */
app.post('/api/printer/:deviceUuid/resume', async (req, res) => {
  try {
    const { deviceUuid } = req.params;
    const topic = `control/${deviceUuid}`;
    const payload = { type: 'resume' };

    await publishMqtt(topic, payload);

    res.json({
      success: true,
      message: 'Print resumed',
      payload,
    });
  } catch (error) {
    console.error('[API] Resume error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @api {post} /api/printer/:deviceUuid/cancel 프린팅 취소 (정지)
 * @apiParam {String} deviceUuid 프린터 디바이스 UUID
 * @apiDescription 현재 진행 중인 프린팅 작업을 취소합니다.
 */
app.post('/api/printer/:deviceUuid/cancel', async (req, res) => {
  try {
    const { deviceUuid } = req.params;
    const topic = `control/${deviceUuid}`;
    const payload = { type: 'cancel' };

    await publishMqtt(topic, payload);

    res.json({
      success: true,
      message: 'Print cancelled',
      payload,
    });
  } catch (error) {
    console.error('[API] Cancel error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @api {post} /api/printer/:deviceUuid/home 프린터 홈 이동
 * @apiParam {String} deviceUuid 프린터 디바이스 UUID
 * @apiBody {String} [axes=XYZ] 홈 이동할 축 (X, Y, Z, XY, XYZ 등)
 * @apiDescription 지정된 축을 원점(홈)으로 이동합니다.
 */
app.post('/api/printer/:deviceUuid/home', async (req, res) => {
  try {
    const { deviceUuid } = req.params;
    const { axes = 'XYZ' } = req.body;
    const topic = `control/${deviceUuid}`;
    const payload = { type: 'home', axes };

    await publishMqtt(topic, payload);

    res.json({
      success: true,
      message: `Homing ${axes} axes`,
      payload,
    });
  } catch (error) {
    console.error('[API] Home error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @api {post} /api/printer/:deviceUuid/move 프린터 이동
 * @apiParam {String} deviceUuid 프린터 디바이스 UUID
 * @apiBody {String} [mode=relative] 이동 모드 (relative, absolute)
 * @apiBody {Number} [x] X축 이동량/위치 (mm)
 * @apiBody {Number} [y] Y축 이동량/위치 (mm)
 * @apiBody {Number} [z] Z축 이동량/위치 (mm)
 * @apiBody {Number} [e] 익스트루더 이동량 (mm)
 * @apiBody {Number} [feedrate=1000] 이동 속도 (mm/min)
 */
app.post('/api/printer/:deviceUuid/move', async (req, res) => {
  try {
    const { deviceUuid } = req.params;
    const { mode = 'relative', x, y, z, e, feedrate = 1000 } = req.body;

    if (!['relative', 'absolute'].includes(mode)) {
      return res.status(400).json({ error: 'mode must be "relative" or "absolute"' });
    }

    const topic = `control/${deviceUuid}`;
    const payload = {
      type: 'move',
      mode,
      feedrate: Number(feedrate),
    };

    if (x !== undefined) payload.x = Number(x);
    if (y !== undefined) payload.y = Number(y);
    if (z !== undefined) payload.z = Number(z);
    if (e !== undefined) payload.e = Number(e);

    await publishMqtt(topic, payload);

    res.json({
      success: true,
      message: `Move command sent (mode: ${mode})`,
      payload,
    });
  } catch (error) {
    console.error('[API] Move error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @api {post} /api/printer/:deviceUuid/gcode G-code 직접 전송
 * @apiParam {String} deviceUuid 프린터 디바이스 UUID
 * @apiBody {String} command G-code 명령어
 */
app.post('/api/printer/:deviceUuid/gcode', async (req, res) => {
  try {
    const { deviceUuid } = req.params;
    const { command } = req.body;

    if (!command || typeof command !== 'string') {
      return res.status(400).json({ error: 'command is required (string)' });
    }

    const topic = `control/${deviceUuid}`;
    const payload = {
      type: 'gcode',
      command: command.trim(),
    };

    await publishMqtt(topic, payload);

    res.json({
      success: true,
      message: `G-code command sent: ${command}`,
      payload,
    });
  } catch (error) {
    console.error('[API] G-code error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 프린터 상태 조회 API
// ============================================

// 프린터 상태 캐시 (MQTT에서 수신한 최신 상태 저장)
const printerStatusCache = new Map();

// dash_status 토픽 구독 및 상태 캐시 업데이트
async function subscribePrinterStatus(deviceUuid) {
  await connectMqtt();
  const topic = `dash_status/${deviceUuid}`;

  // 이미 구독 중인지 확인
  if (printerStatusCache.has(deviceUuid) && printerStatusCache.get(deviceUuid)._subscribed) {
    return;
  }

  mqttClient.subscribe(topic, { qos: 1 }, (err) => {
    if (err) {
      console.error(`[MQTT] Failed to subscribe to ${topic}:`, err);
    } else {
      console.log(`[MQTT] Subscribed to ${topic}`);
      // 구독 상태 표시
      if (!printerStatusCache.has(deviceUuid)) {
        printerStatusCache.set(deviceUuid, { _subscribed: true, lastUpdate: null });
      } else {
        printerStatusCache.get(deviceUuid)._subscribed = true;
      }
    }
  });
}

// MQTT 메시지 핸들러 설정
function setupMqttMessageHandler() {
  if (!mqttClient) return;

  mqttClient.on('message', (topic, message) => {
    // dash_status 메시지 처리
    if (topic.startsWith('dash_status/')) {
      const deviceUuid = topic.replace('dash_status/', '');
      try {
        const payload = JSON.parse(message.toString());
        printerStatusCache.set(deviceUuid, {
          ...payload,
          _subscribed: true,
          lastUpdate: new Date().toISOString(),
        });
      } catch (err) {
        console.error(`[MQTT] Failed to parse message from ${topic}:`, err);
      }
    }
  });
}

/**
 * @api {get} /api/printer/:deviceUuid/status 프린터 상태 조회
 * @apiParam {String} deviceUuid 프린터 디바이스 UUID
 * @apiDescription MQTT를 통해 수신한 최신 프린터 상태를 반환합니다.
 * @apiSuccess {Object} status 프린터 상태 정보
 * @apiSuccess {String} status.state 프린터 상태 (idle, printing, paused, error 등)
 * @apiSuccess {Object} status.temperature 온도 정보
 * @apiSuccess {Object} status.job 현재 작업 정보
 * @apiSuccess {Number} status.progress 진행률
 */
app.get('/api/printer/:deviceUuid/status', async (req, res) => {
  try {
    const { deviceUuid } = req.params;

    // 구독 시작 (아직 안 되어 있다면)
    await subscribePrinterStatus(deviceUuid);

    // 캐시된 상태 반환
    const cachedStatus = printerStatusCache.get(deviceUuid);

    if (!cachedStatus || !cachedStatus.lastUpdate) {
      return res.json({
        success: true,
        status: null,
        message: 'Waiting for printer status... (subscribed to MQTT topic)',
        subscribed: true,
      });
    }

    // 상태 정보 정리
    const { _subscribed, ...statusData } = cachedStatus;

    res.json({
      success: true,
      status: statusData,
      lastUpdate: cachedStatus.lastUpdate,
    });
  } catch (error) {
    console.error('[API] Status error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @api {post} /api/printer/:deviceUuid/status/subscribe 프린터 상태 구독 시작
 * @apiParam {String} deviceUuid 프린터 디바이스 UUID
 * @apiDescription 해당 프린터의 MQTT 상태 토픽 구독을 시작합니다.
 */
app.post('/api/printer/:deviceUuid/status/subscribe', async (req, res) => {
  try {
    const { deviceUuid } = req.params;
    await subscribePrinterStatus(deviceUuid);

    res.json({
      success: true,
      message: `Subscribed to dash_status/${deviceUuid}`,
    });
  } catch (error) {
    console.error('[API] Subscribe error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @api {get} /api/printers/status 모든 구독 중인 프린터 상태 조회
 * @apiDescription 현재 구독 중인 모든 프린터의 상태를 반환합니다.
 */
app.get('/api/printers/status', (req, res) => {
  const statuses = {};

  printerStatusCache.forEach((value, key) => {
    const { _subscribed, ...statusData } = value;
    statuses[key] = statusData;
  });

  res.json({
    success: true,
    printers: statuses,
    count: printerStatusCache.size,
  });
});

// ============================================
// API 상태 확인
// ============================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mqtt: mqttClient?.connected ? 'connected' : 'disconnected',
    subscribedPrinters: printerStatusCache.size,
    timestamp: new Date().toISOString(),
  });
});

// SPA 라우팅: 모든 요청을 index.html로 리다이렉트
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);

  // 서버 시작 시 MQTT 연결 시도
  try {
    await connectMqtt();
    setupMqttMessageHandler();
    console.log('[MQTT] Pre-connected to broker');
  } catch (err) {
    console.warn('[MQTT] Initial connection failed, will retry on first API call:', err.message);
  }
});
