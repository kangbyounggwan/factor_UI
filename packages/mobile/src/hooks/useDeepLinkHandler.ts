import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@shared/contexts/AuthContext";

// 전역 플래그: 리스너가 이미 등록되었는지 확인
let isListenerRegistered = false;

/**
 * 딥링크 처리 전용 훅 (리팩토링 버전)
 * - 역할: URL에서 OAuth 토큰 추출하고 AuthContext에 전달
 * - AuthContext가 setSession 호출 및 loading 상태 관리
 * - 네비게이션은 ProtectedRoute와 App 라우팅이 자동 처리
 */
export function useDeepLinkHandler() {
  const { setSessionFromDeepLink } = useAuth();
  const handledUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const processDeepLink = async (rawUrl: string) => {
      if (!rawUrl) return;
      console.log("[DeepLink] Processing:", rawUrl);

      // 1. 브라우저 닫기
      try {
        const { Browser } = await import("@capacitor/browser");
        await Browser.close();
        console.log("[DeepLink] Browser closed");
      } catch {
        console.log("[DeepLink] Browser already closed");
      }

      // 2. URL 파싱
      let url: URL;
      try {
        url = new URL(rawUrl);
      } catch {
        console.error("[DeepLink] Invalid URL");
        return;
      }

      const fragment = url.hash.substring(1);
      const params = new URLSearchParams(fragment || url.search.substring(1));

      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      console.log("[DeepLink] Tokens:", {
        hasAccess: !!access_token,
        hasRefresh: !!refresh_token,
      });

      if (!access_token || !refresh_token) {
        console.error("[DeepLink] No tokens found");
        return;
      }

      // 3. AuthContext에 전달 (끝)
      console.log("[DeepLink] Calling setSessionFromDeepLink...");
      const { error } = await setSessionFromDeepLink(access_token, refresh_token);

      if (error) {
        console.error("[DeepLink] Failed to set session:", error);
      } else {
        console.log("[DeepLink] Session set successfully");
      }

      // 네비게이션 없음! AuthContext가 상태 업데이트하면 ProtectedRoute가 자동 처리
    };

    const handleUrl = (url: string) => {
      if (!url) return;
      // 중복 처리 방지
      if (handledUrlRef.current === url) {
        console.log("[DeepLink] URL already handled, skipping:", url.substring(0, 50));
        return;
      }
      handledUrlRef.current = url;
      // pending 값 비우기
      (window as any).__PENDING_DEEP_LINK__ = null;
      void processDeepLink(url);
    };

    const setupDeepLinkHandler = async () => {
      // 1) window.__PENDING_DEEP_LINK__ 먼저 확인 (네이티브가 먼저 써놓았을 수 있음)
      const w = window as any;
      if (w.__PENDING_DEEP_LINK__) {
        console.warn("[DeepLink] Found pending deep link (window):", w.__PENDING_DEEP_LINK__);
        handleUrl(w.__PENDING_DEEP_LINK__);
        return; // 찾았으면 더 이상 확인 안 함
      }

      // 2) Capacitor Preferences 확인 (앱 재시작 시 네이티브가 저장했을 수 있음)
      try {
        const { Preferences } = await import("@capacitor/preferences");
        const { value } = await Preferences.get({ key: "pendingDeepLink" });
        if (value) {
          console.warn("[DeepLink] Found pending deep link (Preferences):", value.substring(0, 50) + "...");
          await Preferences.remove({ key: "pendingDeepLink" });
          handleUrl(value);
          return;
        }
      } catch (err) {
        console.warn("[DeepLink] Preferences check failed:", err);
      }

      // 3) localStorage 확인 (네이티브가 저장했을 수 있음)
      const storedDeepLink = localStorage.getItem("pendingOAuthDeepLink");
      if (storedDeepLink) {
        console.warn("[DeepLink] Found pending deep link (localStorage):", storedDeepLink.substring(0, 50) + "...");
        localStorage.removeItem("pendingOAuthDeepLink");
        handleUrl(storedDeepLink);
        return;
      }

      console.warn("[DeepLink] No pending deep link found, waiting for events...");
    };

    setupDeepLinkHandler();

    // 4) 앞으로 들어오는 딥링크는 이벤트로 처리
    // 전역 플래그로 중복 등록 방지
    if (!isListenerRegistered) {
      const onDeepLink = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        console.warn("[DeepLink] Event received:", detail);
        handleUrl(detail);
      };

      window.addEventListener("deep-link-received", onDeepLink);
      isListenerRegistered = true;
      console.warn("[DeepLink] Event listener registered (will persist across navigations)");
    }

    // Cleanup: 리스너는 절대 제거하지 않음 (앱 전체 생명주기 동안 유지)
    // 로그아웃 후 재로그인, 백그라운드→포그라운드 전환 시에도 동작해야 함
    return () => {
      // No cleanup - listener persists
    };
  }, [setSessionFromDeepLink]);
}
