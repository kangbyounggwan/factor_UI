# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Factor UI is a **monorepo-based 3D printer management platform** with cross-platform support. The architecture uses a modular package structure where `host` acts as a platform dispatcher, routing to either `web` (desktop browser) or `mobile` (Capacitor-based native apps) packages, both of which share common code from the `shared` package.

## Important: Reference Documentation

**Before making ANY changes to the codebase, always consult these reference documents:**

### Core Documentation
1. **[README.md](README.md)** - Quick start, overview, and basic commands
2. **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** - Project overview and architecture
3. **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Detailed component structure and function locations
4. **[TECH_STACK.md](TECH_STACK.md)** - Technology stack summary

### API Documentation
5. **[API_REFERENCE.md](API_REFERENCE.md)** - Complete API reference (Supabase, REST, MQTT, WebSocket)
6. **[API_mqtt-registration-payloads.md](API_mqtt-registration-payloads.md)** - MQTT device registration payload specifications

### Sub-Agents System
7. **[SUB_AGENTS.md](SUB_AGENTS.md)** - **Specialized sub-agents guide for efficient development**
8. **[.claude/agents/](./.claude/agents/)** - Individual agent specifications (8 specialized agents)

### Feature Guides
9. **[GUIDE_stl-upload.md](GUIDE_stl-upload.md)** - STL file upload and thumbnail generation workflow
10. **[GUIDE_notification-setup.md](GUIDE_notification-setup.md)** - Notification system setup and testing

### Page Documentation
11. **[docs/page/DOCUMENTATION_PIPELINE.md](docs/page/DOCUMENTATION_PIPELINE.md)** - Page documentation generation pipeline and template
12. **[docs/page/community.md](docs/page/community.md)** - Community system complete documentation (example)

### Technical Documentation
13. **[TECH_stl-rendering-performance.md](TECH_stl-rendering-performance.md)** - STL rendering performance considerations
14. **[TECH_bundle-optimization.md](TECH_bundle-optimization.md)** - Bundle size optimization strategies and results

### Roadmaps
15. **[ROADMAP_native-viewer.md](ROADMAP_native-viewer.md)** - Native 3D viewer implementation plan

**After completing any development work:**
- Review the changes against these documents
- Update the relevant documentation files with any modifications
- Ensure all changes are reflected in PROJECT_STRUCTURE.md if they affect architecture
- Use the appropriate sub-agent from [SUB_AGENTS.md](SUB_AGENTS.md) for specialized tasks

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

- **App ID**: `com.factor.app`
- **App Name**: FACTOR
- **Web Directory**: `dist`
- **Plugins**: Keyboard (body resize), StatusBar (dark theme)

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
- **Navigation History**: SessionStorage tracking for improved back button UX

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
5. **Consult [API_mqtt-registration-payloads.md](API_mqtt-registration-payloads.md)** for existing MQTT message formats

### Updating Documentation

When making changes that affect project structure or architecture:

1. **Always update [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** if changes affect:
   - Package structure or responsibilities
   - New pages or routes
   - New components or services
   - Major function additions/removals
   - Technology stack changes

2. **Update technical documentation** when modifying:
   - Bundle optimization → [TECH_bundle-optimization.md](TECH_bundle-optimization.md)
   - STL rendering → [TECH_stl-rendering-performance.md](TECH_stl-rendering-performance.md)
   - MQTT payloads → [API_mqtt-registration-payloads.md](API_mqtt-registration-payloads.md)

3. **Update guides** when changing user-facing workflows:
   - STL upload process → [GUIDE_stl-upload.md](GUIDE_stl-upload.md)
   - Notification setup → [GUIDE_notification-setup.md](GUIDE_notification-setup.md)

### Page Documentation Pipeline

새로운 페이지나 기능을 문서화할 때 **[docs/page/DOCUMENTATION_PIPELINE.md](docs/page/DOCUMENTATION_PIPELINE.md)** 가이드를 따르세요.

**문서화 프로세스:**
1. 파일 구조 조사 (Glob/Grep으로 관련 파일 탐색)
2. DB 스키마 분석 (테이블, 컬럼, RLS 정책)
3. API 서비스 분석 (함수 시그니처, Supabase 쿼리)
4. 컴포넌트 분석 (Props, 상태, 데이터 흐름)
5. 15개 표준 섹션 구조로 문서 작성

**완성된 문서 예시:** [docs/page/community.md](docs/page/community.md)

**표준 문서 구조 (15개 섹션):**
1. 개요
2. 프로젝트 구조
3. 라우팅 구조
4. 데이터베이스 스키마
5. API 서비스 함수
6. 컴포넌트 계층 구조
7. 주요 컴포넌트 상세
8. 페이지 컴포넌트
9. 상태 관리
10. 데이터 흐름
11. 스타일링 및 UI
12. 에러 처리
13. 보안 고려사항
14. 백엔드 로직 상세
15. 개선 가능 영역

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

## Sub-Agent System for Distributed Development

Factor UI uses **9 specialized sub-agents** to enable efficient parallel development. Each agent has clear responsibilities and manages specific files/domains.

### Quick Reference

| Agent | Responsibility | Key Files |
|-------|----------------|-----------|
| **docs-manager** | Documentation maintenance | `*.md` files |
| **api-developer** | API development | `api/`, `queries/`, `server.js` |
| **mobile-builder** | iOS/Android builds | `ios/`, `android/`, Capacitor |
| **ui-components** | React components & UI | `components/`, `pages/` |
| **type-safety** | TypeScript types | `types/*.ts`, Zod schemas |
| **i18n-manager** | Translations | `i18n/**/*.json` |
| **quality-checker** | Lint, tests, builds | ESLint, TypeScript |
| **realtime-engineer** | MQTT/WebSocket | `mqtt.ts`, `websocket.ts` |
| **page-documenter** | Page documentation | `docs/page/*.md` |

### Usage Patterns

**Sequential workflow** (dependencies):
```
type-safety → api-developer → ui-components → i18n-manager → quality-checker → docs-manager
```

**Parallel workflow** (independent tasks):
```
api-developer + type-safety + docs-manager (simultaneously)
```

**Emergency workflow** (rapid iteration):
```
mobile-builder → quality-checker → mobile-builder
```

### Common Examples

**Adding new API endpoint:**
1. `type-safety`: Define types
2. `api-developer`: Implement API + React Query hooks
3. `docs-manager`: Update API_REFERENCE.md

**Mobile deployment:**
1. `quality-checker`: Pre-deployment checks
2. `mobile-builder`: Build and upload to App Store
3. `docs-manager`: Update release notes

**For complete guide, workflow patterns, and detailed examples:**
- **[SUB_AGENTS.md](SUB_AGENTS.md)** - Overview and collaboration patterns
- **[.claude/agents/README.md](./.claude/agents/README.md)** - Detailed agent specifications
- **[.claude/agents/EXAMPLES.md](./.claude/agents/EXAMPLES.md)** - 8 real-world scenarios

## Supabase Database Query Rule

**중요**: 사용자가 DB 관련 질의(테이블 구조, 데이터 조회, 스키마 확인 등)를 할 때, 프로젝트 루트의 `.env` 파일에서 Supabase 서비스 롤 키를 확인하여 직접 DB를 조회하고 답변해야 합니다.

### 환경 변수 위치
- **파일**: `.env` (프로젝트 루트)
- **URL**: `VITE_SUPABASE_URL`
- **Service Role Key**: `SUPABASE_SERVICE_ROLE_KEY`

### DB 조회 방법

테이블 목록 조회:
```bash
curl -X GET "${VITE_SUPABASE_URL}/rest/v1/" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

특정 테이블 스키마 조회 (예: community_posts):
```bash
curl -X GET "${VITE_SUPABASE_URL}/rest/v1/community_posts?limit=0" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Prefer: return=representation"
```

테이블 컬럼 정보 조회 (PostgreSQL information_schema):
```bash
curl -X POST "${VITE_SUPABASE_URL}/rest/v1/rpc/get_table_columns" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"table_name": "community_posts"}'
```

또는 Supabase REST API로 직접 데이터 조회:
```bash
curl -X GET "${VITE_SUPABASE_URL}/rest/v1/community_posts?select=*&limit=5" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

### 사용 시나리오
1. 사용자가 "DB 테이블 확인해줘", "community_posts 스키마 알려줘" 등 요청 시
2. 코드와 DB 간 불일치 확인이 필요할 때
3. 마이그레이션 필요 여부 판단 시

### 주의사항
- Service Role Key는 RLS(Row Level Security)를 우회하므로 조회 전용으로만 사용
- 데이터 수정/삭제 작업은 사용자 확인 후 진행
- `.env` 파일의 키는 절대 외부에 노출하지 않음

## Important Notes

- **Never hardcode secrets**: Always use environment variables for API keys and URLs
- **Test on mobile**: Always test Capacitor features on actual devices, not just browsers
- **MQTT is primary**: WebSocket support exists but MQTT is the production real-time channel
- **Shared package exports**: Always export new shared utilities from `packages/shared/src/index.ts`
- **Device UUID is critical**: All printer operations require valid `device_uuid` for routing
- **Subscription cleanup**: Always unsubscribe from MQTT topics in component cleanup or logout
- **Role-based features**: Check `isAdmin` before showing admin-only UI elements
- **i18n support**: Use translation keys for user-facing strings (English and Korean supported)
- **Use sub-agents**: Leverage specialized sub-agents for focused, efficient development

---

## 🔍 코드 수정 시 필수 검증 (Code Modification Verification)

**중요**: 모든 코드 수정, 삭제, 추가 작업 시 아래 4가지 검증을 반드시 수행하세요.
상세 내용은 **[.claude/agents/quality-checker.md](./.claude/agents/quality-checker.md)** 참조

### 1. 함수/로직 사용처 영향도 분석 (Impact Analysis)
- 수정할 함수가 다른 곳에서 사용 중인지 확인
- 매개변수/반환 타입 변경 시 모든 호출부 영향 분석
```bash
rg "함수명" --type ts --type tsx -l
```

### 2. 중복 코드/미사용 코드 탐지 (Dead Code Detection)
- 새 함수 추가 시 기존 유사 함수 존재 여부 확인
- 기존 함수 대체 시 이전 함수 삭제 확인
```bash
npm run lint -- --rule '@typescript-eslint/no-unused-vars:error'
```

### 3. 미사용 Import 정리 (Unused Import Cleanup)
- 파일 수정 후 사용하지 않는 import 제거
```bash
npx eslint 파일경로 --fix
```

### 4. 공용 컴포넌트/로직 재사용성 분석 (Reusability Analysis)
- 유사 기능이 이미 구현되어 있는지 검색
- 3곳 이상 사용 시 공용화 검토
```bash
rg "패턴" --type ts --type tsx -C 5
```

### 수정 전 체크리스트
- [ ] 수정할 함수의 사용처 모두 파악
- [ ] 유사한 기존 구현 검색 완료
- [ ] 변경 범위 최소화

### 수정 후 체크리스트
- [ ] 미사용 import/변수/함수 제거
- [ ] 모든 사용처 정상 동작 확인
- [ ] 빌드 및 린트 통과
