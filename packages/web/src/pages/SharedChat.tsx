/**
 * Shared Chat Page
 * 공유된 채팅 대화 조회 페이지
 * URL: /share/:shareId
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getSharedChat, type SharedChat, type SharedReferenceImage } from '@shared/services/supabaseService/sharedChat';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, ArrowLeft, Eye, Calendar, ExternalLink, Activity, MessageCircle, User, Cpu, ImageIcon, ZoomIn, X, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

/**
 * 마크다운 렌더링 전 ~ 문자를 이스케이프
 * remarkGfm의 strikethrough(~~text~~) 문법과 충돌 방지
 * 예: "190~220°C" → "190\~220°C"
 */
function escapeMarkdownTildes(content: string): string {
  return content.replace(/(?<!\\)~(?!~)/g, '\\~');
}

export default function SharedChatPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatData, setChatData] = useState<SharedChat | null>(null);
  const [selectedImage, setSelectedImage] = useState<SharedReferenceImage | null>(null);

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
        <div className="space-y-6">
          {chatData.messages.map((message, index) => (
            <div key={index}>
              {message.role === 'user' ? (
                /* 사용자 메시지 - ChatMessage.tsx UserMessage와 동일 */
                <div className="flex flex-col items-end">
                  {/* 이미지 미리보기 */}
                  {message.images && message.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2 justify-end">
                      {message.images.map((img, imgIdx) => (
                        <img
                          key={imgIdx}
                          src={img}
                          alt={`uploaded-${imgIdx}`}
                          className="w-24 h-24 object-cover rounded-lg border"
                        />
                      ))}
                    </div>
                  )}
                  {/* 파일 미리보기 */}
                  {message.files && message.files.length > 0 && (
                    <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground justify-end">
                      <File className="w-4 h-4" />
                      {message.files.map((f, fIdx) => (
                        <span key={fIdx} className="bg-muted px-2 py-1 rounded">{f.name}</span>
                      ))}
                    </div>
                  )}
                  {/* 메시지 내용 */}
                  <div className="bg-blue-100 text-blue-900 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] overflow-hidden">
                    <div className="text-base leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
                      {message.content}
                    </div>
                  </div>
                </div>
              ) : (
                /* AI 메시지 - ChatMessage.tsx AssistantMessage와 동일 */
                <div>
                  {/* 역할 라벨 */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
                      <Cpu className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-base font-bold text-foreground">
                      FACTOR AI
                    </span>
                  </div>

                  {/* 메시지 내용 - 마크다운 렌더링 */}
                  <div className="prose prose-base max-w-none text-foreground pl-8 dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-ul:my-4 prose-ol:my-4 prose-li:my-1 prose-p:my-3 prose-headings:my-4 prose-headings:mt-6">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {escapeMarkdownTildes(message.content)}
                    </ReactMarkdown>
                  </div>

                  {/* 참고 자료 섹션 - GPT 스타일 (하단 별도 표시) */}
                  {message.references && message.references.length > 0 && (
                    <div className="pl-8 mt-6 pt-4 border-t border-border/50">
                      <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                        <ExternalLink className="w-4 h-4" />
                        <span>{t('shared.references', '참고 자료')}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {message.references.map((ref, idx) => (
                          <a
                            key={`ref-${idx}-${ref.url}`}
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-full transition-colors group"
                            title={ref.snippet}
                          >
                            <span className="max-w-[200px] truncate">{ref.title}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 참조 이미지 섹션 - 문제진단 결과 이미지 */}
                  {message.referenceImages && message.referenceImages.length > 0 && (
                    <div className="pl-8 mt-4 pt-4 border-t border-border/50">
                      <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                        <ImageIcon className="w-4 h-4" />
                        <span>{t('shared.referenceImages', '참조 이미지')}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {message.referenceImages.slice(0, 8).map((img, idx) => (
                          <button
                            key={`ref-img-${idx}-${img.source_url}`}
                            onClick={() => setSelectedImage(img)}
                            className="group relative block rounded-lg overflow-hidden border border-border/50 hover:border-primary/50 transition-all hover:shadow-md text-left"
                          >
                            <img
                              src={img.thumbnail_url}
                              alt={img.title}
                              className="w-full h-24 object-cover"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                              <span className="text-[10px] text-white line-clamp-2 font-medium leading-tight">{img.title}</span>
                            </div>
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <ZoomIn className="w-3 h-3 text-white" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 이미지 확대 보기 모달 */}
        <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
          <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden bg-black/95 border-none">
            {selectedImage && (
              <div className="relative flex flex-col h-full">
                {/* 닫기 버튼 */}
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>

                {/* 이미지 */}
                <div className="flex-1 flex items-center justify-center p-4 min-h-0">
                  <img
                    src={selectedImage.thumbnail_url}
                    alt={selectedImage.title}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                  />
                </div>

                {/* 하단 정보 */}
                <div className="p-4 bg-black/80 border-t border-white/10">
                  <h3 className="text-white font-medium text-sm mb-2 line-clamp-2">{selectedImage.title}</h3>
                  <a
                    href={selectedImage.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t('shared.viewOriginal', '원본 사이트에서 보기')}
                  </a>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

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
