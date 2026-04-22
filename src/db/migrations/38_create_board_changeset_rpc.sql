-- Migration 38: atomic board-changeset creation.
-- Wraps board + columns + cards + subtasks insert in a single transaction
-- so a partial failure leaves no orphans. Caller passes a JSONB payload
-- already validated by ChangesetSchema on the Node side. Inserts run with
-- the caller's JWT (SECURITY INVOKER) so all existing RLS policies apply.
--
-- Adapted from plan to match actual schema:
--   * subtasks table is public.card_subtasks (uuid id), not public.subtasks
--   * cards.board_id is NOT NULL — must be set alongside column_id
--   * cards.position is NOT NULL with no default — assigned per column

CREATE OR REPLACE FUNCTION public.create_board_changeset(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id    TEXT := auth.uid()::text;
  v_board      JSONB;
  v_board_id   UUID;
  v_group_id   UUID;
  v_columns    JSONB := payload->'columns';
  v_cards      JSONB := COALESCE(payload->'cards', '[]'::jsonb);
  v_col        JSONB;
  v_card       JSONB;
  v_sub        JSONB;
  v_col_id     INTEGER;
  v_card_id    UUID;
  v_sub_id     UUID;
  v_position   INTEGER;
  v_col_ids    JSONB := '{}'::jsonb;  -- title → column id
  v_col_pos    JSONB := '{}'::jsonb;  -- column id → next card position
  v_inserted_columns JSONB := '[]'::jsonb;
  v_inserted_cards   JSONB := '[]'::jsonb;
  v_subtasks   JSONB;
  v_inserted_subs JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null — caller must be authenticated';
  END IF;

  v_board := payload->'board';
  IF v_board->>'groupId' IS NOT NULL THEN
    v_group_id := (v_board->>'groupId')::uuid;
  END IF;

  -- 1. Insert the board (RLS: any authenticated user; owner_id = caller)
  INSERT INTO public.boards (name, description, owner_id, group_id, created_via)
  VALUES (
    v_board->>'name',
    v_board->>'description',
    v_user_id,
    v_group_id,
    'api'
  )
  RETURNING id INTO v_board_id;

  -- Add the caller as owner board_member (mirrors UI flow)
  INSERT INTO public.board_members (board_id, user_id, role)
  VALUES (v_board_id, v_user_id, 'owner');

  -- 2. Insert columns; build title → id map; init per-column position counter
  FOR v_col IN SELECT * FROM jsonb_array_elements(v_columns) LOOP
    INSERT INTO public.columns (board_id, title, position)
    VALUES (v_board_id, v_col->>'title', (v_col->>'position')::int)
    RETURNING id INTO v_col_id;
    v_col_ids := v_col_ids || jsonb_build_object(v_col->>'title', v_col_id);
    v_col_pos := v_col_pos || jsonb_build_object(v_col_id::text, 0);
    v_inserted_columns := v_inserted_columns || jsonb_build_object(
      'id', v_col_id,
      'title', v_col->>'title',
      'position', (v_col->>'position')::int
    );
  END LOOP;

  -- 3. Insert cards + subtasks
  FOR v_card IN SELECT * FROM jsonb_array_elements(v_cards) LOOP
    v_col_id := (v_col_ids->>(v_card->>'columnRef'))::int;
    IF v_col_id IS NULL THEN
      RAISE EXCEPTION 'columnRef "%" did not resolve', v_card->>'columnRef';
    END IF;

    -- Next position within this column (1-indexed)
    v_position := COALESCE((v_col_pos->>v_col_id::text)::int, 0) + 1;
    v_col_pos := v_col_pos || jsonb_build_object(v_col_id::text, v_position);

    INSERT INTO public.cards (
      board_id, column_id, title, description, priority, due_date,
      position, created_by, created_via
    )
    VALUES (
      v_board_id,
      v_col_id,
      v_card->>'title',
      v_card->>'description',
      COALESCE(v_card->>'priority', 'medium'),
      NULLIF(v_card->>'dueDate', '')::timestamptz,
      v_position,
      v_user_id,
      'api'
    )
    RETURNING id INTO v_card_id;

    v_subtasks := COALESCE(v_card->'subtasks', '[]'::jsonb);
    v_inserted_subs := '[]'::jsonb;
    FOR v_sub IN SELECT * FROM jsonb_array_elements(v_subtasks) LOOP
      INSERT INTO public.card_subtasks (card_id, title, created_via)
      VALUES (v_card_id, v_sub->>'title', 'api')
      RETURNING id INTO v_sub_id;
      v_inserted_subs := v_inserted_subs || jsonb_build_object(
        'id', v_sub_id, 'title', v_sub->>'title'
      );
    END LOOP;

    v_inserted_cards := v_inserted_cards || jsonb_build_object(
      'id', v_card_id,
      'title', v_card->>'title',
      'columnId', v_col_id,
      'subtasks', v_inserted_subs
    );
  END LOOP;

  RETURN jsonb_build_object(
    'board', jsonb_build_object(
      'id', v_board_id,
      'name', v_board->>'name',
      'groupId', v_group_id
    ),
    'columns', v_inserted_columns,
    'cards', v_inserted_cards
  );
END;
$$;

-- Grant execute to the authenticated role (RLS handles per-row authorization)
GRANT EXECUTE ON FUNCTION public.create_board_changeset(JSONB) TO authenticated;
