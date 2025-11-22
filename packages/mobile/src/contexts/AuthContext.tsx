/**
 * Mobile-specific AuthContext
 * - Extends shared AuthContext with setSessionFromDeepLink for OAuth deep linking
 * - Same interface as web version for consistency
 */
export { useAuth, AuthProvider } from "@shared/contexts/AuthContext";
