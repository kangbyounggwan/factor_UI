import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const PrivacyPolicy = () => {
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
          <h1 className="text-lg font-semibold">{t('legal.privacyPolicy.title', '개인정보처리방침')}</h1>
        </div>
      </div>

      {/* 내용 */}
      <div className="px-4 py-6 space-y-6 pb-safe">
        <div className="text-sm text-muted-foreground">
          {t('legal.effectiveDate', '시행일')}: {isKorean ? '2025년 11월 10일' : 'November 10, 2025'}
        </div>

        {isKorean ? (
          <>
            {/* 1. 개인정보의 수집 및 이용 목적 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">1. 개인정보의 수집 및 이용 목적</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                FACTOR는 다음의 목적을 위하여 개인정보를 처리합니다.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed ml-4">
                <li><strong className="text-foreground">회원가입 및 관리:</strong> 회원 가입의사 확인, 회원제 서비스 제공, 본인 식별·인증</li>
                <li><strong className="text-foreground">서비스 제공:</strong> 3D 프린터 관리 서비스 제공, 콘텐츠 제공, 맞춤형 서비스</li>
                <li><strong className="text-foreground">결제 및 정산:</strong> 유료 서비스 이용에 따른 요금 결제 및 정산</li>
                <li><strong className="text-foreground">마케팅 및 광고:</strong> 이벤트 및 광고성 정보 제공 (선택 동의)</li>
              </ul>
            </section>

            {/* 2. 수집하는 개인정보 항목 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">2. 수집하는 개인정보 항목</h2>
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold mb-2">필수 항목</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground leading-relaxed ml-4">
                    <li>• 이메일 주소, 비밀번호, 이름</li>
                    <li>• 결제 정보 (카드번호는 암호화 처리)</li>
                    <li>• 서비스 이용 기록, 접속 로그, 쿠키, IP 정보</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-2">선택 항목</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground leading-relaxed ml-4">
                    <li>• 프로필 사진, 전화번호, 회사명</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 3. 개인정보의 처리 및 보유기간 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">3. 개인정보의 처리 및 보유기간</h2>
              <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed ml-4">
                <li><strong className="text-foreground">회원정보:</strong> 회원 탈퇴 시까지</li>
                <li><strong className="text-foreground">결제 정보:</strong> 전자상거래법에 따라 5년간 보관</li>
                <li><strong className="text-foreground">접속 기록:</strong> 통신비밀보호법에 따라 3개월간 보관</li>
              </ul>
            </section>

            {/* 4. 개인정보의 제3자 제공 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">4. 개인정보의 제3자 제공</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                회사는 정보주체의 동의가 있거나 법률의 특별한 규정이 있는 경우에만 개인정보를 제3자에게 제공합니다.
              </p>
              <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                <p><strong className="text-foreground">제공받는 자:</strong> Paddle.com Market Limited</p>
                <p><strong className="text-foreground">제공 목적:</strong> 결제 처리 및 정산, 구독 관리</p>
                <p><strong className="text-foreground">제공 항목:</strong> 이메일, 이름, 결제 정보</p>
                <p><strong className="text-foreground">보유 기간:</strong> 거래 종료 후 5년</p>
              </div>
            </section>

            {/* 5. 개인정보 보호책임자 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">5. 개인정보 보호책임자</h2>
              <div className="bg-muted/50 p-4 rounded-lg space-y-1 text-sm text-muted-foreground">
                <p><strong className="text-foreground">담당부서:</strong> 서비스운영팀</p>
                <p><strong className="text-foreground">이메일:</strong> privacy@factor.io.kr</p>
              </div>
            </section>

            {/* 6. 정보주체의 권리 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">6. 정보주체의 권리</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                이용자는 언제든지 다음의 권리를 행사할 수 있습니다.
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground leading-relaxed ml-4">
                <li>• 개인정보 열람 요구</li>
                <li>• 개인정보 정정·삭제 요구</li>
                <li>• 개인정보 처리정지 요구</li>
              </ul>
            </section>

            {/* 7. 개인정보의 파기 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">7. 개인정보의 파기</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.
              </p>
            </section>

            {/* 8. 개인정보 자동 수집 장치의 설치·운영 및 거부 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">8. 쿠키(Cookie) 사용</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                회사는 이용자에게 개별적인 맞춤서비스를 제공하기 위해 쿠키를 사용합니다. 이용자는 쿠키 설치에 대한 선택권을 가지고 있으며, 웹브라우저 설정을 통해 쿠키를 거부할 수 있습니다.
              </p>
            </section>

            {/* 9. 개인정보 보호를 위한 기술적 대책 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">9. 개인정보 보호를 위한 기술적 대책</h2>
              <ul className="space-y-1 text-sm text-muted-foreground leading-relaxed ml-4">
                <li>• 비밀번호 암호화 저장 및 관리</li>
                <li>• 해킹이나 바이러스로부터 보호하기 위한 보안 프로그램 운영</li>
                <li>• HTTPS 프로토콜을 통한 암호화 통신</li>
                <li>• 개인정보 접근 권한 최소화</li>
              </ul>
            </section>

            {/* 10. 개인정보처리방침 변경 */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">10. 개인정보처리방침 변경</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                본 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
              </p>
            </section>
          </>
        ) : (
          <>
            {/* English Version */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">1. Purpose of Collection and Use of Personal Information</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                FACTOR processes personal information for the following purposes:
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed ml-4">
                <li><strong className="text-foreground">Membership registration and management:</strong> Confirmation of membership intention, identification and authentication</li>
                <li><strong className="text-foreground">Service provision:</strong> 3D printer management service, content provision, customized services</li>
                <li><strong className="text-foreground">Payment and settlement:</strong> Payment and settlement for paid services</li>
                <li><strong className="text-foreground">Marketing and advertising:</strong> Providing event and promotional information (optional consent)</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold">2. Personal Information Items Collected</h2>
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold mb-2">Required Items</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground leading-relaxed ml-4">
                    <li>• Email address, password, name</li>
                    <li>• Payment information (card numbers are encrypted)</li>
                    <li>• Service usage records, access logs, cookies, IP information</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-2">Optional Items</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground leading-relaxed ml-4">
                    <li>• Profile picture, phone number, company name</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold">3. Retention Period of Personal Information</h2>
              <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed ml-4">
                <li><strong className="text-foreground">Member information:</strong> Until membership withdrawal</li>
                <li><strong className="text-foreground">Payment information:</strong> 5 years per E-commerce Act</li>
                <li><strong className="text-foreground">Access records:</strong> 3 months per Protection of Communications Secrets Act</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold">4. Third Party Provision</h2>
              <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                <p><strong className="text-foreground">Recipient:</strong> Paddle.com Market Limited</p>
                <p><strong className="text-foreground">Purpose:</strong> Payment processing and subscription management</p>
                <p><strong className="text-foreground">Items:</strong> Email, name, payment information</p>
                <p><strong className="text-foreground">Retention period:</strong> 5 years after transaction</p>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold">5. Personal Information Protection Officer</h2>
              <div className="bg-muted/50 p-4 rounded-lg space-y-1 text-sm text-muted-foreground">
                <p><strong className="text-foreground">Department:</strong> Service Operations Team</p>
                <p><strong className="text-foreground">Email:</strong> privacy@factor.io.kr</p>
              </div>
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

export default PrivacyPolicy;
