// packages/host/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// vite-tsconfig-paths는 타입 선언이 없어 any로 사용
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [
    tsconfigPaths({
      projects: [
        fileURLToPath(new URL("../web/tsconfig.json", import.meta.url)),
        fileURLToPath(new URL("../mobile/tsconfig.json", import.meta.url)),
        fileURLToPath(new URL("./tsconfig.json", import.meta.url)),
      ],
    }),
    react(),
  ],
  envDir: fileURLToPath(new URL("../../", import.meta.url)), 
  envPrefix: ["VITE_"],
  resolve: {
    alias: {
      "@host":   fileURLToPath(new URL("./src", import.meta.url)),
      "@web":    fileURLToPath(new URL("../web/src", import.meta.url)),
      "@mobile": fileURLToPath(new URL("../mobile/src", import.meta.url)),
      "@shared": fileURLToPath(new URL("../shared/src", import.meta.url)),
    },
    preserveSymlinks: true,          
    dedupe: ["react", "react-dom"],   
  },
  server: {
    fs: {
      allow: [
        fileURLToPath(new URL("../../", import.meta.url)), // 루트 접근 허용
        fileURLToPath(new URL("../", import.meta.url)),
        fileURLToPath(new URL("../web", import.meta.url)),
        fileURLToPath(new URL("../mobile", import.meta.url)),
        fileURLToPath(new URL("../shared", import.meta.url)),
      ],
    },
  },
  root: ".", // 그대로 OK
});
