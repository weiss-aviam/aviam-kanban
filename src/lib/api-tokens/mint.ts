import type { SupabaseClient } from "@supabase/supabase-js";
import { generateToken } from "./format";
import { hashToken } from "./hash";

export interface MintResult {
  token: string;
  row: {
    id: string;
    name: string;
    prefix: string;
    createdAt: string;
  };
}

export async function mintToken(args: {
  userId: string;
  name: string;
  supabase: SupabaseClient;
}): Promise<MintResult> {
  const token = generateToken();
  const prefix = token.slice(0, 8);
  const tokenHash = await hashToken(token);

  const { data, error } = await args.supabase
    .from("api_tokens")
    .insert({
      user_id: args.userId,
      name: args.name,
      token_hash: tokenHash,
      prefix,
    })
    .select("id, name, prefix, created_at")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to mint token: ${error?.message ?? "no row returned"}`,
    );
  }

  return {
    token,
    row: {
      id: data.id,
      name: data.name,
      prefix,
      createdAt: data.created_at,
    },
  };
}
