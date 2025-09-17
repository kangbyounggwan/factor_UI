import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";                 // ✅ Tailwind 엔트리 (host에서 한 번만)

// Dashboard에서 플랫폼 분기 및 /admin 처리
const App = lazy(() => import("./pages/Dashboard"));

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={<div className="p-4">Loading…</div>}>
      <App />
    </Suspense>
  </React.StrictMode>
);