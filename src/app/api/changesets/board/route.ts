import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthorizedUser } from "@/lib/supabase/server";
import { ChangesetSchema } from "@/lib/api/changeset-schema";

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

  const { data, error } = await supabase.rpc("create_board_changeset", {
    payload: parsed,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message, details: error },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
