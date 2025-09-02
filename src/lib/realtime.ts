import { createClient } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Create Supabase client for Realtime
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimePayload<T = any> {
  eventType: RealtimeEvent;
  new: T;
  old: T;
  errors: any[];
}

export interface BoardRealtimeHandlers {
  onCardChange?: (payload: RealtimePayload) => void;
  onColumnChange?: (payload: RealtimePayload) => void;
  onCommentChange?: (payload: RealtimePayload) => void;
  onLabelChange?: (payload: RealtimePayload) => void;
  onCardLabelChange?: (payload: RealtimePayload) => void;
  onBoardMemberChange?: (payload: RealtimePayload) => void;
}

/**
 * Subscribe to real-time changes for a specific board
 */
export function subscribeToBoardChanges(
  boardId: number,
  handlers: BoardRealtimeHandlers
): RealtimeChannel {
  const channel = supabase.channel(`board-${boardId}`);

  // Subscribe to card changes
  if (handlers.onCardChange) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'cards',
        filter: `board_id=eq.${boardId}`,
      },
      handlers.onCardChange
    );
  }

  // Subscribe to column changes
  if (handlers.onColumnChange) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'columns',
        filter: `board_id=eq.${boardId}`,
      },
      handlers.onColumnChange
    );
  }

  // Subscribe to comment changes (via cards)
  if (handlers.onCommentChange) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'comments',
      },
      (payload) => {
        // We'll need to check if the comment belongs to a card on this board
        // This could be optimized with a database function or view
        handlers.onCommentChange!(payload);
      }
    );
  }

  // Subscribe to label changes
  if (handlers.onLabelChange) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'labels',
        filter: `board_id=eq.${boardId}`,
      },
      handlers.onLabelChange
    );
  }

  // Subscribe to card label changes
  if (handlers.onCardLabelChange) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'card_labels',
      },
      (payload) => {
        // We'll need to check if the card label belongs to a card on this board
        handlers.onCardLabelChange!(payload);
      }
    );
  }

  // Subscribe to board member changes
  if (handlers.onBoardMemberChange) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'board_members',
        filter: `board_id=eq.${boardId}`,
      },
      handlers.onBoardMemberChange
    );
  }

  // Subscribe to the channel
  channel.subscribe((status) => {
    console.log(`Board ${boardId} realtime status:`, status);
  });

  return channel;
}

/**
 * Unsubscribe from board changes
 */
export function unsubscribeFromBoardChanges(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}

/**
 * Subscribe to presence (users currently viewing the board)
 */
export function subscribeToBoardPresence(
  boardId: number,
  userId: string,
  userInfo: { name?: string; avatar?: string }
) {
  const channel = supabase.channel(`board-presence-${boardId}`, {
    config: {
      presence: {
        key: userId,
      },
    },
  });

  // Track user presence
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    console.log('Presence sync:', state);
  });

  channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
    console.log('User joined:', key, newPresences);
  });

  channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    console.log('User left:', key, leftPresences);
  });

  // Join the presence
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        user_id: userId,
        ...userInfo,
        online_at: new Date().toISOString(),
      });
    }
  });

  return channel;
}

export { supabase };
