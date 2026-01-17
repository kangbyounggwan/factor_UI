# ProfileSetup 페이지

## 개요

신규 사용자(소셜 로그인) 초기 프로필 설정 페이지입니다.

## 파일 위치

| 플랫폼 | 경로 |
|--------|------|
| Web | `packages/web/src/pages/ProfileSetup.tsx` |
| Mobile | `packages/mobile/src/pages/ProfileSetup.tsx` |

## 실행 조건

소셜 로그인(Google, Apple) 후 `profiles` 테이블에 레코드가 없거나 `full_name`이 없는 경우 이 페이지로 리다이렉트됩니다.

## 입력 필드

| 필드 | DB 컬럼 | 필수 | 설명 |
|------|---------|------|------|
| 이름 (실명) | `profiles.full_name` | ✅ | 본인 확인용, 비공개 |
| 닉네임 | `profiles.display_name` | ❌ | 커뮤니티 표시용, 나중에 설정 가능 |
| 휴대폰 번호 | `profiles.phone` | ✅ | 연락처 |

## 저장 처리

### 1. user_metadata 업데이트

```typescript
await supabase.auth.updateUser({
  data: {
    full_name: fullName,
    phone: phone,
  }
});
```

### 2. profiles 테이블 Upsert

```typescript
// role은 DB 트리거로 보호됨 - 클라이언트에서 설정하지 않음
await supabase.from('profiles').upsert({
  user_id: user.id,
  full_name: fullName.trim(),
  display_name: displayName.trim() || null,
  phone: phone || null,
}, {
  onConflict: 'user_id'
});
```

> **중요**: `role` 필드는 클라이언트에서 설정하지 않습니다.
> - 새 프로필: DB DEFAULT 값 (`'user'`) 적용
> - 기존 프로필: 기존 role 유지 (admin 권한 보존)
> - DB 트리거 `prevent_role_change()`가 일반 사용자의 role 변경을 차단합니다.

### 3. user_notification_settings 생성

```typescript
await supabase.from('user_notification_settings').upsert({
  user_id: user.id,
  push_notifications: true,
  print_complete_notifications: true,
  error_notifications: true,
  email_notifications: false,
  weekly_report: false,
  notification_sound: true,
  notification_frequency: 'immediate',
  quiet_hours_enabled: false,
}, { onConflict: 'user_id' });
```

### 4. user_subscriptions 생성

```typescript
const trialEndDate = new Date();
trialEndDate.setDate(trialEndDate.getDate() + 14);

await supabase.from('user_subscriptions').upsert({
  user_id: user.id,
  plan_name: 'free',
  status: 'active',  // DB CHECK: 'active', 'cancelled', 'expired', 'past_due'
  current_period_start: new Date().toISOString(),
  current_period_end: trialEndDate.toISOString(),
  cancel_at_period_end: false,
}, { onConflict: 'user_id' });
```

## Role 관리

### 허용 값

| 값 | 설명 |
|----|------|
| `'user'` | 일반 사용자 |
| `'admin'` | 관리자 |

### 주의사항

- **ProfileSetup에서 role을 덮어쓰지 않음**: 기존 프로필이 있으면 role 필드를 upsert 데이터에 포함하지 않습니다.
- **관리자 권한 부여**: DB에서 직접 `UPDATE profiles SET role = 'admin' WHERE user_id = '...'` 실행 필요
- **useUserRole 훅**: `AppHeader`에서 관리자 메뉴 표시 여부 결정에 사용

### 관리자 권한 복구

실수로 role이 변경된 경우:

```sql
UPDATE profiles
SET role = 'admin'
WHERE user_id = '<user_id>';
```

## 관련 훅

### useUserRole

```typescript
// packages/shared/src/hooks/useUserRole.ts
const { isAdmin, isUser, userRole, loading } = useUserRole();
```

- `profiles.role` 조회
- 에러 시 기본값 `'user'`
- `isAdmin`: 관리자 여부 (`role === 'admin'`)

## 플로우 다이어그램

```
┌─────────────────┐
│  소셜 로그인     │
│ (Google/Apple)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     Yes    ┌─────────────────┐
│ profiles 있음?   │──────────▶│   Dashboard     │
│ full_name 있음?  │           │   (정상 진입)    │
└────────┬────────┘           └─────────────────┘
         │ No
         ▼
┌─────────────────┐
│  ProfileSetup   │
│  페이지 표시     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  정보 입력 후    │
│  저장 버튼 클릭  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  1. auth.updateUser (user_metadata)          │
│  2. profiles upsert (role 보존)              │
│  3. user_notification_settings upsert        │
│  4. user_subscriptions upsert (free 플랜)    │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│   Dashboard     │
│   리다이렉트     │
└─────────────────┘
```

## 트러블슈팅

### 관리자 탭이 안 보임

**원인**: `profiles.role`이 `'admin'`이 아님

**확인**:
```sql
SELECT user_id, role FROM profiles WHERE user_id = '<user_id>';
```

**해결**:
```sql
UPDATE profiles SET role = 'admin' WHERE user_id = '<user_id>';
```

### ProfileSetup이 계속 표시됨

**원인**: `profiles.full_name`이 null이거나 프로필 레코드가 없음

**확인**:
```sql
SELECT * FROM profiles WHERE user_id = '<user_id>';
```

---

*마지막 업데이트: 2026-01-17*
