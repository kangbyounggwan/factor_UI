package com.factor.app;

import android.os.Bundle;
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
    // Optionally request permissions at launch (we also handle in JS)
    String[] perms = new String[]{
      Manifest.permission.ACCESS_FINE_LOCATION,
      Manifest.permission.ACCESS_COARSE_LOCATION
    };
    ActivityCompat.requestPermissions(this, perms, 1001);
  }
}


