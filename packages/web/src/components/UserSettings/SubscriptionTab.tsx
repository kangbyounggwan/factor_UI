/**
 * SubscriptionTab - 구독 관리 탭
 */
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Crown, Check, CreditCard, ChevronLeft, ChevronRight } from "lucide-react";
import type { SubscriptionPlan } from "@shared/types/subscription";
import type { PaymentHistory } from "@shared/services/supabaseService/subscription";
import type { PaymentMethod } from "@shared/services/supabaseService/paymentMethod";

const ITEMS_PER_PAGE = 5;

export interface SubscriptionTabProps {
  user: { email?: string } | null;
  currentPlan: SubscriptionPlan;
  subscriptionData: {
    price: number;
    billingCycle: string;
    nextBillingDate: string | null;
  } | null;
  loadingPlan: boolean;
  setShowChangePlanModal: (show: boolean) => void;
  setShowRefundPolicyModal: (show: boolean) => void;
  setShowPaymentMethodModal: (show: boolean) => void;
  allPaymentHistory: PaymentHistory[];
  paymentMethods: PaymentMethod[];
  loadingPaymentData: boolean;
  paymentHistoryPage: number;
  setPaymentHistoryPage: (page: number | ((prev: number) => number)) => void;
}

// Plan Features Component
const PlanFeatures = ({ plan }: { plan: SubscriptionPlan }) => {
  const features = {
    free: [
      { text: "기본 AI 모델", highlight: false },
      { text: "60분 이상 감지 간격", highlight: false },
      { text: "최대 1대 프린터 연결", highlight: false },
      { text: "월 5개 3D 모델링", highlight: false },
      { text: "API 일부 제한", highlight: false },
    ],
    starter: [
      { text: "고급 AI 모델", highlight: true, color: "amber" },
      { text: "60분 이상 감지 간격", highlight: true, color: "amber" },
      { text: "최대 1대 프린터 연결", highlight: false },
      { text: "월 20개 3D 모델링", highlight: false },
      { text: "API 일부 제한", highlight: false },
    ],
    pro: [
      { text: "고급 AI 모델", highlight: true, color: "blue" },
      { text: "10분 이상 감지 간격", highlight: true, color: "blue" },
      { text: "최대 5대 프린터 연결", highlight: false },
      { text: "월 50개 3D 모델링", highlight: false },
      { text: "API 전체 접근", highlight: false },
    ],
    enterprise: [
      { text: "고급 AI 모델", highlight: true, color: "purple" },
      { text: "실시간 이상 감지", highlight: true, color: "purple" },
      { text: "무제한 프린터 연결", highlight: false },
      { text: "무제한 3D 모델링", highlight: false },
      { text: "API 전체 접근", highlight: false },
    ],
  };

  const planFeatures = features[plan] || features.free;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {planFeatures.map((feature, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <Check
            className={`h-4 w-4 shrink-0 ${
              feature.highlight
                ? feature.color === "amber"
                  ? "text-amber-500"
                  : feature.color === "blue"
                  ? "text-blue-500"
                  : feature.color === "purple"
                  ? "text-purple-500"
                  : "text-primary"
                : "text-primary"
            }`}
          />
          <span
            className={
              feature.highlight
                ? feature.color === "amber"
                  ? "font-medium text-amber-700 dark:text-amber-400"
                  : feature.color === "blue"
                  ? "font-medium text-blue-700 dark:text-blue-400"
                  : feature.color === "purple"
                  ? "font-medium text-purple-700 dark:text-purple-400"
                  : ""
                : ""
            }
          >
            {feature.text}
          </span>
        </div>
      ))}
    </div>
  );
};

export const SubscriptionTab = ({
  user,
  currentPlan,
  subscriptionData,
  loadingPlan,
  setShowChangePlanModal,
  setShowRefundPolicyModal,
  setShowPaymentMethodModal,
  allPaymentHistory,
  paymentMethods,
  loadingPaymentData,
  paymentHistoryPage,
  setPaymentHistoryPage,
}: SubscriptionTabProps) => {
  const { t } = useTranslation();

  // Paginated payment history
  const paginatedPaymentHistory = allPaymentHistory.slice(
    (paymentHistoryPage - 1) * ITEMS_PER_PAGE,
    paymentHistoryPage * ITEMS_PER_PAGE
  );

  if (loadingPlan) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-sm text-muted-foreground">
            {t("userSettings.loadingSubscription")}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Current Plan Section */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">
            {t("userSettings.currentPlan")}
          </h2>
          <p className="text-muted-foreground">
            {t("userSettings.subscriptionDescription")}
          </p>
        </div>

        <Card className="overflow-hidden border-2">
          <CardContent className="p-0">
            <div className="p-8 bg-gradient-to-br from-primary/5 to-primary/10">
              <div className="flex items-center justify-between mb-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Badge className="text-base px-4 py-1.5 capitalize bg-primary hover:bg-primary">
                      <Crown className="h-4 w-4 mr-2" />
                      {currentPlan} {t("userSettings.plan")}
                    </Badge>
                  </div>
                  {subscriptionData && subscriptionData.price > 0 ? (
                    <>
                      <p className="text-3xl font-bold">
                        ₩{subscriptionData.price.toLocaleString()}
                        <span className="text-base font-normal text-muted-foreground ml-2">
                          /{" "}
                          {subscriptionData.billingCycle === "year"
                            ? t("userSettings.perYear")
                            : t("userSettings.perMonth")}
                        </span>
                      </p>
                      {subscriptionData.nextBillingDate && (
                        <p className="text-sm text-muted-foreground">
                          {t("userSettings.nextBillingDate")}:{" "}
                          {new Date(
                            subscriptionData.nextBillingDate
                          ).toLocaleDateString("ko-KR")}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-3xl font-bold">
                      ₩0
                      <span className="text-base font-normal text-muted-foreground ml-2">
                        / 월
                      </span>
                    </p>
                  )}
                </div>
                <Button
                  size="lg"
                  onClick={() => setShowChangePlanModal(true)}
                  className="h-11"
                >
                  {currentPlan === "free"
                    ? t("userSettings.upgradePlan")
                    : t("subscription.viewAllPlans")}
                </Button>
              </div>

              {/* Plan Features */}
              <div className="border-t pt-6">
                <h4 className="font-semibold mb-4 text-sm text-muted-foreground">
                  플랜 포함 사항
                </h4>
                <PlanFeatures plan={currentPlan} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Refund Policy Link */}
        <div className="flex justify-center">
          <Button
            variant="link"
            className="text-sm text-muted-foreground"
            onClick={() => setShowRefundPolicyModal(true)}
          >
            {t("userSettings.refundPolicyButton")}
          </Button>
        </div>
      </div>

      {/* Billing Management Section */}
      {subscriptionData && (
        <>
          {/* Past Invoices */}
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold tracking-tight">
                {t("userSettings.billingHistory")}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t("userSettings.billingHistoryDesc")}
              </p>
            </div>

            <Card>
              <CardContent className="p-0">
                {loadingPaymentData ? (
                  <div className="p-8 text-center text-muted-foreground">
                    {t("userSettings.loadingPaymentData")}
                  </div>
                ) : allPaymentHistory.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    {t("userSettings.noPaymentHistory")}
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left p-4 font-medium text-sm">
                              {t("userSettings.date")}
                            </th>
                            <th className="text-left p-4 font-medium text-sm">
                              {t("userSettings.amount")}
                            </th>
                            <th className="text-left p-4 font-medium text-sm">
                              {t("userSettings.invoiceNumber")}
                            </th>
                            <th className="text-left p-4 font-medium text-sm">
                              {t("userSettings.status")}
                            </th>
                            <th className="text-right p-4 font-medium text-sm"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedPaymentHistory.map((payment) => (
                            <tr
                              key={payment.id}
                              className="border-b hover:bg-muted/30"
                            >
                              <td className="p-4 text-sm">
                                {new Date(
                                  payment.paid_at || payment.created_at
                                ).toLocaleDateString("ko-KR", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </td>
                              <td className="p-4 text-sm">
                                ₩{payment.amount.toLocaleString()}
                              </td>
                              <td className="p-4 text-sm font-mono">
                                {payment.order_id ||
                                  payment.id.slice(0, 8).toUpperCase()}
                              </td>
                              <td className="p-4">
                                <Badge
                                  variant={
                                    payment.status === "success"
                                      ? "default"
                                      : payment.status === "pending"
                                      ? "secondary"
                                      : payment.status === "failed"
                                      ? "destructive"
                                      : payment.status === "refunded"
                                      ? "outline"
                                      : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {payment.status === "success"
                                    ? "완료"
                                    : payment.status === "pending"
                                    ? "대기중"
                                    : payment.status === "failed"
                                    ? "실패"
                                    : payment.status === "refunded"
                                    ? "환불"
                                    : payment.status === "canceled"
                                    ? "취소"
                                    : payment.status}
                                </Badge>
                              </td>
                              <td className="p-4 text-right">
                                {payment.receipt_url && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      window.open(payment.receipt_url!, "_blank")
                                    }
                                  >
                                    영수증
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-4 border-t">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Showing{" "}
                          {(paymentHistoryPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                          {Math.min(
                            paymentHistoryPage * ITEMS_PER_PAGE,
                            allPaymentHistory.length
                          )}{" "}
                          out of {allPaymentHistory.length} invoices
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              setPaymentHistoryPage((prev: number) =>
                                Math.max(1, prev - 1)
                              )
                            }
                            disabled={paymentHistoryPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              setPaymentHistoryPage((prev: number) => prev + 1)
                            }
                            disabled={
                              paymentHistoryPage * ITEMS_PER_PAGE >=
                              allPaymentHistory.length
                            }
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Methods */}
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold tracking-tight">
                {t("userSettings.paymentMethods")}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t("userSettings.paymentMethodsDesc")}
              </p>
            </div>

            <Card>
              <CardContent className="p-6">
                {loadingPaymentData ? (
                  <div className="p-8 text-center text-muted-foreground">
                    {t("userSettings.loadingPaymentMethods")}
                  </div>
                ) : paymentMethods.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-muted-foreground mb-4">
                      {t("userSettings.noPaymentMethods")}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setShowPaymentMethodModal(true)}
                    >
                      {t("userSettings.addPaymentMethod")}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {paymentMethods.map((method) => (
                        <div
                          key={method.id}
                          className="flex items-center justify-between p-4 rounded-lg border"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
                              <CreditCard className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <p className="font-medium">{method.card_number}</p>
                              <p className="text-sm text-muted-foreground">
                                {method.card_company &&
                                  `${method.card_company} · `}
                                만료: {method.card_expiry}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {method.is_default && (
                              <Badge className="bg-green-500 hover:bg-green-500">
                                기본
                              </Badge>
                            )}
                            <Button variant="ghost" size="icon">
                              <span className="text-xl">⋯</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      className="w-full mt-4"
                      onClick={() => setShowPaymentMethodModal(true)}
                    >
                      + 새 카드 추가
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Credit Balance */}
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold tracking-tight">
                {t("userSettings.creditBalance")}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t("userSettings.creditBalanceDesc")}
              </p>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">잔액</p>
                    <p className="text-3xl font-bold">₩0.00</p>
                  </div>
                  <Button variant="outline">충전하기</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Email Recipient */}
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold tracking-tight">
                이메일 수신자
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                모든 청구 관련 안내는 이 이메일로 발송됩니다.
              </p>
            </div>

            <Card>
              <CardContent className="p-6 space-y-4">
                <div>
                  <Label htmlFor="email">이메일 주소</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="additional-emails">추가 이메일</Label>
                  <Input
                    id="additional-emails"
                    type="email"
                    placeholder="추가 수신자 입력"
                    className="mt-2"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="outline">취소</Button>
                  <Button>저장</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default SubscriptionTab;
