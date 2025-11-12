import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const RefundPolicy = () => {
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
          <h1 className="text-4xl font-bold mb-4">{t('legal.refundPolicy.title')}</h1>
          <p className="text-muted-foreground">
            {t('legal.effectiveDate')}: 2025년 11월 10일 | {t('legal.refundPolicy.subtitle')}
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
          {isKorean ? (
            // 한국어 버전
            <>
          {/* 1. 기본 원칙 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">1. 기본 원칙</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>구독은 월 단위 선결제이며, 결제 즉시 프리미엄 기능이 활성화됩니다.</li>
              <li>환불은 아래 기준에 따라 처리되며, 부분 사용분 공제 또는 일할 계산이 적용될 수 있습니다.</li>
              <li>자동 갱신 전 언제든 해지 가능하며, 해지 시 다음 결제부터 청구되지 않습니다.</li>
            </ul>
          </section>

          {/* 2. 결제 직후 철회 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">2. 결제 직후 철회(변심) - 쿨링오프</h2>
            <div className="space-y-3">
              <p className="text-muted-foreground leading-relaxed">
                결제 후 <strong className="text-foreground">7일 이내</strong>이고, 실질적 사용(대량 사용·다운로드·크레딧 소진 등)이 없을 경우 <strong className="text-foreground">전액 환불</strong>합니다.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                사용 이력이 일부라도 있는 경우, 일할 차감 또는 사용량 차감 후 환불합니다.
              </p>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm">
                  <strong>예시:</strong> 월 30일 기준 3일 사용 시 → 결제금액 × (30-3)/30 환불
                </p>
              </div>
            </div>
          </section>

          {/* 3. 무료 체험 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">3. 무료 체험(Trial)·프로모션</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>무료 체험 기간 중에는 언제든 해지 가능하며 청구·환불 없음</li>
              <li>체험 종료 후 유료 전환·청구가 발생한 뒤에는 본 정책 2)~10) 조항 적용</li>
            </ul>
          </section>

          {/* 4. 중도 해지 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">4. 중도 해지(월 구독 기간 내)</h2>
            <div className="space-y-3">
              <p className="text-muted-foreground leading-relaxed">
                해지 즉시 미사용 기간에 대해 일할 계산하여 <strong className="text-foreground">영업일 5~10일</strong> 내 결제 수단으로 환불합니다.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                해지 후에도 현재 결제 주기 종료일까지 서비스 이용 가능합니다.
              </p>
            </div>
          </section>

          {/* 5. 장애·품질 문제 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">5. 장애·품질 문제로 인한 환불</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>연속 12시간 이상 중대한 서비스 장애 발생 시, 고객 요청에 따라 장애시간 비례 금액을 크레딧/연장 또는 환불 중 선택 제공</li>
              <li>장애 통지 및 보상 요청은 발생일로부터 14일 이내 고객센터로 접수</li>
            </ul>
          </section>

          {/* 6. 과금 오류 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">6. 과금 오류·중복 결제</h2>
            <p className="text-muted-foreground leading-relaxed">
              중복 결제 또는 명백한 과금 오류 확인 시 전액 환불. 영수증/거래 내역 확인 후 영업일 5~10일 내 결제 수단으로 환불 처리.
            </p>
          </section>

          {/* 7. 결제 실패 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">7. 결제 실패·미수금</h2>
            <p className="text-muted-foreground leading-relaxed">
              결제 실패 시 3~7일 간 재시도하며, 실패 지속 시 자동 해지 또는 기능 제한이 적용됩니다.
              미수금 해소 시 서비스가 재개되며, 사용하지 못한 기간에 대한 자동 환불은 없습니다.
            </p>
          </section>

          {/* 8. 남용·사기 방지 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">8. 남용·사기 방지</h2>
            <p className="text-muted-foreground leading-relaxed">
              불법 사용, 환불 남용이 확인될 경우 환불 제한·계정 제한이 적용될 수 있습니다.
            </p>
          </section>

          {/* 9. 환불 절차 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">9. 환불 절차</h2>
            <div className="bg-muted p-6 rounded-lg space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <p><strong className="text-foreground">요청 경로:</strong> factor@factor.io.kr</p>
                <p><strong className="text-foreground">필수 정보:</strong> 결제 이메일/아이디, 결제일, 금액, 사유, 영수증</p>
                <p><strong className="text-foreground">처리 기한:</strong> 요청 수신 후 영업일 5~10일 내 승인/반려 안내</p>
                <p><strong className="text-foreground">표시 반영:</strong> 카드사 정책에 따라 실 반영까지 최대 14일 소요</p>
              </div>
            </div>
          </section>

          {/* 10. 세금·수수료 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">10. 세금·수수료</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
              <li>환불 시 결제 대행 수수료·환전 수수료 등이 발생하면, 법령 허용 범위 내에서 실비 공제가 적용될 수 있습니다</li>
              <li>국외 결제의 경우 환율 변동으로 환불 금액이 결제 금액과 다를 수 있습니다</li>
            </ul>
          </section>

          {/* 11. 정책 변경 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">11. 정책 변경</h2>
            <p className="text-muted-foreground leading-relaxed">
              본 정책은 사전 고지 후 변경될 수 있습니다. 중대한 변경 시 시행 7일 전 이메일/공지로 안내합니다.
            </p>
          </section>

          {/* 문의처 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">12. {t('legal.contact.title')}</h2>
            <div className="bg-primary/10 border border-primary/20 p-6 rounded-lg space-y-3">
              <p>
                <strong>{t('legal.contact.email')}:</strong> factor@factor.io.kr
              </p>
              <p>
                <strong>{t('legal.contact.hours')}:</strong> {t('legal.contact.hoursValue')}
              </p>
              <p className="text-sm text-muted-foreground mt-3">
                상세한 환불 정책 및 문의사항은 위 이메일로 연락 주시기 바랍니다.
              </p>
            </div>
          </section>

          {/* 요약 박스 */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-6 rounded-lg">
            <h3 className="font-semibold mb-3 text-lg">빠른 요약</h3>
            <p className="text-muted-foreground leading-relaxed">
              결제 후 7일 이내 미사용 시 전액 환불, 사용 시 일할 계산 환불. 중도 해지 시 미사용 기간 환불(영업일 5~10일).
              장애 12시간 이상 시 보상 제공. 중복 결제·오류는 전액 환불. 환불 요청은 factor@factor.io.kr로 문의 바랍니다.
            </p>
          </div>
            </>
          ) : (
            // 영어 버전
            <>
              {/* 1. Basic Principles */}
              <section className="space-y-3">
                <h2 className="text-2xl font-semibold">1. Basic Principles</h2>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
                  <li>Subscriptions are prepaid on a monthly basis, and premium features are activated immediately upon payment.</li>
                  <li>Refunds are processed according to the criteria below and may be subject to partial usage deductions or prorated calculations.</li>
                  <li>You can cancel at any time before auto-renewal, and you will not be charged from the next billing period.</li>
                </ul>
              </section>

              {/* 2. Cooling-off Period */}
              <section className="space-y-3">
                <h2 className="text-2xl font-semibold">2. Post-Payment Withdrawal (Cooling-off)</h2>
                <div className="space-y-3">
                  <p className="text-muted-foreground leading-relaxed">
                    Within <strong className="text-foreground">7 days</strong> of payment, if there is no substantial usage (heavy usage, downloads, credit consumption, etc.), a <strong className="text-foreground">full refund</strong> is provided.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    If there is partial usage, a refund will be provided after deducting prorated amounts or usage.
                  </p>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm">
                      <strong>Example:</strong> If you used 3 days out of a 30-day month → Refund = Payment amount × (30-3)/30
                    </p>
                  </div>
                </div>
              </section>

              {/* 3. Free Trial */}
              <section className="space-y-3">
                <h2 className="text-2xl font-semibold">3. Free Trial & Promotions</h2>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
                  <li>You can cancel anytime during the free trial period without any charges or refunds</li>
                  <li>After trial ends and paid billing begins, sections 2-10 of this policy apply</li>
                </ul>
              </section>

              {/* 4. Mid-term Cancellation */}
              <section className="space-y-3">
                <h2 className="text-2xl font-semibold">4. Mid-term Cancellation</h2>
                <div className="space-y-3">
                  <p className="text-muted-foreground leading-relaxed">
                    Upon cancellation, unused period will be prorated and refunded within <strong className="text-foreground">5-10 business days</strong> to your payment method.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    You can continue using the service until the end of the current billing cycle after cancellation.
                  </p>
                </div>
              </section>

              {/* 5. Service Issues */}
              <section className="space-y-3">
                <h2 className="text-2xl font-semibold">5. Service Outages & Quality Issues</h2>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
                  <li>For major service outages lasting 12+ hours consecutively, you may choose credit/extension or refund for the proportional amount</li>
                  <li>Outage notifications and compensation requests must be submitted within 14 days of occurrence</li>
                </ul>
              </section>

              {/* 6. Billing Errors */}
              <section className="space-y-3">
                <h2 className="text-2xl font-semibold">6. Billing Errors & Duplicate Charges</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Full refund for confirmed duplicate charges or billing errors. Processed within 5-10 business days after verification.
                </p>
              </section>

              {/* 7. Payment Failures */}
              <section className="space-y-3">
                <h2 className="text-2xl font-semibold">7. Payment Failures</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Payment will be retried for 3-7 days. Continued failure may result in automatic cancellation or feature restrictions.
                  No automatic refunds for periods when service was unavailable due to payment failure.
                </p>
              </section>

              {/* 8. Abuse Prevention */}
              <section className="space-y-3">
                <h2 className="text-2xl font-semibold">8. Abuse & Fraud Prevention</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Refund restrictions and account limitations may apply if illegal usage or refund abuse is detected.
                </p>
              </section>

              {/* 9. Refund Process */}
              <section className="space-y-3">
                <h2 className="text-2xl font-semibold">9. Refund Process</h2>
                <div className="bg-muted p-6 rounded-lg space-y-3">
                  <div className="grid grid-cols-1 gap-3">
                    <p><strong className="text-foreground">Contact:</strong> factor@factor.io.kr</p>
                    <p><strong className="text-foreground">Required Info:</strong> Payment email/ID, payment date, amount, reason, receipt</p>
                    <p><strong className="text-foreground">Processing Time:</strong> Approval/rejection within 5-10 business days</p>
                    <p><strong className="text-foreground">Reflection:</strong> Up to 14 days depending on card company policy</p>
                  </div>
                </div>
              </section>

              {/* 10. Taxes & Fees */}
              <section className="space-y-3">
                <h2 className="text-2xl font-semibold">10. Taxes & Fees</h2>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-4">
                  <li>Payment processing fees may be deducted from refunds within legal limits</li>
                  <li>For international payments, exchange rate fluctuations may affect refund amounts</li>
                </ul>
              </section>

              {/* 11. Policy Changes */}
              <section className="space-y-3">
                <h2 className="text-2xl font-semibold">11. Policy Changes</h2>
                <p className="text-muted-foreground leading-relaxed">
                  This policy may change with prior notice. Major changes will be announced 7 days before implementation.
                </p>
              </section>

              {/* Contact */}
              <section className="space-y-3">
                <h2 className="text-2xl font-semibold">12. {t('legal.contact.title')}</h2>
                <div className="bg-primary/10 border border-primary/20 p-6 rounded-lg space-y-3">
                  <p>
                    <strong>{t('legal.contact.email')}:</strong> factor@factor.io.kr
                  </p>
                  <p>
                    <strong>{t('legal.contact.hours')}:</strong> {t('legal.contact.hoursValue')}
                  </p>
                  <p className="text-sm text-muted-foreground mt-3">
                    For detailed refund policy inquiries, please contact us at the email above.
                  </p>
                </div>
              </section>

              {/* Summary */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-6 rounded-lg">
                <h3 className="font-semibold mb-3 text-lg">Quick Summary</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Full refund within 7 days if unused, prorated if used. Mid-term cancellation refunds unused period (5-10 business days).
                  Compensation for 12+ hour outages. Full refund for duplicate charges/errors. Contact factor@factor.io.kr for refund requests.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RefundPolicy;
