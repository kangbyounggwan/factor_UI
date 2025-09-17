import { useEffect, useRef, useState } from 'react'
import { BluetoothConnection } from '@/components/MobileSetupCompo/BluetoothConnectionTap'
import { NetworkConfiguration } from '@/components/MobileSetupCompo/NetworkTap'
import { ConfigurationManager } from '@/components/MobileSetupCompo/ConfigurationTap'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Smartphone, Bluetooth, Wifi, Settings, Check } from 'lucide-react'

const MobileSetup = () => {
  const [activeTab, setActiveTab] = useState<'bluetooth' | 'network' | 'config'>('bluetooth')
  const [btDone, setBtDone] = useState(false)
  const [netDone, setNetDone] = useState(false)
  const { toast } = useToast()

  const btRef = useRef<HTMLDivElement | null>(null)
  const netRef = useRef<HTMLDivElement | null>(null)

  // Helper: 검사 함수 (특정 루트의 텍스트 노드에 "연결됨" 포함 여부)
  const hasConnectedBadge = (root: HTMLElement | null): boolean => {
    if (!root) return false
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let node: Node | null = walker.nextNode()
    while (node) {
      if ((node.textContent || '').trim() === '연결됨') return true
      node = walker.nextNode()
    }
    return false
  }

  // 1단계: 블루투스 연결 완료 → 자동으로 네트워크 탭으로
  useEffect(() => {
    if (btDone) return
    const root = btRef.current
    const checkAndAdvance = () => {
      if (hasConnectedBadge(root)) {
        setBtDone(true)
        setActiveTab('network')
      }
    }
    checkAndAdvance()
    const mo = new MutationObserver(checkAndAdvance)
    if (root) mo.observe(root, { childList: true, subtree: true, characterData: true })
    const handleBleConnected = () => { setBtDone(true); setActiveTab('network') }
    window.addEventListener('ble:connected', handleBleConnected)
    return () => mo.disconnect()
  }, [btDone])

  // 2단계: 네트워크 적용/연결 확인 → 시스템 탭으로
  useEffect(() => {
    if (netDone) return
    const root = netRef.current
    const checkAndAdvance = () => {
      if (hasConnectedBadge(root)) {
        setNetDone(true)
        setActiveTab('config')
      }
    }
    checkAndAdvance()
    const mo = new MutationObserver(checkAndAdvance)
    if (root) mo.observe(root, { childList: true, subtree: true, characterData: true })
    const advance = () => { setNetDone(true); setActiveTab('config') }
    const onConnected = () => advance()
    const onApplied = () => advance()
    window.addEventListener('network:connected', onConnected)
    window.addEventListener('network:applied', onApplied)
    return () => {
      mo.disconnect()
      window.removeEventListener('network:connected', onConnected)
      window.removeEventListener('network:applied', onApplied)
    }
  }, [netDone])

  // 연결 끊김: 토스트 안내 후 블루투스 탭으로 복귀 및 진행상태 초기화
  useEffect(() => {
    const onBleDisconnected = () => {
      toast({
        title: '블루투스 연결이 끊겼습니다',
        description: '다시 연결을 시도해주세요.',
        variant: 'destructive',
      })
      setActiveTab('bluetooth')
      setBtDone(false)
      setNetDone(false)
    }
    window.addEventListener('ble:disconnected', onBleDisconnected)
    return () => window.removeEventListener('ble:disconnected', onBleDisconnected)
  }, [toast])

  return (
    <div className="min-h-screen bg-background">
      <div className="px-3 py-4 pb-20">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
            <Smartphone className="h-6 w-6 text-primary" />
            모바일 설정
          </h1>
          <p className="text-sm text-muted-foreground leading-5">
            블루투스를 통해 라즈베리파이와 연결하고 네트워크 및 시스템 설정을 관리하세요
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          {/* 단계 표시 탭 헤더 */}
          <TabsList className="grid w-full grid-cols-3 mb-6 h-12">
            <TabsTrigger value="bluetooth" className="flex items-center justify-center gap-2 text-xs py-2">
              {btDone ? <Check className="h-4 w-4 text-success" /> : <Bluetooth className="h-4 w-4" />}
              <span>블루투스</span>
            </TabsTrigger>
            <TabsTrigger value="network" className="flex items-center justify-center gap-2 text-xs py-2" disabled={!btDone && activeTab !== 'network'}>
              {netDone ? <Check className="h-4 w-4 text-success" /> : <Wifi className="h-4 w-4" />}
              <span>네트워크</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center justify-center gap-2 text-xs py-2" disabled={!netDone && activeTab !== 'config'}>
              <Settings className="h-4 w-4" />
              <span>시스템</span>
            </TabsTrigger>
          </TabsList>

          {/* 1단계 */}
          <TabsContent value="bluetooth" className="space-y-4" ref={btRef as any}>
            <BluetoothConnection />
          </TabsContent>

          {/* 2단계 */}
          <TabsContent value="network" className="space-y-4" ref={netRef as any}>
            <NetworkConfiguration />
          </TabsContent>

          {/* 3단계 */}
          <TabsContent value="config" className="space-y-4">
            <ConfigurationManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MobileSetup;