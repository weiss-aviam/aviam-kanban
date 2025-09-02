'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Filter, X, User, Tag, Calendar } from 'lucide-react';
import type { User as UserType, Label, CardFilters } from '@/types/database';

interface BoardFiltersProps {
  boardMembers: UserType[];
  boardLabels: Label[];
  filters: CardFilters;
  onFiltersChange: (filters: CardFilters) => void;
}

export function BoardFilters({
  boardMembers,
  boardLabels,
  filters,
  onFiltersChange,
}: BoardFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  const handleAssigneeChange = (assigneeId: string) => {
    onFiltersChange({
      ...filters,
      assigneeId: assigneeId === 'all' ? undefined : assigneeId,
    });
  };

  const handleLabelToggle = (labelId: number, checked: boolean) => {
    const currentLabels = filters.labelIds || [];
    const newLabels = checked
      ? [...currentLabels, labelId]
      : currentLabels.filter(id => id !== labelId);
    
    onFiltersChange({
      ...filters,
      labelIds: newLabels.length > 0 ? newLabels : undefined,
    });
  };

  const handleDueDateChange = (dueDate: string) => {
    onFiltersChange({
      ...filters,
      dueDate: dueDate === 'all' ? undefined : dueDate as CardFilters['dueDate'],
    });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = filters.assigneeId || 
    (filters.labelIds && filters.labelIds.length > 0) || 
    filters.dueDate;

  const activeFilterCount = [
    filters.assigneeId,
    filters.labelIds && filters.labelIds.length > 0,
    filters.dueDate,
  ].filter(Boolean).length;

  return (
    <div className="flex items-center space-x-2">
      <Popover open={showFilters} onOpenChange={setShowFilters}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="relative">
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Filters</h4>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear all
                </Button>
              )}
            </div>

            {/* Assignee Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center">
                <User className="w-4 h-4 mr-2" />
                Assignee
              </label>
              <Select
                value={filters.assigneeId || 'all'}
                onValueChange={handleAssigneeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All assignees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All assignees</SelectItem>
                  <SelectItem value="">Unassigned</SelectItem>
                  {boardMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Labels Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center">
                <Tag className="w-4 h-4 mr-2" />
                Labels
              </label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {boardLabels.map((label) => (
                  <div key={label.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`label-${label.id}`}
                      checked={filters.labelIds?.includes(label.id) || false}
                      onCheckedChange={(checked) => 
                        handleLabelToggle(label.id, checked as boolean)
                      }
                    />
                    <label
                      htmlFor={`label-${label.id}`}
                      className="flex items-center space-x-2 cursor-pointer flex-1"
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="text-sm">{label.name}</span>
                    </label>
                  </div>
                ))}
                {boardLabels.length === 0 && (
                  <p className="text-sm text-gray-500">No labels available</p>
                )}
              </div>
            </div>

            {/* Due Date Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                Due Date
              </label>
              <Select
                value={filters.dueDate || 'all'}
                onValueChange={handleDueDateChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All cards" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cards</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="today">Due today</SelectItem>
                  <SelectItem value="week">Due this week</SelectItem>
                  <SelectItem value="none">No due date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="flex items-center space-x-1">
          {filters.assigneeId && (
            <Badge variant="secondary" className="text-xs">
              {filters.assigneeId === '' 
                ? 'Unassigned' 
                : boardMembers.find(m => m.id === filters.assigneeId)?.name || 
                  boardMembers.find(m => m.id === filters.assigneeId)?.email || 
                  'Unknown'
              }
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-1"
                onClick={() => handleAssigneeChange('all')}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}
          
          {filters.labelIds?.map((labelId) => {
            const label = boardLabels.find(l => l.id === labelId);
            return label ? (
              <Badge
                key={labelId}
                variant="secondary"
                className="text-xs"
                style={{ backgroundColor: label.color + '20', color: label.color }}
              >
                {label.name}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 ml-1"
                  onClick={() => handleLabelToggle(labelId, false)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </Badge>
            ) : null;
          })}
          
          {filters.dueDate && (
            <Badge variant="secondary" className="text-xs">
              {filters.dueDate === 'overdue' && 'Overdue'}
              {filters.dueDate === 'today' && 'Due today'}
              {filters.dueDate === 'week' && 'Due this week'}
              {filters.dueDate === 'none' && 'No due date'}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-1"
                onClick={() => handleDueDateChange('all')}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
