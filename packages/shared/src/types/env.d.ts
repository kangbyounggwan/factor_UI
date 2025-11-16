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
    readonly VITE_TOSS_SECRET_KEY?: string;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }