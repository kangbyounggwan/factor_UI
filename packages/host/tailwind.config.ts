import type { Config } from "tailwindcss";
import base from "../../tailwind.config"; // ✅ preset으로만 사용

export default {
  presets: [base as unknown as Config],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,html}",
    "../web/{src,app,pages,components}/**/*.{ts,tsx,html}",
    "../mobile/{src,app,pages,components}/**/*.{ts,tsx,html}",
    "../shared/src/**/*.{ts,tsx,html}",
  ],
} satisfies Config;