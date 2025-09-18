'use client';

import React from 'react';
import { Check, ChevronDown, AlertTriangle, Flag, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  getPriorityConfig,
  getPriorityLabel,
  getAllPriorities,
  type CardPriority,
} from '@/lib/priority-colors';

interface PrioritySelectorProps {
  value: CardPriority;
  onChange: (priority: CardPriority) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'badge' | 'minimal';
  className?: string;
  placeholder?: string;
}

const PRIORITY_ICONS = {
  high: AlertTriangle,
  medium: Flag,
  low: Minus,
};

export function PrioritySelector({
  value,
  onChange,
  disabled = false,
  size = 'md',
  variant = 'default',
  className,
  placeholder = 'Select priority',
}: PrioritySelectorProps) {
  const priorities = getAllPriorities();
  const currentPriority = getPriorityConfig(value);
  const CurrentIcon = PRIORITY_ICONS[value];

  const sizeClasses = {
    sm: 'h-8 text-xs px-2',
    md: 'h-9 text-sm px-3',
    lg: 'h-10 text-base px-4',
  };

  if (variant === 'badge') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-auto p-1 hover:bg-gray-100',
              disabled && 'opacity-50 cursor-not-allowed',
              className
            )}
          >
            <Badge
              variant="outline"
              className={cn(
                currentPriority.badgeClass,
                'flex items-center gap-1 text-xs font-medium'
              )}
            >
              <CurrentIcon className="w-3 h-3" />
              {currentPriority.label}
            </Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          {priorities.map(({ value: priorityValue, config }) => {
            const Icon = PRIORITY_ICONS[priorityValue];
            const isSelected = priorityValue === value;
            
            return (
              <DropdownMenuItem
                key={priorityValue}
                onClick={() => onChange(priorityValue)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Icon 
                    className="w-4 h-4" 
                    style={{ color: config.color }}
                  />
                  <span className="font-medium">{config.label}</span>
                </div>
                {isSelected && <Check className="w-4 h-4" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (variant === 'minimal') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-auto p-1 hover:bg-gray-100',
              disabled && 'opacity-50 cursor-not-allowed',
              className
            )}
          >
            <CurrentIcon 
              className="w-4 h-4" 
              style={{ color: currentPriority.color }}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          {priorities.map(({ value: priorityValue, config }) => {
            const Icon = PRIORITY_ICONS[priorityValue];
            const isSelected = priorityValue === value;
            
            return (
              <DropdownMenuItem
                key={priorityValue}
                onClick={() => onChange(priorityValue)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Icon 
                    className="w-4 h-4" 
                    style={{ color: config.color }}
                  />
                  <span className="font-medium">{config.label}</span>
                </div>
                {isSelected && <Check className="w-4 h-4" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Default variant
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          className={cn(
            'justify-between',
            sizeClasses[size],
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        >
          <div className="flex items-center gap-2">
            <CurrentIcon 
              className={cn(
                size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
              )}
              style={{ color: currentPriority.color }}
            />
            <span className="font-medium">{currentPriority.label}</span>
          </div>
          <ChevronDown className={cn(
            size === 'sm' ? 'w-3 h-3' : 'w-4 h-4',
            'opacity-50'
          )} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {priorities.map(({ value: priorityValue, config }) => {
          const Icon = PRIORITY_ICONS[priorityValue];
          const isSelected = priorityValue === value;
          
          return (
            <DropdownMenuItem
              key={priorityValue}
              onClick={() => onChange(priorityValue)}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Icon 
                  className="w-4 h-4" 
                  style={{ color: config.color }}
                />
                <span className="font-medium">{config.label}</span>
              </div>
              {isSelected && <Check className="w-4 h-4" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Priority badge component for display-only use
export function PriorityBadge({
  priority,
  size = 'md',
  className,
}: {
  priority: CardPriority;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const config = getPriorityConfig(priority);
  const Icon = PRIORITY_ICONS[priority];

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-2.5 py-1',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        config.badgeClass,
        sizeClasses[size],
        'flex items-center gap-1 font-medium',
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      {config.label}
    </Badge>
  );
}

// Priority indicator for minimal display
export function PriorityIndicator({
  priority,
  size = 'md',
  className,
}: {
  priority: CardPriority;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const config = getPriorityConfig(priority);
  const Icon = PRIORITY_ICONS[priority];

  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <Icon
      className={cn(sizeClasses[size], className)}
      style={{ color: config.color }}
      aria-label={`Priority: ${config.label}`}
    />
  );
}
