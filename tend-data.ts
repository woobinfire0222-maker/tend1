import { useEffect, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, requireSupabase, supabase } from './supabase';
import type {
  ChatMessage,
  ChatRoom,
  DashboardSummary,
  Pass,
  PassProduct,
  Profile,
  Server,
  ServerSettings,
  Ticket,
} from '@/types/domain';

type Raw = Record<string, unknown>;

function toProfile(row: Raw): Profile {
  return {
    id: String(row.id),
    discordId: (row.discord_id as string | null) ?? null,
    username: (row.username as string | null) ?? null,
    displayName: (row.display_name as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    accountStatus: (row.account_status as Profile['accountStatus']) ?? 'active',
    createdAt: String(row.created_at ?? ''),
    lastLoginAt: String(row.last_login_at ?? ''),
    theme: (row.theme as Profile['theme']) ?? 'light',
    notificationPreferences: (row.notification_preferences as Record<string, boolean> | null) ?? {},
  };
}

function toServer(row: Raw): Server {
  return {
    id: String(row.id),
    discordServerId: String(row.discord_server_id),
    name: (row.name as string | null) ?? null,
    status: row.status as Server['status'],
    botStatus: row.bot_status as Server['botStatus'],
    createdAt: String(row.created_at ?? ''),
  };
}

function queryError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let alive = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setError(error);
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setError(null);
      setSession(nextSession);
      setLoading(false);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { session, loading, configured: isSupabaseConfigured, error };
}

export async function signInWithDiscord() {
  const client = requireSupabase();
  const { error } = await client.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: new URL(import.meta.env.BASE_URL || '/', window.location.origin).toString(),
      scopes: 'identify guilds',
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export function useProfile() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['profile', session?.user.id],
    enabled: Boolean(supabase && session?.user.id),
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('profiles')
        .select('*')
        .eq('id', session!.user.id)
        .single();
      queryError(error);
      return toProfile(data as Raw);
    },
  });
}

export function useDashboardSummary() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['dashboard-summary', session?.user.id],
    enabled: Boolean(supabase && session?.user.id),
    queryFn: async (): Promise<DashboardSummary> => {
      const client = requireSupabase();
      const userId = session!.user.id;
      const [servers, memberships, passes, tickets, notifications, notices] =
        await Promise.all([
          client.from('servers').select('id,status,created_at').eq('created_by', userId),
          client.from('server_memberships').select('server_id,status').eq('user_id', userId),
          client.from('passes').select('id,status,expires_at,created_at').eq('owner_id', userId),
          client.from('tickets').select('id,status').eq('requester_id', userId),
          client.from('notifications').select('id').eq('user_id', userId).is('read_at', null),
          client
            .from('announcements')
            .select('id,title,body,created_at,published_at')
            .eq('status', 'published')
            .is('server_id', null)
            .order('published_at', { ascending: false })
            .limit(4),
        ]);
      for (const result of [servers, memberships, passes, tickets, notifications, notices]) {
        queryError(result.error);
      }
      const serverIds = new Set([
        ...(servers.data ?? []).map((row) => row.id),
        ...(memberships.data ?? []).map((row) => row.server_id),
      ]);
      const now = Date.now();
      const validPasses = passes.data ?? [];
      const noticeRows = notices.data ?? [];
      const activityRows = [
        ...(servers.data ?? []).map((row) => ({
          id: `server-${row.id}`,
          action: '서버 등록 요청',
          created_at: row.created_at,
          result: row.status,
        })),
        ...validPasses.map((row) => ({
          id: `pass-${row.id}`,
          action: '이용권 요청',
          created_at: row.created_at,
          result: row.status,
        })),
      ]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
      return {
        serverCount: serverIds.size,
        activeServerCount: (servers.data ?? []).filter((row) => row.status === 'active').length,
        activePassCount: validPasses.filter((row) => row.status === 'paid').length,
        expiringPassCount: validPasses.filter(
          (row) =>
            row.status === 'paid' &&
            row.expires_at &&
            new Date(row.expires_at).getTime() > now &&
            new Date(row.expires_at).getTime() < now + 7 * 24 * 60 * 60 * 1000,
        ).length,
        openTicketCount: (tickets.data ?? []).filter(
          (row) => row.status === 'open' || row.status === 'in_progress',
        ).length,
        unreadNotificationCount: (notifications.data ?? []).length,
        recentNotices: noticeRows.map((row) => ({
          id: row.id,
          title: row.title,
          body: row.body,
          createdAt: row.created_at,
          publishedAt: row.published_at,
        })),
        recentActivity: activityRows.map((row) => ({
          id: row.id,
          label: row.action,
          createdAt: row.created_at,
          result: row.result,
        })),
      };
    },
  });
}

export function useServers() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['servers', session?.user.id],
    enabled: Boolean(supabase && session?.user.id),
    queryFn: async () => {
      const client = requireSupabase();
      const [created, memberships] = await Promise.all([
        client.from('servers').select('*').eq('created_by', session!.user.id),
        client
          .from('server_memberships')
          .select('server_id,servers!inner(*)')
          .eq('user_id', session!.user.id),
      ]);
      queryError(created.error);
      queryError(memberships.error);
      const rows = new Map<string, Raw>();
      for (const row of created.data ?? []) rows.set(row.id, row as Raw);
      for (const row of memberships.data ?? []) {
        const server = row.servers as unknown as Raw | null;
        if (server) rows.set(String(server.id), server);
      }
      return [...rows.values()]
        .map((row) => toServer(row))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  });
}

export async function requestServerRegistration(discordServerId: string) {
  const id = discordServerId.trim();
  if (!/^\d{15,22}$/.test(id)) {
    throw new Error('Discord 서버 ID는 숫자 15~22자리여야 합니다.');
  }
  const { data, error } = await requireSupabase().rpc('request_server_registration', {
    p_discord_server_id: id,
  });
  queryError(error);
  return data as string;
}

export async function cancelServerRegistration(serverId: string) {
  const { data, error } = await requireSupabase().rpc('cancel_server_registration', {
    p_server: serverId,
  });
  queryError(error);
  if (!data) throw new Error('취소할 대기 중인 요청을 찾지 못했습니다.');
}

export function useServerSettings(serverId: string) {
  return useQuery({
    queryKey: ['server-settings', serverId],
    enabled: Boolean(supabase && serverId),
    queryFn: async (): Promise<ServerSettings | null> => {
      const client = requireSupabase();
      const [settings, words] = await Promise.all([
        client.from('server_settings').select('settings,updated_at').eq('server_id', serverId).maybeSingle(),
        client.from('blocked_words').select('id,word,action').eq('server_id', serverId).order('created_at'),
      ]);
      queryError(settings.error);
      queryError(words.error);
      if (!settings.data) return null;
      const settingsValue = settings.data.settings as Record<string, unknown>;
      const automod = (settingsValue.automod ?? {}) as ServerSettings['automod'];
      return {
        serverId,
        blockedWords: (words.data ?? []).map((row) => ({
          id: row.id,
          word: row.word,
          action: row.action as ServerSettings['blockedWords'][number]['action'],
        })),
        automod,
        updatedAt: settings.data.updated_at,
      };
    },
  });
}

export async function saveServerSettings(
  serverId: string,
  settings: Pick<ServerSettings, 'automod'>,
) {
  const client = requireSupabase();
  const { data: userResult } = await client.auth.getUser();
  if (!userResult.user) throw new Error('로그인 세션이 만료되었습니다.');
  const { error } = await client.from('server_settings').upsert({
    server_id: serverId,
    updated_by: userResult.user.id,
    settings: { automod: settings.automod },
  });
  queryError(error);
}

export async function addBlockedWord(serverId: string, word: string) {
  const normalizedWord = word.trim();
  if (!normalizedWord || normalizedWord.length > 100) {
    throw new Error('차단 단어는 1~100자로 입력해 주세요.');
  }
  const client = requireSupabase();
  const { data: userResult } = await client.auth.getUser();
  if (!userResult.user) throw new Error('로그인 세션이 만료되었습니다.');
  const { error } = await client.from('blocked_words').insert({
    server_id: serverId,
    word: normalizedWord,
    created_by: userResult.user.id,
  });
  queryError(error);
}

export async function deleteBlockedWord(serverId: string, wordId: string) {
  const { error } = await requireSupabase()
    .from('blocked_words')
    .delete()
    .eq('id', wordId)
    .eq('server_id', serverId);
  queryError(error);
}

export function usePassProducts() {
  return useQuery({
    queryKey: ['pass-products'],
    enabled: Boolean(supabase),
    queryFn: async (): Promise<PassProduct[]> => {
      const { data, error } = await requireSupabase()
        .from('pass_products')
        .select('*')
        .eq('active', true)
        .order('duration_days');
      queryError(error);
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        durationDays: row.duration_days as PassProduct['durationDays'],
        price: Number(row.price),
        active: row.active,
      }));
    },
  });
}

export function usePasses() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['passes', session?.user.id],
    enabled: Boolean(supabase && session?.user.id),
    queryFn: async (): Promise<Pass[]> => {
      const { data, error } = await requireSupabase()
        .from('passes')
        .select('id,product_id,server_id,status,starts_at,expires_at,created_at')
        .eq('owner_id', session!.user.id)
        .order('created_at', { ascending: false });
      queryError(error);
      return (data ?? []).map((row) => ({
        id: row.id,
        productId: row.product_id,
        serverId: row.server_id,
        status: row.status as Pass['status'],
        startsAt: row.starts_at,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      }));
    },
  });
}

export async function requestPass(productId: string, serverId: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('request_pass', {
    p_product: productId,
    p_server: serverId,
  });
  queryError(error);
  return data;
}

export function useTickets() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['tickets', session?.user.id],
    enabled: Boolean(supabase && session?.user.id),
    queryFn: async (): Promise<Ticket[]> => {
      const { data, error } = await requireSupabase()
        .from('tickets')
        .select('id,subject,status,category,created_at,updated_at')
        .eq('requester_id', session!.user.id)
        .order('updated_at', { ascending: false });
      queryError(error);
      return (data ?? []).map((row) => ({
        id: row.id,
        subject: row.subject,
        status: row.status as Ticket['status'],
        category: row.category as Ticket['category'],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },
  });
}

export async function createTicket(subject: string, message: string) {
  const { data, error } = await requireSupabase().rpc('create_support_ticket', {
    p_subject: subject.trim(),
    p_message: message.trim(),
    p_category: 'support',
  });
  queryError(error);
  return data as string;
}

export function useChatRooms() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['chat-rooms', session?.user.id],
    enabled: Boolean(supabase && session?.user.id),
    queryFn: async (): Promise<ChatRoom[]> => {
      const { data, error } = await requireSupabase()
        .from('chat_room_members')
        .select('room_id,chat_rooms(id,kind,title,updated_at)')
        .eq('user_id', session!.user.id)
        .is('left_at', null);
      queryError(error);
      return (data ?? [])
        .map((row) => row.chat_rooms as unknown as Raw | null)
        .filter((row): row is Raw => Boolean(row))
        .map((row) => ({
          id: String(row.id),
          type: row.kind as ChatRoom['type'],
          title: String(row.title),
          lastMessageAt: (row.updated_at as string | null) ?? null,
        }));
    },
  });
}

export function useChatMessages(roomId: string) {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const [realtimeStatus, setRealtimeStatus] = useState<
    'connecting' | 'connected' | 'reconnecting' | 'closed'
  >('connecting');
  const query = useQuery({
    queryKey: ['chat-messages', roomId],
    enabled: Boolean(supabase && roomId),
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await requireSupabase()
        .from('chat_messages')
        .select('id,room_id,author_id,body,created_at,edited_at,deleted_at,profiles(display_name,username)')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(100);
      queryError(error);
      return (data ?? []).reverse().map((row) => ({
        id: row.id,
        roomId: row.room_id,
        authorId: row.author_id,
        authorName:
          (row.profiles as unknown as { display_name?: string | null; username?: string | null } | null)
            ?.display_name ??
          (row.profiles as unknown as { username?: string | null } | null)?.username ??
          '상담 참여자',
        isOwn: row.author_id === session?.user.id,
        body: row.body,
        createdAt: row.created_at,
        editedAt: row.edited_at,
        deletedAt: row.deleted_at,
      }));
    },
  });

  useEffect(() => {
    if (!supabase || !roomId) return;
    setRealtimeStatus('connecting');
    const channel = supabase
      .channel(`chat:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['chat-messages', roomId] });
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('reconnecting');
        } else if (status === 'CLOSED') setRealtimeStatus('closed');
      });
    return () => {
      setRealtimeStatus('closed');
      void supabase?.removeChannel(channel);
    };
  }, [queryClient, roomId, session?.user.id]);

  return { ...query, realtimeStatus };
}

export async function markRoomRead(roomId: string) {
  const { error } = await requireSupabase().rpc('mark_room_read', { p_room: roomId });
  queryError(error);
}

export async function editChatMessage(messageId: string, body: string) {
  const { data, error } = await requireSupabase().rpc('edit_own_chat_message', {
    p_message: messageId,
    p_body: body,
  });
  queryError(error);
  if (!data) throw new Error('수정할 수 없는 메시지입니다.');
}

export async function deleteChatMessage(messageId: string) {
  const { data, error } = await requireSupabase().rpc('soft_delete_own_chat_message', {
    p_message: messageId,
  });
  queryError(error);
  if (!data) throw new Error('삭제할 수 없는 메시지입니다.');
}

export async function sendChatMessage(roomId: string, body: string) {
  const client = requireSupabase();
  const content = body.trim();
  if (!content || content.length > 10000) throw new Error('메시지는 1~10,000자여야 합니다.');
  const { data: userResult } = await client.auth.getUser();
  if (!userResult.user) throw new Error('로그인 세션이 만료되었습니다.');
  const { error } = await client.from('chat_messages').insert({
    room_id: roomId,
    author_id: userResult.user.id,
    body: content,
  });
  queryError(error);
}

export async function updateProfilePreferences(
  preferences: { theme?: 'light' | 'dark' | 'system'; notifications?: Record<string, boolean> },
) {
  const client = requireSupabase();
  const { data: userResult } = await client.auth.getUser();
  if (!userResult.user) throw new Error('로그인 세션이 만료되었습니다.');
  const updates: Record<string, unknown> = {};
  if (preferences.theme) updates.theme = preferences.theme;
  if (preferences.notifications) updates.notification_preferences = preferences.notifications;
  const { error } = await client.from('profiles').update(updates).eq('id', userResult.user.id);
  queryError(error);
}

export function useOwnerAccess() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['owner-access', session?.user.id],
    enabled: Boolean(supabase && session?.user.id),
    retry: false,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('user_roles')
        .select('role')
        .eq('user_id', session!.user.id)
        .maybeSingle();
      queryError(error);
      return data?.role === 'owner';
    },
  });
}

export function useOwnerSummary() {
  const access = useOwnerAccess();
  return useQuery({
    queryKey: ['owner-summary'],
    enabled: Boolean(supabase && access.data === true),
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('owner_dashboard_summary');
      queryError(error);
      return data as Record<string, number>;
    },
  });
}

export async function ownerAdmin(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<Record<string, any>> {
  const { data, error } = await requireSupabase().functions.invoke('owner-admin', {
    body: { action, ...payload },
  });
  if (error) {
    const context = (error as unknown as { context?: Response }).context;
    if (context instanceof Response) {
      const body = (await context.clone().json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || error.message);
    }
    throw error;
  }
  if (data?.error) throw new Error(String(data.error));
  return data as Record<string, any>;
}

function useOwnerQuery<T>(
  key: string[],
  action: string,
  payload: Record<string, unknown> = {},
  enabled = true,
) {
  const access = useOwnerAccess();
  return useQuery<T>({
    queryKey: [...key, payload],
    enabled: Boolean(supabase && enabled && access.data === true),
    queryFn: async () => {
      const result = await ownerAdmin(action, payload);
      return result as T;
    },
  });
}

export function useOwnerUsers(term: string) {
  return useOwnerQuery<{ users: Array<Record<string, any>> }>(['owner-users'], 'list_users', { term });
}

export function useOwnerServers() {
  return useOwnerQuery<{ servers: Array<Record<string, any>> }>(['owner-servers'], 'list_servers');
}

export function useOwnerPayments() {
  return useOwnerQuery<{ payments: Array<Record<string, any>> }>(['owner-payments'], 'list_payments');
}

export function useOwnerProducts() {
  return useOwnerQuery<{ products: Array<Record<string, any>> }>(['owner-products'], 'list_products');
}

export function useOwnerTickets() {
  return useOwnerQuery<{ tickets: Array<Record<string, any>> }>(['owner-tickets'], 'list_tickets');
}

export function useOwnerTicketMessages(ticketId: string) {
  return useOwnerQuery<{ messages: Array<Record<string, any>> }>(
    ['owner-ticket-messages', ticketId],
    'ticket_messages',
    { ticketId },
    Boolean(ticketId),
  );
}

export function useOwnerAudit() {
  return useOwnerQuery<{ logs: Array<Record<string, any>> }>(['owner-audit'], 'list_audit');
}

export function useOwnerMaintenance() {
  return useOwnerQuery<{ enabled: boolean; message: string }>(
    ['owner-maintenance'],
    'get_maintenance',
  );
}

export async function runOwnerBootstrap() {
  const { data, error } = await requireSupabase().functions.invoke('owner-bootstrap');
  if (error) throw error;
  return data;
}

export function invalidateTendQueries(keys: string[][]) {
  // Query invalidation belongs to the component's existing QueryClient. This
  // placeholder is intentionally omitted; callers use useQueryClient directly.
  void keys;
}

export function hasActiveSession(session: Session | null) {
  return Boolean(session?.user.id);
}
