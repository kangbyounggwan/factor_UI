import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import type { ConsentState } from "./consent";

/**
 * 회원가입 동의 항목.
 *
 * 개인정보보호법은 수집·이용에 대한 동의를 항목별로 구분해 받고(제22조),
 * 선택 항목에 동의하지 않아도 서비스를 이용할 수 있게 하도록 정한다.
 * 그래서 필수와 선택을 한 덩어리로 묶지 않고 따로 받는다.
 */
interface Props {
  value: ConsentState;
  onChange: (next: ConsentState) => void;
  disabled?: boolean;
}

export function ConsentAgreements({ value, onChange, disabled }: Props) {
  const { t } = useTranslation();
  const allChecked = value.terms && value.privacy && value.marketing;

  const toggleAll = (checked: boolean) =>
    onChange({ terms: checked, privacy: checked, marketing: checked });

  const toggle = (key: keyof ConsentState) => (checked: boolean) =>
    onChange({ ...value, [key]: checked });

  return (
    <div className="space-y-3 rounded-md border p-3">
      {/* 전체 동의 */}
      <div className="flex items-start gap-2">
        <Checkbox
          id="consent-all"
          checked={allChecked}
          onCheckedChange={(c) => toggleAll(c === true)}
          disabled={disabled}
          className="mt-0.5"
        />
        <div className="grid gap-0.5 leading-none">
          <Label htmlFor="consent-all" className="cursor-pointer font-semibold">
            {t("auth.consentAgreeAll", "전체 동의")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("auth.consentAgreeAllHint", "필수 및 선택 항목에 모두 동의합니다.")}
          </p>
        </div>
      </div>

      <div className="border-t" />

      {/* 이용약관 — 필수 */}
      <div className="flex items-start gap-2">
        <Checkbox
          id="consent-terms"
          checked={value.terms}
          onCheckedChange={(c) => toggle("terms")(c === true)}
          disabled={disabled}
          className="mt-0.5"
        />
        <div className="grid gap-0.5 leading-none">
          <Label htmlFor="consent-terms" className="cursor-pointer text-sm font-normal">
            <span className="mr-1 font-medium text-destructive">
              [{t("auth.consentRequired", "필수")}]
            </span>
            {t("auth.consentTerms", "이용약관에 동의합니다")}
          </Label>
        </div>
        <Link
          to="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto shrink-0 text-xs underline text-muted-foreground hover:text-foreground"
        >
          {t("auth.consentView", "보기")}
        </Link>
      </div>

      {/* 개인정보 수집·이용 — 필수 */}
      <div className="flex items-start gap-2">
        <Checkbox
          id="consent-privacy"
          checked={value.privacy}
          onCheckedChange={(c) => toggle("privacy")(c === true)}
          disabled={disabled}
          className="mt-0.5"
        />
        <div className="grid gap-0.5 leading-none">
          <Label htmlFor="consent-privacy" className="cursor-pointer text-sm font-normal">
            <span className="mr-1 font-medium text-destructive">
              [{t("auth.consentRequired", "필수")}]
            </span>
            {t("auth.consentPrivacy", "개인정보 수집·이용에 동의합니다")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t(
              "auth.consentPrivacyDetail",
              "수집 항목: 이메일, 비밀번호, 이름, 휴대전화번호 · 이용 목적: 회원 식별과 서비스 제공 · 보유 기간: 회원 탈퇴 시까지"
            )}
          </p>
        </div>
        <Link
          to="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto shrink-0 text-xs underline text-muted-foreground hover:text-foreground"
        >
          {t("auth.consentView", "보기")}
        </Link>
      </div>

      {/* 마케팅 수신 — 선택 */}
      <div className="flex items-start gap-2">
        <Checkbox
          id="consent-marketing"
          checked={value.marketing}
          onCheckedChange={(c) => toggle("marketing")(c === true)}
          disabled={disabled}
          className="mt-0.5"
        />
        <div className="grid gap-0.5 leading-none">
          <Label htmlFor="consent-marketing" className="cursor-pointer text-sm font-normal">
            <span className="mr-1 font-medium text-muted-foreground">
              [{t("auth.consentOptional", "선택")}]
            </span>
            {t("auth.consentMarketing", "마케팅 정보 수신에 동의합니다")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t(
              "auth.consentMarketingDetail",
              "이벤트·혜택 안내를 받습니다. 동의하지 않아도 서비스를 이용할 수 있습니다."
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ConsentAgreements;
