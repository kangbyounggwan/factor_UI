// packages/mobile/vite.config.ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ mode }) => {
  const rootEnvDir = path.resolve(import.meta.dirname, "../../");
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
      tailwindcss(),
      tsconfigPaths(),            // ✅ tsconfig paths 적용 (@shared/* 등)
      mode === "development" && componentTagger(),
      visualizer({
        filename: "dist/stats.html",
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
    ].filter(Boolean),

    resolve: {
      alias: {
        "@":        path.resolve(import.meta.dirname, "./src"),        // 모바일 전용 @
        "@mobile":  path.resolve(import.meta.dirname, "./src"),
        "@shared":  path.resolve(import.meta.dirname, "../shared/src"),
        // 필요하면 웹 코드도 참고
        "@web":     path.resolve(import.meta.dirname, "../web/src"),
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
          path.resolve(import.meta.dirname, "../"),               // packages/*
          path.resolve(import.meta.dirname, "../shared"),         // shared 접근 허용
          path.resolve(import.meta.dirname, "../web"),            // (필요 시) web 접근 허용
        ],
      },
    },

    build: {
      outDir: "dist",
      sourcemap: true,
      commonjsOptions: { transformMixedEsModules: true },
      rollupOptions: {
        external: [
          // iOS 전용 플러그인 - 빌드 시 번들링 제외
          '@capacitor-community/apple-sign-in',
        ],
        output: {
          // vite 8(rolldown)은 manualChunks의 object 형태를 지원하지 않아 function 형태로 변환
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            const pkg = (name) =>
              id.includes(`/node_modules/${name}/`) || id.includes(`\\node_modules\\${name}\\`);
            // Three.js and 3D rendering libraries in separate chunk
            if (pkg('three') || pkg('@react-three/fiber') || pkg('@react-three/drei')) {
              return 'three-bundle';
            }
            // Vendor chunk for React
            if (pkg('react') || pkg('react-dom') || pkg('react-router-dom')) return 'vendor';
            // UI components
            if (
              pkg('@radix-ui/react-dialog') ||
              pkg('@radix-ui/react-dropdown-menu') ||
              pkg('@radix-ui/react-toast') ||
              pkg('@radix-ui/react-tabs')
            ) {
              return 'ui';
            }
          },
        },
      },
    },
  };
});
