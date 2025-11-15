# App Store Review - Guideline 5.1.1(v) 해결 리포트

**리젝 가이드라인**: 5.1.1(v) - Data Collection and Storage - Account Deletion
**제출 ID**: 7eea269d-1536-4d79-b7f6-0a0156ee4aa9
**검토 날짜**: 2025년 11월 15일
**버전**: 1.0

---

## 📋 리젝 내용

앱이 계정 생성을 지원하지만 계정 삭제 옵션이 포함되어 있지 않음.

**Apple의 요구사항**:
- 계정 생성을 지원하는 모든 앱은 계정 삭제도 제공해야 함
- 사용자가 앱 사용 중 공유한 데이터를 더 잘 제어할 수 있어야 함

**계정 삭제 요구사항**:
- 일시적 비활성화/정지만으로는 불충분
- 웹사이트에서 삭제를 완료해야 하는 경우, 해당 페이지로 직접 연결되는 링크 포함 필요
- 실수로 계정을 삭제하지 않도록 확인 단계 포함 가능
- 규제가 엄격한 산업의 앱만 고객 서비스(전화, 이메일)를 통한 삭제 요구 가능

---

## 🔍 현재 상태 분석

### 계정 관리 기능 확인

**검토한 파일**: `packages/mobile/src/pages/UserSettings.tsx`

**현재 구현된 기능**:
- ✅ 언어 설정
- ✅ 알림 설정
- ✅ 테마 설정
- ✅ 소셜 계정 연동
- ✅ 비밀번호 변경
- ✅ 구독 플랜 관리
- ✅ 결제 내역
- ❌ **계정 삭제 기능 없음**

**문제점**:
- 라인 100까지 확인 결과 계정 삭제 메뉴 항목이 없음
- 사용자가 자신의 계정을 직접 삭제할 방법이 없음

---

## ✅ 해결 방법

### 방법 1: 앱 내 계정 삭제 기능 구현 (권장)

**난이도**: 🟡 중간
**개발 소요**: 2-3일
**타입**: ✅ 개발 필요

#### 구현 단계

**1. Supabase 계정 삭제 API 생성**

**파일**: `packages/shared/src/api/account.ts` (새 파일)

```typescript
import { supabase } from '@shared/integrations/supabase/client';

export const AccountAPI = {
  /**
   * 사용자 계정 완전 삭제
   * - 사용자 데이터 삭제
   * - 연결된 디바이스 해제
   * - 구독 정보 삭제
   */
  deleteAccount: async (userId: string) => {
    try {
      // 1. 사용자 소유 프린터 연결 해제
      const { error: printerError } = await supabase
        .from('printers')
        .delete()
        .eq('user_id', userId);

      if (printerError) throw printerError;

      // 2. 사용자 클라이언트 삭제
      const { error: clientError } = await supabase
        .from('clients')
        .delete()
        .eq('user_id', userId);

      if (clientError) throw clientError;

      // 3. AI 학습 이미지 삭제
      const { error: aiImageError } = await supabase
        .from('ai_training_images')
        .delete()
        .eq('user_id', userId);

      if (aiImageError) throw aiImageError;

      // 4. 사용자 역할 삭제
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (roleError) throw roleError;

      // 5. Supabase Auth 사용자 삭제
      const { error: authError } = await supabase.rpc('delete_user', {
        user_id: userId
      });

      if (authError) throw authError;

      return { success: true, error: null };
    } catch (error: any) {
      console.error('Account deletion error:', error);
      return { success: false, error };
    }
  },

  /**
   * 계정 삭제 전 확인 (사용자 데이터 요약)
   */
  getAccountDeletionSummary: async (userId: string) => {
    try {
      const [printersRes, clientsRes, aiImagesRes] = await Promise.all([
        supabase.from('printers').select('id').eq('user_id', userId),
        supabase.from('clients').select('id').eq('user_id', userId),
        supabase.from('ai_training_images').select('id').eq('user_id', userId),
      ]);

      return {
        printersCount: printersRes.data?.length || 0,
        clientsCount: clientsRes.data?.length || 0,
        aiImagesCount: aiImagesRes.data?.length || 0,
      };
    } catch (error) {
      console.error('Error fetching account summary:', error);
      return { printersCount: 0, clientsCount: 0, aiImagesCount: 0 };
    }
  },
};
```

**2. Supabase Function 생성**

Supabase Dashboard → SQL Editor에서 실행:

```sql
-- 사용자 계정 삭제 함수
CREATE OR REPLACE FUNCTION delete_user(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- auth.users 테이블에서 사용자 삭제
  DELETE FROM auth.users WHERE id = user_id;
END;
$$;

-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION delete_user(uuid) TO authenticated;
```

**3. React Query Hook 생성**

**파일**: `packages/shared/src/queries/account.ts` (새 파일)

```typescript
import { useMutation, useQuery } from '@tanstack/react-query';
import { AccountAPI } from '@shared/api/account';

export const useDeleteAccount = () => {
  return useMutation({
    mutationFn: (userId: string) => AccountAPI.deleteAccount(userId),
    onSuccess: () => {
      // 로그아웃 처리는 컴포넌트에서 수행
    },
  });
};

export const useAccountDeletionSummary = (userId: string) => {
  return useQuery({
    queryKey: ['account-deletion-summary', userId],
    queryFn: () => AccountAPI.getAccountDeletionSummary(userId),
    enabled: !!userId,
  });
};
```

**4. 계정 삭제 확인 다이얼로그 컴포넌트**

**파일**: `packages/mobile/src/components/DeleteAccountDialog.tsx` (새 파일)

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@shared/contexts/AuthContext';
import { useDeleteAccount, useAccountDeletionSummary } from '@shared/queries/account';
import { useToast } from '@/hooks/use-toast';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DeleteAccountDialog = ({ open, onOpenChange }: DeleteAccountDialogProps) => {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState('');

  const { data: summary } = useAccountDeletionSummary(user?.id || '');
  const deleteAccount = useDeleteAccount();

  const handleDelete = async () => {
    if (confirmText !== 'DELETE' && confirmText !== '삭제') {
      toast({
        title: t('account.deleteError'),
        description: t('account.deleteConfirmError'),
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await deleteAccount.mutateAsync(user?.id || '');

      if (result.success) {
        toast({
          title: t('account.deleteSuccess'),
          description: t('account.deleteSuccessMessage'),
        });

        // 로그아웃 및 로그인 화면으로 이동
        await signOut();
        navigate('/', { replace: true });
      } else {
        throw new Error(result.error?.message || 'Unknown error');
      }
    } catch (error: any) {
      toast({
        title: t('account.deleteError'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('account.deleteTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>{t('account.deleteWarning')}</p>

            {summary && (
              <Alert variant="destructive">
                <AlertDescription>
                  <div className="space-y-1 text-sm">
                    <p>{t('account.deleteWillRemove')}:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>{t('account.printersCount', { count: summary.printersCount })}</li>
                      <li>{t('account.clientsCount', { count: summary.clientsCount })}</li>
                      <li>{t('account.aiImagesCount', { count: summary.aiImagesCount })}</li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="confirm-delete">
                {t('account.deleteConfirmLabel')}
              </Label>
              <Input
                id="confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={t('account.deleteConfirmPlaceholder')}
                className="border-destructive"
              />
              <p className="text-xs text-muted-foreground">
                {t('account.deleteConfirmHint')}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteAccount.isPending}>
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteAccount.isPending}
            className="bg-destructive hover:bg-destructive/90"
          >
            {deleteAccount.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t('account.deleteConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
```

**5. UserSettings에 계정 삭제 메뉴 추가**

**파일**: `packages/mobile/src/pages/UserSettings.tsx`

라인 100 이후에 추가:

```tsx
import { DeleteAccountDialog } from '@/components/DeleteAccountDialog';
import { Trash2 } from 'lucide-react';

// 컴포넌트 내부
const [showDeleteDialog, setShowDeleteDialog] = useState(false);

// menuSections 배열에 추가
{
  title: t("profile.dangerZone", "위험 구역"),
  items: [
    {
      icon: Trash2,
      label: t("profile.deleteAccount", "계정 삭제"),
      onClick: () => setShowDeleteDialog(true),
      className: "text-destructive", // 빨간색으로 표시
    },
  ],
}

// 렌더링 부분에 다이얼로그 추가
<DeleteAccountDialog
  open={showDeleteDialog}
  onOpenChange={setShowDeleteDialog}
/>
```

**6. 번역 추가**

**파일**: `packages/shared/src/i18n/locales/ko/common.json`
```json
{
  "account": {
    "deleteTitle": "계정 삭제",
    "deleteWarning": "계정을 삭제하면 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.",
    "deleteWillRemove": "다음 데이터가 삭제됩니다",
    "printersCount": "프린터 {{count}}개",
    "clientsCount": "클라이언트 {{count}}개",
    "aiImagesCount": "AI 학습 이미지 {{count}}개",
    "deleteConfirmLabel": "계속하려면 '삭제'를 입력하세요",
    "deleteConfirmPlaceholder": "삭제",
    "deleteConfirmHint": "'삭제'를 정확히 입력해야 계정이 삭제됩니다",
    "deleteConfirm": "계정 영구 삭제",
    "deleteSuccess": "계정이 삭제되었습니다",
    "deleteSuccessMessage": "계정과 모든 데이터가 삭제되었습니다.",
    "deleteError": "계정 삭제 실패",
    "deleteConfirmError": "확인 텍스트가 일치하지 않습니다"
  },
  "profile": {
    "dangerZone": "위험 구역",
    "deleteAccount": "계정 삭제"
  }
}
```

**파일**: `packages/shared/src/i18n/locales/en/common.json`
```json
{
  "account": {
    "deleteTitle": "Delete Account",
    "deleteWarning": "Deleting your account will permanently remove all your data and cannot be undone.",
    "deleteWillRemove": "The following will be deleted",
    "printersCount": "{{count}} printer(s)",
    "clientsCount": "{{count}} client(s)",
    "aiImagesCount": "{{count}} AI training image(s)",
    "deleteConfirmLabel": "Type 'DELETE' to continue",
    "deleteConfirmPlaceholder": "DELETE",
    "deleteConfirmHint": "You must type 'DELETE' exactly to delete your account",
    "deleteConfirm": "Permanently Delete Account",
    "deleteSuccess": "Account deleted",
    "deleteSuccessMessage": "Your account and all data have been deleted.",
    "deleteError": "Failed to delete account",
    "deleteConfirmError": "Confirmation text does not match"
  },
  "profile": {
    "dangerZone": "Danger Zone",
    "deleteAccount": "Delete Account"
  }
}
```

**7. exports 업데이트**

**파일**: `packages/shared/src/index.ts`
```typescript
// API
export * from './api/account';

// Queries
export * from './queries/account';
```

---

### 방법 2: 웹사이트 링크 제공

**난이도**: 🟡 중간
**개발 소요**: 2-3일
**타입**: ✅ 개발 필요 (웹 페이지 + API)

앱 내에서 웹 브라우저로 계정 삭제 페이지를 열도록 구현

#### 구현 방법

```tsx
// UserSettings.tsx
import { Browser } from '@capacitor/browser';

const handleDeleteAccount = async () => {
  await Browser.open({
    url: 'https://your-domain.com/account/delete',
    presentationStyle: 'popover',
  });
};
```

**단점**:
- 별도의 웹 페이지 개발 필요
- 사용자 경험 저하 (앱 밖으로 나가야 함)

---

## 📊 권장 사항

### ✅ 권장: 방법 1 (앱 내 계정 삭제)

**이유**:
1. **최고의 사용자 경험**: 앱 내에서 완결
2. **Apple 가이드라인 완벽 준수**: 직접 삭제 기능 제공
3. **데이터 제어권 강화**: 사용자에게 완전한 제어권 제공
4. **추가 인프라 불필요**: 웹 페이지 개발 필요 없음

### 구현 우선순위

**Phase 1: 핵심 기능** (필수)
1. AccountAPI 생성
2. Supabase delete_user 함수 생성
3. React Query 훅 생성
4. DeleteAccountDialog 컴포넌트
5. UserSettings에 메뉴 추가

**Phase 2: 안전장치** (중요)
1. 확인 다이얼로그 (실수 방지)
2. 데이터 요약 표시
3. 확인 텍스트 입력 ('DELETE' 입력)

**Phase 3: 테스트** (필수)
1. 테스트 계정으로 삭제 테스트
2. 데이터베이스에서 완전 삭제 확인
3. 로그아웃 및 리다이렉트 확인

---

## 🎯 Action Items

### api-developer
- [ ] `packages/shared/src/api/account.ts` 생성
- [ ] AccountAPI.deleteAccount 구현
- [ ] AccountAPI.getAccountDeletionSummary 구현
- [ ] Supabase delete_user 함수 생성

### type-safety
- [ ] 계정 삭제 관련 타입 정의
- [ ] API 응답 타입 정의

### ui-components
- [ ] DeleteAccountDialog 컴포넌트 생성
- [ ] UserSettings에 계정 삭제 메뉴 추가
- [ ] 확인 다이얼로그 UI 구현

### i18n-manager
- [ ] 번역 키 추가 (한국어, 영어)
- [ ] 에러 메시지 번역

### quality-checker
- [ ] 계정 삭제 기능 테스트
- [ ] 데이터베이스 완전 삭제 확인
- [ ] 타입 체크 및 린트

### docs-manager
- [ ] API_REFERENCE.md에 계정 삭제 API 문서화
- [ ] 사용자 가이드 업데이트

---

## ⚠️ 주의사항

### 데이터 삭제 시 고려사항

1. **관련 데이터 모두 삭제**:
   - printers 테이블
   - clients 테이블
   - ai_training_images 테이블
   - user_roles 테이블
   - auth.users 테이블

2. **구독 처리**:
   - 현재 활성 구독이 있는 경우 경고 표시
   - Apple IAP 구독은 자동으로 계속됨 (Apple에서 관리)
   - 사용자에게 구독 취소 안내

3. **복구 불가 경고**:
   - 명확한 경고 메시지
   - 확인 절차 (DELETE 입력)
   - 데이터 요약 표시

### 절대 하지 말아야 할 것

❌ **비활성화만 하고 삭제하지 않기**:
- Apple은 실제 데이터 삭제를 요구함
- 단순 비활성화는 리젝 사유

❌ **고객 서비스 연락 요구**:
- Factor는 규제 산업이 아니므로 불가
- 앱 내에서 직접 삭제 가능해야 함

---

**작성일**: 2024-11-16
**담당 에이전트**: api-developer, ui-components, type-safety, i18n-manager
**우선순위**: 🔴 High (필수 구현)
**예상 완료**: 2-3일
**타입**: 개발 필요
