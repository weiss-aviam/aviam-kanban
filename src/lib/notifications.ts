import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationType =
  | "mention"
  | "comment_on_assigned"
  | "deadline_change"
  | "file_upload"
  | "card_assigned"
  | "board_member_added"
  | "card_completed"
  | "card_moved";

export type NotificationRow = {
  user_id: string;
  type: NotificationType;
  actor_id: string;
  card_id: string | null;
  board_id: string;
  metadata: Record<string, unknown>;
};

/**
 * Insert one or more notification rows.
 * Non-throwing: a notification failure must never break the primary mutation.
 * Uses the server-side Supabase client which bypasses RLS via the service role key.
 */
export async function createNotifications(
  supabase: SupabaseClient,
  rows: NotificationRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) {
    console.error("[notifications] insert failed:", error.message);
  }
}
