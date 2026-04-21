import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthorizedUser } from "@/lib/supabase/server";
import { ChangesetSchema } from "@/lib/api/changeset-schema";
import { withIdempotency } from "@/lib/api/idempotency";

export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuthorizedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed;
  try {
    const body = await req.json();
    parsed = ChangesetSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      const first = e.issues[0];
      return NextResponse.json(
        {
          error: first?.message ?? "Validation failed",
          at: first?.path?.join(".") ?? "",
          details: e.issues,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const idempotencyKey = req.headers.get("idempotency-key");
  const tokenId = (user as { tokenId?: string }).tokenId ?? null;

  const result = await withIdempotency(
    {
      tokenId: tokenId ?? "session",
      key: tokenId ? idempotencyKey : null,
      supabase,
    },
    async () => {
      const { data, error } = await supabase.rpc("create_board_changeset", {
        payload: parsed,
      });
      if (error) {
        return {
          status: 500,
          body: { error: error.message, details: error },
        };
      }
      return { status: 201, body: data };
    },
  );

  return NextResponse.json(result.body, { status: result.status });
}
