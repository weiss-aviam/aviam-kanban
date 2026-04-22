import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

interface Args {
  tokenId: string;
  key: string | null;
  /**
   * Optional admin client override. Defaults to a fresh service-role client.
   * Tests inject a mock here; production callers can omit.
   */
  adminClient?: SupabaseClient;
}

interface HandlerResult {
  status: number;
  body: unknown;
}

// 1-in-N chance per call to opportunistically prune expired rows. Cheap
// (single indexed DELETE) but no need to run on every request.
const SWEEP_PROBABILITY = 0.05;

export async function withIdempotency(
  args: Args,
  handler: () => Promise<HandlerResult>,
): Promise<HandlerResult> {
  if (!args.key) return await handler();

  const admin = args.adminClient ?? createAdminClient();

  if (Math.random() < SWEEP_PROBABILITY) {
    await admin
      .from("api_idempotency_keys")
      .delete()
      .lt("expires_at", new Date().toISOString());
  }

  const { data: existing } = await admin
    .from("api_idempotency_keys")
    .select("status, response")
    .eq("token_id", args.tokenId)
    .eq("key", args.key)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (existing) {
    return { status: existing.status as number, body: existing.response };
  }

  const result = await handler();
  await admin.from("api_idempotency_keys").insert({
    token_id: args.tokenId,
    key: args.key,
    status: result.status,
    response: result.body as never,
  });
  return result;
}
