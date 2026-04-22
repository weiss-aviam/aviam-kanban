import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/supabase/server";

const Schema = z.object({ enabled: z.boolean() });

export async function PATCH(req: NextRequest) {
  const { supabase, user } = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("users")
    .update({ api_access_enabled: parsed.data.enabled })
    .eq("id", user.id);

  if (error) {
    console.error("Toggle api_access_enabled error:", error);
    return NextResponse.json(
      {
        error: "Failed to update API access setting",
        details:
          process.env.NODE_ENV !== "production" ? error.message : undefined,
      },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, enabled: parsed.data.enabled });
}
