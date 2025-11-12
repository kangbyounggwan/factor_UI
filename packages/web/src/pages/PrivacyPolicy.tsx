import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PrivacyPolicy = () => {
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
          <h1 className="text-4xl font-bold mb-4">{t('legal.privacyPolicy.title')}</h1>
          <p className="text-muted-foreground">
            {t('legal.effectiveDate')}: {isKorean ? '2025년 11월 10일' : 'November 10, 2025'} | {t('legal.privacyPolicy.subtitle')}
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">{isKorean ? (
          <>
          {/* 1. 개인정보의 수집 및 이용 목적 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">1. 개인정보의 수집 및 이용 목적</h2>
            <p className="text-muted-foreground leading-relaxed">
              FACTOR는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li><strong className="text-foreground">회원가입 및 관리:</strong> 회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증, 회원자격 유지·관리, 서비스 부정이용 방지, 각종 고지·통지</li>
              <li><strong className="text-foreground">서비스 제공:</strong> 3D 프린터 관리 서비스 제공, 콘텐츠 제공, 맞춤형 서비스 제공, 본인인증</li>
              <li><strong className="text-foreground">결제 및 정산:</strong> 유료 서비스 이용에 따른 요금 결제 및 정산</li>
              <li><strong className="text-foreground">마케팅 및 광고:</strong> 이벤트 및 광고성 정보 제공 및 참여기회 제공 (선택 동의)</li>
            </ul>
          </section>

          {/* 2. 수집하는 개인정보 항목 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">2. 수집하는 개인정보 항목</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">필수 항목</h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
                  <li>회원가입 시: 이메일 주소, 비밀번호, 이름</li>
                  <li>결제 시: 결제 정보 (카드번호는 결제대행사에서 암호화 처리)</li>
                  <li>서비스 이용 시: 프린터 정보, 출력 기록, 서비스 이용 기록, 접속 로그, 쿠키, 접속 IP 정보</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">선택 항목</h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
                  <li>프로필 사진</li>
                  <li>전화번호</li>
                  <li>회사명</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 3. 개인정보의 처리 및 보유기간 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">3. 개인정보의 처리 및 보유기간</h2>
            <p className="text-muted-foreground leading-relaxed">
              회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li><strong className="text-foreground">회원정보:</strong> 회원 탈퇴 시까지 (단, 관계 법령 위반에 따른 수사·조사 등이 진행 중인 경우에는 해당 수사·조사 종료 시까지)</li>
              <li><strong className="text-foreground">결제 정보:</strong> 전자상거래 등에서의 소비자보호에 관한 법률에 따라 5년간 보관</li>
              <li><strong className="text-foreground">접속 기록:</strong> 통신비밀보호법에 따라 3개월간 보관</li>
            </ul>
          </section>

          {/* 4. 개인정보의 제3자 제공 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">4. 개인정보의 제3자 제공</h2>
            <p className="text-muted-foreground leading-relaxed">
              회사는 정보주체의 개인정보를 제1조(개인정보의 처리 목적)에서 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 개인정보 보호법 제17조 및 제18조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.
            </p>
            <div className="bg-muted p-6 rounded-lg space-y-4">
              <div>
                <p><strong className="text-foreground">제공받는 자:</strong> Paddle.com Market Limited (결제대행사)</p>
                <p><strong className="text-foreground">제공 목적:</strong> 결제 처리 및 정산, 구독 관리</p>
                <p><strong className="text-foreground">제공 항목:</strong> 이메일, 이름, 결제 정보</p>
                <p><strong className="text-foreground">보유 기간:</strong> 거래 종료 후 5년</p>
                <p className="text-sm text-muted-foreground mt-2">
                  * Paddle은 글로벌 결제 대행 서비스로, GDPR 및 PCI DSS 인증을 받았으며 안전하게 결제 정보를 처리합니다.
                  자세한 내용은 <a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Paddle 개인정보 처리방침</a>을 참조하시기 바랍니다.
                </p>
              </div>
            </div>
          </section>

          {/* 5. 개인정보처리의 위탁 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">5. 개인정보처리의 위탁</h2>
            <p className="text-muted-foreground leading-relaxed">
              회사는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.
            </p>
            <div className="bg-muted p-6 rounded-lg space-y-3">
              <div>
                <p><strong className="text-foreground">수탁업체:</strong> Supabase (데이터베이스 호스팅)</p>
                <p><strong className="text-foreground">위탁 업무:</strong> 회원정보 및 서비스 데이터 보관</p>
              </div>
            </div>
          </section>

          {/* 6. 정보주체의 권리·의무 및 행사방법 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">6. 정보주체의 권리·의무 및 행사방법</h2>
            <p className="text-muted-foreground leading-relaxed">
              정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>개인정보 열람 요구</li>
              <li>오류 등이 있을 경우 정정 요구</li>
              <li>삭제 요구</li>
              <li>처리정지 요구</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              권리 행사는 회사에 대해 서면, 전화, 전자우편 등을 통하여 하실 수 있으며 회사는 이에 대해 지체없이 조치하겠습니다.
            </p>
          </section>

          {/* 7. 개인정보의 파기 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">7. 개인정보의 파기</h2>
            <p className="text-muted-foreground leading-relaxed">
              회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li><strong className="text-foreground">파기절차:</strong> 불필요하게 된 개인정보는 별도의 DB로 옮겨져 내부 방침 및 기타 관련 법령에 따라 일정 기간 저장된 후 파기됩니다.</li>
              <li><strong className="text-foreground">파기방법:</strong> 전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용합니다. 종이에 출력된 개인정보는 분쇄기로 분쇄하거나 소각을 통하여 파기합니다.</li>
            </ul>
          </section>

          {/* 8. 개인정보의 안전성 확보조치 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">8. 개인정보의 안전성 확보조치</h2>
            <p className="text-muted-foreground leading-relaxed">
              회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>개인정보 취급 직원의 최소화 및 교육</li>
              <li>개인정보의 암호화</li>
              <li>해킹 등에 대비한 기술적 대책</li>
              <li>개인정보에 대한 접근 제한</li>
              <li>접속기록의 보관 및 위변조 방지</li>
            </ul>
          </section>

          {/* 9. 개인정보 자동 수집 장치의 설치·운영 및 거부 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">9. 쿠키(Cookie)의 설치·운영 및 거부</h2>
            <p className="text-muted-foreground leading-relaxed">
              회사는 이용자에게 개별적인 맞춤서비스를 제공하기 위해 이용정보를 저장하고 수시로 불러오는 '쿠키(cookie)'를 사용합니다.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li><strong className="text-foreground">쿠키의 사용 목적:</strong> 회원과 비회원의 접속 빈도나 방문 시간 등을 분석, 이용자의 취향과 관심분야를 파악 및 자취 추적, 각종 이벤트 참여 정도 및 방문 횟수 파악 등을 통한 타겟 마케팅 및 개인 맞춤 서비스 제공</li>
              <li><strong className="text-foreground">쿠키의 설치·운영 및 거부:</strong> 웹브라우저 상단의 도구 메뉴에서 쿠키 설정을 변경할 수 있습니다. 단, 쿠키 저장을 거부할 경우 맞춤형 서비스 이용에 어려움이 발생할 수 있습니다.</li>
            </ul>
          </section>

          {/* 10. 개인정보 보호책임자 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">10. 개인정보 보호책임자</h2>
            <p className="text-muted-foreground leading-relaxed">
              회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
            </p>
            <div className="bg-primary/10 border border-primary/20 p-6 rounded-lg space-y-3">
              <p>
                <strong>개인정보 보호책임자</strong>
              </p>
              <p>
                <strong>{t('legal.contact.email')}:</strong> factor@factor.io.kr
              </p>
              <p>
                <strong>{t('legal.contact.hours')}:</strong> {t('legal.contact.hoursValue')}
              </p>
              <p className="text-sm text-muted-foreground mt-3">
                정보주체는 회사의 서비스를 이용하시면서 발생한 모든 개인정보 보호 관련 문의, 불만처리, 피해구제 등에 관한 사항을 개인정보 보호책임자에게 문의하실 수 있습니다.
              </p>
            </div>
          </section>

          {/* 11. 권익침해 구제방법 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">11. 권익침해 구제방법</h2>
            <p className="text-muted-foreground leading-relaxed">
              정보주체는 개인정보침해로 인한 구제를 받기 위하여 개인정보분쟁조정위원회, 한국인터넷진흥원 개인정보침해신고센터 등에 분쟁해결이나 상담 등을 신청할 수 있습니다.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>개인정보분쟁조정위원회: 1833-6972 (www.kopico.go.kr)</li>
              <li>개인정보침해신고센터: (국번없이) 118 (privacy.kisa.or.kr)</li>
              <li>대검찰청: (국번없이) 1301 (www.spo.go.kr)</li>
              <li>경찰청: (국번없이) 182 (ecrm.cyber.go.kr)</li>
            </ul>
          </section>

          {/* 12. 개인정보 처리방침 변경 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">12. 개인정보 처리방침 변경</h2>
            <p className="text-muted-foreground leading-relaxed">
              이 개인정보 처리방침은 2025년 11월 10일부터 적용됩니다. 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
            </p>
          </section>

          {/* 공지 박스 */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-6 rounded-lg">
            <h3 className="font-semibold mb-3 text-lg">개인정보 보호에 대한 회사의 약속</h3>
            <p className="text-muted-foreground leading-relaxed">
              FACTOR는 고객님의 개인정보를 소중히 다루며, 관련 법령을 준수하고 있습니다.
              개인정보 보호와 관련하여 궁금하신 사항이 있으시면 언제든지 문의해 주시기 바랍니다.
            </p>
          </div>
          </>
        ) : (
          <>
          {/* 1. Purpose of Personal Information Collection and Use */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">1. Purpose of Personal Information Collection and Use</h2>
            <p className="text-muted-foreground leading-relaxed">
              FACTOR processes personal information for the following purposes. Personal information being processed will not be used for purposes other than the following, and if the purpose of use changes, necessary measures such as obtaining separate consent will be implemented.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li><strong className="text-foreground">Membership Registration and Management:</strong> Confirmation of intention to register, identification and authentication for member services, maintenance and management of membership, prevention of service misuse, various notices and notifications</li>
              <li><strong className="text-foreground">Service Provision:</strong> 3D printer management services, content provision, customized service provision, identity verification</li>
              <li><strong className="text-foreground">Payment and Settlement:</strong> Payment and settlement of fees for paid services</li>
              <li><strong className="text-foreground">Marketing and Advertising:</strong> Provision of events and advertising information and participation opportunities (optional consent)</li>
            </ul>
          </section>

          {/* 2. Personal Information Items Collected */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">2. Personal Information Items Collected</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Required Items</h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
                  <li>At registration: Email address, password, name</li>
                  <li>At payment: Payment information (card numbers are encrypted by payment processor)</li>
                  <li>During service use: Printer information, print history, service usage records, access logs, cookies, access IP information</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Optional Items</h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
                  <li>Profile picture</li>
                  <li>Phone number</li>
                  <li>Company name</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 3. Processing and Retention Period of Personal Information */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">3. Processing and Retention Period of Personal Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Company processes and retains personal information within the retention and use period of personal information according to laws or the retention and use period agreed upon when collecting personal information from the data subject.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li><strong className="text-foreground">Member Information:</strong> Until member withdrawal (however, if investigations related to violations of relevant laws are in progress, until the conclusion of such investigations)</li>
              <li><strong className="text-foreground">Payment Information:</strong> Retained for 5 years in accordance with the Consumer Protection Act in Electronic Commerce</li>
              <li><strong className="text-foreground">Access Records:</strong> Retained for 3 months in accordance with the Protection of Communications Secrets Act</li>
            </ul>
          </section>

          {/* 4. Provision of Personal Information to Third Parties */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">4. Provision of Personal Information to Third Parties</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Company processes personal information of data subjects only within the scope specified in Article 1 (Purpose of Processing Personal Information), and provides personal information to third parties only when applicable under Articles 17 and 18 of the Personal Information Protection Act, such as consent of the data subject or special provisions of law.
            </p>
            <div className="bg-muted p-6 rounded-lg space-y-4">
              <div>
                <p><strong className="text-foreground">Recipient:</strong> Paddle.com Market Limited (Payment Processor)</p>
                <p><strong className="text-foreground">Purpose of Provision:</strong> Payment processing and settlement, subscription management</p>
                <p><strong className="text-foreground">Items Provided:</strong> Email, name, payment information</p>
                <p><strong className="text-foreground">Retention Period:</strong> 5 years after transaction completion</p>
                <p className="text-sm text-muted-foreground mt-2">
                  * Paddle is a global payment processing service, certified with GDPR and PCI DSS, and securely processes payment information.
                  For more details, please refer to <a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Paddle's Privacy Policy</a>.
                </p>
              </div>
            </div>
          </section>

          {/* 5. Entrustment of Personal Information Processing */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">5. Entrustment of Personal Information Processing</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Company entrusts personal information processing tasks as follows for smooth personal information business processing.
            </p>
            <div className="bg-muted p-6 rounded-lg space-y-3">
              <div>
                <p><strong className="text-foreground">Entrusted Company:</strong> Supabase (Database Hosting)</p>
                <p><strong className="text-foreground">Entrusted Tasks:</strong> Storage of member information and service data</p>
              </div>
            </div>
          </section>

          {/* 6. Rights and Obligations of Data Subjects and How to Exercise Them */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">6. Rights and Obligations of Data Subjects and How to Exercise Them</h2>
            <p className="text-muted-foreground leading-relaxed">
              Data subjects may exercise the following personal information protection-related rights to the Company at any time.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>Request to access personal information</li>
              <li>Request for correction if there are errors</li>
              <li>Request for deletion</li>
              <li>Request to stop processing</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Rights may be exercised through written documents, telephone, email, etc., to the Company, and the Company will take action without delay.
            </p>
          </section>

          {/* 7. Destruction of Personal Information */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">7. Destruction of Personal Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Company destroys personal information without delay when it becomes unnecessary, such as when the retention period has expired or the processing purpose has been achieved.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li><strong className="text-foreground">Destruction Procedure:</strong> Unnecessary personal information is moved to a separate database and stored for a certain period according to internal policies and other relevant laws before destruction.</li>
              <li><strong className="text-foreground">Destruction Method:</strong> Electronic file information uses technical methods that cannot reproduce records. Personal information printed on paper is destroyed by shredding or incineration.</li>
            </ul>
          </section>

          {/* 8. Measures to Ensure Safety of Personal Information */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">8. Measures to Ensure Safety of Personal Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Company takes the following measures to ensure the safety of personal information.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>Minimization and training of personal information handling staff</li>
              <li>Encryption of personal information</li>
              <li>Technical measures against hacking</li>
              <li>Restriction of access to personal information</li>
              <li>Storage and prevention of forgery/alteration of access records</li>
            </ul>
          </section>

          {/* 9. Installation, Operation, and Rejection of Automatic Personal Information Collection Devices */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">9. Installation, Operation, and Rejection of Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Company uses 'cookies' that store and periodically retrieve usage information to provide customized services to users.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li><strong className="text-foreground">Purpose of Cookie Use:</strong> Analyzing members' and non-members' access frequency and visit times, identifying users' preferences and areas of interest and tracking their traces, identifying participation levels and visit counts for various events for target marketing and personalized service provision</li>
              <li><strong className="text-foreground">Installation, Operation, and Rejection of Cookies:</strong> You can change cookie settings in the Tools menu at the top of your web browser. However, refusing to store cookies may result in difficulties using customized services.</li>
            </ul>
          </section>

          {/* 10. Personal Information Protection Officer */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">10. Personal Information Protection Officer</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Company designates a Personal Information Protection Officer as follows to oversee matters related to personal information processing and to handle complaints and remedy damages related to personal information processing by data subjects.
            </p>
            <div className="bg-primary/10 border border-primary/20 p-6 rounded-lg space-y-3">
              <p>
                <strong>Personal Information Protection Officer</strong>
              </p>
              <p>
                <strong>{t('legal.contact.email')}:</strong> factor@factor.io.kr
              </p>
              <p>
                <strong>{t('legal.contact.hours')}:</strong> Weekdays 10:00 - 18:00 KST
              </p>
              <p className="text-sm text-muted-foreground mt-3">
                Data subjects may contact the Personal Information Protection Officer regarding all personal information protection-related inquiries, complaint handling, and damage relief that occur while using the Company's services.
              </p>
            </div>
          </section>

          {/* 11. Remedies for Rights Infringement */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">11. Remedies for Rights Infringement</h2>
            <p className="text-muted-foreground leading-relaxed">
              Data subjects may apply for dispute resolution or consultation with the Personal Information Dispute Mediation Committee, Korea Internet & Security Agency Personal Information Infringement Report Center, etc., to receive remedies for personal information infringement.
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>Personal Information Dispute Mediation Committee: 1833-6972 (www.kopico.go.kr)</li>
              <li>Personal Information Infringement Report Center: 118 (privacy.kisa.or.kr)</li>
              <li>Supreme Prosecutors' Office: 1301 (www.spo.go.kr)</li>
              <li>National Police Agency: 182 (ecrm.cyber.go.kr)</li>
            </ul>
          </section>

          {/* 12. Changes to Privacy Policy */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">12. Changes to Privacy Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              This Privacy Policy applies from November 10, 2025. If there are additions, deletions, or corrections to changes according to laws and policies, they will be announced through notices 7 days before the implementation of the changes.
            </p>
          </section>

          {/* Notice Box */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-6 rounded-lg">
            <h3 className="font-semibold mb-3 text-lg">Company's Commitment to Privacy Protection</h3>
            <p className="text-muted-foreground leading-relaxed">
              FACTOR values your personal information and complies with relevant laws.
              If you have any questions regarding privacy protection, please feel free to contact us at any time.
            </p>
          </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
