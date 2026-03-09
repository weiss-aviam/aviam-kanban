-- Migration: Add Storage Bucket RLS Policies
-- Secures the 'avatars' and 'card-attachments' Supabase Storage buckets.
-- Avatars: readable by any authenticated user, writable only by the owner.
-- Card attachments: readable/writable only by board members of the card's board.

-- ============================================================
-- avatars bucket
-- ============================================================

-- Read: any authenticated user (needed to display avatars across the app)
CREATE POLICY "Authenticated users can read avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

-- Upload
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Update (required for upsert)
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- card-attachments bucket
-- ============================================================

-- Read: authenticated user must be a member of the board the card belongs to
CREATE POLICY "Board members can read card attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'card-attachments' AND
  EXISTS (
    SELECT 1 FROM cards c
    JOIN board_members bm ON bm.board_id = c.board_id
    WHERE c.id::text = (storage.foldername(name))[1]
      AND bm.user_id = auth.uid()::text
  )
);

-- Upload: same board membership check
CREATE POLICY "Board members can upload card attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'card-attachments' AND
  EXISTS (
    SELECT 1 FROM cards c
    JOIN board_members bm ON bm.board_id = c.board_id
    WHERE c.id::text = (storage.foldername(name))[1]
      AND bm.user_id = auth.uid()::text
  )
);

-- Delete: same board membership check
CREATE POLICY "Board members can delete card attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'card-attachments' AND
  EXISTS (
    SELECT 1 FROM cards c
    JOIN board_members bm ON bm.board_id = c.board_id
    WHERE c.id::text = (storage.foldername(name))[1]
      AND bm.user_id = auth.uid()::text
  )
);
