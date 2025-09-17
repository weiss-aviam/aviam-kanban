import { pgTable, varchar, serial, boolean, timestamp, text, integer, primaryKey, uuid } from 'drizzle-orm/pg-core';
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
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 160 }).notNull(),
  ownerId: varchar('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Board members table - for permissions and access control
export const boardMembers = pgTable('board_members', {
  boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  userId: varchar('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { enum: ['owner', 'admin', 'member', 'viewer'] }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.boardId, table.userId] }),
}));

// Columns table
export const columns = pgTable('columns', {
  id: serial('id').primaryKey(),
  boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 120 }).notNull(),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Cards table
export const cards = pgTable('cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  columnId: integer('column_id').notNull().references(() => columns.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 160 }).notNull(),
  description: text('description'),
  assigneeId: varchar('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  dueDate: timestamp('due_date'),
  priority: varchar('priority', { enum: ['high', 'medium', 'low'] }).default('medium').notNull(),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Labels table
export const labels = pgTable('labels', {
  id: uuid('id').primaryKey().defaultRandom(),
  boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 50 }).notNull(),
  color: varchar('color', { length: 7 }).default('#6b7280'), // hex color
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Card labels junction table
export const cardLabels = pgTable('card_labels', {
  cardId: uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  labelId: uuid('label_id').notNull().references(() => labels.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.cardId, table.labelId] }),
}));

// Comments table
export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  authorId: varchar('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Column templates table
export const columnTemplates = pgTable('column_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  ownerId: varchar('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  isDefault: boolean('is_default').default(false).notNull(),
  isPublic: boolean('is_public').default(false).notNull(), // Allow sharing templates
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Template columns table - stores the column configuration for each template
export const templateColumns = pgTable('template_columns', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').notNull().references(() => columnTemplates.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 120 }).notNull(),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Admin audit log table - tracks all admin actions for security and compliance
export const adminAuditLog = pgTable('admin_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminUserId: varchar('admin_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetUserId: varchar('target_user_id').references(() => users.id, { onDelete: 'set null' }),
  boardId: uuid('board_id').references(() => boards.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 50 }).notNull(), // 'invite_user', 'update_user', 'remove_user', 'reset_password', 'update_role'
  details: text('details'), // JSON string with additional details
  ipAddress: varchar('ip_address', { length: 45 }), // Support IPv6
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// User invitations table - tracks pending invitations
export const userInvitations = pgTable('user_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull(),
  boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  role: varchar('role', { enum: ['admin', 'member', 'viewer'] }).notNull(),
  invitedBy: varchar('invited_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).notNull().unique(), // Invitation token
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations for better TypeScript inference and joins
export const usersRelations = relations(users, ({ many }) => ({
  ownedBoards: many(boards),
  boardMemberships: many(boardMembers),
  assignedCards: many(cards),
  comments: many(comments),
  columnTemplates: many(columnTemplates),
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

export const columnTemplatesRelations = relations(columnTemplates, ({ one, many }) => ({
  owner: one(users, {
    fields: [columnTemplates.ownerId],
    references: [users.id],
  }),
  columns: many(templateColumns),
}));

export const templateColumnsRelations = relations(templateColumns, ({ one }) => ({
  template: one(columnTemplates, {
    fields: [templateColumns.templateId],
    references: [columnTemplates.id],
  }),
}));

export const adminAuditLogRelations = relations(adminAuditLog, ({ one }) => ({
  adminUser: one(users, {
    fields: [adminAuditLog.adminUserId],
    references: [users.id],
  }),
  targetUser: one(users, {
    fields: [adminAuditLog.targetUserId],
    references: [users.id],
  }),
  board: one(boards, {
    fields: [adminAuditLog.boardId],
    references: [boards.id],
  }),
}));

export const userInvitationsRelations = relations(userInvitations, ({ one }) => ({
  board: one(boards, {
    fields: [userInvitations.boardId],
    references: [boards.id],
  }),
  inviter: one(users, {
    fields: [userInvitations.invitedBy],
    references: [users.id],
  }),
}));
