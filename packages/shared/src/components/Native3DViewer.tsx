/**
 * Native 3D Viewer Component
 * Platform-aware 3D model viewer that uses:
 * - Native Android viewer (SceneView/Filament) on mobile for better performance
 * - Three.js on web for compatibility
 *
 * FUTURE IMPLEMENTATION:
 * This is a stub for future native plugin development.
 *
 * To implement native viewer:
 * 1. Create Capacitor plugin: @capacitor/native-3d-viewer
 * 2. Implement Android native viewer using SceneView/Filament
 * 3. Implement iOS native viewer using SceneKit/ModelIO
 * 4. Wire up this component to use the native plugin
 */

import { lazy, Suspense } from 'react';
import { getPlatformConfig } from '../utils/platform';
import { Loader2 } from 'lucide-react';

// Lazy load Three.js viewer to avoid bundling it unless needed
const ThreeJSViewer = lazy(() => import('./ModelViewer').catch(() => {
  // Fallback if ModelViewer doesn't exist
  return { default: () => <div>3D Viewer not available</div> };
}));

interface Native3DViewerProps {
  modelUrl?: string;
  className?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Native 3D Viewer - Platform-aware component
 */
export function Native3DViewer({ modelUrl, className, onLoad, onError }: Native3DViewerProps) {
  const { features } = getPlatformConfig();

  // FUTURE: Implement native viewer for mobile
  if (features.useNative3DViewer) {
    // TODO: Call Capacitor native plugin when implemented
    // Example:
    // import { Native3DViewerPlugin } from '@capacitor/native-3d-viewer';
    //
    // useEffect(() => {
    //   if (modelUrl) {
    //     Native3DViewerPlugin.loadModel({ url: modelUrl })
    //       .then(() => onLoad?.())
    //       .catch((err) => onError?.(err));
    //   }
    // }, [modelUrl]);
    //
    // return <div id="native-3d-viewer-container" className={className} />;

    console.log('[Native3DViewer] Native viewer not yet implemented, falling back to Three.js');
  }

  // Use Three.js for web or as fallback
  return (
    <Suspense fallback={
      <div className={`flex items-center justify-center ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ThreeJSViewer className={className} />
    </Suspense>
  );
}

export default Native3DViewer;
