import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

const SupportedPrinters = () => {
  const firmwareData = [
    {
      name: "Marlin",
      type: "FDM/SLA 공통",
      support: "완전 지원",
      variant: "default" as const,
      features: [
        "기본 정보 취득 (M115, M503, M31)",
        "온도 관련 (M105, M104, M109, M140, M190)",
        "위치 및 이동 (M114, G28, G1, G92)",
        "프린트 제어 (M24, M25, M26, M27)",
        "팬 제어 (M106, M107)",
        "필라멘트 관련 (M83, M82, M221)",
        "상태 모니터링 (M119, M42, M43)"
      ]
    },
    {
      name: "Klipper",
      type: "고성능 FDM",
      support: "완전 지원",
      variant: "default" as const,
      features: [
        "기본 정보 (STATUS, HELP, GET_POSITION)",
        "온도 관련 (TEMPERATURE_WAIT, SET_HEATER_TEMPERATURE)",
        "고급 기능 (PROBE_CALIBRATE, BED_MESH_CALIBRATE)",
        "압력 어드밴스 (PRESSURE_ADVANCE)",
        "입력 쉐이퍼 (INPUT_SHAPER)",
        "매크로 지원 (PRINT_START, PRINT_END)",
        "사용자 정의 매크로 실행"
      ]
    },
    {
      name: "RepRapFirmware",
      type: "Duet 보드",
      support: "완전 지원",
      variant: "default" as const,
      features: [
        "기본 정보 (M115, M122, M98)",
        "온도 관련 JSON 형식 (M105)",
        "고급 기능 (G32, M561, M671)",
        "네트워크 기능 (M587, M588, M552)",
        "베드 레벨링 자동화",
        "WiFi 설정 및 관리"
      ]
    },
    {
      name: "SLA 프린터",
      type: "레진 프린터",
      support: "부분 지원",
      variant: "secondary" as const,
      features: [
        "레진 탱크 정보 (M6054, M6055, M6056)",
        "UV LED 제어 (M106, M107)",
        "Z축 정밀 제어 (M114, G1 Z)",
        "레진 온도 모니터링 (M104, M105)",
        "마이크로 스텝 이동",
        "FEP 필름 상태 확인"
      ]
    }
  ];

  const supportMatrix = [
    { feature: "온도 모니터링", marlin: true, klipper: true, sla: "partial", reprap: true },
    { feature: "위치 추적", marlin: true, klipper: true, sla: "z-only", reprap: true },
    { feature: "프린트 진행률", marlin: true, klipper: true, sla: true, reprap: true },
    { feature: "팬 제어", marlin: true, klipper: true, sla: false, reprap: true },
    { feature: "베드 레벨링", marlin: true, klipper: true, sla: false, reprap: true },
    { feature: "네트워크 기능", marlin: false, klipper: "partial", sla: false, reprap: true },
    { feature: "매크로 지원", marlin: "partial", klipper: true, sla: false, reprap: true }
  ];

  const renderSupportIcon = (support: boolean | string) => {
    if (support === true) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (support === false) return <XCircle className="h-4 w-4 text-red-500" />;
    return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  };

  const getSupportText = (support: boolean | string) => {
    if (support === true) return "지원";
    if (support === false) return "미지원";
    if (support === "partial") return "부분 지원";
    if (support === "z-only") return "Z축만";
    return support;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="py-12 px-6 border-b safe-area-top">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center mb-6">
            <Button asChild variant="ghost" size="sm" className="mr-4">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                홈으로 돌아가기
              </Link>
            </Button>
          </div>
          
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">지원하는 3D 프린터</h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              다양한 펌웨어와 프린터 타입에 대한 완전한 모니터링 지원
            </p>
          </div>
        </div>
      </section>

      {/* Firmware Support */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">펌웨어별 지원 현황</h2>
          
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
                
                <CardContent>
                  <h4 className="font-medium mb-3">주요 기능</h4>
                  <ul className="space-y-2">
                    {firmware.features.map((feature, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Support Matrix */}
      <section className="py-16 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">기능별 지원 매트릭스</h2>
          
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-medium">기능</th>
                      <th className="text-center p-4 font-medium">Marlin</th>
                      <th className="text-center p-4 font-medium">Klipper</th>
                      <th className="text-center p-4 font-medium">SLA</th>
                      <th className="text-center p-4 font-medium">RepRap</th>
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
                            {renderSupportIcon(row.sla)}
                            <span className="text-xs">{getSupportText(row.sla)}</span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            {renderSupportIcon(row.reprap)}
                            <span className="text-xs">{getSupportText(row.reprap)}</span>
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
          <h2 className="text-3xl font-bold mb-8 text-center">고급 기능</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">실시간 데이터</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• 100Hz 위치 데이터 (Klipper ADXL345)</li>
                  <li>• 10Hz 온도 데이터</li>
                  <li>• 1Hz 상태 데이터</li>
                  <li>• WebSocket 실시간 스트리밍</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">오류 감지</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• 온도 런어웨이 감지</li>
                  <li>• 필라멘트 부족 알림</li>
                  <li>• 베드 접착 실패 감지</li>
                  <li>• 자동 복구 메커니즘</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">확장 기능</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• 커스텀 G-code 명령</li>
                  <li>• Python 모듈 확장</li>
                  <li>• REST API 연동</li>
                  <li>• MQTT IoT 통합</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">지금 시작해보세요</h2>
          <p className="text-lg mb-8 opacity-90">
            다양한 3D 프린터와 호환되는 모니터링 솔루션을 경험해보세요
          </p>
          <Button asChild size="lg" variant="secondary">
            <Link to="/">
              무료로 시작하기
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default SupportedPrinters;