import type { Card, CardFilters } from '@/types/database';

/**
 * Utility functions for filtering cards
 */

/**
 * Check if a card matches the assignee filter
 */
function matchesAssigneeFilter(card: Card, assigneeId?: string): boolean {
  if (assigneeId === undefined) return true;
  
  if (assigneeId === '') {
    // Filter for unassigned cards
    return !card.assigneeId;
  }
  
  return card.assigneeId === assigneeId;
}

/**
 * Check if a card matches the labels filter
 */
function matchesLabelsFilter(card: Card, labelIds?: number[]): boolean {
  if (!labelIds || labelIds.length === 0) return true;
  
  const cardLabelIds = card.labels?.map(label => label.id) || [];
  
  // Card must have at least one of the selected labels
  return labelIds.some(labelId => cardLabelIds.includes(labelId));
}

/**
 * Check if a card matches the due date filter
 */
function matchesDueDateFilter(card: Card, dueDateFilter?: CardFilters['dueDate']): boolean {
  if (!dueDateFilter) return true;
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  switch (dueDateFilter) {
    case 'overdue':
      return card.dueDate ? new Date(card.dueDate) < today : false;
    
    case 'today':
      if (!card.dueDate) return false;
      const cardDate = new Date(card.dueDate);
      const cardDay = new Date(cardDate.getFullYear(), cardDate.getMonth(), cardDate.getDate());
      return cardDay.getTime() === today.getTime();
    
    case 'week':
      if (!card.dueDate) return false;
      const dueDate = new Date(card.dueDate);
      return dueDate >= today && dueDate <= weekFromNow;
    
    case 'none':
      return !card.dueDate;
    
    default:
      return true;
  }
}

/**
 * Filter cards based on the provided filters
 */
export function filterCards(cards: Card[], filters: CardFilters): Card[] {
  return cards.filter(card => {
    return (
      matchesAssigneeFilter(card, filters.assigneeId) &&
      matchesLabelsFilter(card, filters.labelIds) &&
      matchesDueDateFilter(card, filters.dueDate)
    );
  });
}

/**
 * Get filter statistics for display
 */
export function getFilterStats(cards: Card[], filters: CardFilters) {
  const filteredCards = filterCards(cards, filters);
  const totalCards = cards.length;
  const filteredCount = filteredCards.length;
  
  return {
    total: totalCards,
    filtered: filteredCount,
    hidden: totalCards - filteredCount,
    hasFilters: !!(filters.assigneeId || 
      (filters.labelIds && filters.labelIds.length > 0) || 
      filters.dueDate),
  };
}

/**
 * Get quick filter suggestions based on card data
 */
export function getFilterSuggestions(cards: Card[]) {
  const assignees = new Set<string>();
  const labels = new Set<number>();
  let hasOverdue = false;
  let hasDueToday = false;
  let hasDueThisWeek = false;
  let hasNoDueDate = false;
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  cards.forEach(card => {
    // Collect assignees
    if (card.assigneeId) {
      assignees.add(card.assigneeId);
    } else {
      assignees.add(''); // Unassigned
    }
    
    // Collect labels
    card.labels?.forEach(label => labels.add(label.id));
    
    // Check due date categories
    if (card.dueDate) {
      const dueDate = new Date(card.dueDate);
      const cardDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      
      if (dueDate < today) {
        hasOverdue = true;
      } else if (cardDay.getTime() === today.getTime()) {
        hasDueToday = true;
      } else if (dueDate <= weekFromNow) {
        hasDueThisWeek = true;
      }
    } else {
      hasNoDueDate = true;
    }
  });
  
  return {
    assigneeIds: Array.from(assignees),
    labelIds: Array.from(labels),
    dueDateOptions: {
      hasOverdue,
      hasDueToday,
      hasDueThisWeek,
      hasNoDueDate,
    },
  };
}

/**
 * Create a URL-safe filter string for sharing filtered views
 */
export function encodeFilters(filters: CardFilters): string {
  const params = new URLSearchParams();
  
  if (filters.assigneeId !== undefined) {
    params.set('assignee', filters.assigneeId);
  }
  
  if (filters.labelIds && filters.labelIds.length > 0) {
    params.set('labels', filters.labelIds.join(','));
  }
  
  if (filters.dueDate) {
    params.set('dueDate', filters.dueDate);
  }
  
  return params.toString();
}

/**
 * Parse filters from a URL string
 */
export function decodeFilters(filterString: string): CardFilters {
  const params = new URLSearchParams(filterString);
  const filters: CardFilters = {};
  
  const assignee = params.get('assignee');
  if (assignee !== null) {
    filters.assigneeId = assignee;
  }
  
  const labels = params.get('labels');
  if (labels) {
    filters.labelIds = labels.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
  }
  
  const dueDate = params.get('dueDate');
  if (dueDate && ['overdue', 'today', 'week', 'none'].includes(dueDate)) {
    filters.dueDate = dueDate as CardFilters['dueDate'];
  }
  
  return filters;
}
