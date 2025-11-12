import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const SupportedPrinters = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('landing.supportedPrintersTitle') + ' | FACTOR';

    const desc = t('landing.supportedPrintersSubtitle');
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `${window.location.origin}/supported-printers`);

    // JSON-LD 구조화 데이터
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'FACTOR - 3D Printer Management',
      description: desc,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        availability: 'https://schema.org/InStock',
        price: '0',
        priceCurrency: 'KRW'
      }
    };

    const prev = document.getElementById('supported-printers-jsonld');
    if (prev) prev.remove();
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'supported-printers-jsonld';
    script.text = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }, [t]);

  const mainFeatures = [
    t('landing.mainFeature1'),
    t('landing.mainFeature2'),
    t('landing.mainFeature3'),
    t('landing.mainFeature4'),
    t('landing.mainFeature5'),
    t('landing.mainFeature6'),
    t('landing.mainFeature7'),
  ];

  const firmwareData = [
    {
      name: t('landing.marlin'),
      type: t('landing.marlinDesc'),
      support: t('landing.fullySupported'),
      variant: "default" as const,
    },
    {
      name: t('landing.klipper'),
      type: t('landing.klipperDesc'),
      support: t('landing.fullySupported'),
      variant: "default" as const,
    },
    {
      name: t('landing.reprap'),
      type: t('landing.reprapDesc'),
      support: t('landing.fullySupported'),
      variant: "default" as const,
    },
    {
      name: t('landing.prusa'),
      type: t('landing.prusaDesc'),
      support: t('landing.fullySupported'),
      variant: "default" as const,
    }
  ];

  const supportMatrix = [
    { feature: t('landing.featureTemperatureMonitoring'), marlin: true, klipper: true, reprap: true, prusa: true },
    { feature: t('landing.featurePositionTracking'), marlin: true, klipper: true, reprap: true, prusa: true },
    { feature: t('landing.featurePrintProgress'), marlin: true, klipper: true, reprap: true, prusa: true },
    { feature: t('landing.featureFanControl'), marlin: true, klipper: true, reprap: true, prusa: true },
    { feature: t('landing.featureBedLeveling'), marlin: true, klipper: true, reprap: true, prusa: true },
    { feature: t('landing.featureWebcamStreaming'), marlin: true, klipper: true, reprap: true, prusa: true },
    { feature: t('landing.featurePluginSupport'), marlin: true, klipper: true, reprap: "partial", prusa: true }
  ];

  const renderSupportIcon = (support: boolean | string) => {
    if (support === true) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (support === false) return <XCircle className="h-4 w-4 text-red-500" />;
    return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  };

  const getSupportText = (support: boolean | string) => {
    if (support === true) return t('landing.supported');
    if (support === false) return t('landing.notSupported');
    if (support === "partial") return t('landing.partialSupportText');
    if (support === "z-only") return t('landing.zAxisOnly');
    return support;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* NoScript Fallback */}
      <noscript>
        <div style={{padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui'}}>
          <h1>Supported Printers</h1>
          <p>FACTOR supports all major 3D printer firmware</p>
          <h2>Supported Firmware:</h2>
          <ul>
            <li><strong>Marlin</strong> - Fully Supported</li>
            <li><strong>Klipper</strong> - Fully Supported</li>
            <li><strong>RepRap</strong> - Fully Supported</li>
            <li><strong>Prusa</strong> - Fully Supported</li>
          </ul>
          <h2>Key Features:</h2>
          <ul>
            <li>Real-time temperature monitoring</li>
            <li>Position tracking</li>
            <li>Print progress monitoring</li>
            <li>Fan control</li>
            <li>Bed leveling</li>
            <li>Webcam streaming</li>
          </ul>
          <p>JavaScript is required for full functionality. Please enable JavaScript in your browser.</p>
        </div>
      </noscript>
      {/* Header */}
      <section className="py-12 px-6 border-b">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center mb-6">
            <Button asChild variant="ghost" size="sm" className="mr-4">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('nav.backToHome')}
              </Link>
            </Button>
          </div>

          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">{t('landing.supportedPrintersTitle')}</h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              {t('landing.supportedPrintersSubtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* Main Features */}
      <section className="py-16 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">{t('landing.mainFeatures')}</h2>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-8">
              <ul className="grid md:grid-cols-2 gap-4">
                {mainFeatures.map((feature, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Firmware Support */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">{t('landing.firmwareCompatibility')}</h2>

          <div className="grid md:grid-cols-2 gap-8">
            {firmwareData.map((firmware, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">{firmware.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{firmware.type}</p>
                    </div>
                    <Badge variant={firmware.variant}>{firmware.support}</Badge>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Support Matrix */}
      <section className="py-16 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">{t('landing.supportMatrix')}</h2>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-medium">{t('landing.mainFeatures')}</th>
                      <th className="text-center p-4 font-medium">{t('landing.marlin')}</th>
                      <th className="text-center p-4 font-medium">{t('landing.klipper')}</th>
                      <th className="text-center p-4 font-medium">{t('landing.reprap')}</th>
                      <th className="text-center p-4 font-medium">{t('landing.prusa')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supportMatrix.map((row, index) => (
                      <tr key={index} className="border-b last:border-b-0">
                        <td className="p-4 font-medium">{row.feature}</td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            {renderSupportIcon(row.marlin)}
                            <span className="text-xs">{getSupportText(row.marlin)}</span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            {renderSupportIcon(row.klipper)}
                            <span className="text-xs">{getSupportText(row.klipper)}</span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            {renderSupportIcon(row.reprap)}
                            <span className="text-xs">{getSupportText(row.reprap)}</span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            {renderSupportIcon(row.prusa)}
                            <span className="text-xs">{getSupportText(row.prusa)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Advanced Features */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">{t('landing.advancedFeatures')}</h2>

          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('landing.realtimeData')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• {t('landing.realtimeDataFeature1')}</li>
                  <li>• {t('landing.realtimeDataFeature2')}</li>
                  <li>• {t('landing.realtimeDataFeature3')}</li>
                  <li>• {t('landing.realtimeDataFeature4')}</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('landing.errorDetection')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• {t('landing.errorDetectionFeature1')}</li>
                  <li>• {t('landing.errorDetectionFeature2')}</li>
                  <li>• {t('landing.errorDetectionFeature3')}</li>
                  <li>• {t('landing.errorDetectionFeature4')}</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('landing.extensionFeatures')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• {t('landing.extensionFeature1')}</li>
                  <li>• {t('landing.extensionFeature2')}</li>
                  <li>• {t('landing.extensionFeature3')}</li>
                  <li>• {t('landing.extensionFeature4')}</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">{t('landing.getStartedNow')}</h2>
          <p className="text-lg mb-8 opacity-90">
            {t('landing.getStartedDescription')}
          </p>
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth">
              {t('landing.startForFree')}
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default SupportedPrinters;