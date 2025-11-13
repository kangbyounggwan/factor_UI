import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const TermsOfService = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isKorean = i18n.language === 'ko';

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 safe-area-top">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">{t('legal.termsOfService.title', '이용약관')}</h1>
        </div>
      </div>

      {/* 내용 */}
      <div className="px-4 py-6 space-y-6 pb-safe">
        <div className="text-sm text-muted-foreground">
          {t('legal.effectiveDate', '시행일')}: {isKorean ? '2025년 11월 10일' : 'November 10, 2025'}
        </div>

        {isKorean ? (
          <>
            {/* 제1조 목적 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">제1조 (목적)</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                본 약관은 FACTOR(이하 "회사"라 합니다)가 제공하는 3D 프린터 팜 관리 서비스(이하 "서비스"라 합니다)의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
              </p>
            </section>

            {/* 제2조 정의 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">제2조 (정의)</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                본 약관에서 사용하는 용어의 정의는 다음과 같습니다.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed ml-4">
                <li><strong className="text-foreground">"서비스"</strong>란 회사가 제공하는 3D 프린터 원격 모니터링, 제어, 관리 및 관련 부가 서비스를 의미합니다.</li>
                <li><strong className="text-foreground">"이용자"</strong>란 본 약관에 따라 회사가 제공하는 서비스를 이용하는 회원 및 비회원을 말합니다.</li>
                <li><strong className="text-foreground">"회원"</strong>이란 회사와 서비스 이용계약을 체결하고 이용자 아이디(ID)를 부여받은 자를 말합니다.</li>
              </ul>
            </section>

            {/* 제3조 약관의 효력 및 변경 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">제3조 (약관의 효력 및 변경)</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                본 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이 발생합니다. 회사는 필요한 경우 관련 법령을 위배하지 않는 범위에서 본 약관을 변경할 수 있으며, 변경된 약관은 시행일자 7일 전부터 공지합니다.
              </p>
            </section>

            {/* 제4조 서비스의 제공 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">제4조 (서비스의 제공)</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                회사는 다음과 같은 서비스를 제공합니다.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed ml-4">
                <li>• 3D 프린터 원격 모니터링 및 제어</li>
                <li>• 출력 작업 관리 및 스케줄링</li>
                <li>• 실시간 카메라 피드 제공</li>
                <li>• AI 기반 모델 생성 및 최적화</li>
                <li>• 기타 회사가 추가 개발하거나 제휴계약 등을 통해 제공하는 서비스</li>
              </ul>
            </section>

            {/* 제5조 서비스의 중단 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">제5조 (서비스의 중단)</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                회사는 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신의 두절 등의 사유가 발생한 경우에는 서비스의 제공을 일시적으로 중단할 수 있습니다.
              </p>
            </section>

            {/* 제6조 회원가입 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">제6조 (회원가입)</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                이용자는 회사가 정한 가입 양식에 따라 회원정보를 기입한 후 본 약관에 동의한다는 의사표시를 함으로써 회원가입을 신청합니다. 회사는 제1항과 같이 회원으로 가입할 것을 신청한 이용자 중 다음 각 호에 해당하지 않는 한 회원으로 등록합니다.
              </p>
            </section>

            {/* 제7조 회원 탈퇴 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">제7조 (회원 탈퇴 및 자격 상실)</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                회원은 회사에 언제든지 탈퇴를 요청할 수 있으며 회사는 즉시 회원탈퇴를 처리합니다. 회원이 다음 각 호의 사유에 해당하는 경우, 회사는 회원자격을 제한 및 정지시킬 수 있습니다.
              </p>
            </section>

            {/* 제8조 개인정보보호 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">제8조 (개인정보보호)</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                회사는 이용자의 개인정보를 보호하기 위하여 정보통신망법 및 개인정보보호법 등 관계 법령에서 정하는 바를 준수합니다. 개인정보의 보호 및 사용에 대해서는 관련법 및 회사의 개인정보처리방침이 적용됩니다.
              </p>
            </section>

            {/* 제9조 면책조항 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">제9조 (면책조항)</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다. 회사는 회원의 귀책사유로 인한 서비스 이용의 장애에 대하여 책임을 지지 않습니다.
              </p>
            </section>

            {/* 제10조 준거법 및 재판관할 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">제10조 (준거법 및 재판관할)</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                본 약관의 해석 및 회사와 회원 간의 분쟁에 대하여는 대한민국의 법을 적용합니다. 서비스 이용 중 발생한 회원과 회사 간의 소송은 민사소송법에 따른 관할법원에 제소합니다.
              </p>
            </section>
          </>
        ) : (
          <>
            {/* Article 1 - Purpose */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">Article 1 (Purpose)</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                These Terms and Conditions aim to define the rights, obligations, responsibilities, and other necessary matters between the Company and Users regarding the use of the 3D printer farm management service (hereinafter referred to as "Service") provided by FACTOR (hereinafter referred to as "Company").
              </p>
            </section>

            {/* Article 2 - Definitions */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">Article 2 (Definitions)</h2>
              <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed ml-4">
                <li><strong className="text-foreground">"Service"</strong> means the 3D printer remote monitoring, control, management, and related additional services provided by the Company.</li>
                <li><strong className="text-foreground">"User"</strong> refers to members and non-members who use the Service provided by the Company in accordance with these Terms.</li>
                <li><strong className="text-foreground">"Member"</strong> refers to a person who has entered into a service agreement with the Company and has been assigned a user ID.</li>
              </ul>
            </section>

            {/* Remaining articles in English... */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">Article 3 (Effectiveness and Amendment of Terms)</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                These Terms become effective when posted on the Service screen or notified to Members by other means. The Company may amend these Terms as necessary within the scope that does not violate relevant laws, and amended Terms will be announced at least 7 days before the effective date.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold">Article 4 (Service Provision)</h2>
              <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed ml-4">
                <li>• 3D printer remote monitoring and control</li>
                <li>• Print job management and scheduling</li>
                <li>• Real-time camera feed provision</li>
                <li>• AI-based model generation and optimization</li>
                <li>• Other services developed or provided through partnership agreements</li>
              </ul>
            </section>
          </>
        )}

        <div className="pt-6 border-t text-center text-xs text-muted-foreground">
          © 2025 FACTOR. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
