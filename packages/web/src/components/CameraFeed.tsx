import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Play, RotateCw, Maximize2, X } from "lucide-react";
import { mqttConnect, mqttPublish, mqttSubscribe, mqttUnsubscribe } from "@shared/services/mqttService";
import { supabase } from "@shared/integrations/supabase/client";

interface CameraFeedProps {
  cameraId: string; // device uuid와 동일
  isConnected: boolean;
  resolution: string;
}

export const CameraFeed = ({ cameraId, isConnected, resolution }: CameraFeedProps) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'offline' | 'starting' | 'online' | 'error'>('offline');

  // ▶︎ WebRTC URL만 유지
  const [webrtcUrl, setWebrtcUrl] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const autoStopTimerRef = useRef<number | null>(null);

  const cleanupVideo = useCallback(() => {
    const frame = iframeRef.current;
    if (frame) {
      try { frame.src = 'about:blank'; } catch {}
    }
    setWebrtcUrl(null);
  }, []);

  // DB에서 입력 URL 조회
  async function getCameraStreamInput(deviceUuid: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('cameras')
        .select('stream_url')
        .eq('device_uuid', deviceUuid)
        .maybeSingle();
      if (error) {
        console.warn('[CAM][DB] stream_url 조회 실패:', error.message);
        return null;
      }
      return (data as any)?.stream_url ?? null;
    } catch (e) {
      console.warn('[CAM][DB] stream_url 조회 예외:', e);
      return null;
    }
  }

  // ── MQTT 상태 구독 (STATE_TOPIC) ──────────────────────────────────────────────
  useEffect(() => {
    let unsub: (() => Promise<void>) | null = null;
    let active = true;

    (async () => {
      try {
        await mqttConnect();
        const topic = `camera/${cameraId}/state`;
        const handler = (_t: string, payload: any) => {
          try {
            const msg = typeof payload === 'string' ? JSON.parse(payload) : payload;

            // 상태 판단
            const running = !!(msg?.running);
            setCameraStatus(running ? 'online' : 'offline');

            // URL 추출 (WebRTC만 사용)
            const wurl =
              msg?.webrtc?.play_url_webrtc ||
              msg?.play_url_webrtc ||
              (typeof msg?.url === 'string' && !msg.url.endsWith('.m3u8') ? msg.url : null);
            if (wurl) setWebrtcUrl(wurl);
          } catch (e) {
            console.warn('[CAM][STATE] parse error', e);
          }
        };
        await mqttSubscribe(topic, handler, 1);
        unsub = async () => { try { await mqttUnsubscribe(topic, handler); } catch {} };
      } catch (e) {
        console.warn('[CAM][MQTT] subscribe failed', e);
      }
    })();

    return () => { if (unsub) unsub(); };
  }, [cameraId]);

  // ── Start: 라즈베리로 WebRTC 파이프라인 시작 명령 ────────────────────────────
  const startStreaming = useCallback(async () => {
    if (!isConnected) {
      setStreamError('서버와의 연결이 필요합니다.');
      return;
    }
    setStreamError(null);
    setIsStreaming(true);
    setCameraStatus('starting');

    try {
      await mqttConnect();

      // 입력(MJPEG/RTSP 등)
      const input = await getCameraStreamInput(cameraId);
      if (!input) {
        setStreamError('카메라 입력 주소(stream_url)를 찾을 수 없습니다.');
        setIsStreaming(false);
        setCameraStatus('error');
        return;
      }

      // 해상도 파싱
      const [w, h] = (resolution || '').split('x').map((v) => Number(v));
      const width = Number.isFinite(w) && w > 0 ? w : 1280;
      const height = Number.isFinite(h) && h > 0 ? h : 720;

      // 환경변수(없으면 라우터의 LAN 주소를 직접 기입)
      const RTSP_BASE   = (import.meta as any).env?.VITE_MEDIA_RTSP_BASE   || 'rtsp://factor.io.kr:8554';
      const WEBRTC_BASE = (import.meta as any).env?.VITE_MEDIA_WEBRTC_BASE || 'https://factor.io.kr/webrtc';

      const topic = `camera/${cameraId}/cmd`;
      const payload = {
        type: 'camera',
        action: 'start',
        options: {
          name: `cam-${cameraId}`,
          input,                 // ex) http://<rpi>/stream 혹은 rtsp://...
          fps: 20,
          width,
          height,
          bitrateKbps: 1800,
          encoder: 'libx264',    // 라즈베리 HW 인코더(사용 불가면 서버에서 SW로 폴백)
          forceMjpeg: true,      // HTTP MJPEG 입력 최적화
          lowLatency: true,
          rtsp_base: RTSP_BASE,
          webrtc_base: WEBRTC_BASE
        }
      };
      console.log('[CAM][MQTT] start payload', payload);
      await mqttPublish(topic, payload, 1, false);
      // 이후 실제 재생 URL은 STATE_TOPIC에서 수신 → setWebrtcUrl()
    } catch (e) {
      console.error('[CAM][MQTT] start error', e);
      setStreamError('스트리밍 시작 실패');
      setCameraStatus('error');
      setIsStreaming(false);
    }
  }, [isConnected, cameraId, resolution]);

  const stopStreaming = useCallback(async () => {
    setIsStreaming(false);
    cleanupVideo();
    try {
      const topic = `camera/${cameraId}/cmd`;
      await mqttPublish(topic, { type:'camera', action: 'stop', options: { name: `cam-${cameraId}` } }, 1, false);
    } catch {}
  }, [cleanupVideo, cameraId]);

  // 5분 자동 정지 타이머
  useEffect(() => {
    if (isStreaming) {
      if (autoStopTimerRef.current) {
        try { clearTimeout(autoStopTimerRef.current); } catch {}
      }
      autoStopTimerRef.current = window.setTimeout(() => {
        try { stopStreaming(); } catch {}
      }, 5 * 60 * 1000);
    }
    return () => {
      if (autoStopTimerRef.current) {
        try { clearTimeout(autoStopTimerRef.current); } catch {}
        autoStopTimerRef.current = null;
      }
    };
  }, [isStreaming, stopStreaming]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((v) => !v);
  }, []);

  const showIframe = !!webrtcUrl && !webrtcUrl.endsWith('.m3u8');
  

  return (
    <Card className={`h-full ${isFullscreen ? "fixed inset-4 z-50 bg-background" : ""}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            실시간 카메라 피드
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent ${isConnected ? 'bg-primary text-primary-foreground hover:bg-primary/80' : 'bg-muted text-muted-foreground'}`}>
              {isConnected ? '연결됨' : '연결 끊김'}
            </span>
            <span className="text-sm text-muted-foreground">{resolution}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            {isStreaming ? (
              isConnected ? (
                <div className="relative w-full h-full">
                  {/* WebRTC(iframe)만 사용 */}
                  {showIframe ? (
                    <iframe
                      ref={iframeRef}
                      src={`${webrtcUrl!}?autoplay=1&muted=1`}
                      className="absolute inset-0 w-full h-full"
                      allow="autoplay; fullscreen"
                      allowFullScreen
                      title="webrtc-player"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-white">
                      <p className="text-sm opacity-80">스트림 준비 중…</p>
                    </div>
                  )}

                  {isFullscreen && (
                    <button
                      type="button"
                      onClick={() => setIsFullscreen(false)}
                      className="absolute top-4 right-4 z-50 inline-flex items-center justify-center h-8 w-8 rounded-full bg-black/60 text-white hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white/40"
                      aria-label="전체보기 해제"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}

                  {streamError && (
                    <div className="absolute inset-0 bg-black/60 text-white flex items-center justify-center">
                      <div className="text-center px-4">
                        <p className="text-sm opacity-90">{streamError}</p>
                      </div>
                    </div>
                  )}

                  <div className="absolute top-4 left-4">
                    <Badge variant="secondary" className="bg-black/50 text-white">
                      {cameraStatus === 'online' ? 'LIVE' : cameraStatus.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="absolute bottom-4 right-4 text-white text-sm bg-black/50 px-2 py-1 rounded">
                    {new Date().toLocaleString()}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-white">
                  <div className="text-center">
                    <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-lg">카메라 연결 끊김</p>
                    <p className="text-sm opacity-75">카메라 연결을 확인해주세요</p>
                  </div>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-white space-y-4">
                <Camera className="h-16 w-16 text-muted-foreground" />
                <div className="text-center">
                  <h3 className="text-lg font-medium text-white">카메라 스트리밍</h3>
                  <p className="text-sm text-gray-300">실시간 카메라 피드를 시작하려면 버튼을 눌러주세요</p>
                </div>
                <Button onClick={startStreaming} disabled={!isConnected} size="lg" className="bg-primary hover:bg-primary/90">
                  <Play className="h-5 w-5 mr-2" />
                  스트리밍 시작
                </Button>
              </div>
            )}
          </div>

          {isStreaming && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={stopStreaming} disabled={!isConnected}>
                  정지
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { /* 새로고침: iframe 리로드 */ 
                    if (webrtcUrl && iframeRef.current) iframeRef.current.src = `${webrtcUrl}?t=${Date.now()}&autoplay=1&muted=1`;
                  }}
                  disabled={!isConnected || !isStreaming}
                >
                  <RotateCw className="h-4 w-4" />
                  새로고침
                </Button>
              </div>

              <Button variant="outline" size="sm" onClick={toggleFullscreen} disabled={!isConnected || !isStreaming}>
                <Maximize2 className="h-4 w-4" />
                {isFullscreen ? "축소" : "전체화면"}
              </Button>
            </div>
          )}

          {isStreaming && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">카메라 ID:</span>
                <span className="ml-2 font-mono">{cameraId}</span>
              </div>
              <div>
                <span className="text-muted-foreground">해상도:</span>
                <span className="ml-2">{resolution}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
