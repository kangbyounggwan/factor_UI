import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Share2, Eye, MessageSquare, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SharedChat {
  id: string;
  share_id: string;
  title: string | null;
  message_count: number;
  view_count: number;
  created_at: string;
  user_email: string | null;
  user_name: string | null;
}

interface SharedChatsListProps {
  chats: SharedChat[];
  loading?: boolean;
}

export function SharedChatsList({ chats, loading }: SharedChatsListProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-blue-500" />
            공유된 채팅
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse p-3 rounded-lg border">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return `${diffMinutes}분 전`;
      }
      return `${diffHours}시간 전`;
    } else if (diffDays === 1) {
      return '어제';
    } else if (diffDays < 7) {
      return `${diffDays}일 전`;
    } else {
      return date.toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-blue-500" />
          공유된 채팅
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {chats.map((chat) => (
            <a
              key={chat.id}
              href={`/share/${chat.share_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-lg border hover:bg-accent/50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">
                    {chat.title || '제목 없음'}
                    <ExternalLink className="inline-block h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {chat.user_name || chat.user_email || '익명'}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {formatDate(chat.created_at)}
                </Badge>
              </div>

              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>{chat.message_count}개 메시지</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" />
                  <span>{chat.view_count}회 조회</span>
                </div>
              </div>
            </a>
          ))}

          {chats.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Share2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>공유된 채팅이 없습니다</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default SharedChatsList;
