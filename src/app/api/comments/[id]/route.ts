import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedUser } from "../../../../lib/supabase/server";
import { z } from "zod";

const updateCommentSchema = z.object({
  body: z
    .string()
    .min(1, "Comment body is required")
    .max(1000, "Comment too long"),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const { supabase, user } = await getAuthorizedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const commentId = id;

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(commentId)) {
      return NextResponse.json(
        { error: "Invalid comment ID" },
        { status: 400 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateCommentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 },
      );
    }

    const { body: commentBody } = validation.data;

    // Update the comment using Supabase (respects RLS)
    const { data: updatedComment, error: updateError } = await supabase
      .from("comments")
      .update({ body: commentBody, edited_at: new Date().toISOString() })
      .eq("id", commentId)
      .select(
        `
        id,
        card_id,
        author_id,
        body,
        created_at,
        edited_at,
        deleted_at,
        users!inner(id, email, name)
      `,
      )
      .single();

    if (updateError) {
      console.error("Update comment error:", updateError);
      return NextResponse.json(
        { error: "Failed to update comment or access denied" },
        { status: 500 },
      );
    }

    // Transform response to match expected format
    const transformedComment = {
      id: updatedComment.id,
      cardId: updatedComment.card_id,
      authorId: updatedComment.author_id,
      body: updatedComment.body,
      createdAt: updatedComment.created_at,
      editedAt:
        (updatedComment as unknown as { edited_at?: string | null })
          .edited_at ?? null,
      deletedAt:
        (updatedComment as unknown as { deleted_at?: string | null })
          .deleted_at ?? null,
      author: (() => {
        const u = (updatedComment as unknown as { users?: unknown }).users as
          | { id: string; email: string; name: string | null }
          | { id: string; email: string; name: string | null }[]
          | undefined;
        return {
          id: Array.isArray(u) ? u[0]?.id : u?.id,
          email: Array.isArray(u) ? u[0]?.email : u?.email,
          name: Array.isArray(u) ? u[0]?.name : u?.name,
        };
      })(),
    };

    return NextResponse.json(transformedComment);
  } catch (error) {
    console.error("Update comment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const { supabase, user } = await getAuthorizedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const commentId = id;

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(commentId)) {
      return NextResponse.json(
        { error: "Invalid comment ID" },
        { status: 400 },
      );
    }

    // Soft-delete: set deleted_at instead of removing the row so the thread position is preserved
    const deletedAt = new Date().toISOString();
    const { error: deleteError } = await supabase
      .from("comments")
      .update({ deleted_at: deletedAt })
      .eq("id", commentId);

    if (deleteError) {
      console.error("Delete comment error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete comment or access denied" },
        { status: 500 },
      );
    }

    return NextResponse.json({ deletedAt });
  } catch (error) {
    console.error("Delete comment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
