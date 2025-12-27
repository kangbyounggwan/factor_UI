/**
 * Shared Chat Page
 * 공유된 채팅 대화 조회 페이지
 * URL: /share/:shareId
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getSharedChat, type SharedChat } from '@shared/services/supabaseService/sharedChat';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, ArrowLeft, Eye, Calendar, ExternalLink, Activity, MessageCircle, User, Cpu, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function SharedChatPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatData, setChatData] = useState<SharedChat | null>(null);

  useEffect(() => {
    async function loadSharedChat() {
      if (!shareId) {
        setError('Invalid share link');
        setLoading(false);
        return;
      }

      try {
        const data = await getSharedChat(shareId);

        if (!data) {
          setError('Chat not found or expired');
          setLoading(false);
          return;
        }

        setChatData(data);
      } catch (err) {
        console.error('[SharedChatPage] Error:', err);
        setError('Failed to load chat');
      } finally {
        setLoading(false);
      }
    }

    loadSharedChat();
  }, [shareId]);

  // 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('shared.loadingChat', '대화를 불러오는 중...')}</p>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error || !chatData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-6 p-8">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-semibold mb-2">
                {error === 'Chat not found or expired'
                  ? t('shared.chatExpired', '대화를 찾을 수 없음')
                  : t('shared.chatNotFound', '대화를 찾을 수 없음')}
              </h1>
              <p className="text-muted-foreground">
                {error === 'Chat not found or expired'
                  ? t('shared.chatExpiredDesc', '이 공유 링크가 만료되었거나 삭제되었습니다.')
                  : t('shared.chatNotFoundDesc', '공유된 대화를 찾을 수 없습니다.')}
              </p>
            </div>
            <Link to="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                {t('shared.goHome', '홈으로')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 공유 헤더 */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
                  <Activity className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold font-orbitron text-primary tracking-wide">
                  FACTOR
                </span>
              </Link>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageCircle className="w-4 h-4" />
                {t('shared.sharedChat', '공유된 대화')}
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                <span>{chatData.view_count}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>{new Date(chatData.created_at).toLocaleDateString()}</span>
              </div>
              <Link to="/ai-chat">
                <Button size="sm" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  {t('shared.tryFactor', 'FACTOR 사용하기')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 대화 콘텐츠 */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 제목 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">
            {chatData.title || t('shared.chatConversation', '프린터 문제 진단 대화')}
          </h1>
          <p className="text-muted-foreground">
            {t('shared.generatedByFactor', 'FACTOR AI 어시스턴트와의 대화')}
          </p>
        </div>

        {/* 메시지 목록 */}
        <div className="space-y-4">
          {chatData.messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex gap-4 p-4 rounded-xl",
                message.role === 'user'
                  ? 'bg-primary/5'
                  : 'bg-muted/50'
              )}
            >
              {/* 아바타 */}
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gradient-to-br from-blue-500 to-purple-500 text-white'
              )}>
                {message.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Cpu className="w-4 h-4" />
                )}
              </div>

              {/* 메시지 내용 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-sm">
                    {message.role === 'user'
                      ? t('shared.user', '사용자')
                      : t('shared.factorAI', 'FACTOR AI')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* 이미지가 있는 경우 */}
                {message.images && message.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {message.images.map((img, imgIdx) => (
                      <div key={imgIdx} className="relative">
                        <img
                          src={img}
                          alt={`Attachment ${imgIdx + 1}`}
                          className="max-w-[200px] max-h-[200px] rounded-lg object-cover border"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* 파일 첨부가 있는 경우 */}
                {message.files && message.files.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {message.files.map((file, fileIdx) => (
                      <Badge key={fileIdx} variant="secondary" className="gap-1">
                        <ImageIcon className="w-3 h-3" />
                        {file.name}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* 텍스트 내용 */}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Card className="bg-gradient-to-r from-primary/10 to-blue-500/10 border-primary/20">
            <CardContent className="py-8">
              <h2 className="text-xl font-bold mb-2">
                {t('shared.tryFactorCTA', '나도 FACTOR로 프린터 문제 해결하기')}
              </h2>
              <p className="text-muted-foreground mb-4">
                {t('shared.tryFactorDesc', 'AI가 3D 프린터 문제를 진단하고 해결 방법을 알려드립니다.')}
              </p>
              <Link to="/ai-chat">
                <Button size="lg" className="gap-2">
                  <MessageCircle className="w-5 h-5" />
                  {t('shared.startChat', '무료로 시작하기')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="border-t mt-12 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p className="mb-2">
            {t('shared.poweredBy', 'Powered by FACTOR - AI-Powered 3D Printing Assistant')}
          </p>
          <Link to="/" className="text-primary hover:underline">
            {t('shared.learnMore', 'FACTOR에 대해 더 알아보기')}
          </Link>
        </div>
      </footer>
    </div>
  );
}
