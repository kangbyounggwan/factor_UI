import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, MessageSquare, Box, FileCode, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopUser {
  user_id: string;
  email: string;
  display_name: string;
  total_chat_sessions: number;
  total_models_generated: number;
  total_gcode_analyses: number;
  total_activity: number;
}

interface TopUsersListProps {
  users: TopUser[];
  loading?: boolean;
}

export function TopUsersList({ users, loading }: TopUsersListProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            AI 활용 상위 사용자
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-lg border">
                <div className="w-10 h-10 bg-muted rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getRankBadge = (index: number) => {
    const badges = [
      { color: 'bg-yellow-500', text: '1st' },
      { color: 'bg-gray-400', text: '2nd' },
      { color: 'bg-amber-600', text: '3rd' },
    ];
    if (index < 3) {
      return (
        <Badge className={cn(badges[index].color, 'text-white')}>
          {badges[index].text}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="w-8 justify-center">
        {index + 1}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          AI 활용 상위 사용자
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {users.map((user, index) => (
            <div
              key={user.user_id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                index === 0 && "border-yellow-500/50 bg-yellow-500/5",
                index === 1 && "border-gray-400/50 bg-gray-400/5",
                index === 2 && "border-amber-600/50 bg-amber-600/5"
              )}
            >
              {getRankBadge(index)}

              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-medium">
                  {(user.display_name || user.email)?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {user.display_name || user.email || '알 수 없음'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-blue-500" title="채팅 세션">
                  <MessageSquare className="h-4 w-4" />
                  <span>{user.total_chat_sessions}</span>
                </div>
                <div className="flex items-center gap-1 text-violet-500" title="모델 생성">
                  <Box className="h-4 w-4" />
                  <span>{user.total_models_generated}</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-500" title="G-code 분석">
                  <FileCode className="h-4 w-4" />
                  <span>{user.total_gcode_analyses}</span>
                </div>
              </div>

              <div className="text-right">
                <p className="text-lg font-bold">{user.total_activity}</p>
                <p className="text-xs text-muted-foreground">총 활동</p>
              </div>
            </div>
          ))}

          {users.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>사용자 데이터가 없습니다</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default TopUsersList;
