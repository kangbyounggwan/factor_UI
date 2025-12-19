/**
 * Paddle Pricing Page
 *
 * GPT, Gemini, Notion, Linear 스타일의 현대적인 가격 페이지
 * - 깔끔한 카드 기반 레이아웃
 * - 월간/연간 토글
 * - Paddle Overlay Checkout 연동
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@shared/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Check,
  X,
  Sparkles,
  Zap,
  Building2,
  ArrowRight,
  Loader2,
  Shield,
  CreditCard,
} from 'lucide-react';
import {
  initializePaddleService,
  openPaddleCheckout,
  getPaddlePriceId,
  formatUSD,
  PLAN_DISPLAY_PRICES,
  CheckoutEventData,
} from '@/lib/paddleService';
import { cn } from '@/lib/utils';

// 플랜 정의
interface PlanFeature {
  name: string;
  included: boolean;
  limit?: string;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  popular?: boolean;
  features: PlanFeature[];
  cta: string;
  icon: React.ReactNode;
}

const PaddlePricing = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isYearly, setIsYearly] = useState(true);
  const [isPaddleReady, setIsPaddleReady] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  // 플랜 정의
  const plans: Plan[] = [
    {
      id: 'free',
      name: t('pricing.plans.free.name', 'Free'),
      description: t('pricing.plans.free.description', 'For hobbyists and makers'),
      monthlyPrice: 0,
      yearlyPrice: 0,
      icon: <Sparkles className="h-5 w-5" />,
      cta: t('pricing.getStarted', 'Get Started'),
      features: [
        { name: t('pricing.features.printers', 'Printers'), included: true, limit: '1' },
        { name: t('pricing.features.realtimeMonitoring', 'Real-time monitoring'), included: true },
        { name: t('pricing.features.remoteControl', 'Remote control'), included: true },
        { name: t('pricing.features.pushNotifications', 'Push notifications'), included: true },
        { name: t('pricing.features.aiGeneration', 'AI Model Generation'), included: false },
        { name: t('pricing.features.analytics', 'Advanced analytics'), included: false },
        { name: t('pricing.features.apiAccess', 'API access'), included: false },
        { name: t('pricing.features.prioritySupport', 'Priority support'), included: false },
      ],
    },
    {
      id: 'pro',
      name: t('pricing.plans.pro.name', 'Pro'),
      description: t('pricing.plans.pro.description', 'For professionals and small teams'),
      monthlyPrice: PLAN_DISPLAY_PRICES.pro.monthly,
      yearlyPrice: PLAN_DISPLAY_PRICES.pro.yearly,
      popular: true,
      icon: <Zap className="h-5 w-5" />,
      cta: t('pricing.subscribe', 'Subscribe'),
      features: [
        { name: t('pricing.features.printers', 'Printers'), included: true, limit: '5' },
        { name: t('pricing.features.realtimeMonitoring', 'Real-time monitoring'), included: true },
        { name: t('pricing.features.remoteControl', 'Remote control'), included: true },
        { name: t('pricing.features.pushNotifications', 'Push notifications'), included: true },
        { name: t('pricing.features.aiGeneration', 'AI Model Generation'), included: true, limit: '50/mo' },
        { name: t('pricing.features.analytics', 'Advanced analytics'), included: true },
        { name: t('pricing.features.apiAccess', 'API access'), included: true },
        { name: t('pricing.features.prioritySupport', 'Priority support'), included: true },
      ],
    },
    {
      id: 'enterprise',
      name: t('pricing.plans.enterprise.name', 'Enterprise'),
      description: t('pricing.plans.enterprise.description', 'For large organizations'),
      monthlyPrice: -1,
      yearlyPrice: -1,
      icon: <Building2 className="h-5 w-5" />,
      cta: t('pricing.contactSales', 'Contact Sales'),
      features: [
        { name: t('pricing.features.printers', 'Printers'), included: true, limit: t('pricing.unlimited', 'Unlimited') },
        { name: t('pricing.features.realtimeMonitoring', 'Real-time monitoring'), included: true },
        { name: t('pricing.features.remoteControl', 'Remote control'), included: true },
        { name: t('pricing.features.pushNotifications', 'Push notifications'), included: true },
        { name: t('pricing.features.aiGeneration', 'AI Model Generation'), included: true, limit: t('pricing.unlimited', 'Unlimited') },
        { name: t('pricing.features.analytics', 'Advanced analytics'), included: true },
        { name: t('pricing.features.apiAccess', 'API access'), included: true },
        { name: t('pricing.features.dedicatedSupport', 'Dedicated support'), included: true },
        { name: t('pricing.features.sla', 'SLA guarantee'), included: true },
        { name: t('pricing.features.customIntegration', 'Custom integration'), included: true },
      ],
    },
  ];

  // Paddle 초기화
  useEffect(() => {
    const init = async () => {
      const paddle = await initializePaddleService({
        onCheckoutComplete: handleCheckoutComplete,
        onCheckoutClose: handleCheckoutClose,
        onCheckoutError: handleCheckoutError,
      });
      setIsPaddleReady(!!paddle);
    };

    init();
  }, []);

  // 체크아웃 완료 핸들러
  const handleCheckoutComplete = useCallback((data: CheckoutEventData) => {
    console.log('[PaddlePricing] Checkout completed:', data);
    toast({
      title: t('pricing.success.title', 'Subscription activated!'),
      description: t('pricing.success.description', 'Thank you for subscribing. Your plan is now active.'),
    });
    navigate('/payment/success?provider=paddle');
  }, [navigate, toast, t]);

  // 체크아웃 닫기 핸들러
  const handleCheckoutClose = useCallback(() => {
    console.log('[PaddlePricing] Checkout closed');
    setIsLoading(null);
  }, []);

  // 체크아웃 에러 핸들러
  const handleCheckoutError = useCallback((error: Error) => {
    console.error('[PaddlePricing] Checkout error:', error);
    toast({
      title: t('pricing.error.title', 'Payment failed'),
      description: t('pricing.error.description', 'Please try again or contact support.'),
      variant: 'destructive',
    });
    setIsLoading(null);
  }, [toast, t]);

  // 플랜 선택 핸들러
  const handleSelectPlan = async (plan: Plan) => {
    // Free 플랜: 회원가입/로그인으로 이동
    if (plan.id === 'free') {
      if (!user) {
        navigate('/auth');
      } else {
        navigate('/dashboard');
      }
      return;
    }

    // Enterprise: Contact Sales
    if (plan.id === 'enterprise') {
      window.location.href = 'mailto:sales@factor.io.kr?subject=Enterprise Plan Inquiry';
      return;
    }

    // Pro 플랜: Paddle Checkout
    if (!isPaddleReady) {
      toast({
        title: t('pricing.error.notReady', 'Payment system loading'),
        description: t('pricing.error.tryAgain', 'Please wait a moment and try again.'),
        variant: 'destructive',
      });
      return;
    }

    const priceId = getPaddlePriceId(plan.id, isYearly);

    if (!priceId) {
      toast({
        title: t('pricing.error.configError', 'Configuration error'),
        description: t('pricing.error.contactSupport', 'Please contact support.'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(plan.id);

    try {
      await openPaddleCheckout({
        priceId,
        customerEmail: user?.email,
        customData: user?.id ? { user_id: user.id } : undefined,
        locale: 'en', // TODO: 사용자 언어 설정 사용
        successUrl: `${window.location.origin}/payment/success?provider=paddle&plan=${plan.id}`,
      });
    } catch (error) {
      console.error('[PaddlePricing] Failed to open checkout:', error);
      toast({
        title: t('pricing.error.title', 'Payment failed'),
        description: t('pricing.error.description', 'Please try again or contact support.'),
        variant: 'destructive',
      });
      setIsLoading(null);
    }
  };

  // 가격 포맷팅
  const formatPrice = (price: number) => {
    if (price === 0) return t('pricing.free', 'Free');
    if (price === -1) return t('pricing.custom', 'Custom');
    return formatUSD(price);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />

        <div className="relative max-w-7xl mx-auto text-center">
          <Badge variant="secondary" className="mb-4">
            {t('pricing.badge', 'Simple, transparent pricing')}
          </Badge>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            {t('pricing.title', 'Choose your plan')}
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            {t('pricing.subtitle', 'Start free, upgrade when you need more power. All plans include core features.')}
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <span className={cn(
              "text-sm font-medium transition-colors",
              !isYearly ? "text-foreground" : "text-muted-foreground"
            )}>
              {t('pricing.monthly', 'Monthly')}
            </span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-primary"
            />
            <span className={cn(
              "text-sm font-medium transition-colors",
              isYearly ? "text-foreground" : "text-muted-foreground"
            )}>
              {t('pricing.yearly', 'Yearly')}
            </span>
            {isYearly && (
              <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                {t('pricing.savePercent', 'Save ~17%')}
              </Badge>
            )}
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="px-4 sm:px-6 lg:px-8 pb-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {plans.map((plan) => {
              const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
              const isPopular = plan.popular;
              const isEnterprise = plan.id === 'enterprise';

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-2xl border bg-card p-6 lg:p-8 transition-all duration-200",
                    isPopular && "border-primary shadow-lg shadow-primary/10 scale-[1.02] lg:scale-105",
                    !isPopular && "hover:border-primary/50 hover:shadow-md"
                  )}
                >
                  {/* Popular Badge */}
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground px-3 py-1">
                        {t('pricing.popular', 'Most Popular')}
                      </Badge>
                    </div>
                  )}

                  {/* Plan Header */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn(
                        "p-2 rounded-lg",
                        isPopular ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {plan.icon}
                      </div>
                      <h3 className="text-xl font-semibold">{plan.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      {!isEnterprise ? (
                        <>
                          <span className="text-4xl font-bold">{formatPrice(price)}</span>
                          {price > 0 && (
                            <span className="text-muted-foreground">
                              /{isYearly ? t('pricing.year', 'year') : t('pricing.month', 'month')}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-3xl font-bold">{t('pricing.custom', 'Custom')}</span>
                      )}
                    </div>
                    {isYearly && price > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatUSD(price / 12)}/{t('pricing.month', 'month')} {t('pricing.billedAnnually', 'billed annually')}
                      </p>
                    )}
                  </div>

                  {/* CTA Button */}
                  <Button
                    className={cn(
                      "w-full mb-6",
                      isPopular ? "bg-primary hover:bg-primary/90" : ""
                    )}
                    variant={isPopular ? "default" : "outline"}
                    size="lg"
                    onClick={() => handleSelectPlan(plan)}
                    disabled={isLoading === plan.id}
                  >
                    {isLoading === plan.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('pricing.processing', 'Processing...')}
                      </>
                    ) : (
                      <>
                        {plan.cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  {/* Features */}
                  <div className="flex-1">
                    <h4 className="text-sm font-medium mb-4">
                      {t('pricing.whatsIncluded', "What's included")}
                    </h4>
                    <ul className="space-y-3">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-3">
                          {feature.included ? (
                            <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground/40 flex-shrink-0" />
                          )}
                          <span className={cn(
                            "text-sm",
                            feature.included ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {feature.name}
                            {feature.limit && feature.included && (
                              <span className="text-muted-foreground ml-1">({feature.limit})</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="px-4 sm:px-6 lg:px-8 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="bg-muted/50 rounded-2xl p-8 text-center">
            <div className="flex items-center justify-center gap-6 flex-wrap mb-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>{t('pricing.trust.secure', 'Secure payment')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                <span>{t('pricing.trust.cards', 'All major cards accepted')}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('pricing.trust.paddleMerchant', 'Payments are processed by Paddle, our Merchant of Record.')}
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-4 sm:px-6 lg:px-8 pb-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">
            {t('pricing.faq.title', 'Frequently asked questions')}
          </h2>

          <div className="space-y-6">
            <div className="border-b pb-6">
              <h3 className="font-medium mb-2">{t('pricing.faq.q1', 'Can I switch plans anytime?')}</h3>
              <p className="text-muted-foreground text-sm">
                {t('pricing.faq.a1', 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.')}
              </p>
            </div>

            <div className="border-b pb-6">
              <h3 className="font-medium mb-2">{t('pricing.faq.q2', 'What payment methods do you accept?')}</h3>
              <p className="text-muted-foreground text-sm">
                {t('pricing.faq.a2', 'We accept all major credit cards, PayPal, Apple Pay, and Google Pay through our payment partner Paddle.')}
              </p>
            </div>

            <div className="border-b pb-6">
              <h3 className="font-medium mb-2">{t('pricing.faq.q3', 'Is there a free trial?')}</h3>
              <p className="text-muted-foreground text-sm">
                {t('pricing.faq.a3', 'The Free plan is available forever with limited features. Try it out before upgrading to Pro.')}
              </p>
            </div>

            <div className="border-b pb-6">
              <h3 className="font-medium mb-2">{t('pricing.faq.q4', 'How do I cancel my subscription?')}</h3>
              <p className="text-muted-foreground text-sm">
                {t('pricing.faq.a4', 'You can cancel anytime from your account settings. Your access continues until the end of your billing period.')}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PaddlePricing;
