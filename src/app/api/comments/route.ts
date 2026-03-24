import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createNotifications } from "../../../lib/notifications";
import { z } from "zod";

const createCommentSchema = z.object({
  cardId: z.string().uuid("Card ID must be a valid UUID"),
  body: z
    .string()
    .min(1, "Comment body is required")
    .max(1000, "Comment too long"),
  mentionedUserIds: z.array(z.string().uuid()).max(20).optional().default([]),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = createCommentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 },
      );
    }

    const { cardId, body: commentBody, mentionedUserIds } = validation.data;

    // Verify the card exists and user has access (using Supabase RLS)
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id, board_id, assignee_id")
      .eq("id", cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json(
        { error: "Card not found or access denied" },
        { status: 404 },
      );
    }

    // Create the comment using Supabase (respects RLS)
    const { data: newComment, error: commentError } = await supabase
      .from("comments")
      .insert({
        card_id: cardId,
        author_id: user.id,
        body: commentBody,
      })
      .select(
        `
        id,
        card_id,
        author_id,
        body,
        created_at,
        users!inner(id, email, name, avatar_url)
      `,
      )
      .single();

    if (commentError) {
      console.error("Create comment error:", commentError);
      return NextResponse.json(
        { error: "Failed to create comment" },
        { status: 500 },
      );
    }

    // Transform response to match expected format
    const transformedComment = {
      id: newComment.id,
      cardId: newComment.card_id,
      authorId: newComment.author_id,
      body: newComment.body,
      createdAt: newComment.created_at,
      author: (() => {
        const u = (
          newComment as unknown as {
            users?:
              | {
                  id: string;
                  email: string;
                  name: string;
                  avatar_url: string | null;
                }
              | {
                  id: string;
                  email: string;
                  name: string;
                  avatar_url: string | null;
                }[];
          }
        ).users;
        const userObj = Array.isArray(u) ? u[0] : u;
        return {
          id: userObj?.id || "",
          email: userObj?.email || "",
          name: userObj?.name || "",
          avatarUrl: userObj?.avatar_url ?? null,
        };
      })(),
    };

    // ── Notifications (non-throwing) ──────────────────────────────────────
    const notifRows: Parameters<typeof createNotifications>[1] = [];

    // 1. Notify card assignee about the new comment (unless they wrote it)
    const assigneeId = (card as { assignee_id?: string | null }).assignee_id;
    if (assigneeId && assigneeId !== user.id) {
      notifRows.push({
        user_id: assigneeId,
        type: "comment_on_assigned",
        actor_id: user.id,
        card_id: cardId,
        board_id: card.board_id,
        metadata: {
          commentId: newComment.id,
          commentExcerpt: commentBody.slice(0, 120),
        },
      });
    }

    // 2. Notify each valid @mentioned board member (skip self-mentions)
    if (mentionedUserIds.length > 0) {
      // Validate that each mentioned user is actually a board member
      const { data: members } = await supabase
        .from("board_members")
        .select("user_id")
        .eq("board_id", card.board_id)
        .in("user_id", mentionedUserIds);

      const validMentionedIds = new Set((members ?? []).map((m) => m.user_id));

      for (const mentionedId of mentionedUserIds) {
        if (mentionedId === user.id) continue; // skip self
        if (!validMentionedIds.has(mentionedId)) continue; // not a board member
        // Avoid duplicate if assignee was already notified above
        if (mentionedId === assigneeId) continue;
        notifRows.push({
          user_id: mentionedId,
          type: "mention",
          actor_id: user.id,
          card_id: cardId,
          board_id: card.board_id,
          metadata: {
            commentId: newComment.id,
            commentExcerpt: commentBody.slice(0, 120),
          },
        });
      }
    }

    await createNotifications(createAdminClient(), notifRows);
    // ── End notifications ──────────────────────────────────────────────────

    return NextResponse.json(transformedComment, { status: 201 });
  } catch (error) {
    console.error("Create comment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get("cardId");

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!cardId || !uuidRegex.test(cardId)) {
      return NextResponse.json(
        { error: "Valid card UUID is required" },
        { status: 400 },
      );
    }

    // Verify the card exists and user has access (using Supabase RLS)
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id, board_id")
      .eq("id", cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json(
        { error: "Card not found or access denied" },
        { status: 404 },
      );
    }

    // Get comments for the card using Supabase (respects RLS)
    const { data: comments, error: commentsError } = await supabase
      .from("comments")
      .select(
        `
        id,
        card_id,
        author_id,
        body,
        created_at,
        edited_at,
        deleted_at,
        users!inner(id, email, name, avatar_url)
      `,
      )
      .eq("card_id", cardId)
      .order("created_at", { ascending: true });

    if (commentsError) {
      console.error("Get comments error:", commentsError);
      return NextResponse.json(
        { error: "Failed to fetch comments" },
        { status: 500 },
      );
    }

    // Transform response to match expected format
    const transformedComments = comments.map((comment) => ({
      id: comment.id,
      cardId: comment.card_id,
      authorId: comment.author_id,
      body: comment.body,
      createdAt: comment.created_at,
      editedAt:
        (comment as unknown as { edited_at?: string | null }).edited_at ?? null,
      deletedAt:
        (comment as unknown as { deleted_at?: string | null }).deleted_at ??
        null,
      author: (() => {
        const u = (
          comment as unknown as {
            users?:
              | {
                  id: string;
                  email: string;
                  name: string;
                  avatar_url: string | null;
                }
              | {
                  id: string;
                  email: string;
                  name: string;
                  avatar_url: string | null;
                }[];
          }
        ).users;
        const userObj = Array.isArray(u) ? u[0] : u;
        return {
          id: userObj?.id || "",
          email: userObj?.email || "",
          name: userObj?.name || "",
          avatarUrl: userObj?.avatar_url ?? null,
        };
      })(),
    }));

    return NextResponse.json({ comments: transformedComments });
  } catch (error) {
    console.error("Get comments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
