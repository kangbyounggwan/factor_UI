/**
 * 사이드바 콘텐츠 컴포넌트 공통 타입
 */

// Chat 세션 메시지 타입
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  images?: string[];
  files?: { name: string; type: string }[];
}

// Chat 세션 타입
export interface ChatSession {
  id: string;
  title: string;
  timestamp: Date;
  messages: Message[];
  metadata?: Record<string, unknown>;
}

// Settings 탭 타입
export type SettingsTab = 'profile' | 'account' | 'subscription' | 'notifications' | 'api-keys';

// PrinterDetail 탭 타입
export type PrinterDetailTab = 'all' | 'monitoring' | 'files' | 'settings' | 'settings-equipment' | 'settings-camera';

// 보고서 아카이브 아이템 타입
export interface ReportArchiveItem {
  id: string;
  fileName: string;
  overallScore?: number;
  overallGrade?: string;
  totalIssues?: number;
  createdAt: Date;
}

// 프린터 빠른 선택 아이템 타입
export interface PrinterQuickItem {
  id: string;
  name: string;
  model?: string;
  isOnline: boolean;
  progress?: number; // 0-100
  currentJob?: string;
}

// 프린터 알림 타입
export type PrinterAlertType = 'error' | 'warning' | 'info' | 'success';
export interface PrinterAlert {
  id: string;
  type: PrinterAlertType;
  printerName: string;
  message: string;
  timestamp: Date;
}

// 커뮤니티 통계 타입
export interface CommunitySidebarStats {
  totalPosts: number;
  totalComments: number;
  totalUsers: number;
  totalLikes: number;
  todayPosts: number;
}

// 내 최근 글 아이템 타입 (사이드바용)
export interface MyRecentPostItem {
  id: string;
  title: string;
  category: string;
  created_at: string;
  comment_count: number;
  like_count: number;
}

// 내 최근 댓글 아이템 타입 (사이드바용)
export interface MyRecentCommentItem {
  id: string;
  content: string;
  post_id: string;
  post_title: string;
  created_at: string;
}

// AI 생성 모델 타입 (re-export)
export type { AIGeneratedModel } from "@shared/types/aiModelType";
