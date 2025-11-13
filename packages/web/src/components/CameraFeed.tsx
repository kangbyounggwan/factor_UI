import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Play, RotateCw, Maximize2, X } from "lucide-react";
import { publishCameraStart, publishCameraStop, subscribeCameraState } from "@shared/services/mqttService";
import { supabase } from "@shared/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/contexts/AuthContext";
import { getUserPlan } from "@shared/services/supabaseService/subscription";
import { getWebcamReconnectInterval } from "@shared/utils/subscription";
import type { SubscriptionPlan } from "@shared/types/subscription";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface CameraFeedProps {
  cameraId: string; // device uuid와 동일
  isConnected: boolean;
  resolution: string;
}

export const CameraFeed = ({ cameraId, isConnected, resolution }: CameraFeedProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isStreaming, setIsStreaming] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'offline' | 'starting' | 'online' | 'error'>('offline');

  // ▶︎ WebRTC URL만 유지
  const [webrtcUrl, setWebrtcUrl] = useState<string | null>(null);

  // 카메라 URL 설정 모달 상태
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [cameraUrl, setCameraUrl] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const autoStopTimerRef = useRef<number | null>(null);

  // 사용자 플랜 및 재연결 간격 상태
  const [userPlan, setUserPlan] = useState<SubscriptionPlan>('free');
  const [reconnectInterval, setReconnectInterval] = useState<number | undefined>(5); // 기본값: 5분

  const cleanupVideo = useCallback(() => {
    const frame = iframeRef.current;
    if (frame) {
      try {
        frame.src = 'about:blank';
      } catch (error) {
        console.warn('[CAM] Failed to reset iframe src:', error);
      }
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
      return (data as { stream_url?: string } | null)?.stream_url ?? null;
    } catch (e) {
      console.warn('[CAM][DB] stream_url 조회 예외:', e);
      return null;
    }
  }

  // 카메라 URL 저장
  const saveCameraUrl = useCallback(async () => {
    if (!cameraUrl.trim()) {
      toast({
        title: t('camera.error'),
        description: t('camera.urlRequired'),
        variant: "destructive",
      });
      return;
    }

    setSavingUrl(true);
    try {
      const { error } = await supabase
        .from('cameras')
        .update({ stream_url: cameraUrl.trim() })
        .eq('device_uuid', cameraId);

      if (error) {
        console.error('[CAM] Failed to save camera URL:', error);
        toast({
          title: t('camera.error'),
          description: t('camera.urlSaveFailed'),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: t('camera.success'),
        description: t('camera.urlSaved'),
      });

      setShowUrlModal(false);
      // URL 저장 후 자동으로 스트리밍 시작
      setTimeout(() => startStreaming(), 500);
    } catch (error) {
      console.error('[CAM] Exception saving camera URL:', error);
      toast({
        title: t('camera.error'),
        description: t('camera.urlSaveFailed'),
        variant: "destructive",
      });
    } finally {
      setSavingUrl(false);
    }
  }, [cameraUrl, cameraId, toast, t]);

  // 사용자 플랜 로드 및 재연결 간격 설정
  useEffect(() => {
    const loadUserPlan = async () => {
      if (!user) return;
      try {
        const plan = await getUserPlan(user.id);
        setUserPlan(plan);
        const interval = getWebcamReconnectInterval(plan);
        setReconnectInterval(interval);
      } catch (error) {
        console.error('[CAM] Error loading user plan:', error);
      }
    };
    loadUserPlan();
  }, [user]);

  // ── MQTT 상태 구독 (STATE_TOPIC) ──────────────────────────────────────────────
  useEffect(() => {
    let unsub: (() => Promise<void>) | null = null;

    (async () => {
      try {
        unsub = await subscribeCameraState(cameraId, ({ running, webrtcUrl, status }) => {
          setCameraStatus(status);
          if (webrtcUrl) setWebrtcUrl(webrtcUrl);
        });
      } catch (e) {
        console.warn('[CAM][MQTT] subscribe failed', e);
      }
    })();

    return () => { if (unsub) unsub(); };
  }, [cameraId]);

  // ── Start: 라즈베리로 WebRTC 파이프라인 시작 명령 ────────────────────────────
  const startStreaming = useCallback(async () => {
    if (!isConnected) {
      setStreamError(t('camera.serverConnectionRequired'));
      return;
    }
    setStreamError(null);
    setIsStreaming(true);
    setCameraStatus('starting');

    try {
      // 입력(MJPEG/RTSP 등)
      const input = await getCameraStreamInput(cameraId);
      if (!input) {
        // URL이 없으면 모달 열기
        setIsStreaming(false);
        setCameraStatus('offline');
        setShowUrlModal(true);
        return;
      }

      // 해상도 파싱
      const [w, h] = (resolution || '').split('x').map((v) => Number(v));
      const width = Number.isFinite(w) && w > 0 ? w : 1280;
      const height = Number.isFinite(h) && h > 0 ? h : 720;

      // 환경변수(없으면 라우터의 LAN 주소를 직접 기입)
      const RTSP_BASE   = import.meta.env?.VITE_MEDIA_RTSP_BASE   || 'rtsp://factor.io.kr:8554';
      const WEBRTC_BASE = import.meta.env?.VITE_MEDIA_WEBRTC_BASE || 'https://factor.io.kr/webrtc';

      // shared 함수 사용
      await publishCameraStart({
        deviceUuid: cameraId,
        streamUrl: input,
        fps: 20,
        width,
        height,
        bitrateKbps: 1800,
        encoder: 'libx264',
        forceMjpeg: true,
        lowLatency: true,
        rtspBase: RTSP_BASE,
        webrtcBase: WEBRTC_BASE
      });
      // 이후 실제 재생 URL은 STATE_TOPIC에서 수신 → setWebrtcUrl()
    } catch (e) {
      console.error('[CAM][MQTT] start error', e);
      setStreamError(t('camera.startFailed'));
      setCameraStatus('error');
      setIsStreaming(false);
    }
  }, [isConnected, cameraId, resolution, t]);

  const stopStreaming = useCallback(async () => {
    setIsStreaming(false);
    cleanupVideo();
    try {
      await publishCameraStop(cameraId);
    } catch (e) {
      console.warn('[CAM][MQTT] stop error', e);
    }
  }, [cleanupVideo, cameraId]);

  // 플랜별 자동 재연결 타이머 (무료: 5분, 프로/엔터: 무제한)
  useEffect(() => {
    if (isStreaming && reconnectInterval !== undefined) {
      // reconnectInterval이 undefined면 무제한 스트리밍 (Pro/Enterprise)
      if (autoStopTimerRef.current) {
        try {
          clearTimeout(autoStopTimerRef.current);
        } catch (error) {
          console.warn('[CAM] Failed to clear timeout:', error);
        }
      }
      autoStopTimerRef.current = window.setTimeout(() => {
        try {
          stopStreaming();
        } catch (error) {
          console.error('[CAM] Auto-stop failed:', error);
        }
      }, reconnectInterval * 60 * 1000);
    }
    return () => {
      if (autoStopTimerRef.current) {
        try {
          clearTimeout(autoStopTimerRef.current);
        } catch (error) {
          console.warn('[CAM] Failed to clear timeout on cleanup:', error);
        }
        autoStopTimerRef.current = null;
      }
    };
  }, [isStreaming, reconnectInterval, stopStreaming]);

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
            {t('camera.title')}
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent ${isConnected ? 'bg-primary/40 text-primary-foreground hover:bg-primary/50' : 'bg-destructive/40 text-destructive-foreground hover:bg-destructive/50'}`}>
              {isConnected ? t('camera.connected') : t('camera.disconnected')}
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
                      <p className="text-sm opacity-80">{t("camera.streamPreparation")}</p>
                    </div>
                  )}

                  {isFullscreen && (
                    <button
                      type="button"
                      onClick={() => setIsFullscreen(false)}
                      className="absolute top-4 right-4 z-50 inline-flex items-center justify-center h-8 w-8 rounded-full bg-black/60 text-white hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white/40"
                      aria-label={t("camera.exitFullscreen")}
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
                    <Badge variant="secondary" className={`text-white ${
                      !isConnected
                        ? 'bg-destructive'
                        : cameraStatus === 'online'
                          ? 'bg-red-500'
                          : 'bg-black/50'
                    }`}>
                      {!isConnected
                        ? t('camera.disconnected')
                        : cameraStatus === 'online'
                          ? 'LIVE'
                          : cameraStatus.toUpperCase()}
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
                    <p className="text-lg">{t("camera.cameraDisconnected")}</p>
                    <p className="text-sm opacity-75">{t("camera.checkConnection")}</p>
                  </div>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-white space-y-4">
                <Camera className="h-16 w-16 text-muted-foreground" />
                <div className="text-center">
                  <h3 className="text-lg font-medium text-white">{t("camera.cameraStreaming")}</h3>
                  <p className="text-sm text-gray-300">{t("camera.startStreamingDesc")}</p>
                </div>
                <Button onClick={startStreaming} disabled={!isConnected} size="lg" className="bg-primary hover:bg-primary/90">
                  <Play className="h-5 w-5 mr-2" />
                  {t("camera.startStreaming")}
                </Button>
              </div>
            )}
          </div>

          {isStreaming && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={stopStreaming} disabled={!isConnected}>
                  {t("camera.stop")}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { /* {t("camera.refresh")}}: iframe 리로드 */ 
                    if (webrtcUrl && iframeRef.current) iframeRef.current.src = `${webrtcUrl}?t=${Date.now()}&autoplay=1&muted=1`;
                  }}
                  disabled={!isConnected || !isStreaming}
                >
                  <RotateCw className="h-4 w-4" />
                {t("camera.refresh")}
                </Button>
              </div>

              <Button variant="outline" size="sm" onClick={toggleFullscreen} disabled={!isConnected || !isStreaming}>
                <Maximize2 className="h-4 w-4" />
                {isFullscreen ? t("camera.minimize") : t("camera.fullscreen")}
              </Button>
            </div>
          )}

          {isStreaming && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t("camera.cameraId")}</span>
                <span className="ml-2 font-mono">{cameraId}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("camera.resolution")}</span>
                <span className="ml-2">{resolution}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {/* 카메라 URL 설정 모달 */}
      <Dialog open={showUrlModal} onOpenChange={setShowUrlModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('camera.setupCameraUrl')}</DialogTitle>
            <DialogDescription>
              {t('camera.setupCameraUrlDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="camera-url">{t('camera.cameraUrl')}</Label>
              <Input
                id="camera-url"
                type="text"
                placeholder="http://192.168.1.100:8080/video"
                value={cameraUrl}
                onChange={(e) => setCameraUrl(e.target.value)}
                disabled={savingUrl}
              />
              <p className="text-sm text-muted-foreground">
                {t('camera.urlExample')}: http://192.168.1.100:8080/video, rtsp://192.168.1.100:8554/stream
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUrlModal(false)}
              disabled={savingUrl}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={saveCameraUrl}
              disabled={savingUrl || !cameraUrl.trim()}
            >
              {savingUrl ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
