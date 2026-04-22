import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/supabase/server";

const ParamsSchema = z.object({ id: z.string().uuid() });

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const parsed = ParamsSchema.safeParse(resolved);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid token id" }, { status: 400 });
  }

  const { supabase, user } = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
