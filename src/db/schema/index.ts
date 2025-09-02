import { pgTable, varchar, serial, boolean, timestamp, text, integer, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table - synced with Supabase Auth
export const users = pgTable('users', {
  id: varchar('id').primaryKey(), // Supabase auth UID
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Boards table
export const boards = pgTable('boards', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  ownerId: varchar('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Board members table - for permissions and access control
export const boardMembers = pgTable('board_members', {
  boardId: integer('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  userId: varchar('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { enum: ['owner', 'admin', 'member', 'viewer'] }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.boardId, table.userId] }),
}));

// Columns table
export const columns = pgTable('columns', {
  id: serial('id').primaryKey(),
  boardId: integer('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 120 }).notNull(),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Cards table
export const cards = pgTable('cards', {
  id: serial('id').primaryKey(),
  boardId: integer('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  columnId: integer('column_id').notNull().references(() => columns.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 160 }).notNull(),
  description: text('description'),
  assigneeId: varchar('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  dueDate: timestamp('due_date'),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Labels table
export const labels = pgTable('labels', {
  id: serial('id').primaryKey(),
  boardId: integer('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 50 }).notNull(),
  color: varchar('color', { length: 7 }).default('#6b7280'), // hex color
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Card labels junction table
export const cardLabels = pgTable('card_labels', {
  cardId: integer('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  labelId: integer('label_id').notNull().references(() => labels.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.cardId, table.labelId] }),
}));

// Comments table
export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  cardId: integer('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  authorId: varchar('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations for better TypeScript inference and joins
export const usersRelations = relations(users, ({ many }) => ({
  ownedBoards: many(boards),
  boardMemberships: many(boardMembers),
  assignedCards: many(cards),
  comments: many(comments),
}));

export const boardsRelations = relations(boards, ({ one, many }) => ({
  owner: one(users, {
    fields: [boards.ownerId],
    references: [users.id],
  }),
  members: many(boardMembers),
  columns: many(columns),
  cards: many(cards),
  labels: many(labels),
}));

export const boardMembersRelations = relations(boardMembers, ({ one }) => ({
  board: one(boards, {
    fields: [boardMembers.boardId],
    references: [boards.id],
  }),
  user: one(users, {
    fields: [boardMembers.userId],
    references: [users.id],
  }),
}));

export const columnsRelations = relations(columns, ({ one, many }) => ({
  board: one(boards, {
    fields: [columns.boardId],
    references: [boards.id],
  }),
  cards: many(cards),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  board: one(boards, {
    fields: [cards.boardId],
    references: [boards.id],
  }),
  column: one(columns, {
    fields: [cards.columnId],
    references: [columns.id],
  }),
  assignee: one(users, {
    fields: [cards.assigneeId],
    references: [users.id],
  }),
  labels: many(cardLabels),
  comments: many(comments),
}));

export const labelsRelations = relations(labels, ({ one, many }) => ({
  board: one(boards, {
    fields: [labels.boardId],
    references: [boards.id],
  }),
  cards: many(cardLabels),
}));

export const cardLabelsRelations = relations(cardLabels, ({ one }) => ({
  card: one(cards, {
    fields: [cardLabels.cardId],
    references: [cards.id],
  }),
  label: one(labels, {
    fields: [cardLabels.labelId],
    references: [labels.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  card: one(cards, {
    fields: [comments.cardId],
    references: [cards.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
}));
