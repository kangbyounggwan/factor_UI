import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@shared/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, CheckCircle, AlertCircle, Save, Camera, Video, Play, X, Square, Globe, Cpu } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  getManufacturers,
  getSeriesByManufacturer,
  getModelsByManufacturerAndSeries,
  getManufacturingPrinterById,
  type ManufacturerOption,
  type SeriesOption,
  type ModelOption
} from "@shared/api/manufacturingPrinter";
import { publishCameraStart, publishCameraStop, subscribeCameraState } from "@shared/services/mqttService";

interface PrinterSettingsTabProps {
  printerId: string;
  printerName: string;
  currentManufactureId?: string | null;
  deviceUuid?: string | null;
  onSuccess?: () => void;
  mode?: 'equipment' | 'camera';
}

export function PrinterSettingsTab({
  printerId,
  printerName,
  currentManufactureId,
  deviceUuid,
  onSuccess,
  mode = 'equipment',
}: PrinterSettingsTabProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 카메라 설정 상태
  const [cameraType, setCameraType] = useState<'octoprint' | 'external'>('octoprint'); // 카메라 유형
  const [initialCameraType, setInitialCameraType] = useState<'octoprint' | 'external'>('octoprint');
  const [cameraUrl, setCameraUrl] = useState("");
  const [initialCameraUrl, setInitialCameraUrl] = useState("");
  const [savingCamera, setSavingCamera] = useState(false);
  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const [cameraTestLoading, setCameraTestLoading] = useState(false);
  const [cameraTestError, setCameraTestError] = useState<string | null>(null);
  const [webrtcUrl, setWebrtcUrl] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'offline' | 'starting' | 'online' | 'error'>('offline');
  const [cameraTestPassed, setCameraTestPassed] = useState<boolean | null>(null); // null: 테스트 안함, true: 통과, false: 실패
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const cameraTimeoutRef = useRef<number | null>(null);
  const streamPollingRef = useRef<number | null>(null);

  // 데이터
  const [manufacturers, setManufacturers] = useState<ManufacturerOption[]>([]);
  const [seriesList, setSeriesList] = useState<SeriesOption[]>([]);
  const [modelsList, setModelsList] = useState<ModelOption[]>([]);

  // 선택된 값
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("");
  const [selectedSeries, setSelectedSeries] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");

  // 셀렉트박스 열림 상태 추적
  const [manufacturerOpen, setManufacturerOpen] = useState(false);
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  // 초기값 저장 (변경 감지용)
  const [initialValues, setInitialValues] = useState({
    manufacturer: "",
    series: "",
    model: ""
  });

  // 선택된 모델의 cura_engine_support 상태
  const selectedModelData = modelsList.find((m) => m.id === selectedModel);
  const hasCuraSupport = selectedModelData?.cura_engine_support !== false;

  // 선택 완료 여부
  const isAllSelected = selectedManufacturer && selectedSeries && selectedModel;
  const isNoneSelected = !selectedManufacturer && !selectedSeries && !selectedModel;

  // 변경사항 있는지 확인
  const hasChanges = selectedManufacturer !== initialValues.manufacturer ||
    selectedSeries !== initialValues.series ||
    selectedModel !== initialValues.model;

  // 카메라 변경사항 확인 (URL 또는 타입 변경)
  const hasCameraChanges = cameraUrl !== initialCameraUrl || cameraType !== initialCameraType;

  // 카메라 저장 가능 여부
  // - OctoPrint 플러그인: URL이 있으면 테스트 통과 필수
  // - 외부 카메라: URL이 있으면 이미지 로드 성공 필수
  const canSaveCamera = hasCameraChanges && (
    cameraUrl.trim() === "" ||  // URL이 비어있으면 저장 가능
    cameraTestPassed === true    // 모든 타입에서 테스트 통과 필요
  );

  // 테두리 색상 결정
  const getBorderColor = () => {
    if (isAllSelected && !hasCuraSupport) {
      return "border-yellow-500/30";
    }
    if (isAllSelected) {
      return "border-green-500/30";
    }
    if (isNoneSelected) {
      return "border-red-500/30";
    }
    return "border-border";
  };

  // 현재 프린터의 설정 로드
  useEffect(() => {
    const loadCurrentSettings = async () => {
      if (!currentManufactureId) {
        // 제조사 목록만 로드
        try {
          const data = await getManufacturers();
          setManufacturers(data);
        } catch (error) {
          console.error("Failed to load manufacturers:", error);
        }
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // 현재 설정된 프린터 모델 정보 로드
        const printerData = await getManufacturingPrinterById(currentManufactureId);

        if (printerData) {
          // 제조사 목록 로드
          const manufacturersData = await getManufacturers();
          setManufacturers(manufacturersData);
          setSelectedManufacturer(printerData.manufacturer);

          // 시리즈 목록 로드
          const seriesData = await getSeriesByManufacturer(printerData.manufacturer);
          setSeriesList(seriesData);
          setSelectedSeries(printerData.series);

          // 모델 목록 로드
          const modelsData = await getModelsByManufacturerAndSeries(
            printerData.manufacturer,
            printerData.series
          );
          setModelsList(modelsData);
          setSelectedModel(currentManufactureId);

          // 초기값 저장
          setInitialValues({
            manufacturer: printerData.manufacturer,
            series: printerData.series,
            model: currentManufactureId
          });
        } else {
          // 제조사 목록만 로드
          const data = await getManufacturers();
          setManufacturers(data);
        }
      } catch (error) {
        console.error("Failed to load current settings:", error);
        toast({
          title: t("common.error"),
          description: t("printer.setup.loadError"),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadCurrentSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentManufactureId]);

  // 카메라 URL 및 타입 로드
  useEffect(() => {
    const loadCameraSettings = async () => {
      if (!deviceUuid) {
        setCameraUrl("");
        setInitialCameraUrl("");
        setCameraType('octoprint');
        setInitialCameraType('octoprint');
        return;
      }

      try {
        console.log('[CAM][Settings] Loading camera settings for device:', deviceUuid);
        const { data, error } = await supabase
          .from("cameras")
          .select("stream_url, camera_type")
          .eq("device_uuid", deviceUuid)
          .maybeSingle();

        if (error) {
          console.error("[CAM][Settings] Failed to load camera settings:", error);
          return;
        }

        const camData = data as { stream_url?: string; camera_type?: string } | null;
        const url = camData?.stream_url || "";
        const type = (camData?.camera_type === 'external' ? 'external' : 'octoprint') as 'octoprint' | 'external';

        console.log('[CAM][Settings] Loaded from DB:', { hasUrl: !!url, type, rawCameraType: camData?.camera_type });

        setCameraUrl(url);
        setInitialCameraUrl(url);
        setCameraType(type);
        setInitialCameraType(type);
      } catch (error) {
        console.error("[CAM][Settings] Failed to load camera settings:", error);
      }
    };

    loadCameraSettings();
  }, [deviceUuid]);

  // 카메라 URL 또는 타입 변경 시 테스트 상태 초기화
  useEffect(() => {
    // 외부 카메라는 이미지 로드 테스트 필요 (URL 변경 시 리셋)
    if (cameraType === 'external') {
      // URL이 비어있으면 테스트 상태 리셋
      if (!cameraUrl.trim()) {
        setCameraTestPassed(null);
      }
      // URL이 있으면 이미지 로드 테스트 필요 (onLoad/onError에서 처리)
      return;
    }

    // OctoPrint 플러그인: URL 변경 시 테스트 상태 초기화
    if (cameraUrl !== initialCameraUrl || cameraType !== initialCameraType) {
      if (cameraUrl.trim() === "") {
        setCameraTestPassed(true); // 빈 URL은 저장 가능
      } else {
        setCameraTestPassed(null); // 새 URL 입력 시 테스트 필요
      }
    } else {
      // 원래 설정으로 복원 시 테스트 상태도 복원 (이미 저장된 설정이므로 통과)
      setCameraTestPassed(true);
    }
  }, [cameraUrl, initialCameraUrl, cameraType, initialCameraType]);

  // 제조사 선택 시 시리즈 로드
  useEffect(() => {
    if (!selectedManufacturer || loading) return;

    // 초기 로드 시에는 이미 시리즈가 로드되어 있으므로 스킵
    if (selectedManufacturer === initialValues.manufacturer && seriesList.length > 0) {
      return;
    }

    const loadSeries = async () => {
      try {
        const data = await getSeriesByManufacturer(selectedManufacturer);
        setSeriesList(data);
        setSelectedSeries("");
        setModelsList([]);
        setSelectedModel("");
      } catch (error) {
        console.error("Failed to load series:", error);
        toast({
          title: t("common.error"),
          description: t("printer.setup.loadError"),
          variant: "destructive",
        });
      }
    };

    loadSeries();
  }, [selectedManufacturer, loading, initialValues.manufacturer, t, toast]);

  // 시리즈 선택 시 모델 로드
  useEffect(() => {
    if (!selectedManufacturer || !selectedSeries || loading) return;

    // 초기 로드 시에는 이미 모델이 로드되어 있으므로 스킵
    if (
      selectedManufacturer === initialValues.manufacturer &&
      selectedSeries === initialValues.series &&
      modelsList.length > 0
    ) {
      return;
    }

    const loadModels = async () => {
      try {
        const data = await getModelsByManufacturerAndSeries(
          selectedManufacturer,
          selectedSeries
        );
        setModelsList(data);
        setSelectedModel("");
      } catch (error) {
        console.error("Failed to load models:", error);
        toast({
          title: t("common.error"),
          description: t("printer.setup.loadError"),
          variant: "destructive",
        });
      }
    };

    loadModels();
  }, [selectedManufacturer, selectedSeries, loading, initialValues, t, toast]);

  // 저장 핸들러
  const handleSave = async () => {
    if (!selectedModel) {
      toast({
        title: t("common.error"),
        description: t("printer.setup.selectAllFields"),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const modelData = modelsList.find((m) => m.id === selectedModel);

      if (!modelData) {
        throw new Error("Selected model not found");
      }

      const { error } = await supabase
        .from("printers")
        .update({
          model: modelData.display_name,
          manufacture_id: selectedModel,
          updated_at: new Date().toISOString(),
        })
        .eq("id", printerId);

      if (error) throw error;

      // 초기값 업데이트
      setInitialValues({
        manufacturer: selectedManufacturer,
        series: selectedSeries,
        model: selectedModel
      });

      toast({
        title: t("common.success"),
        description: t("printer.setup.saveSuccess"),
      });

      onSuccess?.();
    } catch (error) {
      console.error("Failed to save printer setup:", error);
      toast({
        title: t("common.error"),
        description: t("printer.setup.saveError"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // 취소 (초기값으로 복원)
  const handleCancel = async () => {
    if (!initialValues.manufacturer) {
      setSelectedManufacturer("");
      setSelectedSeries("");
      setSelectedModel("");
      setSeriesList([]);
      setModelsList([]);
      return;
    }

    setSelectedManufacturer(initialValues.manufacturer);

    // 시리즈 목록 다시 로드
    try {
      const seriesData = await getSeriesByManufacturer(initialValues.manufacturer);
      setSeriesList(seriesData);
      setSelectedSeries(initialValues.series);

      // 모델 목록 다시 로드
      const modelsData = await getModelsByManufacturerAndSeries(
        initialValues.manufacturer,
        initialValues.series
      );
      setModelsList(modelsData);
      setSelectedModel(initialValues.model);
    } catch (error) {
      console.error("Failed to restore settings:", error);
    }
  };

  // 카메라 설정 저장 (URL + 타입)
  const handleSaveCameraUrl = async () => {
    if (!deviceUuid) {
      toast({
        title: t("common.error"),
        description: t("camera.deviceNotConnected", "장치가 연결되지 않았습니다"),
        variant: "destructive",
      });
      return;
    }

    setSavingCamera(true);
    try {
      const { error } = await supabase
        .from("cameras")
        .update({
          stream_url: cameraUrl.trim(),
          camera_type: cameraType
        })
        .eq("device_uuid", deviceUuid);

      if (error) {
        console.error("Failed to save camera settings:", error);
        toast({
          title: t("common.error"),
          description: t("camera.urlSaveFailed", "카메라 설정 저장에 실패했습니다"),
          variant: "destructive",
        });
        return;
      }

      setInitialCameraUrl(cameraUrl);
      setInitialCameraType(cameraType);
      toast({
        title: t("common.success"),
        description: t("camera.settingsSaved", "카메라 설정이 저장되었습니다"),
      });
    } catch (error) {
      console.error("Failed to save camera settings:", error);
      toast({
        title: t("common.error"),
        description: t("camera.urlSaveFailed", "카메라 설정 저장에 실패했습니다"),
        variant: "destructive",
      });
    } finally {
      setSavingCamera(false);
    }
  };

  // 카메라 설정 취소 (URL + 타입)
  const handleCancelCameraUrl = () => {
    setCameraUrl(initialCameraUrl);
    setCameraType(initialCameraType);
  };

  // 카메라 비디오 클린업
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

  // MQTT 상태 구독 - 카메라 모드일 때 항상 구독 유지 (테스트 시작 전에 구독되어 있어야 함)
  useEffect(() => {
    // 카메라 모드가 아니거나 deviceUuid가 없으면 구독하지 않음
    if (!deviceUuid || mode !== 'camera') return;

    let unsub: (() => Promise<void>) | null = null;

    console.log('[CAM] Subscribing to camera state for device:', deviceUuid, '(mode:', mode, ')');

    (async () => {
      try {
        unsub = await subscribeCameraState(deviceUuid, async ({ status, webrtcUrl: url }) => {
          console.log('[CAM] Received camera state:', { status, hasUrl: !!url, showCameraPreview });
          setCameraStatus(status);

          // 테스트 중이 아니면 상태만 업데이트하고 종료
          // (showCameraPreview가 false면 테스트 UI가 표시되지 않으므로 상태 업데이트도 불필요)

          if (status === 'online' && url) {
            // MQTT에서 성공 응답 받음 - 폴링/타임아웃 클리어 후 성공 처리
            console.log('[CAM][MQTT] ✅ Received online status with URL');

            // 폴링/타임아웃 클리어
            if (streamPollingRef.current) {
              clearInterval(streamPollingRef.current);
              streamPollingRef.current = null;
            }
            if (cameraTimeoutRef.current) {
              clearTimeout(cameraTimeoutRef.current);
              cameraTimeoutRef.current = null;
            }

            // MQTT에서 URL을 받았으면 신뢰하고 성공 처리
            // (MediaMTX 폴링이 이미 병행 중이므로, MQTT 응답이 먼저 오면 바로 성공 처리)
            setWebrtcUrl(url);
            setCameraTestLoading(false);
            setCameraTestError(null);
            setCameraTestPassed(true);
            console.log('[CAM] Camera connected successfully via MQTT');
          }

          if (status === 'error') {
            // 에러 발생 - MediaMTX 폴링 및 타임아웃 클리어
            if (streamPollingRef.current) {
              clearInterval(streamPollingRef.current);
              streamPollingRef.current = null;
              console.log('[CAM][MQTT] Cleared MediaMTX polling - MQTT reported error');
            }
            if (cameraTimeoutRef.current) {
              clearTimeout(cameraTimeoutRef.current);
              cameraTimeoutRef.current = null;
            }
            setCameraTestError(t("camera.testFailed", "카메라 연결에 실패했습니다."));
            setCameraTestLoading(false);
            setCameraTestPassed(false); // 테스트 실패
            console.error('[CAM] Camera connection failed');
          }
        });
        console.log('[CAM] Successfully subscribed to camera state');
      } catch (e) {
        console.warn('[CAM][MQTT] subscribe failed', e);
      }
    })();

    return () => {
      if (unsub) {
        console.log('[CAM] Unsubscribing from camera state');
        unsub();
      }
    };
  }, [deviceUuid, mode, t]);

  // 타임아웃 클리어
  const clearCameraTimeout = useCallback(() => {
    if (cameraTimeoutRef.current) {
      clearTimeout(cameraTimeoutRef.current);
      cameraTimeoutRef.current = null;
    }
  }, []);

  // 스트림 폴링 클리어
  const clearStreamPolling = useCallback(() => {
    if (streamPollingRef.current) {
      clearInterval(streamPollingRef.current);
      streamPollingRef.current = null;
    }
  }, []);

  // MediaMTX API 직접 호출로 스트림 상태 체크
  const checkStreamStatus = useCallback(async (): Promise<{ streaming: boolean; webrtc_url?: string; error?: string } | null> => {
    if (!deviceUuid) return null;

    try {
      // 스트림 이름: cam-{deviceUuid}
      const streamName = `cam-${deviceUuid}`;

      // VITE_MEDIA_WEBRTC_BASE에서 도메인 추출 (https://factor.io.kr/webrtc -> https://factor.io.kr)
      const webrtcBase = import.meta.env?.VITE_MEDIA_WEBRTC_BASE || 'https://factor.io.kr/webrtc';
      const url = new URL(webrtcBase);
      const apiBase = `${url.protocol}//${url.host}`;

      // MediaMTX API v3 (nginx 프록시): /api/mediamtx/v3/paths/get/{name}
      const apiUrl = `${apiBase}/api/mediamtx/v3/paths/get/${encodeURIComponent(streamName)}`;

      console.log('[CAM][MediaMTX] Checking stream status:', {
        streamName: streamName.substring(0, 8) + '***',
        apiBase,
        webrtcBase: webrtcBase.replace(/\/[^/]+$/, '/***')
      });

      const response = await fetch(apiUrl);

      // 404는 스트림이 존재하지 않음 - 에러로 처리
      if (response.status === 404) {
        console.log('[CAM][MediaMTX] Stream not found (404)');
        return { streaming: false, error: '404 Not Found' };
      }

      if (!response.ok) {
        console.warn('[CAM][MediaMTX] API request failed:', {
          status: response.status,
          statusText: response.statusText
        });
        // 404 외의 에러는 실제 에러로 처리
        return { streaming: false, error: `${response.status} ${response.statusText}` };
      }

      const pathInfo = await response.json();

      // MediaMTX v3 응답 구조:
      // { name, source, sourceReady, tracks, bytesReceived, bytesSent, readers, ... }
      const isStreaming = pathInfo.sourceReady === true && pathInfo.source !== null;
      const readersCount = pathInfo.readers?.length || 0;

      // 상세 로그 출력 (민감한 정보 마스킹)
      console.log('[CAM][MediaMTX] API Response:', {
        name: pathInfo.name ? pathInfo.name.substring(0, 8) + '***' : null,
        hasSource: !!pathInfo.source,
        sourceReady: pathInfo.sourceReady,
        tracks: pathInfo.tracks?.length || 0,
        readers: readersCount,
        isStreaming
      });

      if (isStreaming) {
        // WebRTC URL 생성
        const webrtcUrl = `${webrtcBase}/${streamName}`;
        return { streaming: true, webrtc_url: webrtcUrl };
      }

      return { streaming: false };
    } catch (error) {
      console.error('[CAM][MediaMTX] API check error:', error);
      return { streaming: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, [deviceUuid]);

  // 스트림 상태 폴링 시작 (2초마다)
  const startStreamPolling = useCallback(() => {
    clearStreamPolling();

    const pollInterval = 2000; // 2초
    let pollCount = 0;
    const maxPolls = 15; // 최대 30초 (15 * 2초)
    let consecutiveErrors = 0; // 연속 에러 카운트

    console.log('[CAM][MediaMTX] Starting stream polling...', {
      deviceUuid,
      pollInterval: `${pollInterval}ms`,
      maxPolls,
      maxDuration: `${(pollInterval * maxPolls) / 1000}s`
    });

    streamPollingRef.current = window.setInterval(async () => {
      pollCount++;
      console.log(`[CAM][MediaMTX] Polling stream status (${pollCount}/${maxPolls})...`);

      const status = await checkStreamStatus();

      // 에러 발생 시 (404 등)
      if (status?.error) {
        consecutiveErrors++;
        console.warn(`[CAM][MediaMTX] ⚠️ API error (${consecutiveErrors}/3):`, status.error);

        // 3번 연속 에러 발생 시 실패 처리
        if (consecutiveErrors >= 3) {
          console.error('[CAM][MediaMTX] ❌ Too many consecutive errors, marking as failed');
          clearStreamPolling();
          clearCameraTimeout();
          setCameraStatus('error');
          setCameraTestLoading(false);
          setCameraTestError(t("camera.streamNotFound", "스트림을 찾을 수 없습니다. 라즈베리파이 연결을 확인해주세요."));
          setCameraTestPassed(false);
          return;
        }
      } else {
        // 에러 없으면 연속 에러 카운트 리셋
        consecutiveErrors = 0;
      }

      if (status?.streaming && status?.webrtc_url) {
        // 스트림이 활성화됨 - 성공
        console.log('[CAM][MediaMTX] ✅ Stream is ACTIVE!');
        clearStreamPolling();
        clearCameraTimeout();
        setCameraStatus('online');
        setWebrtcUrl(status.webrtc_url);
        setCameraTestLoading(false);
        setCameraTestError(null);
        setCameraTestPassed(true); // 테스트 통과
        return;
      }

      // 스트림 상태 로그
      if (status && !status.error) {
        console.log('[CAM][MediaMTX] Stream not ready yet:', {
          streaming: status.streaming
        });
      }

      if (pollCount >= maxPolls) {
        // 최대 폴링 횟수 도달 - 타임아웃 실패
        console.warn('[CAM][MediaMTX] ⚠️ Max polling reached, stream not ready after 30s');
        clearStreamPolling();
        clearCameraTimeout();
        setCameraStatus('error');
        setCameraTestLoading(false);
        setCameraTestError(t("camera.connectionTimeout", "연결 시간이 초과되었습니다. 라즈베리파이가 연결되어 있는지 확인해주세요."));
        setCameraTestPassed(false);
      }
    }, pollInterval);
  }, [deviceUuid, checkStreamStatus, clearStreamPolling, clearCameraTimeout, t]);

  // 카메라 테스트 시작 (MQTT를 통한 WebRTC 스트리밍)
  const handleTestCamera = useCallback(async () => {
    console.log('[CAM][Settings] ========== CAMERA TEST START ==========');
    console.log('[CAM][Settings] Current state:', {
      cameraType,
      initialCameraType,
      cameraUrl,
      initialCameraUrl,
      deviceUuid,
      hasCameraChanges,
      cameraTestPassed
    });

    if (!cameraUrl.trim()) {
      toast({
        title: t("common.error"),
        description: t("camera.urlRequired", "카메라 URL을 입력해주세요"),
        variant: "destructive",
      });
      return;
    }

    if (!deviceUuid) {
      toast({
        title: t("common.error"),
        description: t("camera.deviceNotConnected", "장치가 연결되지 않았습니다"),
        variant: "destructive",
      });
      return;
    }

    // 이전 타임아웃/폴링 클리어
    clearCameraTimeout();
    clearStreamPolling();

    setCameraTestError(null);
    setCameraTestLoading(true);
    setShowCameraPreview(true);
    setCameraStatus('starting');
    setWebrtcUrl(null);

    // 30초 타임아웃 설정 (서버 폴링이 있으므로 더 여유있게)
    cameraTimeoutRef.current = window.setTimeout(() => {
      if (cameraStatus === 'starting') {
        clearStreamPolling();
        setCameraTestError(t("camera.connectionTimeout", "연결 시간이 초과되었습니다. 라즈베리파이가 연결되어 있는지 확인해주세요."));
        setCameraTestLoading(false);
        setCameraStatus('error');
        setCameraTestPassed(false); // 테스트 실패
      }
    }, 30000);

    try {
      // 환경변수(없으면 기본값 사용)
      const RTSP_BASE = import.meta.env?.VITE_MEDIA_RTSP_BASE || 'rtsp://factor.io.kr:8554';
      const WEBRTC_BASE = import.meta.env?.VITE_MEDIA_WEBRTC_BASE || 'https://factor.io.kr/webrtc';

      const mqttPayload = {
        deviceUuid: deviceUuid,
        streamUrl: cameraUrl.trim(),
        fps: 20,
        width: 1280,
        height: 720,
        bitrateKbps: 1800,
        encoder: 'libx264',
        forceMjpeg: true,
        lowLatency: true,
        rtspBase: RTSP_BASE,
        webrtcBase: WEBRTC_BASE
      };

      console.log('[CAM][MQTT] ========== CAMERA START COMMAND ==========');
      console.log('[CAM][MQTT] Stream URL length:', cameraUrl.trim().length);
      console.log('[CAM][MQTT] Expected stream name: cam-***');

      await publishCameraStart(mqttPayload);

      console.log('[CAM][MQTT] ✅ Camera start command sent successfully');
      console.log('[CAM][MQTT] Waiting for Raspberry Pi to process and start FFmpeg...');

      // 서버 API를 통한 스트림 상태 폴링 시작 (MQTT와 병행)
      startStreamPolling();
    } catch (e) {
      console.error('[CAM][MQTT] start error', e);
      clearCameraTimeout();
      clearStreamPolling();
      setCameraTestError(t("camera.testFailed", "카메라 시작에 실패했습니다."));
      setCameraTestLoading(false);
      setCameraStatus('error');
      setCameraTestPassed(false); // 테스트 실패
    }
  }, [cameraUrl, deviceUuid, toast, t, cameraStatus, clearCameraTimeout, clearStreamPolling, startStreamPolling]);

  // 카메라 테스트 중지
  const handleStopCamera = useCallback(async () => {
    if (!deviceUuid) return;

    clearCameraTimeout();
    clearStreamPolling();
    cleanupVideo();
    setCameraStatus('offline');

    try {
      await publishCameraStop(deviceUuid);
    } catch (e) {
      console.warn('[CAM][MQTT] stop error', e);
    }
  }, [deviceUuid, cleanupVideo, clearCameraTimeout, clearStreamPolling]);

  // 카메라 미리보기 닫기
  const handleCloseCameraPreview = useCallback(async () => {
    await handleStopCamera();
    setShowCameraPreview(false);
    setCameraTestLoading(false);
    setCameraTestError(null);
  }, [handleStopCamera]);

  // 외부 카메라 타임아웃 ref
  const externalCameraTimeoutRef = useRef<number | null>(null);

  // 외부 카메라 테스트 함수 (미리보기 표시 - 실제 img 태그에서 로드 결과 감지)
  const handleTestExternalCamera = useCallback(() => {
    if (!cameraUrl.trim()) {
      toast({
        title: t("common.error"),
        description: t("camera.urlRequired", "카메라 URL을 입력해주세요"),
        variant: "destructive",
      });
      return;
    }

    // 이전 타임아웃 클리어
    if (externalCameraTimeoutRef.current) {
      clearTimeout(externalCameraTimeoutRef.current);
    }

    console.log('[CAM][External] Starting external camera test...');
    setCameraTestLoading(true);
    setCameraTestError(null);
    setCameraTestPassed(null);
    setShowCameraPreview(true);

    // 10초 타임아웃 설정
    externalCameraTimeoutRef.current = window.setTimeout(() => {
      console.log('[CAM][External] ⏱️ Test timeout (10s)');
      setCameraTestLoading(false);
      setCameraTestError(t("camera.connectionTimeout", "연결 시간이 초과되었습니다. URL이 올바른지 확인해주세요."));
      setCameraTestPassed(false);
    }, 10000);
  }, [cameraUrl, toast, t]);

  // 외부 카메라 이미지 로드 성공 핸들러
  const handleExternalImageLoad = useCallback(() => {
    // 타임아웃 클리어
    if (externalCameraTimeoutRef.current) {
      clearTimeout(externalCameraTimeoutRef.current);
      externalCameraTimeoutRef.current = null;
    }
    console.log('[CAM][External] ✅ Image/stream loaded successfully');
    setCameraTestLoading(false);
    setCameraTestError(null);
    setCameraTestPassed(true);
  }, []);

  // 외부 카메라 이미지 로드 실패 핸들러
  const handleExternalImageError = useCallback(() => {
    // 타임아웃 클리어
    if (externalCameraTimeoutRef.current) {
      clearTimeout(externalCameraTimeoutRef.current);
      externalCameraTimeoutRef.current = null;
    }
    console.log('[CAM][External] ❌ Image/stream load failed');
    setCameraTestLoading(false);
    setCameraTestError(t("camera.previewFailed", "미리보기를 불러올 수 없습니다. URL이 올바른지 확인하세요."));
    setCameraTestPassed(false);
  }, [t]);

  if (loading && mode === 'equipment') {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-180px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 카메라 설정 모드
  if (mode === 'camera') {
    // 테스트 필요 여부 (OctoPrint: 수동 테스트, 외부: 이미지 로드 테스트)
    const needsOctoprintTest = cameraType === 'octoprint' && hasCameraChanges && cameraUrl.trim() && cameraTestPassed !== true;
    const needsExternalTest = cameraType === 'external' && hasCameraChanges && cameraUrl.trim() && cameraTestPassed !== true;

    // 카메라 테두리 색상 결정
    const getCameraBorderColor = () => {
      if (!cameraUrl.trim()) return "border-border";
      if (cameraTestPassed === true) return "border-green-500/30";
      if (cameraTestPassed === false) return "border-red-500/30";
      if (hasCameraChanges) return "border-yellow-500/30";
      return "border-border";
    };

    return (
      <TooltipProvider>
        <div className="p-6 max-w-4xl mx-auto">
          <div className="space-y-6">
            {/* 헤더 */}
            <div>
              <h2 className="text-xl font-semibold">{t("printerDetail.settingsCamera", "카메라 설정")}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("camera.settingsDescription", "프린터에 연결된 카메라의 스트리밍 URL을 설정합니다")}
              </p>
            </div>

            {/* 프린터 이름 표시 */}
            <div className="space-y-2">
              <Label>{t("printer.setup.printerName")}</Label>
              <div className="px-3 py-2 bg-muted rounded-md">
                <p className="text-sm font-medium">{printerName}</p>
              </div>
            </div>

            {/* 카메라 유형 선택 */}
            <div className="space-y-3">
              <Label>{t("camera.type", "카메라 유형")}</Label>
              <RadioGroup
                value={cameraType}
                onValueChange={(value: 'octoprint' | 'external') => setCameraType(value)}
                className="grid grid-cols-2 gap-4"
                disabled={!deviceUuid}
              >
                {/* OctoPrint 플러그인 옵션 */}
                <label
                  htmlFor="camera-type-octoprint"
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
                    cameraType === 'octoprint'
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                    !deviceUuid && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <RadioGroupItem value="octoprint" id="camera-type-octoprint" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-primary" />
                      <span className="font-medium">{t("camera.typeOctoprint", "OctoPrint 플러그인")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("camera.typeOctoprintDesc", "라즈베리파이 + Factor 플러그인을 사용하는 경우. WebRTC로 스트리밍됩니다.")}
                    </p>
                  </div>
                </label>

                {/* 외부 카메라 옵션 */}
                <label
                  htmlFor="camera-type-external"
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
                    cameraType === 'external'
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                    !deviceUuid && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <RadioGroupItem value="external" id="camera-type-external" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" />
                      <span className="font-medium">{t("camera.typeExternal", "외부 카메라")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("camera.typeExternalDesc", "외부 접속 가능한 카메라 URL (MJPEG, HTTP 스트림 등)")}
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {/* 카메라 설정 카드 */}
            <div className={cn(
              "space-y-6 p-6 bg-muted/30 rounded-lg border-2 transition-colors min-h-[200px]",
              getCameraBorderColor()
            )}>
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                <h3 className="text-sm font-bold uppercase tracking-wide">
                  {cameraType === 'octoprint'
                    ? t("camera.octoprintSettings", "OctoPrint 플러그인 설정")
                    : t("camera.externalSettings", "외부 카메라 설정")}
                </h3>
                {cameraUrl.trim() && (
                  cameraType === 'external' ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : cameraTestPassed === true ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : cameraTestPassed === false ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertCircle className="h-5 w-5 text-red-500 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-red-500">
                          {t("camera.testFailed", "카메라 테스트에 실패했습니다")}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : hasCameraChanges ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="h-5 w-5 text-yellow-500 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-yellow-500">
                          {t("camera.testRequired", "저장하려면 테스트를 통과해야 합니다")}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )
                )}
                {!cameraUrl.trim() && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertTriangle className="h-5 w-5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-muted-foreground">
                        {t("camera.urlNotSet", "카메라 URL이 설정되지 않았습니다")}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="camera-url">
                    {t("camera.streamUrl", "스트림 URL")}
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Video className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="camera-url"
                        type="url"
                        value={cameraUrl}
                        onChange={(e) => setCameraUrl(e.target.value)}
                        placeholder={cameraType === 'octoprint'
                          ? t("camera.urlPlaceholderOctoprint", "http://192.168.0.100:8080/video (로컬 네트워크 URL)")
                          : t("camera.urlPlaceholderExternal", "https://camera.example.com/stream (외부 접속 URL)")}
                        className="pl-9"
                        disabled={!deviceUuid}
                      />
                    </div>
                    {/* 테스트 버튼 - 모든 카메라 타입에서 표시 */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={cameraType === 'octoprint' ? handleTestCamera : handleTestExternalCamera}
                      disabled={!cameraUrl.trim() || !deviceUuid || cameraTestLoading}
                    >
                      {cameraTestLoading ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 mr-1" />
                      )}
                      {t("camera.test", "테스트")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {cameraType === 'octoprint'
                      ? t("camera.urlDescriptionOctoprint", "라즈베리파이에서 접근 가능한 카메라 URL을 입력하세요 (로컬 네트워크)")
                      : t("camera.urlDescriptionExternal", "외부에서 접근 가능한 카메라 URL을 입력하세요 (공개 URL)")}
                  </p>
                </div>

                {/* OctoPrint 플러그인 - 카메라 미리보기 (WebRTC) */}
                {cameraType === 'octoprint' && showCameraPreview && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label>{t("camera.preview", "미리보기")}</Label>
                        {cameraStatus !== 'offline' && (
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            cameraStatus === 'online' ? "bg-green-500 text-white" :
                            cameraStatus === 'starting' ? "bg-yellow-500 text-white" :
                            cameraStatus === 'error' ? "bg-red-500 text-white" :
                            "bg-gray-500 text-white"
                          )}>
                            {cameraStatus === 'online' ? 'LIVE' :
                             cameraStatus === 'starting' ? t("camera.starting", "연결 중...") :
                             cameraStatus === 'error' ? t("camera.error", "오류") :
                             cameraStatus.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {cameraStatus === 'online' && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleStopCamera}
                          >
                            <Square className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleCloseCameraPreview}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden border-2 border-transparent transition-colors duration-300" style={{
                      borderColor: cameraTestLoading ? '#facc15' : cameraTestError ? '#ef4444' : webrtcUrl ? '#22c55e' : 'transparent'
                    }}>
                      {cameraTestError ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10 bg-black/80">
                          <AlertCircle className="h-8 w-8 mb-2 text-red-500" />
                          <p className="text-sm text-center px-4">{cameraTestError}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-4"
                            onClick={handleTestCamera}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            {t("camera.retry", "다시 시도")}
                          </Button>
                        </div>
                      ) : cameraTestLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                          <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-yellow-400 mx-auto mb-2" />
                            <p className="text-yellow-400 text-sm font-medium">{t("camera.connectingToRaspberry", "라즈베리파이에 연결 중...")}</p>
                            <p className="text-white/60 text-xs mt-1">{t("camera.testingConnection", "연결 테스트 진행 중")}</p>
                          </div>
                        </div>
                      ) : webrtcUrl ? (
                        <iframe
                          ref={iframeRef}
                          src={`${webrtcUrl}?autoplay=1&muted=1`}
                          className="absolute inset-0 w-full h-full"
                          allow="autoplay; fullscreen"
                          allowFullScreen
                          title="webrtc-player"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                          <Camera className="h-12 w-12 mb-2 opacity-50" />
                          <p className="text-sm opacity-75">{t("camera.waitingForStream", "스트림 대기 중...")}</p>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("camera.previewNote", "라즈베리파이를 통해 WebRTC로 스트리밍됩니다. 장치가 연결되어 있어야 합니다.")}
                    </p>
                  </div>
                )}

                {/* 외부 카메라 - 미리보기 (테스트 버튼 클릭 후 표시) */}
                {cameraType === 'external' && showCameraPreview && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label>{t("camera.preview", "미리보기")}</Label>
                        {cameraTestPassed === true && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500 text-white text-xs font-medium">
                            <CheckCircle className="h-3 w-3" />
                            {t("camera.loadSuccess", "로드 성공")}
                          </span>
                        )}
                        {cameraTestLoading && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500 text-white text-xs font-medium">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {t("camera.testing", "테스트 중")}
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowCameraPreview(false);
                          setCameraTestLoading(false);
                          setCameraTestError(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className={cn(
                      "relative aspect-video bg-black rounded-lg overflow-hidden border-2 transition-colors",
                      cameraTestLoading ? "border-yellow-500/50" :
                      cameraTestPassed === true ? "border-green-500/50" :
                      cameraTestPassed === false ? "border-red-500/50" : "border-transparent"
                    )}>
                      {/* 이미지/스트림 - 테스트 중이거나 성공일 때 표시 */}
                      {(cameraTestLoading || cameraTestPassed === true) && !cameraTestError && (
                        <img
                          src={cameraUrl}
                          alt="Camera preview"
                          className="absolute inset-0 w-full h-full object-contain"
                          onLoad={handleExternalImageLoad}
                          onError={handleExternalImageError}
                        />
                      )}

                      {/* 로딩 오버레이 */}
                      {cameraTestLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                          <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-yellow-400 mx-auto mb-2" />
                            <p className="text-yellow-400 text-sm font-medium">{t("camera.loadingImage", "이미지 로딩 중...")}</p>
                            <p className="text-white/60 text-xs mt-1">{t("camera.testingConnection", "연결 테스트 진행 중")}</p>
                          </div>
                        </div>
                      )}

                      {/* 에러 상태 */}
                      {cameraTestError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/90">
                          <AlertCircle className="h-8 w-8 mb-2 text-red-500" />
                          <p className="text-sm text-center px-4 mb-4">{cameraTestError}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleTestExternalCamera}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            {t("camera.retry", "다시 시도")}
                          </Button>
                        </div>
                      )}

                      {/* 대기 상태 */}
                      {!cameraTestLoading && cameraTestPassed === null && !cameraTestError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                          <Camera className="h-12 w-12 mb-2 opacity-50" />
                          <p className="text-sm opacity-75">{t("camera.waitingForTest", "테스트 대기 중...")}</p>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("camera.externalPreviewNote", "외부 카메라 URL을 직접 표시합니다. MJPEG 또는 정적 이미지 URL이 지원됩니다.")}
                    </p>
                  </div>
                )}

                {!deviceUuid && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <span>{t("camera.deviceNotConnected", "장치가 연결되지 않았습니다")}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 버튼 영역 - 카드 밖 */}
            {/* 테스트 필요 안내 메시지 (OctoPrint 및 외부 카메라 모두) */}
            {(needsOctoprintTest || needsExternalTest) && (
              <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{t("camera.testRequiredToSave", "저장하려면 카메라 테스트를 통과해야 합니다.")}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleCancelCameraUrl}
                disabled={savingCamera || !hasCameraChanges}
              >
                {t("common.cancel")}
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      onClick={handleSaveCameraUrl}
                      disabled={!deviceUuid || savingCamera || !canSaveCamera}
                    >
                      {savingCamera ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {t("common.save", "저장")}
                    </Button>
                  </span>
                </TooltipTrigger>
                {(needsOctoprintTest || needsExternalTest) && (
                  <TooltipContent>
                    <p>{t("camera.testRequiredToSave", "저장하려면 카메라 테스트를 통과해야 합니다.")}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // 설비 설정 모드 (기본)
  return (
    <TooltipProvider>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="space-y-6">
          {/* 헤더 */}
          <div>
            <h2 className="text-xl font-semibold">{t("printerDetail.settingsEquipment", "설비 설정")}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("printer.setup.description")}
            </p>
          </div>

          {/* 프린터 이름 표시 */}
          <div className="space-y-2">
            <Label>{t("printer.setup.printerName")}</Label>
            <div className="px-3 py-2 bg-muted rounded-md">
              <p className="text-sm font-medium">{printerName}</p>
            </div>
          </div>

          {/* MANUFACTURER 카드 */}
          <div className={`space-y-6 p-6 bg-muted/30 rounded-lg border-2 transition-colors ${getBorderColor()}`}>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wide">
                {t("settings.manufacturer")}
              </h3>
              {isAllSelected && !hasCuraSupport ? (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              ) : isAllSelected ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : isNoneSelected ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="h-5 w-5 text-red-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-red-500">
                      {t("printer.setup.setupRequired")}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>

            <div className="grid grid-cols-12 gap-6">
              {/* 제조사 선택 */}
              <div className="space-y-2 col-span-4">
                <Label htmlFor="manufacturer">
                  {t("settings.selectManufacturer")}
                </Label>
                <Select
                  value={selectedManufacturer}
                  open={manufacturerOpen}
                  onOpenChange={setManufacturerOpen}
                  onValueChange={(value) => {
                    setSelectedManufacturer(value);
                    setSelectedSeries("");
                    setSelectedModel("");
                  }}
                >
                  <SelectTrigger
                    id="manufacturer"
                    className={cn(
                      manufacturerOpen ? "ring-2 ring-primary ring-offset-2" : "",
                      "[&>span]:text-left [&>span]:block [&>span]:w-full"
                    )}
                  >
                    <SelectValue
                      placeholder={t("settings.selectManufacturerPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {manufacturers.map((m) => (
                      <SelectItem
                        key={m.manufacturer}
                        value={m.manufacturer}
                        className="pl-3 [&>span:first-child]:!hidden [&_svg.lucide-check]:!hidden"
                      >
                        {m.manufacturer}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 시리즈 선택 */}
              <div className="space-y-2 col-span-3">
                <Label htmlFor="series">{t("settings.selectSeries")}</Label>
                <Select
                  value={selectedSeries}
                  open={seriesOpen}
                  onOpenChange={setSeriesOpen}
                  onValueChange={(value) => {
                    setSelectedSeries(value);
                    setSelectedModel("");
                  }}
                  disabled={!selectedManufacturer}
                >
                  <SelectTrigger
                    id="series"
                    className={cn(
                      seriesOpen ? "ring-2 ring-primary ring-offset-2" : "",
                      "[&>span]:text-left [&>span]:block [&>span]:w-full"
                    )}
                  >
                    <SelectValue
                      placeholder={t("settings.selectSeriesPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {seriesList.map((s) => (
                      <SelectItem
                        key={s.series}
                        value={s.series}
                        className="pl-3 [&>span:first-child]:!hidden [&_svg.lucide-check]:!hidden"
                      >
                        {s.series}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 모델 선택 */}
              <div className="space-y-2 col-span-5">
                <Label htmlFor="model">{t("settings.selectModel")}</Label>
                <Select
                  value={selectedModel}
                  onValueChange={setSelectedModel}
                  open={modelOpen}
                  onOpenChange={setModelOpen}
                  disabled={!selectedSeries}
                >
                  <SelectTrigger
                    id="model"
                    className={cn(
                      "data-[state=open]:ring-2 data-[state=open]:ring-primary data-[state=open]:ring-offset-2"
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-3">
                      <SelectValue placeholder={t("settings.selectModelPlaceholder")} />
                    </div>
                  </SelectTrigger>

                  <SelectContent
                    side="bottom"
                    sideOffset={4}
                    className="w-[--radix-select-trigger-width] p-0"
                  >
                    {modelsList.map((model) => (
                      <SelectItem
                        key={model.id}
                        value={model.id}
                      >
                        <div className="flex w-full items-center justify-between gap-3">
                          <span className="truncate">{model.display_name}</span>
                          <span className="pointer-events-none">
                            {model.cura_engine_support !== false ? (
                              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                            )}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 범례 */}
          {selectedModel && (
            <div className="space-y-2 text-sm">
              {hasCuraSupport ? (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      {t("printer.setup.legend.fullSupport")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      {t("printer.setup.legend.slicingSupported")}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      {t("printer.setup.legend.fullSupport")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      {t("printer.setup.legend.limitedSlicing")}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 프린터 모델 버튼 영역 */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={saving || !hasChanges}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!selectedModel || saving || !hasChanges}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {t("common.save", "저장")}
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
