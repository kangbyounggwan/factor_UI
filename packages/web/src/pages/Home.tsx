import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Monitor, Play, Bell, BarChart3, Settings, Zap, Shield, Smartphone, ShoppingCart, Code2, Wand2, Image, Box, Layers, Download } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@shared/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


const Home = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const [showVideoModal, setShowVideoModal] = useState(false);

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
      title: t('landing.realtimeMonitoring'),
      description: t('landing.realtimeMonitoringDesc'),
      clickable: false
    },
    {
      icon: Play,
      title: t('landing.remoteControl'),
      description: t('landing.remoteControlDesc'),
      clickable: false
    },
    {
      icon: Bell,
      title: t('landing.errorNotifications'),
      description: t('landing.errorNotificationsDesc'),
      clickable: false
    },
    {
      icon: Download,
      title: t('landing.quickInstall'),
      description: t('landing.quickInstallDesc'),
      clickable: true,
      onClick: () => setShowVideoModal(true)
    }
  ];

  const aiFeatures = [
    {
      icon: Wand2,
      title: t('landing.textTo3D'),
      description: t('landing.textTo3DDesc')
    },
    {
      icon: Image,
      title: t('landing.imageTo3D'),
      description: t('landing.imageTo3DDesc')
    },
    {
      icon: Layers,
      title: t('landing.textToImage'),
      description: t('landing.textToImageDesc')
    },
    {
      icon: Box,
      title: t('landing.smartGcode'),
      description: t('landing.smartGcodeDesc')
    }
  ];

  const additionalFeatures = [
    {
      icon: BarChart3,
      title: t('landing.detailedAnalytics'),
      description: t('landing.detailedAnalyticsDesc')
    },
    {
      icon: Settings,
      title: t('landing.groupManagement'),
      description: t('landing.groupManagementDesc')
    },
    {
      icon: Zap,
      title: t('landing.fastResponse'),
      description: t('landing.fastResponseDesc')
    }
  ];

  return (
    <div className="min-h-screen bg-background scroll-smooth">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 px-6 bg-background">
        <div className="max-w-7xl mx-auto text-center">
          <div className="space-y-6">
            <div className="space-y-4">
              <h1 className="text-6xl md:text-7xl font-bold tracking-tight">
                {t('landing.heroTitle')} <span className="text-primary">{t('landing.heroTitleHighlight')}</span>{t('landing.heroTitleEnd')}
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
                {t('landing.heroSubtitle')}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
              <Button asChild size="lg" className="text-lg px-8 py-6">
                <Link to={user ? "/dashboard" : "/auth"}>
                  <Monitor className="h-5 w-5 mr-2" />
                  {user ? t('landing.goToDashboard') : t('landing.getStarted')}
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6">
                <Link to="/subscription">
                  <Zap className="h-5 w-5 mr-2" />
                  {t('landing.viewPricing')}
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
      <section id="features" className="scroll-mt-16 py-24 px-6 bg-muted/65">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{t('landing.featuresTitle')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('landing.featuresSubtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card
                key={index}
                className={`text-center hover:shadow-lg transition-all border-2 hover:border-primary/20 ${
                  feature.clickable ? 'cursor-pointer hover:scale-105' : ''
                }`}
                onClick={feature.clickable ? feature.onClick : undefined}
              >
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
      <section id="ai-features" className="scroll-mt-16 py-24 px-6 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{t('landing.aiFeaturesTitle')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('landing.aiFeaturesSubtitle')}
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
              <Link to="/create">
                <Layers className="h-5 w-5 mr-2" />
                {t('landing.tryAIStudio')}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Supported Printers */}
      <section id="printers" className="scroll-mt-16 py-24 px-6 bg-muted/65">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{t('landing.supportedPrintersTitle')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('landing.supportedPrintersSubtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <Card className="text-center hover:shadow-lg transition-shadow border-2 hover:border-primary/20">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Settings className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('landing.marlin')}</h3>
                <p className="text-sm text-muted-foreground mb-2">{t('landing.marlinDesc')}</p>
                <Badge variant="secondary" className="text-xs">{t('landing.fullySupported')}</Badge>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow border-2 hover:border-primary/20">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('landing.klipper')}</h3>
                <p className="text-sm text-muted-foreground mb-2">{t('landing.klipperDesc')}</p>
                <Badge variant="secondary" className="text-xs">{t('landing.fullySupported')}</Badge>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow border-2 hover:border-primary/20">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('landing.reprap')}</h3>
                <p className="text-sm text-muted-foreground mb-2">{t('landing.reprapDesc')}</p>
                <Badge variant="secondary" className="text-xs">{t('landing.fullySupported')}</Badge>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow border-2 hover:border-primary/20">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('landing.sla')}</h3>
                <p className="text-sm text-muted-foreground mb-2">{t('landing.slaDesc')}</p>
                <Badge variant="outline" className="text-xs">{t('landing.partialSupport')}</Badge>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <Button asChild size="lg" variant="outline">
              <Link to="/supported-printers">
                <Monitor className="h-5 w-5 mr-2" />
                {t('landing.viewFullList')}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Marketplace Section */}
      <section id="marketplace" className="scroll-mt-16 py-24 px-6 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{t('landing.marketplaceTitle')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('landing.marketplaceSubtitle')}
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingCart className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-4">{t('landing.comingSoon')}</h3>
            <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              {t('landing.marketplaceDesc')}
            </p>
          </div>
        </div>
      </section>

      {/* Connection Features */}
      <section className="py-24 px-6 bg-muted/65">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{t('landing.stayConnectedTitle')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('landing.stayConnectedSubtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {additionalFeatures.map((feature, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow border-2 hover:border-primary/20">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* API Documentation Section */}
      <section id="api" className="scroll-mt-16 py-24 px-6 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{t('landing.apiTitle')}</h2>
            <p className="text-xl text-muted-foreground">
              {t('landing.apiSubtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Code2 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold">{t('landing.restfulAPI')}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t('landing.apiDescription')}
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-lg font-medium">{t('landing.keyFeatures')}</h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    <span>{t('landing.apiFeature1')}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    <span>{t('landing.apiFeature2')}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    <span>{t('landing.apiFeature3')}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    <span>{t('landing.apiFeature4')}</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-6">
              <div className="text-sm text-muted-foreground mb-2">{t('landing.apiExample')}</div>
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

      {/* Installation Video Modal */}
      <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{t('landing.installationVideo')}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="plugin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="plugin">{t('landing.pluginInstallation')}</TabsTrigger>
              <TabsTrigger value="camera">{t('landing.cameraSetup')}</TabsTrigger>
            </TabsList>

            <TabsContent value="plugin">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  className="absolute top-0 left-0 w-full h-full rounded-lg"
                  src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                  title="Plugin Installation Guide"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                {t('landing.pluginInstallationDesc')}
              </p>
            </TabsContent>

            <TabsContent value="camera">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  className="absolute top-0 left-0 w-full h-full rounded-lg"
                  src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                  title="Camera Setup Guide"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                {t('landing.cameraSetupDesc')}
              </p>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Home;