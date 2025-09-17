import React, { Suspense, lazy, useMemo, useState } from "react";
import { getPlatformMode } from "../lib/platform";

const WebApp = lazy(() => import("@web/App"));
const MobileApp = lazy(() => import("@mobile/App"));

const WebProviderWrapper = lazy(async () => {
  try {
    const mod: any = await import("@shared/contexts/AuthContext");
    const Provider = mod.AuthProvider ?? (({ children }: any) => <>{children}</>);
    return { default: ({ children }: any) => <Provider variant="web">{children}</Provider> };
  } catch {
    return { default: ({ children }: any) => <>{children}</> };
  }
});

const MobileProviderWrapper = lazy(async () => {
  try {
    const mod: any = await import("@shared/contexts/AuthContext");
    const Provider = mod.AuthProvider ?? (({ children }: any) => <>{children}</>);
    return { default: ({ children }: any) => <Provider variant="mobile">{children}</Provider> };
  } catch {
    return { default: ({ children }: any) => <>{children}</> };
  }
});

function AdminPanel() {
  const detected = useMemo(() => getPlatformMode(), []);
  const stored = (typeof window !== "undefined" && localStorage.getItem("platformOverride")) || "없음";
  const [choice, setChoice] = useState<"auto" | "web" | "mobile">(
    stored === "web" || stored === "mobile" ? (stored as "web" | "mobile") : "auto"
  );

  const applyChoice = () => {
    if (choice === "auto") {
      localStorage.removeItem("platformOverride");
    } else {
      localStorage.setItem("platformOverride", choice);
    }
    window.location.href = "/";
  };

  const goWithQuery = (mode: "web" | "mobile") => {
    const url = new URL(window.location.href);
    url.pathname = "/";
    url.searchParams.set("platform", mode);
    window.location.href = url.toString();
  };

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>/admin 플랫폼 테스트</h1>

      <div style={{ marginBottom: 12 }}>
        <div>자동 감지 결과: <b>{detected}</b></div>
        <div>저장된 강제값(localStorage): <b>{stored}</b></div>
      </div>

      <div style={{ display: "grid", gap: 8, margin: "16px 0" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="radio"
            name="platform"
            value="auto"
            checked={choice === "auto"}
            onChange={() => setChoice("auto")}
          />
          자동(auto)
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="radio"
            name="platform"
            value="web"
            checked={choice === "web"}
            onChange={() => setChoice("web")}
          />
          웹(web)
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="radio"
            name="platform"
            value="mobile"
            checked={choice === "mobile"}
            onChange={() => setChoice("mobile")}
          />
          모바일(mobile)
        </label>
      </div>

      <button
        onClick={applyChoice}
        style={{
          display: "inline-block",
          padding: "10px 16px",
          borderRadius: 8,
          color: "white",
          background: "#111827",
          cursor: "pointer",
          marginRight: 8
        }}
      >
        적용 후 홈으로
      </button>

      <button
        onClick={() => goWithQuery("web")}
        style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", marginRight: 8 }}
      >
        ?platform=web로 접속
      </button>

      <button
        onClick={() => goWithQuery("mobile")}
        style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb" }}
      >
        ?platform=mobile로 접속
      </button>

      <p style={{ marginTop: 16, color: "#6b7280" }}>
        참고: <code>localStorage.platformOverride</code> 값을 사용합니다.
      </p>
    </div>
  );
}

export default function Dashboard() {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
    return <AdminPanel />;
  }

  const mode = getPlatformMode();
  return (
    <Suspense fallback={null}>
      {mode === "mobile" ? (
        <MobileProviderWrapper>
          <MobileApp />
        </MobileProviderWrapper>
      ) : (
        <WebProviderWrapper>
          <WebApp />
        </WebProviderWrapper>
      )}
    </Suspense>
  );
}


