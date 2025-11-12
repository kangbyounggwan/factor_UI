import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const TermsOfService = () => {
  const { t, i18n } = useTranslation();
  const isKorean = i18n.language === 'ko';

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header with Back Button */}
        <div className="mb-8">
          <Link to="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ChevronLeft className="h-4 w-4 mr-2" />
              {t('common.backToHome')}
            </Button>
          </Link>
          <h1 className="text-4xl font-bold mb-4">{t('legal.termsOfService.title')}</h1>
          <p className="text-muted-foreground">
            {t('legal.effectiveDate')}: {isKorean ? '2025년 11월 10일' : 'November 10, 2025'} | {t('legal.termsOfService.subtitle')}
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">{isKorean ? (
          <>
          {/* 제1조 목적 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">제1조 (목적)</h2>
            <p className="text-muted-foreground leading-relaxed">
              본 약관은 FACTOR(이하 "회사"라 합니다)가 제공하는 3D 프린터 팜 관리 서비스(이하 "서비스"라 합니다)의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          {/* 제2조 정의 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">제2조 (정의)</h2>
            <p className="text-muted-foreground leading-relaxed">
              본 약관에서 사용하는 용어의 정의는 다음과 같습니다.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li><strong className="text-foreground">"서비스"</strong>란 회사가 제공하는 3D 프린터 원격 모니터링, 제어, 관리 및 관련 부가 서비스를 의미합니다.</li>
              <li><strong className="text-foreground">"이용자"</strong>란 본 약관에 따라 회사가 제공하는 서비스를 이용하는 회원 및 비회원을 말합니다.</li>
              <li><strong className="text-foreground">"회원"</strong>이란 회사와 서비스 이용계약을 체결하고 이용자 아이디(ID)를 부여받은 자를 말합니다.</li>
              <li><strong className="text-foreground">"아이디(ID)"</strong>란 회원의 식별과 서비스 이용을 위하여 회원이 설정하고 회사가 승인하는 이메일 주소를 말합니다.</li>
              <li><strong className="text-foreground">"비밀번호"</strong>란 회원의 동일성 확인과 회원정보의 보호를 위하여 회원이 설정하고 회사가 승인하는 문자와 숫자의 조합을 말합니다.</li>
            </ul>
          </section>

          {/* 제3조 약관의 효력 및 변경 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">제3조 (약관의 효력 및 변경)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>본 약관은 서비스를 이용하고자 하는 모든 이용자에 대하여 그 효력을 발생합니다.</li>
              <li>회사는 필요한 경우 관련 법령을 위배하지 않는 범위 내에서 본 약관을 변경할 수 있습니다.</li>
              <li>회사가 약관을 변경할 경우에는 적용일자 및 변경사유를 명시하여 현행약관과 함께 서비스 초기화면에 그 적용일자 7일 이전부터 적용일자 전일까지 공지합니다.</li>
              <li>이용자가 변경된 약관에 동의하지 않는 경우, 이용자는 서비스 이용을 중단하고 이용계약을 해지할 수 있습니다.</li>
            </ul>
          </section>

          {/* 제4조 회원가입 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">제4조 (회원가입)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>이용자는 회사가 정한 가입 양식에 따라 회원정보를 기입한 후 본 약관에 동의한다는 의사표시를 함으로써 회원가입을 신청합니다.</li>
              <li>회사는 제1항과 같이 회원으로 가입할 것을 신청한 이용자 중 다음 각 호에 해당하지 않는 한 회원으로 등록합니다.
                <ul className="list-circle list-inside ml-6 mt-2 space-y-1">
                  <li>등록 내용에 허위, 기재누락, 오기가 있는 경우</li>
                  <li>회원자격을 상실한 자가 재이용 신청을 하는 경우</li>
                  <li>기타 회원으로 등록하는 것이 회사의 기술상 현저히 지장이 있다고 판단되는 경우</li>
                </ul>
              </li>
              <li>회원가입계약의 성립시기는 회사의 승낙이 회원에게 도달한 시점으로 합니다.</li>
            </ul>
          </section>

          {/* 제5조 서비스의 제공 및 변경 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">제5조 (서비스의 제공 및 변경)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>회사는 다음과 같은 서비스를 제공합니다.
                <ul className="list-circle list-inside ml-6 mt-2 space-y-1">
                  <li>3D 프린터 원격 모니터링 및 제어</li>
                  <li>프린터 상태 실시간 확인</li>
                  <li>출력 작업 관리</li>
                  <li>프린터 팜 통합 관리</li>
                  <li>AI 기반 출력 최적화 (유료 플랜)</li>
                  <li>기타 회사가 추가 개발하거나 제휴계약 등을 통해 회원에게 제공하는 일체의 서비스</li>
                </ul>
              </li>
              <li>회사는 서비스의 내용을 변경할 경우 그 변경내용을 서비스 화면에 공지합니다.</li>
            </ul>
          </section>

          {/* 제6조 서비스의 중단 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">제6조 (서비스의 중단)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>회사는 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신의 두절 등의 사유가 발생한 경우에는 서비스의 제공을 일시적으로 중단할 수 있습니다.</li>
              <li>회사는 제1항의 사유로 서비스의 제공이 일시적으로 중단됨으로 인하여 이용자 또는 제3자가 입은 손해에 대하여 배상합니다. 단, 회사에 고의 또는 과실이 없는 경우에는 그러하지 아니합니다.</li>
              <li>사업종목의 전환, 사업의 포기, 업체간의 통합 등의 이유로 서비스를 제공할 수 없게 되는 경우에는 회사는 제8조에 정한 방법으로 이용자에게 통지하고 당초 회사에서 제시한 조건에 따라 소비자에게 보상합니다.</li>
            </ul>
          </section>

          {/* 제7조 회원탈퇴 및 자격 상실 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">제7조 (회원탈퇴 및 자격 상실)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>회원은 회사에 언제든지 탈퇴를 요청할 수 있으며 회사는 즉시 회원탈퇴를 처리합니다.</li>
              <li>회원이 다음 각 호의 사유에 해당하는 경우, 회사는 회원자격을 제한 및 정지시킬 수 있습니다.
                <ul className="list-circle list-inside ml-6 mt-2 space-y-1">
                  <li>가입 신청 시에 허위 내용을 등록한 경우</li>
                  <li>다른 사람의 서비스 이용을 방해하거나 그 정보를 도용하는 등 전자상거래 질서를 위협하는 경우</li>
                  <li>서비스를 이용하여 법령 또는 본 약관이 금지하거나 공서양속에 반하는 행위를 하는 경우</li>
                </ul>
              </li>
              <li>회사가 회원 자격을 제한·정지 시킨 후, 동일한 행위가 2회 이상 반복되거나 30일 이내에 그 사유가 시정되지 아니하는 경우 회사는 회원자격을 상실시킬 수 있습니다.</li>
            </ul>
          </section>

          {/* 제8조 회원에 대한 통지 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">제8조 (회원에 대한 통지)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>회사가 회원에 대한 통지를 하는 경우, 회원이 회사에 제출한 이메일 주소로 할 수 있습니다.</li>
              <li>회사는 불특정다수 회원에 대한 통지의 경우 1주일 이상 서비스 게시판에 게시함으로써 개별 통지에 갈음할 수 있습니다.</li>
            </ul>
          </section>

          {/* 제9조 유료 서비스 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">제9조 (유료 서비스)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>회사가 제공하는 서비스 중 일부는 유료로 제공되며, 이용자는 유료 서비스 이용 시 해당 요금을 지불해야 합니다.</li>
              <li>유료 서비스의 요금 및 결제 방법은 서비스 화면에 별도로 안내됩니다.</li>
              <li>유료 서비스는 월 단위 또는 연 단위 구독 방식으로 제공되며, 구독 기간 중 이용자는 약정된 서비스를 이용할 수 있습니다.</li>
              <li>결제는 신용카드, 계좌이체 등 회사가 정한 방법으로 이루어집니다.</li>
              <li>구독 해지 및 환불 정책은 별도의 환불 정책을 따릅니다.</li>
            </ul>
          </section>

          {/* 제10조 회원의 의무 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">제10조 (회원의 의무)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>회원은 다음 행위를 하여서는 안 됩니다.
                <ul className="list-circle list-inside ml-6 mt-2 space-y-1">
                  <li>신청 또는 변경 시 허위 내용의 등록</li>
                  <li>타인의 정보 도용</li>
                  <li>회사가 게시한 정보의 변경</li>
                  <li>회사가 정한 정보 이외의 정보(컴퓨터 프로그램 등) 등의 송신 또는 게시</li>
                  <li>회사와 기타 제3자의 저작권 등 지적재산권에 대한 침해</li>
                  <li>회사 및 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위</li>
                  <li>외설 또는 폭력적인 메시지, 화상, 음성, 기타 공서양속에 반하는 정보를 서비스에 공개 또는 게시하는 행위</li>
                </ul>
              </li>
            </ul>
          </section>

          {/* 제11조 저작권의 귀속 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">제11조 (저작권의 귀속)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>회사가 작성한 저작물에 대한 저작권 기타 지적재산권은 회사에 귀속합니다.</li>
              <li>이용자는 서비스를 이용함으로써 얻은 정보 중 회사에게 지적재산권이 귀속된 정보를 회사의 사전 승낙없이 복제, 송신, 출판, 배포, 방송 기타 방법에 의하여 영리목적으로 이용하거나 제3자에게 이용하게 하여서는 안됩니다.</li>
              <li>회원이 서비스 내에 게시한 게시물의 저작권은 해당 게시물의 저작자에게 귀속됩니다.</li>
            </ul>
          </section>

          {/* 제12조 분쟁해결 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">제12조 (분쟁해결)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>회사는 이용자가 제기하는 정당한 의견이나 불만을 반영하고 그 피해를 보상처리하기 위하여 피해보상처리기구를 설치·운영합니다.</li>
              <li>회사는 이용자로부터 제출되는 불만사항 및 의견은 우선적으로 그 사항을 처리합니다. 다만, 신속한 처리가 곤란한 경우에는 이용자에게 그 사유와 처리일정을 즉시 통보해 드립니다.</li>
            </ul>
          </section>

          {/* 제13조 재판권 및 준거법 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">제13조 (재판권 및 준거법)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>회사와 이용자 간에 발생한 서비스 이용에 관한 분쟁에 대하여는 대한민국 법을 적용합니다.</li>
              <li>회사와 이용자간에 발생한 분쟁에 관한 소송은 민사소송법상의 관할법원에 제소합니다.</li>
            </ul>
          </section>

          {/* 부칙 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">부칙</h2>
            <p className="text-muted-foreground leading-relaxed">
              본 약관은 2025년 11월 10일부터 시행합니다.
            </p>
          </section>

          {/* 문의 */}
          <div className="bg-primary/10 border border-primary/20 p-6 rounded-lg space-y-3">
            <h3 className="font-semibold text-lg">{t('legal.contact.title')}</h3>
            <p>
              <strong>{t('legal.contact.email')}:</strong> factor@factor.io.kr
            </p>
            <p>
              <strong>{t('legal.contact.hours')}:</strong> {t('legal.contact.hoursValue')}
            </p>
            <p className="text-sm text-muted-foreground mt-3">
              이용약관과 관련하여 궁금하신 사항이 있으시면 위 이메일로 문의해 주시기 바랍니다.
            </p>
          </div>

          {/* 공지 박스 */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-6 rounded-lg">
            <h3 className="font-semibold mb-3 text-lg">서비스 이용 시 유의사항</h3>
            <p className="text-muted-foreground leading-relaxed">
              본 약관은 FACTOR 서비스 이용에 필요한 기본적인 사항을 규정하고 있습니다.
              서비스를 이용하기 전에 반드시 약관을 숙지하시기 바라며, 약관에 동의하지 않는 경우 서비스 이용이 제한될 수 있습니다.
            </p>
          </div>
          </>
        ) : (
          <>
          {/* Article 1 Purpose */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">Article 1 (Purpose)</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms of Service are intended to stipulate the rights, obligations, and responsibilities between FACTOR (hereinafter referred to as "the Company") and users, as well as other necessary matters, in relation to the use of the 3D printer farm management service (hereinafter referred to as "the Service") provided by the Company.
            </p>
          </section>

          {/* Article 2 Definitions */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">Article 2 (Definitions)</h2>
            <p className="text-muted-foreground leading-relaxed">
              The definitions of terms used in these Terms are as follows.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li><strong className="text-foreground">"Service"</strong> means 3D printer remote monitoring, control, management, and related additional services provided by the Company.</li>
              <li><strong className="text-foreground">"User"</strong> refers to members and non-members who use the Service provided by the Company according to these Terms.</li>
              <li><strong className="text-foreground">"Member"</strong> refers to a person who has entered into a Service use agreement with the Company and has been granted a user ID.</li>
              <li><strong className="text-foreground">"ID"</strong> refers to the email address set by the member and approved by the Company for member identification and Service use.</li>
              <li><strong className="text-foreground">"Password"</strong> refers to a combination of letters and numbers set by the member and approved by the Company to confirm the member's identity and protect member information.</li>
            </ul>
          </section>

          {/* Article 3 Effect and Changes of Terms */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">Article 3 (Effect and Changes of Terms)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>These Terms shall take effect for all users who wish to use the Service.</li>
              <li>The Company may change these Terms within the scope that does not violate relevant laws if necessary.</li>
              <li>When the Company changes the Terms, it shall announce the effective date and reasons for the changes along with the current Terms on the initial screen of the Service from 7 days before the effective date until the day before the effective date.</li>
              <li>If a user does not agree to the changed Terms, the user may stop using the Service and terminate the use agreement.</li>
            </ul>
          </section>

          {/* Article 4 Membership Registration */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">Article 4 (Membership Registration)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>A user applies for membership registration by filling in member information according to the registration form set by the Company and expressing intention to agree to these Terms.</li>
              <li>The Company shall register as a member any user who has applied for membership registration as in Paragraph 1, unless any of the following applies:
                <ul className="list-circle list-inside ml-6 mt-2 space-y-1">
                  <li>If there is false information, omissions, or errors in the registration content</li>
                  <li>If a person who has lost membership qualification applies for re-use</li>
                  <li>If it is determined that registration as a member would cause significant technical difficulties for the Company</li>
                </ul>
              </li>
              <li>The time of establishment of the membership registration agreement shall be when the Company's approval reaches the member.</li>
            </ul>
          </section>

          {/* Article 5 Provision and Changes of Service */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">Article 5 (Provision and Changes of Service)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>The Company provides the following services:
                <ul className="list-circle list-inside ml-6 mt-2 space-y-1">
                  <li>3D printer remote monitoring and control</li>
                  <li>Real-time printer status checking</li>
                  <li>Print job management</li>
                  <li>Integrated printer farm management</li>
                  <li>AI-based print optimization (paid plans)</li>
                  <li>All other services that the Company additionally develops or provides to members through partnership agreements, etc.</li>
                </ul>
              </li>
              <li>When the Company changes the content of the Service, it shall announce the changes on the Service screen.</li>
            </ul>
          </section>

          {/* Article 6 Suspension of Service */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">Article 6 (Suspension of Service)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>The Company may temporarily suspend the provision of the Service in case of maintenance, replacement, failure of information and communication facilities such as computers, or interruption of communication.</li>
              <li>The Company shall compensate for damages suffered by users or third parties due to temporary suspension of the Service for the reasons in Paragraph 1. However, this shall not apply if the Company has no intention or negligence.</li>
              <li>If the Service cannot be provided due to reasons such as business conversion, abandonment of business, or integration between companies, the Company shall notify users in the manner specified in Article 8 and compensate consumers according to the conditions originally presented by the Company.</li>
            </ul>
          </section>

          {/* Article 7 Member Withdrawal and Loss of Qualification */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">Article 7 (Member Withdrawal and Loss of Qualification)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>A member may request withdrawal at any time from the Company, and the Company shall immediately process the member withdrawal.</li>
              <li>If a member falls under any of the following reasons, the Company may restrict and suspend membership:
                <ul className="list-circle list-inside ml-6 mt-2 space-y-1">
                  <li>If false content is registered at the time of application for registration</li>
                  <li>If interfering with other people's use of the Service or stealing their information, etc., threatening the order of e-commerce</li>
                  <li>If using the Service to engage in acts prohibited by laws or these Terms or contrary to public order and morals</li>
                </ul>
              </li>
              <li>After the Company restricts or suspends membership, if the same act is repeated more than twice or the reason is not corrected within 30 days, the Company may revoke the membership.</li>
            </ul>
          </section>

          {/* Article 8 Notification to Members */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">Article 8 (Notification to Members)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>When the Company notifies a member, it may do so to the email address submitted by the member to the Company.</li>
              <li>In the case of notification to an unspecified number of members, the Company may substitute individual notification by posting on the Service bulletin board for more than one week.</li>
            </ul>
          </section>

          {/* Article 9 Paid Services */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">Article 9 (Paid Services)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>Some of the services provided by the Company are provided for a fee, and users must pay the corresponding fee when using paid services.</li>
              <li>Fees and payment methods for paid services are separately announced on the Service screen.</li>
              <li>Paid services are provided on a monthly or annual subscription basis, and users can use the contracted services during the subscription period.</li>
              <li>Payment is made by credit card, bank transfer, or other methods determined by the Company.</li>
              <li>Subscription cancellation and refund policy follow a separate refund policy.</li>
            </ul>
          </section>

          {/* Article 10 Member Obligations */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">Article 10 (Member Obligations)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>Members shall not engage in the following acts:
                <ul className="list-circle list-inside ml-6 mt-2 space-y-1">
                  <li>Registration of false content during application or changes</li>
                  <li>Theft of others' information</li>
                  <li>Changing information posted by the Company</li>
                  <li>Transmission or posting of information other than information designated by the Company (such as computer programs)</li>
                  <li>Infringement of copyrights and other intellectual property rights of the Company and other third parties</li>
                  <li>Acts that damage the reputation of the Company and other third parties or interfere with their business</li>
                  <li>Acts of disclosing or posting obscene or violent messages, images, voices, or other information contrary to public order and morals on the Service</li>
                </ul>
              </li>
            </ul>
          </section>

          {/* Article 11 Attribution of Copyrights */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">Article 11 (Attribution of Copyrights)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>Copyrights and other intellectual property rights for works created by the Company belong to the Company.</li>
              <li>Users shall not use information among information obtained through the use of the Service to which intellectual property rights belong to the Company for commercial purposes by reproduction, transmission, publication, distribution, broadcasting, or other methods without the Company's prior consent, or allow third parties to use it.</li>
              <li>Copyrights for posts posted by members within the Service belong to the author of the posts.</li>
            </ul>
          </section>

          {/* Article 12 Dispute Resolution */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">Article 12 (Dispute Resolution)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>The Company establishes and operates a damage compensation processing organization to reflect legitimate opinions or complaints raised by users and to compensate for damages.</li>
              <li>The Company shall prioritize processing complaints and opinions submitted by users. However, if prompt processing is difficult, the Company shall immediately notify the user of the reason and processing schedule.</li>
            </ul>
          </section>

          {/* Article 13 Jurisdiction and Governing Law */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">Article 13 (Jurisdiction and Governing Law)</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>Korean law shall apply to disputes arising between the Company and users regarding the use of the Service.</li>
              <li>Lawsuits concerning disputes arising between the Company and users shall be filed with the competent court under the Civil Procedure Act.</li>
            </ul>
          </section>

          {/* Addendum */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">Addendum</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be effective from November 10, 2025.
            </p>
          </section>

          {/* Contact */}
          <div className="bg-primary/10 border border-primary/20 p-6 rounded-lg space-y-3">
            <h3 className="font-semibold text-lg">{t('legal.contact.title')}</h3>
            <p>
              <strong>{t('legal.contact.email')}:</strong> factor@factor.io.kr
            </p>
            <p>
              <strong>{t('legal.contact.hours')}:</strong> Weekdays 10:00 - 18:00 KST
            </p>
            <p className="text-sm text-muted-foreground mt-3">
              If you have any questions regarding the Terms of Service, please contact us at the email above.
            </p>
          </div>

          {/* Notice Box */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-6 rounded-lg">
            <h3 className="font-semibold mb-3 text-lg">Important Notes for Service Use</h3>
            <p className="text-muted-foreground leading-relaxed">
              These Terms stipulate the basic matters necessary for using the FACTOR service.
              Please be sure to familiarize yourself with the Terms before using the Service, and if you do not agree to the Terms, your use of the Service may be restricted.
            </p>
          </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
