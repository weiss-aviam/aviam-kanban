import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { ApiAccessContent } from "@/components/api-access/ApiAccessContent";

export default async function ApiAccessPage() {
  const { supabase, user } = await getSessionUser();
  if (!user) redirect("/login");

  const [{ data: u }, { data: tokens }] = await Promise.all([
    supabase
      .from("users")
      .select("api_access_enabled")
      .eq("id", user.id)
      .single(),
    supabase
      .from("api_tokens")
      .select("id, name, prefix, last_used_at, created_at, revoked_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <ApiAccessContent
      initialEnabled={u?.api_access_enabled ?? false}
      initialTokens={(tokens ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        prefix: r.prefix,
        lastUsedAt: r.last_used_at,
        createdAt: r.created_at,
        revokedAt: r.revoked_at,
      }))}
    />
  );
}
