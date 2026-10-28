export type AccountStatus = 'active' | 'restricted';
export type ServerStatus = 'requested' | 'active' | 'paused' | 'disconnected';
export type BotStatus = 'unknown' | 'online' | 'offline';
export type PassStatus =
  | 'pending'
  | 'paid'
  | 'rejected'
  | 'refunded'
  | 'expired'
  | 'cancelled';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type ChatRoomType = 'support' | 'staff' | 'pass' | 'server';

export interface Profile {
  id: string;
  discordId: string | null;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  accountStatus: AccountStatus;
  createdAt: string;
  lastLoginAt: string;
  theme?: 'light' | 'dark' | 'system';
  notificationPreferences?: Record<string, boolean>;
}

export interface Server {
  id: string;
  discordServerId: string;
  name: string | null;
  status: ServerStatus;
  botStatus: BotStatus;
  createdAt: string;
}

export interface PassProduct {
  id: string;
  name: string;
  durationDays: 1 | 10 | 30;
  price: number;
  active: boolean;
}

export interface Pass {
  id: string;
  productId: string;
  serverId: string;
  status: PassStatus;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface Ticket {
  id: string;
  subject: string;
  status: TicketStatus;
  category: 'support' | 'pass' | 'server';
  createdAt: string;
  updatedAt: string;
}

export interface ChatRoom {
  id: string;
  type: ChatRoomType;
  title: string;
  ticketId?: string | null;
  lastMessageAt: string | null;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  authorId: string;
  authorName?: string;
  isOwn?: boolean;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface ServerSettings {
  serverId: string;
  blockedWords: Array<{
    id: string;
    word: string;
    action: {
      deleteMessage: boolean;
      warningCount: number;
      timeoutSeconds: number;
      exceptRoleIds: string[];
      exceptChannelIds: string[];
    };
  }>;
  automod: {
    spam: boolean;
    repeatedMessages: boolean;
    inviteLinks: boolean;
    externalLinks: boolean;
    mentionSpam: boolean;
    newAccountLimit: boolean;
  };
  updatedAt: string;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  publishedAt: string | null;
}

export interface DashboardSummary {
  serverCount: number;
  activeServerCount: number;
  activePassCount: number;
  expiringPassCount: number;
  openTicketCount: number;
  unreadNotificationCount: number;
  recentNotices: Notice[];
  recentActivity: Array<{
    id: string;
    label: string;
    createdAt: string;
    result: string;
  }>;
}
