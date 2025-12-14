package com.factor.app;

import android.os.Bundle;
import android.os.Build;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.util.Log;
import androidx.core.view.WindowCompat;
import androidx.core.app.ActivityCompat;
import android.Manifest;
import com.getcapacitor.BridgeActivity;

// Microsoft Clarity
import com.microsoft.clarity.Clarity;
import com.microsoft.clarity.ClarityConfig;
import com.microsoft.clarity.models.LogLevel;

public class MainActivity extends BridgeActivity {
  private static final String TAG = "MainActivity";
  // Capacitor Preferences 플러그인이 사용하는 SharedPreferences 파일명
  private static final String PREFS_NAME = "CapacitorStorage";
  private static final String KEY_PENDING_DEEP_LINK = "pendingDeepLink";

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Disable edge-to-edge so content does not draw under the status bar
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

    // Initialize Microsoft Clarity
    ClarityConfig config = new ClarityConfig("ulihilhfie");
    config.setLogLevel(LogLevel.None); // Use LogLevel.Verbose for debugging
    Clarity.initialize(getApplicationContext(), config);
    Log.d(TAG, "Microsoft Clarity initialized");

    // Create notification channel for Android 8.0+
    createNotificationChannel();

    // Optionally request permissions at launch (we also handle in JS)
    String[] perms = new String[]{
      Manifest.permission.ACCESS_FINE_LOCATION,
      Manifest.permission.ACCESS_COARSE_LOCATION
    };
    ActivityCompat.requestPermissions(this, perms, 1001);

    // 앱 시작 시 딥링크를 SharedPreferences에 저장 (WebView 로드 후 JavaScript에서 읽음)
    Intent intent = getIntent();
    if (intent != null && Intent.ACTION_VIEW.equals(intent.getAction()) && intent.getData() != null) {
      String url = intent.getData().toString();
      if (url.contains("auth/callback")) {
        Log.d(TAG, "Deep link saved to SharedPreferences (onCreate): " + url.substring(0, Math.min(80, url.length())) + "...");
        savePendingDeepLink(url);
      }
    }
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);

    if (intent == null) return;

    String action = intent.getAction();
    Uri data = intent.getData();

    if (Intent.ACTION_VIEW.equals(action) && data != null) {
      String url = data.toString();
      Log.d(TAG, "Deep link received (onNewIntent): " + url.substring(0, Math.min(80, url.length())) + "...");

      if (url.contains("auth/callback")) {
        // SharedPreferences에 저장
        savePendingDeepLink(url);

        // WebView에 즉시 주입 시도 + 이벤트 발생
        if (getBridge() != null && getBridge().getWebView() != null) {
          final String escapedUrl = url.replace("'", "\\'").replace("\n", "");
          final String jsCode =
            "window.__PENDING_DEEP_LINK__ = '" + escapedUrl + "';" +
            "window.dispatchEvent(new CustomEvent('deep-link-received', { detail: '" + escapedUrl + "' }));" +
            "console.warn('[MainActivity] Deep link event dispatched');";

          getBridge().getWebView().post(() -> {
            getBridge().getWebView().evaluateJavascript(jsCode, null);
            Log.d(TAG, "Deep link injected to WebView via evaluateJavascript");
          });
        }
      }
    }
  }

  private void savePendingDeepLink(String url) {
    // SharedPreferences에 저장 (백업용)
    SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
    prefs.edit().putString(KEY_PENDING_DEEP_LINK, url).apply();

    // WebView localStorage에도 저장 시도 (React 앱에서 읽을 수 있도록)
    if (getBridge() != null && getBridge().getWebView() != null) {
      final String escapedUrl = url.replace("'", "\\'").replace("\n", "");
      final String jsCode = "localStorage.setItem('pendingOAuthDeepLink', '" + escapedUrl + "');" +
                            "console.warn('[MainActivity] Deep link saved to localStorage');";

      getBridge().getWebView().post(() -> {
        getBridge().getWebView().evaluateJavascript(jsCode, null);
      });
    }
  }

  /**
   * Create notification channel for Android 8.0 (API 26) and higher
   */
  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      CharSequence name = "FACTOR Notifications";
      String description = "FACTOR 앱의 푸시 알림 채널";
      int importance = NotificationManager.IMPORTANCE_HIGH;
      NotificationChannel channel = new NotificationChannel("factor_default", name, importance);
      channel.setDescription(description);
      channel.enableVibration(true);
      channel.enableLights(true);

      NotificationManager notificationManager = getSystemService(NotificationManager.class);
      if (notificationManager != null) {
        notificationManager.createNotificationChannel(channel);
      }
    }
  }
}


