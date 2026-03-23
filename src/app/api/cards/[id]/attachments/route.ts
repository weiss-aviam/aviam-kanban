import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotifications } from "@/lib/notifications";

const BUCKET = "card-attachments";
const SIGNED_URL_TTL = 3600; // 1 hour

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: cardId } = await params;
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify card access via RLS
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

    // List files in storage at path {cardId}/
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET)
      .list(cardId, { sortBy: { column: "created_at", order: "asc" } });

    if (listError) {
      return NextResponse.json(
        { error: "Failed to list attachments" },
        { status: 500 },
      );
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ attachments: [] });
    }

    // Generate signed URLs for all files
    const paths = files.map((f) => `${cardId}/${f.name}`);
    const { data: signedUrls, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL);

    if (signError) {
      return NextResponse.json(
        { error: "Failed to generate download URLs" },
        { status: 500 },
      );
    }

    const attachments = files.map((f, i) => ({
      name: f.name,
      path: `${cardId}/${f.name}`,
      size: f.metadata?.size ?? null,
      mimeType: f.metadata?.mimetype ?? null,
      createdAt: f.created_at,
      downloadUrl: signedUrls?.[i]?.signedUrl ?? null,
    }));

    return NextResponse.json({ attachments });
  } catch (error) {
    console.error("GET attachments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: cardId } = await params;
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify card access and get assignee for notification
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large (max 20 MB)" },
        { status: 400 },
      );
    }

    const sanitizedName = sanitizeFilename(file.name);
    const storagePath = `${cardId}/${sanitizedName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, {
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 },
      );
    }

    // Generate signed URL for immediate use
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL);

    // Notify card assignee if they are not the uploader
    if (card.assignee_id && card.assignee_id !== user.id) {
      await createNotifications(createAdminClient(), [
        {
          user_id: card.assignee_id,
          type: "file_upload",
          actor_id: user.id,
          card_id: cardId,
          board_id: card.board_id,
          metadata: { fileName: sanitizedName, filePath: storagePath },
        },
      ]);
    }

    return NextResponse.json(
      {
        attachment: {
          name: sanitizedName,
          path: storagePath,
          size: file.size,
          mimeType: file.type,
          downloadUrl: signed?.signedUrl ?? null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST attachment error:", error);
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
  const { id: cardId } = await params;
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify card access
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

    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("path");

    if (!filePath) {
      return NextResponse.json({ error: "path is required" }, { status: 400 });
    }

    // Ensure the path belongs to this card (security: prevent path traversal)
    if (!filePath.startsWith(`${cardId}/`)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const { error: deleteError } = await supabase.storage
      .from(BUCKET)
      .remove([filePath]);

    if (deleteError) {
      console.error("Delete attachment error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete file" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE attachment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
