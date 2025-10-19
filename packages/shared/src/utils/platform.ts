/**
 * Platform detection utility
 * Detects whether the app is running on web or mobile (Capacitor)
 */

export type Platform = 'web' | 'mobile';

/**
 * Detect current platform
 */
export function getPlatform(): Platform {
  // Check for Capacitor environment
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    return 'mobile';
  }

  // Check User Agent
  if (typeof navigator !== 'undefined') {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('capacitor') || userAgent.includes('cordova')) {
      return 'mobile';
    }
  }

  return 'web';
}

/**
 * Check if running on mobile
 */
export function isMobile(): boolean {
  return getPlatform() === 'mobile';
}

/**
 * Check if running on web
 */
export function isWeb(): boolean {
  return getPlatform() === 'web';
}

/**
 * Get platform-specific configuration
 */
export function getPlatformConfig() {
  const platform = getPlatform();

  return {
    platform,
    isMobile: platform === 'mobile',
    isWeb: platform === 'web',
    // Feature flags based on platform
    features: {
      // Use native 3D viewer on mobile for better performance
      useNative3DViewer: platform === 'mobile',
      // Use WebGL-based Three.js on web
      useThreeJS: platform === 'web',
    }
  };
}
