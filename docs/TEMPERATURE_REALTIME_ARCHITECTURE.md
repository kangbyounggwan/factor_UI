# 🌡️ Temperature Realtime Architecture (Final)

## 📊 구조 개요

```
Frontend/MQTT → printers.status = 'printing'
    ↓ (UPDATE 이벤트)
Supabase Realtime
    ↓
WebSocket Proxy (Node.js) - 수집 상태 활성화
    ↓
MQTT (3초마다) - temperature_info 수신
    ↓
[수집 체크] printerCollectionStatus.get(printer_id) === true
    ↓
printer_temperature_logs (실시간, 최대 800개/프린터)
    ↓ (INSERT 이벤트)
Supabase Realtime
    ↓
Frontend (PrinterDetail.tsx) - 그래프 실시간 업데이트

    [800개 도달 시 자동 아카이브]
    ↓
printer_temperature_sessions (JSONB 압축 저장)
    ↓
printer_temperature_logs에서 아카이브된 데이터 삭제
```

---

## 🎯 핵심 특징

### 1️⃣ **실시간 데이터 저장 (printer_temperature_logs)**

- **저장 주기**: 3초마다
- **저장 조건**: `printers.status = 'printing'` (Realtime으로 모니터링)
- **수집 제어**: WebSocket Proxy가 `printers` 테이블 UPDATE 이벤트 구독
- **최대 개수**: 프린터당 800개
- **Realtime 구독**: Frontend에서 INSERT 이벤트 구독
- **자동 정리**: 800개 도달 시 자동 아카이브

### 2️⃣ **자동 아카이브 (printer_temperature_sessions)**

- **트리거**: 800개 도달 시 자동 실행
- **저장 형식**: JSONB 배열 (압축)
- **아카이브 후**: printer_temperature_logs에서 해당 데이터 삭제
- **보관 기간**: 7일 (설정 가능)

### 3️⃣ **Supabase Realtime**

- **이벤트**: `INSERT` on `printer_temperature_logs`
- **필터**: `printer_id=eq.{printer_id}`
- **Frontend**: 실시간 그래프 업데이트 (1800개 최대 유지)

---

## 🗄️ 테이블 구조

### `printer_temperature_logs` (실시간 데이터)

```sql
CREATE TABLE public.printer_temperature_logs (
  id BIGSERIAL PRIMARY KEY,
  printer_id UUID NOT NULL,
  nozzle_temp FLOAT NOT NULL DEFAULT 0,
  nozzle_target FLOAT NOT NULL DEFAULT 0,
  bed_temp FLOAT NOT NULL DEFAULT 0,
  bed_target FLOAT NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_printer_logs FOREIGN KEY (printer_id)
    REFERENCES printers(id) ON DELETE CASCADE
);
```

**특징**:
- 프린터당 최대 800개
- Realtime publication 활성화
- INSERT 시 자동 아카이브 Trigger

---

### `printer_temperature_sessions` (아카이브)

```sql
-- 기존 테이블 유지 (JSONB 구조)
CREATE TABLE public.printer_temperature_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printer_id UUID NOT NULL,
  session_start TIMESTAMPTZ NOT NULL,
  session_end TIMESTAMPTZ,
  temperature_data JSONB NOT NULL DEFAULT '{"readings": []}'::jsonb,
  reading_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_printer FOREIGN KEY (printer_id)
    REFERENCES printers(id) ON DELETE CASCADE
);
```

**JSONB 형식**:
```json
{
  "readings": [
    { "t": "2025-12-07T10:00:00Z", "nt": 158, "nto": 158, "bt": 85, "bto": 85 },
    { "t": "2025-12-07T10:00:03Z", "nt": 158, "nto": 158, "bt": 85, "bto": 85 },
    ...
  ]
}
```

---

## ⚙️ 자동 아카이브 로직

### Trigger Function

```sql
CREATE OR REPLACE FUNCTION archive_temperature_logs()
RETURNS TRIGGER AS $$
DECLARE
  log_count INTEGER;
  readings JSONB;
BEGIN
  -- 현재 프린터의 로그 개수 확인
  SELECT COUNT(*) INTO log_count
  FROM public.printer_temperature_logs
  WHERE printer_id = NEW.printer_id;

  -- 800개 이상이면 아카이브
  IF log_count >= 800 THEN
    -- 1. 가장 오래된 800개 → JSON 변환
    SELECT jsonb_agg(
      jsonb_build_object(
        't', recorded_at,
        'nt', nozzle_temp,
        'nto', nozzle_target,
        'bt', bed_temp,
        'bto', bed_target
      ) ORDER BY recorded_at ASC
    ) INTO readings
    FROM (
      SELECT * FROM public.printer_temperature_logs
      WHERE printer_id = NEW.printer_id
      ORDER BY recorded_at ASC
      LIMIT 800
    ) AS oldest_logs;

    -- 2. printer_temperature_sessions에 저장
    INSERT INTO public.printer_temperature_sessions (
      printer_id, session_start, session_end,
      temperature_data, reading_count
    )
    SELECT
      NEW.printer_id,
      MIN(recorded_at),
      MAX(recorded_at),
      jsonb_build_object('readings', readings),
      800
    FROM (
      SELECT * FROM public.printer_temperature_logs
      WHERE printer_id = NEW.printer_id
      ORDER BY recorded_at ASC
      LIMIT 800
    ) AS archived;

    -- 3. 아카이브된 데이터 삭제
    DELETE FROM public.printer_temperature_logs
    WHERE id IN (
      SELECT id FROM public.printer_temperature_logs
      WHERE printer_id = NEW.printer_id
      ORDER BY recorded_at ASC
      LIMIT 800
    );

    RAISE NOTICE '[Archive] Archived and deleted 800 old logs for printer %', NEW.printer_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 🖥️ Frontend 구현

### PrinterDetail.tsx

```typescript
useEffect(() => {
  if (!id) return;

  // 1. 초기 데이터 로드 (최근 30분)
  const loadTemperatureHistory = async () => {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: logs, error } = await supabase
      .from('printer_temperature_logs')
      .select('*')
      .eq('printer_id', id)
      .gte('recorded_at', thirtyMinsAgo)
      .order('recorded_at', { ascending: true })
      .limit(800);

    if (!error && logs) {
      const historyData = logs.map(log => ({
        time: formatTime(log.recorded_at),
        toolTemp: log.nozzle_temp,
        toolTarget: log.nozzle_target,
        bedTemp: log.bed_temp,
        bedTarget: log.bed_target,
      }));
      setTemperatureHistory(historyData);
    }
  };

  loadTemperatureHistory();

  // 2. Realtime 구독 (INSERT 이벤트)
  const channel = supabase
    .channel(`printer_temp_logs:${id}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'printer_temperature_logs',
        filter: `printer_id=eq.${id}`,
      },
      (payload) => {
        const log = payload.new as any;
        const newPoint = {
          time: formatTime(log.recorded_at),
          toolTemp: log.nozzle_temp,
          toolTarget: log.nozzle_target,
          bedTemp: log.bed_temp,
          bedTarget: log.bed_target,
        };

        setTemperatureHistory(prev => {
          const updated = [...prev, newPoint];
          return updated.slice(-1800); // 최근 30분만 유지
        });
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}, [id]);
```

---

## 📈 데이터 흐름 타임라인

```
[시간: 0초]
MQTT → WebSocket Proxy → DB INSERT → Realtime → Frontend (그래프 +1)

[시간: 3초]
MQTT → WebSocket Proxy → DB INSERT → Realtime → Frontend (그래프 +1)

[시간: 6초]
MQTT → WebSocket Proxy → DB INSERT → Realtime → Frontend (그래프 +1)

...

[800개 도달 시]
MQTT → WebSocket Proxy → DB INSERT
    ↓ Trigger 실행
    ↓ 1. 800개 → JSONB 변환
    ↓ 2. printer_temperature_sessions INSERT
    ↓ 3. printer_temperature_logs DELETE (800개)
    ↓ 4. 현재 INSERT 완료
    ↓
Realtime → Frontend (그래프 +1)
```

---

## 🎯 장점

| 항목 | 설명 |
|------|------|
| **실시간성** | Supabase Realtime으로 3초마다 그래프 자동 업데이트 |
| **자동 정리** | 800개 도달 시 자동 아카이브 + 삭제 (무한 증가 방지) |
| **히스토리 보존** | printer_temperature_sessions에 JSONB 압축 저장 |
| **효율성** | 실시간 테이블은 최대 800개만 유지 (빠른 쿼리) |
| **비용 0** | Edge Function 불필요, DB Trigger만 사용 |

---

## 📊 성능 지표

### 프린터 1대 기준

- **3초마다 INSERT**: 하루 28,800회
- **DB Writes**: 28,800회/일
- **실시간 테이블 크기**: 최대 800 rows (자동 정리)
- **아카이브 빈도**: 800개마다 (약 40분마다)

### 프린터 100대 기준

- **DB Writes**: 2,880,000회/일
- **실시간 테이블 크기**: 최대 80,000 rows
- **아카이브**: 3,600회/일

---

## 🔧 배포 가이드

### 1. Migration 실행

```bash
# Supabase CLI로 마이그레이션 실행
supabase db push
```

### 2. Realtime Publication 확인

```sql
-- printer_temperature_logs가 publication에 포함되어 있는지 확인
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- 없으면 추가
ALTER PUBLICATION supabase_realtime ADD TABLE public.printer_temperature_logs;
```

### 3. WebSocket Proxy 재시작

```bash
cd packages/shared
node server.js
```

### 4. Frontend 재배포

```bash
cd packages/web
npm run build
```

---

## 🧪 테스트

### 1. 실시간 데이터 확인

```sql
-- 프린터별 현재 로그 개수
SELECT printer_id, COUNT(*) as log_count
FROM printer_temperature_logs
GROUP BY printer_id;
```

### 2. 아카이브 확인

```sql
-- 프린터별 아카이브 세션 수
SELECT printer_id, COUNT(*) as session_count, SUM(reading_count) as total_readings
FROM printer_temperature_sessions
GROUP BY printer_id;
```

### 3. Realtime 구독 테스트

```javascript
// 브라우저 콘솔에서
supabase
  .channel('test-channel')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'printer_temperature_logs',
  }, (payload) => console.log('New insert!', payload))
  .subscribe();
```

---

## 🎉 결론

이 구조는:
- ✅ **실시간** Supabase Realtime으로 즉각 반영
- ✅ **자동 아카이브** 800개마다 JSONB 압축 저장
- ✅ **무한 증가 방지** 실시간 테이블은 항상 800개 이하
- ✅ **히스토리 보존** 압축된 아카이브에서 조회 가능
- ✅ **비용 0** Edge Function 불필요

**Production Ready!** 🚀

---

**Version**: 3.0 (Realtime)
**Date**: 2025-12-07
**Status**: ✅ Implemented
