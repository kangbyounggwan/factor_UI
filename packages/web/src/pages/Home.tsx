import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Monitor, Play, Bell, BarChart3, Settings, Zap, Shield, Smartphone, Code2, Wand2, Image, Box, Layers, Download, Video, Copy, Check, FileSearch } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TypingEffect } from "@/components/Home/TypingEffect";


const PLUGIN_URL = "https://github.com/kangbyounggwan/octoprint-factor-plugin/archive/main.zip";

const Home = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(PLUGIN_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

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
      icon: Download,
      title: t('landing.quickInstall'),
      description: t('landing.quickInstallDesc'),
      clickable: true,
      onClick: () => setShowVideoModal(true),
      hasVideo: true
    },
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
      icon: Box,
      title: t('landing.smartGcode'),
      description: t('landing.smartGcodeDesc')
    },
    {
      icon: FileSearch,
      title: t('landing.gcodeAnalysis'),
      description: t('landing.gcodeAnalysisDesc')
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
      <section className="relative overflow-hidden py-24 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="space-y-6">
            <div className="space-y-4">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight min-h-[180px] md:min-h-[220px] flex flex-col items-center justify-center">
                <span className="block mb-2">{t('landing.heroTitle')}</span>
                <TypingEffect
                  text={t('landing.heroTitleHighlight')}
                  speed={80}
                  delay={500}
                  className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 bg-clip-text text-transparent block"
                />
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
                {t('landing.heroSubtitle')}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
              <Button
                asChild
                size="lg"
                className="relative text-lg px-12 py-7 font-semibold text-white bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 bg-[length:200%_100%] animate-gradient-x hover:shadow-2xl hover:shadow-purple-500/40 hover:scale-105 transition-all duration-300 rounded-full border-0"
              >
                <Link to="/ai-chat">
                  <Zap className="h-5 w-5 mr-2" />
                  {t('landing.getStarted')}
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <picture>
            <source srcSet="/images/hero-bg.webp" type="image/webp" />
            <img
              src="/images/hero-bg.png"
              alt="Background"
              className="absolute inset-0 w-full h-full object-cover opacity-30"
              loading="eager"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background" />
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
                className={`text-center hover:shadow-lg transition-all border-2 hover:border-primary/20 relative ${feature.clickable ? 'cursor-pointer hover:scale-105' : ''
                  }`}
                onClick={feature.clickable ? feature.onClick : undefined}
              >
                {feature.hasVideo && (
                  <div className="absolute top-4 right-4">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg">
                      <Video className="w-4 h-4 text-primary-foreground" />
                    </div>
                  </div>
                )}
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

          <div className="text-center flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button asChild size="lg" className="text-lg px-8 py-6">
              <Link to="/create">
                <Layers className="h-5 w-5 mr-2" />
                {t('landing.tryAIStudio')}
              </Link>
            </Button>
            <Button asChild size="lg" className="text-lg px-8 py-6">
              <Link to="/ai-chat">
                <FileSearch className="h-5 w-5 mr-2" />
                {t('landing.gcodeAnalysis')}
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

      {/* Footer - 무료 AI 모델 안내 */}
      <footer className="py-8 px-6 bg-muted/30 border-t">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            {t('landing.freeAiModelInfo', '🎁 로그인 없이 AI 채팅 10회 무료 체험 · Gemini 2.5 Flash Lite')}
          </p>
        </div>
      </footer>

      {/* Installation Video Modal */}
      <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
        <DialogContent className="max-w-5xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('landing.installationVideo')}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="plugin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="plugin">{t('landing.pluginInstallation')}</TabsTrigger>
              <TabsTrigger value="camera">{t('landing.cameraSetup')}</TabsTrigger>
            </TabsList>

            <TabsContent value="plugin">
              {/* Plugin URL Copy Section */}
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">from URL</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  OctoPrint → Settings → Plugin Manager → Get More → ... from URL 에 붙여넣기
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-background px-3 py-2 rounded border truncate">
                    {PLUGIN_URL}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyUrl}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <video
                  className="absolute top-0 left-0 w-full h-full rounded-lg bg-black"
                  src="/videos/installation-guide.mp4"
                  controls
                  playsInline
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
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