import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { boards, columns, cards, labels, cardLabels, users, boardMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { checkBoardAccess } from '@/db/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const boardId = parseInt(params.id);
    
    if (isNaN(boardId)) {
      return NextResponse.json(
        { error: 'Invalid board ID' },
        { status: 400 }
      );
    }

    // Check if user has access to this board
    const hasAccess = await checkBoardAccess(user.id, boardId, 'viewer');
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Board not found or access denied' },
        { status: 404 }
      );
    }

    // Get board with all related data
    const board = await db
      .select()
      .from(boards)
      .where(eq(boards.id, boardId))
      .limit(1);

    if (board.length === 0) {
      return NextResponse.json(
        { error: 'Board not found' },
        { status: 404 }
      );
    }

    // Get board owner
    const owner = await db
      .select()
      .from(users)
      .where(eq(users.id, board[0].ownerId))
      .limit(1);

    // Get board members
    const members = await db
      .select({
        boardId: boardMembers.boardId,
        userId: boardMembers.userId,
        role: boardMembers.role,
        createdAt: boardMembers.createdAt,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          createdAt: users.createdAt,
        },
      })
      .from(boardMembers)
      .innerJoin(users, eq(boardMembers.userId, users.id))
      .where(eq(boardMembers.boardId, boardId));

    // Get columns
    const boardColumns = await db
      .select()
      .from(columns)
      .where(eq(columns.boardId, boardId))
      .orderBy(columns.position);

    // Get cards with assignees and labels
    const boardCards = await db
      .select({
        id: cards.id,
        boardId: cards.boardId,
        columnId: cards.columnId,
        title: cards.title,
        description: cards.description,
        assigneeId: cards.assigneeId,
        dueDate: cards.dueDate,
        position: cards.position,
        createdAt: cards.createdAt,
        assignee: {
          id: users.id,
          email: users.email,
          name: users.name,
          createdAt: users.createdAt,
        },
      })
      .from(cards)
      .leftJoin(users, eq(cards.assigneeId, users.id))
      .where(eq(cards.boardId, boardId))
      .orderBy(cards.position);

    // Get labels
    const boardLabels = await db
      .select()
      .from(labels)
      .where(eq(labels.boardId, boardId));

    // Get card labels
    const cardLabelRelations = await db
      .select({
        cardId: cardLabels.cardId,
        labelId: cardLabels.labelId,
        label: {
          id: labels.id,
          name: labels.name,
          color: labels.color,
        },
      })
      .from(cardLabels)
      .innerJoin(labels, eq(cardLabels.labelId, labels.id))
      .innerJoin(cards, eq(cardLabels.cardId, cards.id))
      .where(eq(cards.boardId, boardId));

    // Structure the response
    const response = {
      ...board[0],
      owner: owner[0] || null,
      members,
      columns: boardColumns.map(column => ({
        ...column,
        cards: boardCards
          .filter(card => card.columnId === column.id)
          .map(card => ({
            ...card,
            assignee: card.assignee.id ? card.assignee : null,
            labels: cardLabelRelations
              .filter(rel => rel.cardId === card.id)
              .map(rel => rel.label),
          })),
      })),
      labels: boardLabels,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get board error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
