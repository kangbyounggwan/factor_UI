interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_AUTH_REDIRECT_URL?: string;
    readonly VITE_MQTT_URL?: string;
    readonly VITE_MQTT_USERNAME?: string;
    readonly VITE_MQTT_PASSWORD?: string;
    readonly VITE_MQTT_CLIENT_ID?: string;
    readonly VITE_WEBSOCKET_URL?: string;
    readonly VITE_AI_PYTHON_URL?: string;
    readonly VITE_RASP_SERVER?: string;
    readonly VITE_MEDIA_RTSP_BASE?: string;
    readonly VITE_MEDIA_WEBRTC_BASE?: string;
    readonly VITE_DEV_HOST?: string;
    readonly VITE_DEV_PORT?: string;
    readonly VITE_PRODUCTION?: string;
    readonly VITE_TOSS_CLIENT_KEY?: string;
    // ⚠ 시크릿 키는 VITE_ 접두사로 두지 않는다. VITE_ 변수는 빌드 시 JS 번들에
    // 그대로 포함되어 브라우저에서 확인 가능하다. 서버 전용 키는 접두사 없이
    // process.env 로만 사용하고, 서버 프록시(/api/ai/*)를 통해 호출한다.
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }