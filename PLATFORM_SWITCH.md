# 플랫폼 전환 가이드 (iOS ↔ Android)

iOS 개발 후 Android 빌드 시, 또는 Android 개발 후 iOS 빌드 시 발생하는 에러를 방지하기 위한 워크플로우입니다.

## 문제 발생 원인

Capacitor는 각 플랫폼별로:
- 네이티브 코드 (iOS: Swift/Xcode, Android: Kotlin/Gradle)
- 플랫폼별 설정 파일 (iOS: Info.plist, Android: AndroidManifest.xml)
- Web 에셋 (dist 폴더)

을 동기화합니다. 한 플랫폼에서 작업 후 다른 플랫폼으로 전환하면 동기화 문제가 발생할 수 있습니다.

---

## 📱 iOS → Android 전환 시

```bash
# 1. Web 빌드 (최신 코드 반영)
cd packages/mobile
npm run build

# 2. Capacitor 동기화 (Android 네이티브 코드 업데이트)
npx cap sync android

# 3. Android 빌드/실행
npx cap run android
# 또는 Android Studio에서 직접 빌드
```

---

## 🍎 Android → iOS 전환 시

```bash
# 1. Web 빌드 (최신 코드 반영)
cd packages/mobile
npm run build

# 2. Capacitor 동기화 (iOS 네이티브 코드 업데이트)
npx cap sync ios

# 3. iOS 빌드/실행
npx cap run ios
# 또는 Xcode에서 직접 빌드
```

---

## 🔄 전체 클린 빌드 (문제 발생 시)

플랫폼 전환 시 에러가 계속 발생하면 완전히 클린하고 다시 빌드:

```bash
cd packages/mobile

# 1. 기존 빌드 파일 삭제
rm -rf dist
rm -rf node_modules/.vite

# 2. Web 빌드
npm run build

# 3. 양쪽 플랫폼 동기화
npx cap sync

# 4. 원하는 플랫폼 실행
npx cap run android  # Android
npx cap run ios      # iOS
```

---

## ⚠️ 주요 에러 케이스

### 1. `js-sha256` 같은 패키지 resolve 에러
**증상:**
```
Rollup failed to resolve import "js-sha256"
```

**원인:** shared 패키지에서 사용하는 npm 패키지가 shared/package.json에 없음

**해결:**
```bash
# shared 패키지에 의존성 추가
cd packages/shared
npm install js-sha256

# 또는 루트에서
cd ../../
npm install
```

### 2. 네이티브 플러그인 에러
**증상:**
```
Cannot find module '@capacitor/...'
```

**해결:**
```bash
# Capacitor 플러그인 재설치
cd packages/mobile
npm install
npx cap sync
```

### 3. Web 에셋 not found
**증상:**
```
index.html not found
Failed to load resource
```

**해결:**
```bash
# Web 빌드 재실행
cd packages/mobile
npm run build
npx cap copy  # 에셋만 복사 (동기화 없이)
```

---

## 🛠️ 권장 워크플로우

### 개발 시작 시 (매일 첫 작업)
```bash
cd packages/mobile
npm run build
npx cap sync
```

### 플랫폼 변경 시 (iOS ↔ Android)
```bash
npm run build
npx cap sync [platform]  # platform: ios 또는 android
```

### 코드 수정 후 테스트 시
```bash
# Hot reload가 안 되는 네이티브 기능 변경 시에만
npm run build
npx cap copy [platform]  # 빠른 복사만
```

### 릴리즈 빌드 전
```bash
# 1. 클린 빌드
rm -rf dist node_modules/.vite
npm run build

# 2. 버전 업데이트
# Android: packages/mobile/android/app/build.gradle
#   versionCode, versionName 변경
# iOS: Xcode에서 Version, Build 변경

# 3. 동기화 및 빌드
npx cap sync
npx cap run android --prod  # Android
npx cap run ios --prod      # iOS
```

---

## 📝 체크리스트

플랫폼 전환 전 확인 사항:

- [ ] `npm run build` 성공
- [ ] `dist/index.html` 파일 존재 확인
- [ ] shared 패키지 의존성 설치 완료
- [ ] `npx cap sync` 실행
- [ ] 네이티브 에러 로그 확인 (Android: Logcat, iOS: Xcode Console)

---

## 🚀 빠른 명령어 모음

```bash
# 전체 재빌드 (플랫폼 전환 시)
cd packages/mobile && npm run build && npx cap sync

# Android만
cd packages/mobile && npm run build && npx cap sync android && npx cap run android

# iOS만
cd packages/mobile && npm run build && npx cap sync ios && npx cap run ios

# 웹 개발 서버 (네이티브 기능 없이)
cd packages/mobile && npm run dev
```

---

## 💡 팁

1. **개발 중**: 웹 브라우저에서 `npm run dev`로 먼저 테스트
2. **네이티브 기능 테스트**: 실제 디바이스 또는 에뮬레이터 필요
3. **Hot Reload**: Capacitor는 Hot Reload 지원 제한적 → 코드 변경 시 재빌드 권장
4. **의존성 문제**: shared 패키지 import 시 shared/package.json에 의존성 반드시 추가
5. **빌드 속도**: `npx cap copy`는 `npx cap sync`보다 빠름 (네이티브 코드 변경 없을 때)
