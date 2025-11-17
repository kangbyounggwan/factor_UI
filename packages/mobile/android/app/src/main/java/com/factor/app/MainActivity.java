package com.factor.app;

import android.os.Bundle;
import android.os.Build;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import androidx.core.view.WindowCompat;
import androidx.core.app.ActivityCompat;
import android.Manifest;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Disable edge-to-edge so content does not draw under the status bar
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

    // Create notification channel for Android 8.0+
    createNotificationChannel();

    // Optionally request permissions at launch (we also handle in JS)
    String[] perms = new String[]{
      Manifest.permission.ACCESS_FINE_LOCATION,
      Manifest.permission.ACCESS_COARSE_LOCATION
    };
    ActivityCompat.requestPermissions(this, perms, 1001);
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


