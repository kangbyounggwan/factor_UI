import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 루트 .env 사용
  const rootEnvDir = path.resolve(import.meta.dirname, "../../");
  const env = loadEnv(mode, rootEnvDir, "");

  return {
    envDir: rootEnvDir,
    envPrefix: ["VITE_"],
    server: {
      host: env.VITE_DEV_HOST || "::",
      port: parseInt(env.VITE_DEV_PORT) || 8080,
      fs: {
        // 루트(monorepo) 경로까지 파일 서빙 허용 (/@fs 사용)
        allow: [
          path.resolve(import.meta.dirname, "."),
          path.resolve(import.meta.dirname, "../../"),
        ],
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      mode === 'development' &&
      componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
        "@shared": path.resolve(import.meta.dirname, "../shared/src"),
      },
    },
    preview: {
      port: 4173,
      strictPort: true,
      // Enable SPA fallback for client-side routing
      proxy: {},
    },
    build: {
      // Target modern browsers to avoid unnecessary polyfills (saves ~26KB)
      target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
      sourcemap: true,
      cssCodeSplit: true,
      cssMinify: true,
      rollupOptions: {
        external: [
          '@capacitor/preferences',
        ],
        output: {
          // vite 8(rolldown)은 manualChunks의 object 형태를 지원하지 않아 function 형태로 변환
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            const pkg = (name) =>
              id.includes(`/node_modules/${name}/`) || id.includes(`\\node_modules\\${name}\\`);
            // Three.js and 3D rendering libraries in separate chunk
            if (pkg('three') || pkg('three-stdlib') || pkg('@react-three/fiber') || pkg('@react-three/drei')) {
              return 'three-bundle';
            }
            // MQTT - 프린터 연결 시에만 필요
            if (pkg('mqtt')) return 'mqtt-bundle';
            // Vendor chunk for React
            if (pkg('react') || pkg('react-dom') || pkg('react-router-dom')) return 'vendor';
            // UI components - 필수 컴포넌트만
            if (
              pkg('@radix-ui/react-dialog') ||
              pkg('@radix-ui/react-dropdown-menu') ||
              pkg('@radix-ui/react-toast') ||
              pkg('@radix-ui/react-tabs') ||
              pkg('@radix-ui/react-select')
            ) {
              return 'ui';
            }
            // Supabase
            if (pkg('@supabase/supabase-js')) return 'supabase';
            // i18n
            if (pkg('i18next') || pkg('react-i18next')) return 'i18n';
          },
        },
      },
    },
  };
});