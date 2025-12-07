/**
 * Temperature Session Management
 * JSONB-based batch updates for efficient storage
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface TemperatureReading {
  t: string; // ISO timestamp
  nt: number; // nozzle_temp
  nto: number; // nozzle_target
  bt: number; // bed_temp
  bto: number; // bed_target
}

export interface TemperatureSession {
  id: string;
  printer_id: string;
  session_start: string;
  session_end: string | null;
  temperature_data: {
    readings: TemperatureReading[];
  };
  reading_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * 온도 세션 관리 클래스
 * 메모리 버퍼에 데이터를 모았다가 배치로 DB에 저장
 */
export class TemperatureSessionManager {
  private printerId: string;
  private supabase: SupabaseClient;
  private buffer: TemperatureReading[] = [];
  private currentSessionId: string | null = null;
  private lastFlush: number = Date.now();

  // 설정
  private readonly BUFFER_SIZE = 60; // 60개 모이면 플러시 (약 1-2분)
  private readonly FLUSH_INTERVAL = 60 * 1000; // 1분마다 플러시
  private readonly SESSION_TIMEOUT = 10 * 60 * 1000; // 10분 동안 데이터 없으면 세션 종료
  private readonly MAX_READINGS_PER_PRINTER = 800; // 프린터당 최대 reading 수 제한

  private flushTimer: NodeJS.Timeout | null = null;
  private sessionTimer: NodeJS.Timeout | null = null;

  constructor(printerId: string, supabase: SupabaseClient) {
    this.printerId = printerId;
    this.supabase = supabase;
  }

  /**
   * 온도 데이터 추가
   */
  async addReading(reading: TemperatureReading): Promise<void> {
    this.buffer.push(reading);

    // 세션 타이머 리셋
    this.resetSessionTimer();

    // 버퍼가 가득 차면 플러시
    if (this.buffer.length >= this.BUFFER_SIZE) {
      await this.flush();
    } else if (!this.flushTimer) {
      // 주기적 플러시 타이머 시작
      this.startFlushTimer();
    }
  }

  /**
   * 버퍼를 DB에 플러시
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    try {
      console.log(`[TempSession] Flushing ${this.buffer.length} readings to DB...`);

      // 현재 활성 세션 가져오기 또는 생성
      const sessionId = await this.getOrCreateSession();

      // 기존 세션의 데이터 가져오기
      const { data: session, error: fetchError } = await this.supabase
        .from('printer_temperature_sessions')
        .select('temperature_data, reading_count')
        .eq('id', sessionId)
        .single();

      if (fetchError) {
        console.error('[TempSession] Failed to fetch session:', fetchError);
        return;
      }

      // 새 데이터 추가
      const existingReadings = (session?.temperature_data as { readings: TemperatureReading[] })?.readings || [];
      const newReadings = [...existingReadings, ...this.buffer];

      // DB 업데이트
      const { error: updateError } = await this.supabase
        .from('printer_temperature_sessions')
        .update({
          temperature_data: { readings: newReadings },
          reading_count: newReadings.length,
          session_end: new Date().toISOString(), // 최신 타임스탬프로 업데이트
        })
        .eq('id', sessionId);

      if (updateError) {
        console.error('[TempSession] Failed to update session:', updateError);
        return;
      }

      console.log(`[TempSession] ✅ Flushed ${this.buffer.length} readings. Total: ${newReadings.length}`);

      // 버퍼 비우기
      this.buffer = [];
      this.lastFlush = Date.now();
    } catch (error) {
      console.error('[TempSession] Flush error:', error);
    }
  }

  /**
   * 프린터의 총 reading 수 제한 유지 (800개 이하)
   */
  private async enforceReadingLimit(): Promise<void> {
    try {
      // 현재 프린터의 총 reading 수 계산
      const { data: sessions, error } = await this.supabase
        .from('printer_temperature_sessions')
        .select('id, reading_count, session_start')
        .eq('printer_id', this.printerId)
        .order('session_start', { ascending: false });

      if (error || !sessions) {
        console.warn('[TempSession] Failed to check reading count:', error);
        return;
      }

      const totalReadings = sessions.reduce((sum, s) => sum + (s.reading_count || 0), 0);

      if (totalReadings <= this.MAX_READINGS_PER_PRINTER) {
        return; // 제한 이하면 아무것도 안 함
      }

      console.log(`[TempSession] ⚠️ Total readings (${totalReadings}) exceeds limit (${this.MAX_READINGS_PER_PRINTER})`);

      // 초과된 수만큼 오래된 세션부터 삭제
      const excessReadings = totalReadings - this.MAX_READINGS_PER_PRINTER;
      let readingsToDelete = 0;
      const sessionsToDelete: string[] = [];

      // 가장 오래된 것부터 삭제 대상 선정
      for (let i = sessions.length - 1; i >= 0; i--) {
        const session = sessions[i];
        sessionsToDelete.push(session.id);
        readingsToDelete += session.reading_count || 0;

        if (readingsToDelete >= excessReadings) {
          break;
        }
      }

      if (sessionsToDelete.length > 0) {
        const { error: deleteError } = await this.supabase
          .from('printer_temperature_sessions')
          .delete()
          .in('id', sessionsToDelete);

        if (deleteError) {
          console.error('[TempSession] Failed to delete old sessions:', deleteError);
        } else {
          console.log(`[TempSession] 🗑️ Deleted ${sessionsToDelete.length} old sessions (${readingsToDelete} readings)`);
        }
      }
    } catch (error) {
      console.error('[TempSession] Error enforcing reading limit:', error);
    }
  }

  /**
   * 현재 활성 세션 가져오기 또는 새 세션 생성
   */
  private async getOrCreateSession(): Promise<string> {
    // 이미 세션 ID가 있으면 재사용
    if (this.currentSessionId) {
      return this.currentSessionId;
    }

    // 최근 활성 세션 찾기 (10분 이내)
    const tenMinutesAgo = new Date(Date.now() - this.SESSION_TIMEOUT).toISOString();

    const { data: recentSession, error: fetchError } = await this.supabase
      .from('printer_temperature_sessions')
      .select('id')
      .eq('printer_id', this.printerId)
      .gte('session_end', tenMinutesAgo)
      .order('session_end', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentSession && !fetchError) {
      console.log('[TempSession] Reusing recent session:', recentSession.id);
      this.currentSessionId = recentSession.id;
      return recentSession.id;
    }

    // 새 세션 생성 전에 reading 수 제한 확인
    await this.enforceReadingLimit();

    // 새 세션 생성
    const now = new Date().toISOString();
    const { data: newSession, error: insertError } = await this.supabase
      .from('printer_temperature_sessions')
      .insert({
        printer_id: this.printerId,
        session_start: now,
        session_end: now,
        temperature_data: { readings: [] },
        reading_count: 0,
      })
      .select('id')
      .single();

    if (insertError || !newSession) {
      console.error('[TempSession] Failed to create session:', insertError);
      throw new Error('Failed to create temperature session');
    }

    console.log('[TempSession] ✨ Created new session:', newSession.id);
    this.currentSessionId = newSession.id;
    return newSession.id;
  }

  /**
   * 주기적 플러시 타이머 시작
   */
  private startFlushTimer(): void {
    if (this.flushTimer) return;

    this.flushTimer = setInterval(async () => {
      const timeSinceLastFlush = Date.now() - this.lastFlush;
      if (timeSinceLastFlush >= this.FLUSH_INTERVAL && this.buffer.length > 0) {
        await this.flush();
      }
    }, this.FLUSH_INTERVAL);
  }

  /**
   * 세션 타이머 리셋 (데이터가 계속 들어오면 세션 유지)
   */
  private resetSessionTimer(): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }

    this.sessionTimer = setTimeout(() => {
      console.log('[TempSession] Session timeout - closing session');
      this.endSession();
    }, this.SESSION_TIMEOUT);
  }

  /**
   * 세션 종료
   */
  async endSession(): Promise<void> {
    // 남은 버퍼 플러시
    await this.flush();

    // 세션 종료 시간 업데이트
    if (this.currentSessionId) {
      await this.supabase
        .from('printer_temperature_sessions')
        .update({ session_end: new Date().toISOString() })
        .eq('id', this.currentSessionId);

      console.log('[TempSession] Session ended:', this.currentSessionId);
      this.currentSessionId = null;
    }

    // 타이머 정리
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
  }

  /**
   * 클린업
   */
  async destroy(): Promise<void> {
    await this.endSession();
  }
}

/**
 * 온도 히스토리 조회 (최근 N분)
 */
export async function getTemperatureHistory(
  supabase: SupabaseClient,
  printerId: string,
  minutes: number = 30
): Promise<TemperatureReading[]> {
  const startTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();

  const { data: sessions, error } = await supabase
    .from('printer_temperature_sessions')
    .select('temperature_data')
    .eq('printer_id', printerId)
    .gte('session_end', startTime)
    .order('session_start', { ascending: true });

  if (error) {
    console.error('[TempSession] Failed to fetch history:', error);
    return [];
  }

  if (!sessions || sessions.length === 0) {
    return [];
  }

  // 모든 세션의 readings 합치기
  const allReadings: TemperatureReading[] = [];
  for (const session of sessions) {
    const readings = (session.temperature_data as { readings: TemperatureReading[] })?.readings || [];

    // 시간 범위 필터링
    const filteredReadings = readings.filter(r => r.t >= startTime);
    allReadings.push(...filteredReadings);
  }

  // 시간순 정렬
  allReadings.sort((a, b) => a.t.localeCompare(b.t));

  console.log(`[TempSession] Loaded ${allReadings.length} readings from ${sessions.length} sessions`);
  return allReadings;
}
