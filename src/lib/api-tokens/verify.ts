import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePrefix } from "./format";
import { verifyToken } from "./hash";

export interface AuthenticatedToken {
  tokenId: string;
  userId: string;
}

interface Args {
  adminClient: SupabaseClient;
}

export async function authenticateBearerToken(
  plain: string,
  args: Args,
): Promise<AuthenticatedToken | null> {
  const prefix = parsePrefix(plain);
  if (!prefix) return null;

  const { data: candidates } = await args.adminClient
    .from("api_tokens")
    .select("id, user_id, token_hash")
    .eq("prefix", prefix)
    .is("revoked_at", null);

  if (!candidates || candidates.length === 0) return null;

  let matched: { id: string; user_id: string } | null = null;
  for (const c of candidates as {
    id: string;
    user_id: string;
    token_hash: string;
  }[]) {
    if (await verifyToken(plain, c.token_hash)) {
      matched = { id: c.id, user_id: c.user_id };
      break;
    }
  }
  if (!matched) return null;

  const { data: user } = await args.adminClient
    .from("users")
    .select("id, api_access_enabled")
    .eq("id", matched.user_id)
    .single();

  if (!user || !user.api_access_enabled) return null;

  void args.adminClient
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", matched.id);

  return { tokenId: matched.id, userId: matched.user_id };
}
