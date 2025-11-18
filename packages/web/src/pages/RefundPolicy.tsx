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
            <h2 className="text-2xl font-semibold">2. 14일 취소권 (Paddle Buyer Terms)</h2>
            <div className="space-y-3">
              <p className="text-muted-foreground leading-relaxed">
                결제 후 <strong className="text-foreground">14일 이내</strong> 계약 취소 및 환불을 요청할 수 있습니다.
              </p>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                <p className="text-sm font-semibold mb-2">디지털 콘텐츠 제공 시작 시 취소권 제한</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>AI 모델 생성, 다운로드, 프리미엄 기능 사용 등 디지털 콘텐츠 제공이 시작되면 14일 취소권이 소멸됩니다</li>
                  <li>구독 활성화 시점부터 서비스가 즉시 제공되므로, 실질적 사용 후에는 법적 취소권이 적용되지 않습니다</li>
                </ul>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-semibold mb-2">환불 가능 케이스</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li><strong>미사용 시:</strong> 14일 이내 + 서비스를 전혀 사용하지 않은 경우 전액 환불</li>
                  <li><strong>기술적 문제:</strong> 서비스 장애, 중대한 품질 문제가 있는 경우 개별 검토 후 환불</li>
                  <li><strong>과금 오류:</strong> 중복 결제, 시스템 오류로 인한 잘못된 청구는 전액 환불</li>
                  <li><strong>재량적 환불:</strong> 기타 특별한 사유는 Paddle 및 운영자 재량으로 개별 검토</li>
                </ul>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 rounded-lg mt-3">
                <p className="text-sm">
                  <strong>Paddle Buyer Terms 준수:</strong> 본 환불 정책은 Paddle의 구매자 약관에 따라 구매 후 14일 이내 계약 취소 권리를 보장하되,
                  디지털 콘텐츠 특성상 제공 시작 후에는 취소권이 제한됨을 명시합니다.
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

          {/* 4. 구독 해지 */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">4. 구독 해지 정책</h2>
            <div className="space-y-3">
              <p className="text-muted-foreground leading-relaxed">
                구독은 언제든 해지할 수 있으며, 해지 시점에 따라 다음과 같이 처리됩니다:
              </p>

              <div className="bg-muted p-4 rounded-lg space-y-3">
                <div>
                  <p className="font-semibold text-sm mb-1">다음 결제일 48시간 전까지 해지</p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground ml-2">
                    <li>다음 결제 주기부터 자동 갱신이 중단됩니다</li>
                    <li>현재 결제 주기 종료일까지 서비스를 계속 이용할 수 있습니다</li>
                    <li>이미 납부된 기간에 대한 환불은 없습니다</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-sm mb-1">기간 중 중도 해지</p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground ml-2">
                    <li>원칙적으로 이미 납부된 구독료는 환불되지 않습니다</li>
                    <li>특별한 사유(서비스 장애, 품질 문제 등)가 있는 경우 개별 검토 후 재량적으로 환불 가능</li>
                    <li>환불 승인 시 미사용 기간을 일할 계산하여 영업일 5~10일 내 처리</li>
                  </ul>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
                <p className="text-sm">
                  <strong>중요:</strong> 사기 또는 남용이 의심되는 경우 환불이 거절될 수 있으며, 계정 제한 조치가 취해질 수 있습니다.
                </p>
              </div>
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
            <ul className="space-y-2 text-muted-foreground">
              <li><strong>✅ 14일 취소권:</strong> 미사용 시 14일 이내 전액 환불, 사용 시작 후에는 취소권 소멸</li>
              <li><strong>🔄 구독 해지:</strong> 다음 결제일 48시간 전 해지 시 자동 갱신 중단, 기납부 기간은 환불 없음</li>
              <li><strong>🛠️ 재량적 환불:</strong> 서비스 장애, 과금 오류 등 특별한 사유는 개별 검토 후 환불 가능</li>
              <li><strong>📧 문의:</strong> factor@factor.io.kr (영업일 5~10일 내 처리)</li>
            </ul>
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

              {/* 2. 14-Day Right of Cancellation */}
              <section className="space-y-3">
                <h2 className="text-2xl font-semibold">2. 14-Day Right of Cancellation (Paddle Buyer Terms)</h2>
                <div className="space-y-3">
                  <p className="text-muted-foreground leading-relaxed">
                    You may cancel your agreement and request a refund within <strong className="text-foreground">14 days</strong> of purchase.
                  </p>

                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                    <p className="text-sm font-semibold mb-2">Cancellation Right Limitation for Digital Content</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      <li>The 14-day cancellation right expires once digital content delivery begins (AI model generation, downloads, premium feature usage, etc.)</li>
                      <li>Service is provided immediately upon subscription activation, so legal cancellation rights do not apply after actual usage</li>
                    </ul>
                  </div>

                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm font-semibold mb-2">Refund Eligible Cases</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      <li><strong>No Usage:</strong> Full refund if service was not used at all within 14 days</li>
                      <li><strong>Technical Issues:</strong> Service outages or critical quality problems reviewed individually</li>
                      <li><strong>Billing Errors:</strong> Duplicate charges or system errors refunded in full</li>
                      <li><strong>Discretionary Refunds:</strong> Other special circumstances reviewed by Paddle and operator discretion</li>
                    </ul>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 rounded-lg mt-3">
                    <p className="text-sm">
                      <strong>Paddle Buyer Terms Compliance:</strong> This refund policy guarantees the 14-day cancellation right per Paddle's Buyer Terms,
                      while noting that this right is limited after digital content delivery begins due to the nature of the service.
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

              {/* 4. Subscription Cancellation */}
              <section className="space-y-3">
                <h2 className="text-2xl font-semibold">4. Subscription Cancellation Policy</h2>
                <div className="space-y-3">
                  <p className="text-muted-foreground leading-relaxed">
                    Subscriptions can be cancelled anytime, processed as follows based on cancellation timing:
                  </p>

                  <div className="bg-muted p-4 rounded-lg space-y-3">
                    <div>
                      <p className="font-semibold text-sm mb-1">Cancellation 48 Hours Before Next Billing</p>
                      <ul className="list-disc list-inside text-sm text-muted-foreground ml-2">
                        <li>Auto-renewal will be stopped from the next billing cycle</li>
                        <li>Service continues until the end of current billing period</li>
                        <li>No refund for already paid period</li>
                      </ul>
                    </div>

                    <div>
                      <p className="font-semibold text-sm mb-1">Mid-term Cancellation</p>
                      <ul className="list-disc list-inside text-sm text-muted-foreground ml-2">
                        <li>Paid subscription fees are generally non-refundable</li>
                        <li>Special circumstances (service outages, quality issues) reviewed individually for discretionary refunds</li>
                        <li>If approved, unused period prorated and processed within 5-10 business days</li>
                      </ul>
                    </div>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
                    <p className="text-sm">
                      <strong>Important:</strong> Refunds may be denied and account restrictions applied if fraud or abuse is suspected.
                    </p>
                  </div>
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
                <ul className="space-y-2 text-muted-foreground">
                  <li><strong>✅ 14-Day Cancellation:</strong> Full refund if unused within 14 days, right expires after service use begins</li>
                  <li><strong>🔄 Subscription Cancellation:</strong> Cancel 48 hours before renewal to stop auto-renewal, no refund for paid period</li>
                  <li><strong>🛠️ Discretionary Refunds:</strong> Service outages, billing errors reviewed individually</li>
                  <li><strong>📧 Contact:</strong> factor@factor.io.kr (Processed within 5-10 business days)</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RefundPolicy;
