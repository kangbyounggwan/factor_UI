import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 루트 .env 사용
  const rootEnvDir = path.resolve(__dirname, "../../");
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
          path.resolve(__dirname, "."),
          path.resolve(__dirname, "../../"),
        ],
      },
    },
    plugins: [
      react(),
      mode === 'development' &&
      componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@shared": path.resolve(__dirname, "../shared/src"),
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
          manualChunks: {
            // Three.js and 3D rendering libraries in separate chunk
            'three-bundle': [
              'three',
              'three-stdlib',
              '@react-three/fiber',
              '@react-three/drei',
            ],
            // MQTT - 프린터 연결 시에만 필요
            'mqtt-bundle': [
              'mqtt',
            ],
            // Vendor chunk for React
            'vendor': [
              'react',
              'react-dom',
              'react-router-dom',
            ],
            // UI components - 필수 컴포넌트만
            'ui': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-toast',
              '@radix-ui/react-tabs',
              '@radix-ui/react-select',
            ],
            // Supabase
            'supabase': [
              '@supabase/supabase-js',
            ],
            // i18n
            'i18n': [
              'i18next',
              'react-i18next',
            ],
          },
        },
      },
    },
  };
});