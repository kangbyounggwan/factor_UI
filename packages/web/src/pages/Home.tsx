import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Monitor, Play, Bell, BarChart3, Settings, Zap, Shield, Smartphone, ShoppingCart, Code2, Wand2, Image, Box, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@shared/contexts/AuthContext";


const Home = () => {
  const { user } = useAuth();

  const features = [
    {
      icon: Monitor,
      title: "실시간 모니터링",
      description: "모든 기기에서 실시간으로 프린트를 추적하고 진행 상황과 상태를 확인하세요."
    },
    {
      icon: Play,
      title: "원격 제어",
      description: "원격으로 일시정지, 중지하거나 설정을 조정하여 안심하고 사용하세요."
    },
    {
      icon: Bell,
      title: "오류 알림",
      description: "문제 발생 시 즉시 알림을 받아 놓치지 않고 대응할 수 있습니다."
    }
  ];

  const aiFeatures = [
    {
      icon: Wand2,
      title: "텍스트 → 3D 모델링",
      description: "간단한 텍스트 설명만으로 전문적인 3D 모델을 생성하고 즉시 프린팅하세요."
    },
    {
      icon: Image,
      title: "이미지 → 3D 변환",
      description: "2D 이미지를 업로드하면 AI가 자동으로 3D 모델로 변환해드립니다."
    },
    {
      icon: Layers,
      title: "텍스트 → 이미지",
      description: "원하는 이미지를 텍스트로 설명하면 AI가 고품질 이미지를 생성합니다."
    },
    {
      icon: Box,
      title: "스마트 G-code 변환",
      description: "생성된 3D 모델을 자동으로 최적화하고 프린터에 맞는 G-code로 변환합니다."
    }
  ];

  const additionalFeatures = [
    {
      icon: BarChart3,
      title: "상세 분석",
      description: "프린터 성능과 사용 패턴을 분석하여 효율성을 높이세요."
    },
    {
      icon: Settings,
      title: "그룹 관리",
      description: "여러 프린터를 그룹으로 구성하여 체계적으로 관리하세요."
    },
    {
      icon: Zap,
      title: "빠른 응답",
      description: "실시간 데이터 동기화로 즉각적인 상태 확인이 가능합니다."
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
                3D 프린터를 <span className="text-primary">모니터링</span>하세요
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
                실시간 제어. 투명한 인사이트.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
              <Button asChild size="lg" className="text-lg px-8 py-6">
                <Link to={user ? "/dashboard" : "/auth"}>
                  <Monitor className="h-5 w-5 mr-2" />
                  {user ? "대시보드로 이동" : "지금 시작하기"}
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6">
                <Link to="/subscription">
                  <Zap className="h-5 w-5 mr-2" />
                  요금제 보기
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
            <h2 className="text-4xl font-bold mb-4">핵심 기능</h2>
            <p className="text-xl text-muted-foreground">
              전문적인 3D 프린터 모니터링을 위한 모든 기능을 제공합니다
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
            <h2 className="text-4xl font-bold mb-4">AI 3D 모델링 스튜디오</h2>
            <p className="text-xl text-muted-foreground">
              텍스트와 이미지에서 3D 모델까지, AI로 창작의 새로운 경험을 만나보세요
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
                AI 스튜디오 체험하기
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Additional Features */}
      <section id="marketplace" className="scroll-mt-16 py-24 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">마켓플레이스</h2>
            <p className="text-xl text-muted-foreground">
              다양한 3D 모델과 프린팅 서비스를 만나보세요
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingCart className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-4">곧 출시 예정</h3>
            <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              프리미엄 3D 모델 라이브러리, 맞춤형 프린팅 서비스, 
              그리고 전문가들이 검증한 프린팅 설정을 제공할 마켓플레이스가 곧 출시됩니다.
            </p>
          </div>
        </div>
      </section>

      {/* Supported Printers */}
      <section id="printers" className="scroll-mt-16 py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">지원 프린터</h2>
            <p className="text-xl text-muted-foreground">
              다양한 3D 프린터 펌웨어와 호환되는 모니터링 솔루션
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Settings className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Marlin</h3>
                <p className="text-sm text-muted-foreground mb-2">FDM/SLA 공통</p>
                <Badge variant="secondary" className="text-xs">완전 지원</Badge>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Klipper</h3>
                <p className="text-sm text-muted-foreground mb-2">고성능 FDM</p>
                <Badge variant="secondary" className="text-xs">완전 지원</Badge>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">RepRap</h3>
                <p className="text-sm text-muted-foreground mb-2">Duet 보드</p>
                <Badge variant="secondary" className="text-xs">완전 지원</Badge>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">SLA</h3>
                <p className="text-sm text-muted-foreground mb-2">레진 프린터</p>
                <Badge variant="outline" className="text-xs">부분 지원</Badge>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <Button asChild size="lg" variant="outline">
              <Link to="/supported-printers">
                <Monitor className="h-5 w-5 mr-2" />
                전체 지원 목록 보기
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Connection Features */}
      <section className="py-24 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">연결 상태를 유지하세요</h2>
            <p className="text-xl text-muted-foreground">
              언제 어디서나 프린터 상태를 확인하고 제어하세요
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
            <h2 className="text-4xl font-bold mb-4">API 통합</h2>
            <p className="text-xl text-muted-foreground">
              강력한 API로 시스템을 확장하고 자동화하세요
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Code2 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold">RESTful API</h3>
                <p className="text-muted-foreground leading-relaxed">
                  모든 프린터 제어 및 모니터링 기능을 API로 제공합니다. 
                  자동화된 워크플로우 구축과 타사 시스템 통합이 가능합니다.
                </p>
              </div>
              
              <div className="space-y-3">
                <h4 className="text-lg font-medium">주요 기능</h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    <span>실시간 프린터 상태 조회</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    <span>원격 프린터 제어</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    <span>G-code 파일 관리</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    <span>웹훅 알림</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-6">
              <div className="text-sm text-muted-foreground mb-2">API 예제</div>
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
            쉽게 모니터링을 시작하세요
          </h2>
          <p className="text-xl mb-8 opacity-90">
            지금 가입하고 전문적인 3D 프린터 관리를 경험해보세요
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" variant="secondary" className="text-lg px-8 py-6">
              <Link to={user ? "/dashboard" : "/auth"}>
                <Monitor className="h-5 w-5 mr-2" />
                {user ? "대시보드로 이동" : "무료로 시작하기"}
              </Link>
            </Button>
          </div>

          {!user && (
            <p className="text-sm mt-4 opacity-80">
              신용카드가 필요하지 않습니다 • 언제든 취소 가능
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;