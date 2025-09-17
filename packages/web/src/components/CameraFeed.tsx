import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Play, Pause, RotateCw, Maximize2 } from "lucide-react";
import { websocketService } from "@/lib/websocketService";

interface CameraFeedProps {
  cameraId: string;
  isConnected: boolean;
  resolution: string;
}

export const CameraFeed = ({ cameraId, isConnected, resolution }: CameraFeedProps) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleTimeString());
  const [streamError, setStreamError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const roomIdRef = useRef<string>(`camera:${cameraId}`);
  const joinedRef = useRef<boolean>(false);

  const iceServers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] },
  ];

  // 실시간 시간 업데이트 시뮬레이션
  useEffect(() => {
    if (isConnected && isPlaying && isStreaming) {
      const interval = setInterval(() => {
        setLastUpdate(new Date().toLocaleTimeString());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isConnected, isPlaying, isStreaming]);

  const attachMediaStream = useCallback((stream: MediaStream) => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    videoElement.srcObject = stream;
    if (isPlaying) {
      // 자동 재생 허용을 위해 mute
      videoElement.muted = true;
      videoElement.play().catch(() => {
        // 자동재생 정책으로 실패 시 사용자가 재생 버튼을 눌러야 함
      });
    }
  }, [isPlaying]);

  const cleanupPeer = useCallback(() => {
    try {
      const peer = peerRef.current;
      if (peer) {
        peer.ontrack = null;
        peer.onicecandidate = null;
        peer.getSenders().forEach((s) => {
          try { s.track?.stop(); } catch {}
        });
        peer.getReceivers().forEach((r) => {
          try { r.track?.stop(); } catch {}
        });
        peer.close();
      }
    } catch {}
    peerRef.current = null;

    const videoElement = videoRef.current;
    if (videoElement && videoElement.srcObject) {
      const stream = videoElement.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoElement.srcObject = null;
    }
  }, []);
  const normalizeSessionDescriptionInit = (raw: any): RTCSessionDescriptionInit | null => {
    if (!raw) return null;
    // { offer: { type, sdp } }
    if (raw.offer && typeof raw.offer === 'object' && raw.offer.sdp && raw.offer.type) {
      return { type: raw.offer.type, sdp: raw.offer.sdp };
    }
    // { sdp: { type, sdp } }
    if (raw.sdp && typeof raw.sdp === 'object' && raw.sdp.sdp && raw.sdp.type) {
      return { type: raw.sdp.type, sdp: raw.sdp.sdp };
    }
    // { sdp: 'v=0...', type: 'offer' }
    if (typeof raw.sdp === 'string') {
      return { type: raw.type || 'offer', sdp: raw.sdp };
    }
    // { type, sdp }
    if (raw.type && raw.sdp) {
      return { type: raw.type, sdp: raw.sdp };
    }
    return null;
  };
 // 2) handleOffer 교체
  const handleOffer = useCallback(async (payload: any) => {
    const offer = normalizeSessionDescriptionInit(payload);
    if (!offer) {
      console.error('수신한 offer 데이터 형식이 올바르지 않습니다:', payload);
      setStreamError('수신한 offer 형식이 올바르지 않습니다.');
      return;
    }
    if (!peerRef.current) {
      peerRef.current = new RTCPeerConnection({ iceServers });
      const peer = peerRef.current;
      peer.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteStream) attachMediaStream(remoteStream);
      };
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          websocketService.send('webrtc_ice_candidate', {
            roomId: roomIdRef.current,
            candidate: event.candidate,
          });
        }
      };
    }
    const peer = peerRef.current!;
    try {
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      // answer도 퍼블리셔가 유연하게 처리할 수 있게 { sdp: 객체 } 형태 유지
      websocketService.send('webrtc_answer', {
        roomId: roomIdRef.current,
        sdp: answer.sdp,
        type: answer.type,
      });
    } catch (error) {
      console.error('WebRTC offer 처리 실패', error);
      setStreamError('스트림 연결 중 오류가 발생했습니다.');
    }
  }, [attachMediaStream]);

  const handleRemoteIce = useCallback(async (payload: any) => {
    const candidate: RTCIceCandidateInit = payload?.candidate;
    if (!candidate) return;
    try {
      if (peerRef.current) {
        await peerRef.current.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error('ICE 후보 추가 실패', error);
    }
  }, []);

  const startStreaming = useCallback(() => {
    if (!isConnected) {
      setStreamError('서버와의 연결이 필요합니다.');
      return;
    }
    setStreamError(null);
    setIsStreaming(true);
    if (!joinedRef.current) {
      websocketService.send('webrtc_join', { roomId: roomIdRef.current, role: 'viewer' });
      joinedRef.current = true;
    }
  }, [isConnected]);

  const stopStreaming = useCallback(() => {
    setIsStreaming(false);
    setIsPlaying(false);
    cleanupPeer();
    if (joinedRef.current) {
      websocketService.send('webrtc_leave', { roomId: roomIdRef.current });
      joinedRef.current = false;
    }
  }, [cleanupPeer]);

  const togglePlayPause = useCallback(() => {
    const next = !isPlaying;
    setIsPlaying(next);
    const video = videoRef.current;
    if (video) {
      if (next) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  }, [isPlaying]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // WebSocket 시그널링 구독/해제
  useEffect(() => {
    if (!isStreaming) return;
    const onOffer = (data: any) => {
      if (data?.roomId !== roomIdRef.current) return;
      handleOffer(data);
    };
    const onIce = (data: any) => {
      if (data?.roomId !== roomIdRef.current) return;
      handleRemoteIce(data);
    };

    websocketService.on('webrtc_offer', onOffer);
    websocketService.on('webrtc_ice_candidate', onIce);

    return () => {
      websocketService.off('webrtc_offer', onOffer);
      websocketService.off('webrtc_ice_candidate', onIce);
    };
  }, [isStreaming, handleOffer, handleRemoteIce]);

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
          {/* 카메라 피드 영역 또는 시작 버튼 */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            {isStreaming ? (
              isConnected ? (
                <div className="relative w-full h-full">
                  <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline />
                  {streamError && (
                    <div className="absolute inset-0 bg-black/60 text-white flex items-center justify-center">
                      <div className="text-center px-4">
                        <p className="text-sm opacity-90">{streamError}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* 스트림 상태 오버레이 */}
                  <div className="absolute top-4 left-4">
                    <Badge variant="secondary" className="bg-black/50 text-white">
                      LIVE
                    </Badge>
                  </div>
                  
                  {/* 타임스탬프 */}
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
                  <p className="text-sm text-gray-300">
                    실시간 카메라 피드를 시작하려면 버튼을 눌러주세요
                  </p>
                </div>
                <Button
                  onClick={startStreaming}
                  disabled={!isConnected}
                  size="lg"
                  className="bg-primary hover:bg-primary/90"
                >
                  <Play className="h-5 w-5 mr-2" />
                  스트리밍 시작
                </Button>
              </div>
            )}
          </div>
          
          {/* 컨트롤 버튼들 */}
          {isStreaming && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={togglePlayPause}
                  disabled={!isConnected}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {isPlaying ? "일시정지" : "재생"}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={stopStreaming}
                  disabled={!isConnected}
                >
                  정지
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!isConnected || !isStreaming}
                >
                  <RotateCw className="h-4 w-4" />
                  새로고침
                </Button>
              </div>
            
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
                disabled={!isConnected || !isStreaming}
              >
                <Maximize2 className="h-4 w-4" />
                {isFullscreen ? "축소" : "전체화면"}
              </Button>
            </div>
          )}
          
          {/* 카메라 정보 */}
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