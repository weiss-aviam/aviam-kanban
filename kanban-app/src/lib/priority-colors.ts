import type { CardPriority } from '@/types/database';
import type { Card } from '@/types/database';

// Re-export CardPriority for use in other components
export type { CardPriority };

/**
 * Priority configuration with colors, labels, and styling
 */
export interface PriorityConfig {
  color: string;
  bgColor: string;
  label: string;
  badgeClass: string;
  borderColor: string;
  icon: string;
}

/**
 * Priority configurations for each priority level
 */
const PRIORITY_CONFIGS: Record<CardPriority, PriorityConfig> = {
  high: {
    color: '#dc2626', // red-600
    bgColor: '#fef2f2', // red-50
    label: 'HIGH',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
    borderColor: '#dc2626',
    icon: 'AlertTriangle',
  },
  medium: {
    color: '#d97706', // amber-600
    bgColor: '#fffbeb', // amber-50
    label: 'MEDIUM',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    borderColor: '#d97706',
    icon: 'Flag',
  },
  low: {
    color: '#059669', // emerald-600
    bgColor: '#ecfdf5', // emerald-50
    label: 'LOW',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    borderColor: '#059669',
    icon: 'Minus',
  },
};

/**
 * Get priority configuration including colors and labels
 */
export function getPriorityConfig(priority: CardPriority): PriorityConfig {
  return PRIORITY_CONFIGS[priority];
}

/**
 * Get Tailwind classes for priority badge
 */
export function getPriorityBadgeClasses(priority: CardPriority): string {
  return PRIORITY_CONFIGS[priority].badgeClass;
}

/**
 * Get capitalized priority label
 */
export function getPriorityLabel(priority: CardPriority): string {
  return PRIORITY_CONFIGS[priority].label;
}

/**
 * Get priority color for styling
 */
export function getPriorityColor(priority: CardPriority): string {
  return PRIORITY_CONFIGS[priority].color;
}

/**
 * Get priority background color for styling
 */
export function getPriorityBgColor(priority: CardPriority): string {
  return PRIORITY_CONFIGS[priority].bgColor;
}

/**
 * Get priority border color for card accents
 */
export function getPriorityBorderColor(priority: CardPriority): string {
  return PRIORITY_CONFIGS[priority].borderColor;
}

/**
 * Get priority icon name
 */
export function getPriorityIcon(priority: CardPriority): string {
  return PRIORITY_CONFIGS[priority].icon;
}

/**
 * Priority order for sorting (high = 0, medium = 1, low = 2)
 */
const PRIORITY_ORDER: Record<CardPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Sort cards by priority (high -> medium -> low)
 */
export function sortCardsByPriority(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const priorityA = a.priority || 'medium';
    const priorityB = b.priority || 'medium';
    return PRIORITY_ORDER[priorityA as CardPriority] - PRIORITY_ORDER[priorityB as CardPriority];
  });
}

/**
 * Filter cards by priority
 */
export function filterCardsByPriority(cards: Card[], priority: CardPriority | 'all'): Card[] {
  if (priority === 'all') {
    return cards;
  }
  return cards.filter(card => (card.priority || 'medium') === priority);
}

/**
 * Get all available priorities for dropdowns/selectors
 */
export function getAllPriorities(): { value: CardPriority; label: string; config: PriorityConfig }[] {
  return Object.entries(PRIORITY_CONFIGS).map(([value, config]) => ({
    value: value as CardPriority,
    label: config.label,
    config,
  }));
}

/**
 * Get priority statistics for a list of cards
 */
export function getPriorityStats(cards: Card[]): Record<CardPriority, number> {
  const stats: Record<CardPriority, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };

  cards.forEach(card => {
    const priority = (card.priority || 'medium') as CardPriority;
    stats[priority]++;
  });

  return stats;
}

/**
 * Check if a priority is considered urgent (high priority)
 */
export function isUrgentPriority(priority: CardPriority): boolean {
  return priority === 'high';
}

/**
 * Get CSS custom properties for priority styling
 */
export function getPriorityCSSProperties(priority: CardPriority): Record<string, string> {
  const config = getPriorityConfig(priority);
  return {
    '--priority-color': config.color,
    '--priority-bg-color': config.bgColor,
    '--priority-border-color': config.borderColor,
  };
}

/**
 * Get priority level as number (for calculations)
 */
export function getPriorityLevel(priority: CardPriority): number {
  return PRIORITY_ORDER[priority];
}

/**
 * Get priority from level number
 */
export function getPriorityFromLevel(level: number): CardPriority {
  const priorities = Object.entries(PRIORITY_ORDER);
  const found = priorities.find(([, orderLevel]) => orderLevel === level);
  return (found?.[0] as CardPriority) || 'medium';
}
