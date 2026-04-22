import type { SupabaseClient } from "@supabase/supabase-js";

const TTL_HOURS = 24;

interface Args {
  tokenId: string;
  key: string | null;
  supabase: SupabaseClient;
}

interface HandlerResult {
  status: number;
  body: unknown;
}

export async function withIdempotency(
  args: Args,
  handler: () => Promise<HandlerResult>,
): Promise<HandlerResult> {
  if (!args.key) return await handler();

  const cutoff = new Date(
    Date.now() - TTL_HOURS * 60 * 60 * 1000,
  ).toISOString();
  const { data: existing } = await args.supabase
    .from("api_idempotency_keys")
    .select("status, response")
    .eq("token_id", args.tokenId)
    .eq("key", args.key)
    .gt("created_at", cutoff)
    .maybeSingle();

  if (existing) {
    return { status: existing.status as number, body: existing.response };
  }

  const result = await handler();
  await args.supabase.from("api_idempotency_keys").insert({
    token_id: args.tokenId,
    key: args.key,
    status: result.status,
    response: result.body as never,
  });
  return result;
}
