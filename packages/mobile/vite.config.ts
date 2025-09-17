// packages/mobile/vite.config.ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const rootEnvDir = path.resolve(__dirname, "../../");
  const env = loadEnv(mode, rootEnvDir, "");

  // 개발 편의용 기본값
  const devHost = env.VITE_DEV_HOST || "0.0.0.0"; // 모바일/에뮬 접속 위해 0.0.0.0 권장
  const devPort = Number(env.VITE_DEV_PORT || 5175);
  const hmrHost = env.VITE_DEV_PUBLIC_HOST || env.VITE_DEV_HOST || "localhost";
  const hmrPort = Number(env.VITE_DEV_HMR_PORT || devPort);

  return {
    envDir: rootEnvDir,
    envPrefix: ["VITE_"],

    plugins: [
      react(),
      tsconfigPaths(),            // ✅ tsconfig paths 적용 (@shared/* 등)
      mode === "development" && componentTagger(),
    ].filter(Boolean),

    resolve: {
      alias: {
        "@":        path.resolve(__dirname, "./src"),        // 모바일 전용 @
        "@mobile":  path.resolve(__dirname, "./src"),
        "@shared":  path.resolve(__dirname, "../shared/src"),
        // 필요하면 웹 코드도 참고
        "@web":     path.resolve(__dirname, "../web/src"),
      },
      preserveSymlinks: true,
      dedupe: ["react", "react-dom"],
    },

    server: {
      host: devHost,
      port: devPort,
      strictPort: true,
      hmr: {
        host: hmrHost,           // 에뮬/실기기에서 접속할 PC IP 넣기 (예: 192.168.0.10)
        port: hmrPort,
      },
      fs: {
        allow: [
          rootEnvDir,                                   // 모노레포 루트
          path.resolve(__dirname, "../"),               // packages/*
          path.resolve(__dirname, "../shared"),         // shared 접근 허용
          path.resolve(__dirname, "../web"),            // (필요 시) web 접근 허용
        ],
      },
    },

    build: {
      outDir: "dist",
      sourcemap: true,
      commonjsOptions: { transformMixedEsModules: true },
    },
  };
});
