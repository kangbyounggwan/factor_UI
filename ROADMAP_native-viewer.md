# Native 3D Viewer Implementation Roadmap

## Overview
This document outlines the plan to implement a native 3D viewer for Android mobile app using Capacitor plugin architecture.

## Current Status
- ✅ Platform detection utility created (`packages/shared/src/utils/platform.ts`)
- ✅ Native3DViewer wrapper component created (`packages/shared/src/components/Native3DViewer.tsx`)
- ⏳ Native Capacitor plugin (not yet implemented)

## Benefits
- **Performance**: Native rendering is significantly faster than WebGL on mobile
- **Memory**: Lower memory footprint compared to Three.js
- **Battery**: Better battery efficiency with native GPU acceleration
- **Bundle Size**: Removes Three.js from mobile bundle (~1-2MB reduction)

## Implementation Steps

### Phase 1: Capacitor Plugin Setup
1. Create Capacitor plugin package
   ```bash
   npm init @capacitor/plugin native-3d-viewer
   ```

2. Plugin structure:
   ```
   packages/native-3d-viewer/
   ├── android/
   │   └── src/main/java/
   │       └── Native3DViewerPlugin.java
   ├── ios/ (future)
   ├── src/
   │   └── index.ts (TypeScript definitions)
   └── package.json
   ```

### Phase 2: Android Implementation
1. **Dependencies** (build.gradle):
   ```gradle
   implementation 'com.google.android.filament:filament-android:1.40.0'
   implementation 'com.google.android.filament:gltfio-android:1.40.0'
   implementation 'com.google.android.filament:filament-utils-android:1.40.0'
   ```

2. **Core Features**:
   - Load STL/GLTF models from URL or local storage
   - Basic camera controls (orbit, zoom, pan)
   - Material rendering (PBR support)
   - Lighting setup (IBL, directional lights)

3. **Plugin Methods**:
   ```typescript
   interface Native3DViewerPlugin {
     loadModel(options: { url: string }): Promise<void>;
     clearModel(): Promise<void>;
     setCameraPosition(position: { x: number, y: number, z: number }): Promise<void>;
     screenshot(): Promise<{ base64: string }>;
   }
   ```

### Phase 3: Integration
1. Update `Native3DViewer.tsx` to use the plugin
2. Add feature detection and fallback logic
3. Test on Android devices

### Phase 4: iOS Implementation (Future)
1. Implement iOS version using SceneKit/ModelIO
2. Unified API across platforms

## Technical Details

### Android Native Viewer (Filament)
Filament is Google's physically-based rendering engine optimized for mobile:
- Supports GLTF 2.0, GLB formats
- Efficient memory management
- Hardware-accelerated rendering
- Small binary size (~3MB)

### Sample Code (Java/Kotlin)
```java
public class Native3DViewerPlugin extends Plugin {
    private Engine engine;
    private Scene scene;
    private View view;

    @PluginMethod
    public void loadModel(PluginCall call) {
        String url = call.getString("url");

        // Download model
        // Parse with gltfio
        // Add to scene
        // Setup camera

        call.resolve();
    }
}
```

## Performance Comparison

| Metric | Three.js (Web) | Native (Filament) |
|--------|----------------|-------------------|
| Initial Load | ~2-3s | ~0.5-1s |
| Memory Usage | ~150-200MB | ~50-80MB |
| Frame Rate | 30-45 FPS | 60 FPS |
| Bundle Size | +2MB | +3MB (one-time) |

## Migration Path

### Step 1: Feature Flag
```typescript
const platformConfig = getPlatformConfig();
if (platformConfig.features.useNative3DViewer) {
  // Use native viewer
} else {
  // Use Three.js
}
```

### Step 2: Gradual Rollout
1. Beta test with native viewer
2. Monitor performance metrics
3. Full rollout if metrics improve

### Step 3: Deprecate Three.js on Mobile
Once native viewer is stable:
1. Remove Three.js from mobile bundle
2. Keep for web package only

## Development Timeline

- **Week 1-2**: Capacitor plugin setup + Android basic viewer
- **Week 3**: Camera controls and interaction
- **Week 4**: Material/lighting support
- **Week 5**: Integration testing
- **Week 6**: Beta release

## Future Enhancements
- AR support (ARCore on Android)
- Animation playback
- Multi-model support
- Annotation/measurement tools
- Export to images/videos

## Resources
- [Filament Documentation](https://google.github.io/filament/)
- [Capacitor Plugin Guide](https://capacitorjs.com/docs/plugins)
- [GLTF Format Spec](https://www.khronos.org/gltf/)
