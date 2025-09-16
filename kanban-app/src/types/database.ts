import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import {
  users,
  boards,
  boardMembers,
  columns,
  cards,
  labels,
  cardLabels,
  comments,
} from '@/db/schema';

// Select types (for reading from database)
export type User = InferSelectModel<typeof users>;
export type Board = InferSelectModel<typeof boards>;
export type BoardMember = InferSelectModel<typeof boardMembers>;
export type Column = InferSelectModel<typeof columns>;
export type Card = InferSelectModel<typeof cards>;
export type Label = InferSelectModel<typeof labels>;
export type CardLabel = InferSelectModel<typeof cardLabels>;
export type Comment = InferSelectModel<typeof comments>;

// Insert types (for creating new records)
export type NewUser = InferInsertModel<typeof users>;
export type NewBoard = InferInsertModel<typeof boards>;
export type NewBoardMember = InferInsertModel<typeof boardMembers>;
export type NewColumn = InferInsertModel<typeof columns>;
export type NewCard = InferInsertModel<typeof cards>;
export type NewLabel = InferInsertModel<typeof labels>;
export type NewCardLabel = InferInsertModel<typeof cardLabels>;
export type NewComment = InferInsertModel<typeof comments>;

// Enum types
export type BoardMemberRole = 'owner' | 'admin' | 'member' | 'viewer';

// Extended types with relations for API responses
export type BoardWithDetails = Board & {
  owner: User;
  members: (BoardMember & { user: User })[];
  columns: (Column & {
    cards: (Card & {
      assignee?: User;
      labels: (CardLabel & { label: Label })[];
      comments: (Comment & { author: User })[];
    })[];
  })[];
  labels: Label[];
  // User's role in this board
  role: BoardMemberRole;
  // Additional computed fields
  memberCount?: number;
  isArchived?: boolean;
  description?: string;
};

export type CardWithDetails = Card & {
  assignee?: User;
  labels: (CardLabel & { label: Label })[];
  comments: (Comment & { author: User })[];
  column: Column;
  board: Board;
};

export type ColumnWithCards = Column & {
  cards: (Card & {
    assignee?: User;
    labels: (CardLabel & { label: Label })[];
  })[];
};

// API request/response types
export type CreateBoardRequest = {
  name: string;
};

export type CreateColumnRequest = {
  boardId: string;
  title: string;
  position: number;
};

export type UpdateColumnRequest = {
  title?: string;
  position?: number;
};

export type CreateCardRequest = {
  boardId: string;
  columnId: number;
  title: string;
  position: number;
};

export type UpdateCardRequest = {
  title?: string;
  description?: string;
  assigneeId?: string | null;
  dueDate?: Date | null;
  columnId?: number;
  position?: number;
};

export type CreateLabelRequest = {
  boardId: string;
  name: string;
  color?: string;
};

export type CreateCommentRequest = {
  cardId: string;
  body: string;
};

export type BulkUpdateCardRequest = {
  id: string;
  columnId: number;
  position: number;
}[];

// Filter types for API queries
export type CardFilters = {
  assigneeId?: string;
  labelIds?: number[];
  dueDate?: 'overdue' | 'today' | 'week' | 'none';
};

// Permission check types
export type PermissionContext = {
  userId: string;
  boardId: string;
  requiredRole?: BoardMemberRole;
};
