module.exports = {
  apps: [
    // UI - web (메인 UI 권장)
    {
      name: "factor-ui-web",
      cwd: "/var/www/factor_UI/packages/web",
      script: "../../node_modules/vite/bin/vite.js",
      args: "preview --host 127.0.0.1 --port 4173 --strictPort",
      env: { NODE_ENV: "production" },
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      restart_delay: 2000
    },

    // UI - host (관리/호스트용 UI가 따로 있을 때)
    {
      name: "factor-ui-host",
      cwd: "/var/www/factor_UI/packages/host",
      script: "../../node_modules/vite/bin/vite.js",
      args: "preview --host 127.0.0.1 --port 4174 --strictPort",
      env: { NODE_ENV: "production" },
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      restart_delay: 2000
    },

    // UI - mobile (선택)
    {
      name: "factor-ui-mobile",
      cwd: "/var/www/factor_UI/packages/mobile",
      script: "../../node_modules/vite/bin/vite.js",
      args: "preview --host 127.0.0.1 --port 4175 --strictPort",
      env: { NODE_ENV: "production" },
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      restart_delay: 2000
    },

    // API
    {
      name: "factor-api",
      cwd: "/var/www/factor_UI",
      script: "packages/shared/server.js",
      args: "--host 127.0.0.1 --port 5000 --ws --rest",
      env: { NODE_ENV: "production" },
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      restart_delay: 2000
    },

    // MediaMTX (도커 없이 바이너리)
    {
      name: "mediamtx",
      script: "/usr/local/bin/mediamtx",
      args: "/etc/mediamtx/mediamtx.yml",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      restart_delay: 2000,
      kill_timeout: 5000
    },

    // AI Server (Python FastAPI)
    {
      name: "factor-ai-server",
      cwd: "/var/www/factor_ai_server",
      script: "/var/www/factor_ai_server/.venv/bin/uvicorn",
      args: "main:app --host 127.0.0.1 --port 7000 --workers 2",
      interpreter: "none",  // Don't use Node.js interpreter
      env: {
        PYTHONUNBUFFERED: "1"
      },
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      restart_delay: 2000,
      max_memory_restart: "1G"
    }
  ]
}
