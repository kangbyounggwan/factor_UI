import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Monitor, Play, Bell, BarChart3, Settings, Zap, Shield, Smartphone, ShoppingCart, Code2, Wand2, Image, Box, Layers } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@shared/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";


const Home = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  // 해시 변경 시 스크롤 처리
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        // 약간의 지연을 두고 스크롤 (페이지 렌더링 완료 대기)
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    } else {
      // 해시가 없으면 페이지 최상단으로 스크롤
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.hash]);

  const features = [
    {
      icon: Monitor,
      title: t('home.realtimeMonitoring'),
      description: t('home.realtimeMonitoringDesc')
    },
    {
      icon: Play,
      title: t('home.remoteControl'),
      description: t('home.remoteControlDesc')
    },
    {
      icon: Bell,
      title: t('home.errorNotifications'),
      description: t('home.errorNotificationsDesc')
    }
  ];

  const aiFeatures = [
    {
      icon: Wand2,
      title: t('home.textTo3D'),
      description: t('home.textTo3DDesc')
    },
    {
      icon: Image,
      title: t('home.imageTo3D'),
      description: t('home.imageTo3DDesc')
    },
    {
      icon: Layers,
      title: t('home.textToImage'),
      description: t('home.textToImageDesc')
    },
    {
      icon: Box,
      title: t('home.smartGcode'),
      description: t('home.smartGcodeDesc')
    }
  ];

  const additionalFeatures = [
    {
      icon: BarChart3,
      title: t('home.detailedAnalytics'),
      description: t('home.detailedAnalyticsDesc')
    },
    {
      icon: Settings,
      title: t('home.groupManagement'),
      description: t('home.groupManagementDesc')
    },
    {
      icon: Zap,
      title: t('home.fastResponse'),
      description: t('home.fastResponseDesc')
    }
  ];

  return (
    <div className="min-h-screen bg-background scroll-smooth">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="space-y-6">
            <div className="space-y-4">
              <h1 className="text-6xl md:text-7xl font-bold tracking-tight">
                {t('home.heroTitle')} <span className="text-primary">{t('home.heroTitleHighlight')}</span>{t('home.heroTitleEnd')}
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
                {t('home.heroSubtitle')}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
              <Button asChild size="lg" className="text-lg px-8 py-6">
                <Link to={user ? "/dashboard" : "/auth"}>
                  <Monitor className="h-5 w-5 mr-2" />
                  {user ? t('home.goToDashboard') : t('home.getStarted')}
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6">
                <Link to="/subscription">
                  <Zap className="h-5 w-5 mr-2" />
                  {t('home.viewPricing')}
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="scroll-mt-16 py-24 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{t('home.featuresTitle')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('home.featuresSubtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardContent className="p-8">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <feature.icon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-4">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* AI Features Section */}
      <section id="ai-features" className="scroll-mt-16 py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{t('home.aiFeaturesTitle')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('home.aiFeaturesSubtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {aiFeatures.map((feature, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow border-2 hover:border-primary/20">
                <CardContent className="p-6">
                  <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center">
            <Button asChild size="lg" className="text-lg px-8 py-6">
              <Link to="/ai">
                <Layers className="h-5 w-5 mr-2" />
                {t('home.tryAIStudio')}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Additional Features */}
      <section id="marketplace" className="scroll-mt-16 py-24 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{t('home.marketplaceTitle')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('home.marketplaceSubtitle')}
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingCart className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-4">{t('home.comingSoon')}</h3>
            <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              {t('home.marketplaceDesc')}
            </p>
          </div>
        </div>
      </section>

      {/* Supported Printers */}
      <section id="printers" className="scroll-mt-16 py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{t('home.supportedPrintersTitle')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('home.supportedPrintersSubtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Settings className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('home.marlin')}</h3>
                <p className="text-sm text-muted-foreground mb-2">{t('home.marlinDesc')}</p>
                <Badge variant="secondary" className="text-xs">{t('home.fullySupported')}</Badge>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('home.klipper')}</h3>
                <p className="text-sm text-muted-foreground mb-2">{t('home.klipperDesc')}</p>
                <Badge variant="secondary" className="text-xs">{t('home.fullySupported')}</Badge>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('home.reprap')}</h3>
                <p className="text-sm text-muted-foreground mb-2">{t('home.reprapDesc')}</p>
                <Badge variant="secondary" className="text-xs">{t('home.fullySupported')}</Badge>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('home.sla')}</h3>
                <p className="text-sm text-muted-foreground mb-2">{t('home.slaDesc')}</p>
                <Badge variant="outline" className="text-xs">{t('home.partialSupport')}</Badge>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <Button asChild size="lg" variant="outline">
              <Link to="/supported-printers">
                <Monitor className="h-5 w-5 mr-2" />
                {t('home.viewFullList')}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Connection Features */}
      <section className="py-24 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{t('home.stayConnectedTitle')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('home.stayConnectedSubtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {additionalFeatures.map((feature, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API Documentation Section */}
      <section id="api" className="scroll-mt-16 py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{t('home.apiTitle')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('home.apiSubtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Code2 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold">{t('home.restfulAPI')}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t('home.apiDescription')}
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-lg font-medium">{t('home.keyFeatures')}</h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    <span>{t('home.apiFeature1')}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    <span>{t('home.apiFeature2')}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    <span>{t('home.apiFeature3')}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    <span>{t('home.apiFeature4')}</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-6">
              <div className="text-sm text-muted-foreground mb-2">{t('home.apiExample')}</div>
              <pre className="text-sm bg-background/50 rounded p-4 overflow-x-auto">
                <code>{`// 프린터 상태 조회
GET /api/v1/printers/status

// 프린트 시작
POST /api/v1/printers/{id}/print
{
  "file": "model.gcode",
  "settings": {
    "temperature": 210,
    "bed_temp": 60
  }
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">
            {t('home.ctaTitle')}
          </h2>
          <p className="text-xl mb-8 opacity-90">
            {t('home.ctaSubtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" variant="secondary" className="text-lg px-8 py-6">
              <Link to={user ? "/dashboard" : "/auth"}>
                <Monitor className="h-5 w-5 mr-2" />
                {user ? t('home.goToDashboard') : t('home.startFree')}
              </Link>
            </Button>
          </div>

          {!user && (
            <p className="text-sm mt-4 opacity-80">
              {t('home.noCreditCard')} • {t('home.cancelAnytime')}
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;