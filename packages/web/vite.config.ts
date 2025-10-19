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
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            // Three.js and 3D rendering libraries in separate chunk
            'three-bundle': [
              'three',
              'three-stdlib',
              '@react-three/fiber',
              '@react-three/drei',
            ],
            // Vendor chunk for React
            'vendor': [
              'react',
              'react-dom',
              'react-router-dom',
            ],
            // UI components
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
          },
        },
      },
    },
  };
});