import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Monitor, Settings, Zap, BarChart3, Play, ShoppingCart, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@shared/contexts/AuthContext";
import { Capacitor } from "@capacitor/core";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


const Home = () => {
  const { user } = useAuth();
  const [showIosProfileWarning, setShowIosProfileWarning] = useState(false);

  // iOS 플랫폼 체크
  const isIOS = Capacitor.getPlatform() === 'ios';

  // 페이지 진입 시 스크롤 초기화 및 iOS 프로필 경고 체크
  useEffect(() => {
    window.scrollTo(0, 0);

    // iOS에서 프로필 없이 로그아웃된 경우 경고 표시
    const platform = Capacitor.getPlatform();
    const wasLoggedOutDueToProfile = localStorage.getItem('iosProfileSetupRequired');

    if (platform === 'ios' && wasLoggedOutDueToProfile === 'true') {
      setShowIosProfileWarning(true);
      localStorage.removeItem('iosProfileSetupRequired');

      // 5초 후 경고 자동 숨김
      setTimeout(() => setShowIosProfileWarning(false), 10000);
    }
  }, []);

  // iOS에서는 구독 메뉴 제거 (Apple IAP 정책 준수)
  const allMenuItems = [
    {
      icon: Monitor,
      title: "대시보드",
      description: "실시간 프린터 상태 확인",
      path: user ? "/dashboard" : "/auth",
      color: "bg-blue-500/10 hover:bg-blue-500/20 text-blue-600"
    },
    {
      icon: Play,
      title: "AI 스튜디오",
      description: "AI 3D 모델링 도구",
      path: user ? "/ai" : "/auth",
      color: "bg-purple-500/10 hover:bg-purple-500/20 text-purple-600"
    },
    {
      icon: BarChart3,
      title: "분석",
      description: "성능 및 사용 분석",
      path: user ? "/dashboard" : "/auth",
      color: "bg-orange-500/10 hover:bg-orange-500/20 text-orange-600"
    },
    {
      icon: Settings,
      title: "설정",
      description: "시스템 환경 설정",
      path: user ? "/settings" : "/auth",
      color: "bg-gray-500/10 hover:bg-gray-500/20 text-gray-600"
    },
    ...(!isIOS ? [{
      icon: ShoppingCart,
      title: "구독",
      description: "요금제 및 결제",
      path: "/subscription",
      color: "bg-pink-500/10 hover:bg-pink-500/20 text-pink-600"
    }] : [])
  ];

  const quickMenuItems = allMenuItems;

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* iOS 프로필 설정 필요 경고 */}
      {showIosProfileWarning && (
        <div className="px-4 pt-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>프로필 설정 필요</AlertTitle>
            <AlertDescription>
              iOS 앱에서는 프로필 설정이 지원되지 않습니다.
              웹사이트에서 먼저 회원가입을 완료해주세요.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Quick Menu Grid */}
      <section className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {quickMenuItems.map((item, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-200 cursor-pointer">
                <Link to={item.path} className="block">
                  <CardContent className="p-6 text-center space-y-4">
                    <div className={`w-16 h-16 ${item.color} rounded-2xl mx-auto flex items-center justify-center transition-all duration-200 group-hover:scale-110`}>
                      <item.icon className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 하단 버튼 영역 제거 및 스크롤 차단 (overflow-hidden 상단에서 처리) */}
    </div>
  );
};

export default Home;