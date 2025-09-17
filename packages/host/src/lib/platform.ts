export function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const hasRNWV = (window as any).ReactNativeWebView != null;
  return hasRNWV || /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(ua);
}

export type PlatformMode = "web" | "mobile";

export function getPlatformMode(): PlatformMode {
  if (typeof window === "undefined") return "web";

  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("platform");
    if (q === "web" || q === "mobile") return q;
  } catch {}

  try {
    const override = localStorage.getItem("platformOverride");
    if (override === "web" || override === "mobile") return override;
  } catch {}

  return isMobile() ? "mobile" : "web";
}


