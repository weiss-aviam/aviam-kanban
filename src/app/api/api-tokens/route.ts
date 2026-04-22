import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/supabase/server";
import { mintToken } from "@/lib/api-tokens/mint";

const NameSchema = z.object({ name: z.string().trim().min(1).max(80) });

export async function GET() {
  const { supabase, user } = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("api_tokens")
    .select("id, name, prefix, last_used_at, created_at, revoked_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    tokens: (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      prefix: r.prefix,
      lastUsedAt: r.last_used_at,
      createdAt: r.created_at,
      revokedAt: r.revoked_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = NameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid name" },
      { status: 400 },
    );
  }

  const { data: u } = await supabase
    .from("users")
    .select("api_access_enabled")
    .eq("id", user.id)
    .single();
  if (!u?.api_access_enabled) {
    return NextResponse.json(
      { error: "API access is disabled — enable it in settings first." },
      { status: 403 },
    );
  }

  const result = await mintToken({
    userId: user.id,
    name: parsed.data.name,
    supabase,
  });

  return NextResponse.json(
    {
      token: result.token,
      id: result.row.id,
      name: result.row.name,
      prefix: result.row.prefix,
      createdAt: result.row.createdAt,
    },
    { status: 201 },
  );
}
