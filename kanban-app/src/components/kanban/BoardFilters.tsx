'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Filter, SortAsc, SortDesc, X, AlertTriangle, Flag, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CardPriority } from '@/types/database';
import { getPriorityConfig, getAllPriorities } from '@/lib/priority-colors';

export interface BoardFilters {
  priorities: CardPriority[];
  assignees: string[];
  sortBy: 'priority' | 'dueDate' | 'title' | 'created' | 'updated';
  sortOrder: 'asc' | 'desc';
}

interface BoardFiltersProps {
  filters: BoardFilters;
  onFiltersChange: (filters: BoardFilters) => void;
  availableAssignees: { id: string; name: string; email: string }[];
  className?: string;
}

const PRIORITY_ICONS = {
  high: AlertTriangle,
  medium: Flag,
  low: Minus,
};

const SORT_OPTIONS = [
  { value: 'priority', label: 'Priority' },
  { value: 'dueDate', label: 'Due Date' },
  { value: 'title', label: 'Title' },
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
] as const;

export function BoardFilters({
  filters,
  onFiltersChange,
  availableAssignees,
  className,
}: BoardFiltersProps) {
  const priorities = getAllPriorities();
  const hasActiveFilters = filters.priorities.length > 0 || filters.assignees.length > 0;

  const handlePriorityToggle = (priority: CardPriority) => {
    const newPriorities = filters.priorities.includes(priority)
      ? filters.priorities.filter(p => p !== priority)
      : [...filters.priorities, priority];
    
    onFiltersChange({
      ...filters,
      priorities: newPriorities,
    });
  };

  const handleAssigneeToggle = (assigneeId: string) => {
    const newAssignees = filters.assignees.includes(assigneeId)
      ? filters.assignees.filter(id => id !== assigneeId)
      : [...filters.assignees, assigneeId];
    
    onFiltersChange({
      ...filters,
      assignees: newAssignees,
    });
  };

  const handleSortChange = (sortBy: BoardFilters['sortBy']) => {
    onFiltersChange({
      ...filters,
      sortBy,
    });
  };

  const handleSortOrderToggle = () => {
    onFiltersChange({
      ...filters,
      sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc',
    });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      priorities: [],
      assignees: [],
      sortBy: 'created',
      sortOrder: 'desc',
    });
  };

  const clearPriorityFilters = () => {
    onFiltersChange({
      ...filters,
      priorities: [],
    });
  };

  const clearAssigneeFilters = () => {
    onFiltersChange({
      ...filters,
      assignees: [],
    });
  };

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {/* Priority Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8',
              filters.priorities.length > 0 && 'bg-blue-50 border-blue-200'
            )}
          >
            <Filter className="w-4 h-4 mr-1" />
            Priority
            {filters.priorities.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                {filters.priorities.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {priorities.map(({ value, config }) => {
            const Icon = PRIORITY_ICONS[value];
            const isSelected = filters.priorities.includes(value);
            
            return (
              <DropdownMenuCheckboxItem
                key={value}
                checked={isSelected}
                onCheckedChange={() => handlePriorityToggle(value)}
              >
                <Icon 
                  className="w-4 h-4 mr-2" 
                  style={{ color: config.color }}
                />
                {config.label}
              </DropdownMenuCheckboxItem>
            );
          })}
          {filters.priorities.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={clearPriorityFilters}>
                <X className="w-4 h-4 mr-2" />
                Clear Priority Filters
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Assignee Filter */}
      {availableAssignees.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-8',
                filters.assignees.length > 0 && 'bg-green-50 border-green-200'
              )}
            >
              <Filter className="w-4 h-4 mr-1" />
              Assignee
              {filters.assignees.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                  {filters.assignees.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuCheckboxItem
              checked={filters.assignees.includes('unassigned')}
              onCheckedChange={() => handleAssigneeToggle('unassigned')}
            >
              Unassigned
            </DropdownMenuCheckboxItem>
            {availableAssignees.map((assignee) => (
              <DropdownMenuCheckboxItem
                key={assignee.id}
                checked={filters.assignees.includes(assignee.id)}
                onCheckedChange={() => handleAssigneeToggle(assignee.id)}
              >
                {assignee.name || assignee.email}
              </DropdownMenuCheckboxItem>
            ))}
            {filters.assignees.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={clearAssigneeFilters}>
                  <X className="w-4 h-4 mr-2" />
                  Clear Assignee Filters
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Sort Options */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            {filters.sortOrder === 'asc' ? (
              <SortAsc className="w-4 h-4 mr-1" />
            ) : (
              <SortDesc className="w-4 h-4 mr-1" />
            )}
            Sort: {SORT_OPTIONS.find(opt => opt.value === filters.sortBy)?.label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          {SORT_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleSortChange(option.value)}
              className={cn(
                filters.sortBy === option.value && 'bg-gray-100'
              )}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSortOrderToggle}>
            {filters.sortOrder === 'asc' ? (
              <>
                <SortDesc className="w-4 h-4 mr-2" />
                Sort Descending
              </>
            ) : (
              <>
                <SortAsc className="w-4 h-4 mr-2" />
                Sort Ascending
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear All Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllFilters}
          className="h-8 text-gray-500 hover:text-gray-700"
        >
          <X className="w-4 h-4 mr-1" />
          Clear All
        </Button>
      )}

      {/* Active Filter Badges */}
      {filters.priorities.length > 0 && (
        <div className="flex items-center gap-1">
          {filters.priorities.map((priority) => {
            const config = getPriorityConfig(priority);
            const Icon = PRIORITY_ICONS[priority];
            
            return (
              <Badge
                key={priority}
                variant="outline"
                className={cn(config.badgeClass, 'text-xs')}
              >
                <Icon className="w-3 h-3 mr-1" />
                {config.label}
                <button
                  onClick={() => handlePriorityToggle(priority)}
                  className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                >
                  <X className="w-2 h-2" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
