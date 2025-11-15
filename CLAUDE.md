# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation Reference

**IMPORTANT**: Before making any changes, always review these documentation files:

- **[README.md](./README.md)** - Quick start and project overview
- **[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)** - Complete project architecture, features, and patterns
- **[TECH_STACK.md](./TECH_STACK.md)** - Technology stack and dependencies
- **[API_REFERENCE.md](./API_REFERENCE.md)** - API endpoints and real-time communication protocols

**When making changes**:
1. Review relevant documentation sections before implementing
2. Update affected documentation files after changes
3. Keep version numbers and changelogs current
4. Document new patterns, APIs, or architectural decisions

## Sub Agent System

FACTOR UI uses a **specialized sub-agent system** for efficient distributed development. Each agent focuses on a specific domain and can work in parallel.

**Available Agents**: See [.claude/agents/README.md](./.claude/agents/README.md) for complete documentation.

### Quick Reference

| Agent | Responsibility | Key Files |
|-------|----------------|-----------|
| **docs-manager** | Documentation maintenance | `*.md` files |
| **api-developer** | API development | `api/`, `queries/`, `server.js` |
| **mobile-builder** | iOS/Android builds | `ios/`, `android/`, Capacitor |
| **ui-components** | React components | `components/`, `pages/` |
| **type-safety** | TypeScript types | `types/`, `tsconfig.json` |
| **i18n-manager** | Translations | `i18n/`, language files |
| **quality-checker** | Code quality | ESLint, TypeScript |
| **realtime-engineer** | MQTT/WebSocket | `mqtt.ts`, `websocket.ts` |

### Usage Examples

**Single Agent**:
```
@api-developer: Add new printer pause API endpoint
```

**Parallel Agents** (independent tasks):
```
Run in parallel:
1. @api-developer: Implement printer pause API
2. @type-safety: Define pause request/response types
3. @docs-manager: Update API_REFERENCE.md
```

**Sequential Agents** (dependent tasks):
```
1. @ui-components: Create printer control buttons
2. Then @i18n-manager: Add button labels
3. Then @quality-checker: Verify code quality
```

### Common Workflows

**New Feature Development**:
```
1. @type-safety: Define data types
2. @api-developer: Implement API
3. @ui-components: Build UI
4. @i18n-manager: Add translations
5. @quality-checker: Run checks
6. @docs-manager: Document feature
```

**Mobile Release**:
```
1. @quality-checker: Full quality check
2. @mobile-builder: Build iOS/Android
3. @docs-manager: Update release notes
```

**Bug Fix**:
```
1. @quality-checker: Identify issue
2. [Appropriate agent]: Fix bug
3. @quality-checker: Verify fix
```

## Project Overview

Factor UI is a **monorepo-based 3D printer management platform** with cross-platform support. The architecture uses a modular package structure where `host` acts as a platform dispatcher, routing to either `web` (desktop browser) or `mobile` (Capacitor-based native apps) packages, both of which share common code from the `shared` package.

**Current Version**: 1.2.0 (Build 3)
**Bundle ID**: com.byeonggwan.factor
**Platforms**: Web (Browser), iOS (App Store), Android (planned)

## Monorepo Structure

```
packages/
├── host/       # Platform dispatcher - routes to web or mobile based on detection
├── web/        # Full-featured web application
├── mobile/     # Capacitor-based mobile app with native integrations
└── shared/     # Common code: API clients, services, types, hooks, queries
```

### Package Responsibilities

- **host**: Central routing layer with platform detection logic. Checks Capacitor environment, user agent, query params (`?platform=web|mobile`), and localStorage overrides. Contains `/admin` route for manual platform testing.

- **web**: Complete browser application with AI assistant sidebar, advanced printer controls, subscription management, and model viewer.

- **mobile**: Native-optimized app using Capacitor APIs (Status Bar, Keyboard, Network). Disables AI assistant features.

- **shared**: All business logic, API clients, React Query hooks, Supabase integration, MQTT services, TypeScript types, and i18n (English/Korean).

## Development Commands

### Starting Services

```bash
# Start media streaming service (Docker)
npm run media:start

# Development - Individual packages
npm run dev:host      # Start host (dispatcher)
npm run dev:web       # Start web app
npm run dev:mobile    # Start mobile app

# Development - Full stack (host + API + media)
npm run dev:stack     # Runs concurrently: host, server, mediamtx

# Individual services
npm run dev:ui        # Vite only
npm run dev:api       # API server only
```

### Building

```bash
# Build individual packages
npm run build:host
npm run build:web
npm run build:mobile

# Build all packages
npm run build:all

# Build full stack (host + web + mobile)
npm run build:stack
```

### Testing & Linting

```bash
# Run lint for web package
npm --workspace @factor/web run lint

# Run lint for mobile package
npm --workspace @factor/mobile run lint
```

## Environment Variables

Create `.env` file in project root (shared by all packages):

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Development Server
VITE_DEV_HOST=::                    # Default: "::" (all interfaces)
VITE_DEV_PORT=8080                  # Default: 8080

# MQTT Broker (for real-time device communication)
VITE_MQTT_BROKER_URL=ws://localhost:9001
```

All packages load from the root `.env` file via `envDir: rootEnvDir` in their Vite configs.

## Architecture Patterns

### Platform Detection Priority

1. Query parameter: `?platform=web` or `?platform=mobile`
2. localStorage override: `platformOverride` key
3. Capacitor environment detection
4. User agent detection (Android, iPhone, iPad, etc.)
5. Default: web

### Path Aliases

All packages use TypeScript path aliases defined in `tsconfig.base.json`:

```typescript
import { something } from '@shared/api/printer';     // Shared package
import { Component } from '@/components/Component';  // Package-local
```

**Important**: Always use `@shared/*` imports when accessing shared code from web/mobile packages.

### Real-Time Communication: MQTT

The project uses **MQTT** (not WebSocket) for real-time device communication:

- **Singleton pattern**: `createSharedMqttClient()` ensures one client per app instance
- **Topic structure**:
  - `octoprint/status/{device_uuid}` - Printer status updates
  - `control_result/{device_uuid}` - Control command results
- **Auto-subscription**: Managed by `AuthContext` - subscribes on login, unsubscribes on logout
- **Device UUID caching**: 60-second TTL to reduce database queries
- **Graceful degradation**: Inert mode if `VITE_MQTT_BROKER_URL` not set

### Authentication & Authorization

- **Provider**: Supabase with email/password authentication
- **Session Storage**: localStorage with auto-refresh enabled
- **Role-based access**: `user_roles` table determines admin status
- **Protected Routes**: `ProtectedRoute` and `AdminRoute` wrapper components
- **Token injection**: Supabase access token passed to MQTT/WebSocket connections

**Auth Flow**:
1. User signs in via Supabase
2. `AuthProvider` loads user role from `user_roles` table
3. MQTT subscriptions established for user's devices
4. On logout, all subscriptions cleaned up

### State Management

- **Server state**: TanStack React Query for data fetching and caching
- **Auth state**: React Context (`AuthContext`)
- **UI state**: React Context (e.g., `AISidebarContext` for sidebar toggle)
- **Refs for subscriptions**: Prevent stale closures and double-subscriptions in `AuthContext`

### Supabase Tables

Key tables accessed by the application:

- `clients` - Client devices registered to users
- `printers` - Printer configurations and status
- `cameras` - Camera configurations and stream URLs
- `user_roles` - Role-based access control (admin/user)
- `ai_models` - AI model metadata for image processing
- `ai_training_images` - Training data for AI models

## API Server

The Express server (`packages/shared/server.js`) provides:

- **REST API**:
  - `POST /api/auth/login` - Supabase password authentication
  - `POST /api/printer/register` - Device registration with normalization
  - `GET /api/printers/summary` - Fetch user's printers
  - `GET /api/status` - Server health and connection counts
  - `POST /api/printer/update` - Update printer data

- **WebSocket Server**:
  - Edge clients (Python/requests) send printer status updates
  - Web clients (browsers) receive real-time status broadcasts
  - Heartbeat and acknowledgment messages
  - Message types: `printer_status`, `temperature_update`, `position_update`, `print_progress`

**Running standalone**:
```bash
node packages/shared/server.js --host 0.0.0.0 --port 5000 --ws --rest
```

Flags: `--rest` (enable REST API), `--ws` (enable WebSocket), `--host`, `--port`

## Mobile Development (Capacitor)

### Capacitor Configuration

- **App ID**: `com.byeonggwan.factor`
- **App Name**: FACTOR
- **Web Directory**: `dist`
- **Plugins**: Keyboard (ionic resize), StatusBar (dark theme), Safe Area, Preferences

### Building for Mobile

```bash
# Build mobile package
npm run build:mobile

# Sync with Capacitor
cd packages/mobile
npx cap sync

# Open in native IDE
npx cap open android
npx cap open ios
```

### Mobile-Specific Features

- **Status Bar**: Dynamic styling based on theme (light text on dark background)
- **Network Detection**: `@capacitor/network` for connectivity monitoring
- **Safe Area**: `@capacitor-community/safe-area` for notch/status bar handling
  - **CRITICAL**: Always use `viewport-fit=cover` in `index.html` meta viewport tag
  - Use CSS classes: `.safe-area-top`, `.safe-area-bottom`, `.safe-area-inset`
  - Bottom padding: `calc(env(safe-area-inset-bottom, 0px) + 1.5rem)` for buttons/content
- **Navigation History**: SessionStorage tracking for improved back button UX
- **Hardware Back Button**: Custom handling in `App.tsx` for Android/iOS
- **Language Preferences**: Stored in Capacitor Preferences, instant language switching

## Code Conventions

### Import Structure

1. External libraries (React, etc.)
2. Shared package imports (`@shared/*`)
3. Local package imports (`@/components`, `@/lib`)
4. Relative imports (`./`, `../`)

### Component Patterns

- **Lazy loading**: Use `React.lazy()` for route components to reduce bundle size
- **Error boundaries**: Wrap async components with Suspense fallbacks
- **Protected routes**: Always wrap authenticated routes with `ProtectedRoute` or `AdminRoute`

### Type Safety

- All API responses should have corresponding types in `@shared/types`
- Use Zod for runtime validation (e.g., forms with `react-hook-form`)
- Avoid `any` - use `unknown` if type is truly unknown

### Async Operations

- **React Query**: Use for all data fetching - provides caching, refetching, and loading states
- **Timeout protection**: Wrap potentially slow operations (e.g., `getSession()`) with timeouts
- **Error handling**: Always handle Promise rejections gracefully

## Common Workflows

### Adding a New API Endpoint

1. Add API client function in `packages/shared/src/api/{domain}.ts`
2. Create React Query hook in `packages/shared/src/queries/{domain}.ts`
3. Add TypeScript types in `packages/shared/src/types/{domain}Type.ts`
4. Export from `packages/shared/src/index.ts`
5. Use hook in web/mobile components

### Adding a New Shared Component

1. Create component in appropriate web/mobile package (NOT shared)
2. If truly reusable across platforms, consider creating in shared and importing
3. Use Radix UI primitives for complex interactive components
4. Style with Tailwind CSS using the configured theme

### Modifying Authentication Flow

1. Update `packages/shared/src/contexts/AuthContext.tsx` (or platform-specific variant)
2. Ensure MQTT subscription cleanup is maintained
3. Test logout flow to prevent subscription leaks
4. Verify role-based access control still works

### Adding MQTT Topics

1. Define topic pattern in `packages/shared/src/component/mqtt.ts`
2. Add subscription logic in `AuthContext` or component-level
3. Handle message parsing and state updates
4. Always clean up subscriptions in cleanup functions

## Debugging Tips

### MQTT Connection Issues

- Check `VITE_MQTT_BROKER_URL` is set correctly
- Verify broker is running and accessible
- Check browser console for connection errors
- Ensure client ID is not duplicated (check localStorage: `_factor_mqtt_clientid`)

### Authentication Problems

- Clear localStorage and try fresh login
- Check Supabase project settings (URL and anon key)
- Verify `user_roles` table has entries for the user
- Look for "Invalid Refresh Token" errors (indicates stale session)

### Platform Detection Not Working

- Test with query param: `?platform=mobile` or `?platform=web`
- Check localStorage for `platformOverride` key
- Verify Capacitor is properly initialized (mobile only)
- Review `packages/host/src/lib/platform.ts` logic

### Build Failures

- Ensure all packages have dependencies installed: `npm install` in root
- Check TypeScript errors: `npx tsc --noEmit` in package directory
- Verify path aliases resolve correctly (check `tsconfig.json` and `vite.config.ts`)
- Clear build cache: remove `dist/` directories

## iOS Development & Deployment

### Version Management

**Files to update when changing version**:
1. `packages/mobile/package.json` - `version` field
2. `packages/mobile/ios/App/App.xcodeproj/project.pbxproj` - `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION`

```bash
# Update version strings
MARKETING_VERSION = 1.2.0      # User-facing version
CURRENT_PROJECT_VERSION = 3     # Build number (increment for each build)
```

### iOS Build Process

```bash
# 1. Build and sync
npm run build:mobile
cd packages/mobile
npx cap sync ios

# 2. Update version in Xcode project (manual or via sed)
# MARKETING_VERSION and CURRENT_PROJECT_VERSION in project.pbxproj

# 3. Open Xcode and create archive
open ios/App/App.xcworkspace
# Xcode: Product → Archive

# 4. Distribute to App Store
# Organizer → Distribute App → App Store Connect → Upload
```

### Common iOS Issues

**Provisioning Profile Errors**:
- Connect physical iPhone via USB
- Xcode → Settings → Accounts → Download Manual Profiles
- Enable "Automatically manage signing" in target settings
- Team: byeonggwan lim (PV97G6HPRA)

**Safe Area Issues on iPad**:
- Ensure `viewport-fit=cover` in `index.html`
- Use `.safe-area-bottom` class on scrollable containers
- Test on actual iPad device, not just simulator

**App Icon Transparency**:
- Remove alpha channel: `sips -s format jpeg icon.png --out /tmp/temp.jpg && sips -s format png /tmp/temp.jpg --out icon.png`
- Generate all required sizes (20x20 to 1024x1024)

## Recent Changes (v1.2.0 Build 3)

### UX Improvements
- **Theme Settings**: Removed unnecessary "완료" button - theme applies immediately on selection
- **Language Settings**: Instant language switching without page reload using Capacitor Preferences
- **iPad Safe Area**: Fixed bottom content clipping on iPad
  - Added `viewport-fit=cover` to viewport meta tag
  - Increased `.safe-area-bottom` padding to 1.5rem
  - Applied to ThemeSettings and LanguageSettings pages

### Mobile Optimizations
- Capacitor Preferences for persistent language storage
- Improved i18n initialization with proper error handling
- App reload removed from language change - now instant update

## Important Notes

- **Never hardcode secrets**: Always use environment variables for API keys and URLs
- **Test on mobile**: Always test Capacitor features on actual devices, not just browsers
- **MQTT is primary**: WebSocket support exists but MQTT is the production real-time channel
- **Shared package exports**: Always export new shared utilities from `packages/shared/src/index.ts`
- **Device UUID is critical**: All printer operations require valid `device_uuid` for routing
- **Subscription cleanup**: Always unsubscribe from MQTT topics in component cleanup or logout
- **Role-based features**: Check `isAdmin` before showing admin-only UI elements
- **i18n support**: Use translation keys for user-facing strings (English and Korean supported)
- **Documentation maintenance**: Update relevant .md files when making significant changes
