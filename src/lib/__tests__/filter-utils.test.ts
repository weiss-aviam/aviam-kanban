import { filterCards, getFilterStats } from '../filter-utils';
import type { Card, CardFilters } from '@/types/database';

const mockCards: Card[] = [
  {
    id: 1,
    boardId: 1,
    columnId: 1,
    title: 'Card 1',
    description: 'Description 1',
    assigneeId: 'user-1',
    dueDate: new Date('2024-12-31'),
    position: 1,
    createdAt: new Date('2024-01-01'),
    assignee: {
      id: 'user-1',
      email: 'user1@example.com',
      name: 'User 1',
      createdAt: new Date('2024-01-01'),
    },
    labels: [
      { id: 1, boardId: 1, name: 'Bug', color: '#ef4444' },
      { id: 2, boardId: 1, name: 'High Priority', color: '#f59e0b' },
    ],
  },
  {
    id: 2,
    boardId: 1,
    columnId: 1,
    title: 'Card 2',
    description: 'Description 2',
    assigneeId: 'user-2',
    dueDate: new Date('2020-01-01'), // Overdue
    position: 2,
    createdAt: new Date('2024-01-02'),
    assignee: {
      id: 'user-2',
      email: 'user2@example.com',
      name: 'User 2',
      createdAt: new Date('2024-01-01'),
    },
    labels: [
      { id: 2, boardId: 1, name: 'High Priority', color: '#f59e0b' },
    ],
  },
  {
    id: 3,
    boardId: 1,
    columnId: 2,
    title: 'Card 3',
    description: 'Description 3',
    assigneeId: null,
    dueDate: null,
    position: 1,
    createdAt: new Date('2024-01-03'),
    assignee: null,
    labels: [],
  },
];

describe('filterCards', () => {
  it('returns all cards when no filters applied', () => {
    const filters: CardFilters = {};
    const result = filterCards(mockCards, filters);
    expect(result).toHaveLength(3);
  });

  it('filters by assignee', () => {
    const filters: CardFilters = { assigneeId: 'user-1' };
    const result = filterCards(mockCards, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('filters by unassigned', () => {
    const filters: CardFilters = { assigneeId: '' };
    const result = filterCards(mockCards, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it('filters by labels', () => {
    const filters: CardFilters = { labelIds: [1] };
    const result = filterCards(mockCards, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('filters by multiple labels (OR logic)', () => {
    const filters: CardFilters = { labelIds: [1, 2] };
    const result = filterCards(mockCards, filters);
    expect(result).toHaveLength(2);
  });

  it('filters by overdue cards', () => {
    const filters: CardFilters = { dueDate: 'overdue' };
    const result = filterCards(mockCards, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('filters by cards with no due date', () => {
    const filters: CardFilters = { dueDate: 'none' };
    const result = filterCards(mockCards, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it('combines multiple filters', () => {
    const filters: CardFilters = {
      assigneeId: 'user-1',
      labelIds: [1],
    };
    const result = filterCards(mockCards, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('returns empty array when no cards match filters', () => {
    const filters: CardFilters = {
      assigneeId: 'non-existent-user',
    };
    const result = filterCards(mockCards, filters);
    expect(result).toHaveLength(0);
  });
});

describe('getFilterStats', () => {
  it('returns correct stats with no filters', () => {
    const filters: CardFilters = {};
    const stats = getFilterStats(mockCards, filters);
    
    expect(stats.total).toBe(3);
    expect(stats.filtered).toBe(3);
    expect(stats.hidden).toBe(0);
    expect(stats.hasFilters).toBe(false);
  });

  it('returns correct stats with filters', () => {
    const filters: CardFilters = { assigneeId: 'user-1' };
    const stats = getFilterStats(mockCards, filters);
    
    expect(stats.total).toBe(3);
    expect(stats.filtered).toBe(1);
    expect(stats.hidden).toBe(2);
    expect(stats.hasFilters).toBe(true);
  });

  it('detects filters correctly', () => {
    const filtersWithAssignee: CardFilters = { assigneeId: 'user-1' };
    const filtersWithLabels: CardFilters = { labelIds: [1] };
    const filtersWithDueDate: CardFilters = { dueDate: 'overdue' };
    
    expect(getFilterStats(mockCards, filtersWithAssignee).hasFilters).toBe(true);
    expect(getFilterStats(mockCards, filtersWithLabels).hasFilters).toBe(true);
    expect(getFilterStats(mockCards, filtersWithDueDate).hasFilters).toBe(true);
  });
});
