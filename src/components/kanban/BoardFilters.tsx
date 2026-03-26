"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  SortAsc,
  SortDesc,
  X,
  AlertTriangle,
  Flag,
  Minus,
  User,
  Users,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CardPriority } from "@/types/database";
import { getPriorityConfig, getAllPriorities } from "@/lib/priority-colors";
import { t } from "@/lib/i18n";

export interface BoardFilters {
  priorities: CardPriority[];
  assignees: string[];
  sortBy: "priority" | "dueDate" | "title" | "created" | "updated";
  sortOrder: "asc" | "desc";
}

interface BoardFiltersProps {
  filters: BoardFilters;
  onFiltersChange: (filters: BoardFilters) => void;
  availableAssignees: { id: string; name: string; email: string }[];
  currentUserId?: string | undefined;
  className?: string;
}

const PRIORITY_ICONS = {
  high: AlertTriangle,
  medium: Flag,
  low: Minus,
};

const SORT_OPTIONS = [
  { value: "priority", labelKey: "filters.sortPriority" },
  { value: "dueDate", labelKey: "filters.sortDueDate" },
  { value: "title", labelKey: "filters.sortTitle" },
  { value: "created", labelKey: "filters.sortCreated" },
  { value: "updated", labelKey: "filters.sortUpdated" },
] as const;

export function BoardFilters({
  filters,
  onFiltersChange,
  availableAssignees,
  currentUserId,
  className,
}: BoardFiltersProps) {
  const priorities = getAllPriorities();
  const hasActiveFilters =
    filters.priorities.length > 0 || filters.assignees.length > 0;
  const totalActiveFilters =
    filters.priorities.length + filters.assignees.length;

  const isMyCardsActive =
    !!currentUserId && filters.assignees.includes(currentUserId);

  const handleMyCardsToggle = () => {
    if (!currentUserId) return;
    const newAssignees = isMyCardsActive
      ? filters.assignees.filter((id) => id !== currentUserId)
      : [
          ...filters.assignees.filter((id) => id !== currentUserId),
          currentUserId,
        ];
    onFiltersChange({ ...filters, assignees: newAssignees });
  };

  const handlePriorityToggle = (priority: CardPriority) => {
    const newPriorities = filters.priorities.includes(priority)
      ? filters.priorities.filter((p) => p !== priority)
      : [...filters.priorities, priority];
    onFiltersChange({ ...filters, priorities: newPriorities });
  };

  const handleAssigneeToggle = (assigneeId: string) => {
    const newAssignees = filters.assignees.includes(assigneeId)
      ? filters.assignees.filter((id) => id !== assigneeId)
      : [...filters.assignees, assigneeId];
    onFiltersChange({ ...filters, assignees: newAssignees });
  };

  const handleSortChange = (sortBy: BoardFilters["sortBy"]) => {
    onFiltersChange({ ...filters, sortBy });
  };

  const handleSortOrderToggle = () => {
    onFiltersChange({
      ...filters,
      sortOrder: filters.sortOrder === "asc" ? "desc" : "asc",
    });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      priorities: [],
      assignees: [],
      sortBy: "created",
      sortOrder: "desc",
    });
  };

  const SortIcon = filters.sortOrder === "asc" ? SortAsc : SortDesc;

  // Shared priority dropdown content
  const priorityDropdownContent = (
    <>
      {priorities.map(({ value, config }) => {
        const Icon = PRIORITY_ICONS[value];
        return (
          <DropdownMenuCheckboxItem
            key={value}
            checked={filters.priorities.includes(value)}
            onCheckedChange={() => handlePriorityToggle(value)}
          >
            <Icon className="w-4 h-4 mr-2" style={{ color: config.color }} />
            {config.label}
          </DropdownMenuCheckboxItem>
        );
      })}
    </>
  );

  // Shared assignee dropdown content
  const assigneeDropdownContent = availableAssignees.length > 0 && (
    <>
      <DropdownMenuCheckboxItem
        checked={filters.assignees.includes("unassigned")}
        onCheckedChange={() => handleAssigneeToggle("unassigned")}
      >
        {t("filters.unassigned")}
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
    </>
  );

  // Shared sort dropdown content
  const sortDropdownContent = (
    <>
      {SORT_OPTIONS.map((option) => (
        <DropdownMenuItem
          key={option.value}
          onClick={() => handleSortChange(option.value)}
          className={cn(
            "gap-2",
            filters.sortBy === option.value && "bg-accent",
          )}
        >
          {filters.sortBy === option.value ? (
            <Check className="w-4 h-4 shrink-0" />
          ) : (
            <span className="w-4 h-4 shrink-0" />
          )}
          {t(option.labelKey)}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={handleSortOrderToggle} className="gap-2">
        {filters.sortOrder === "asc" ? (
          <SortDesc className="w-4 h-4 shrink-0" />
        ) : (
          <SortAsc className="w-4 h-4 shrink-0" />
        )}
        {filters.sortOrder === "asc"
          ? t("filters.sortDescending")
          : t("filters.sortAscending")}
      </DropdownMenuItem>
    </>
  );

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {/* ── Mobile: single combined dropdown ──────────────────────────── */}
      <div className="flex items-center gap-1.5 sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="icon"
              className="h-8 w-8 relative"
              aria-label={t("filters.filters")}
              title={t("filters.filters")}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {totalActiveFilters > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center px-0.5 leading-none">
                  {totalActiveFilters}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {/* My Cards */}
            {currentUserId && (
              <DropdownMenuCheckboxItem
                checked={isMyCardsActive}
                onCheckedChange={handleMyCardsToggle}
              >
                <User className="w-4 h-4 mr-2" />
                {t("filters.myCards")}
              </DropdownMenuCheckboxItem>
            )}

            {/* Priority */}
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground py-1">
                {t("filters.priority")}
              </DropdownMenuLabel>
              {priorityDropdownContent}
            </DropdownMenuGroup>

            {/* Assignee */}
            {availableAssignees.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground py-1">
                    {t("filters.assignee")}
                  </DropdownMenuLabel>
                  {assigneeDropdownContent}
                </DropdownMenuGroup>
              </>
            )}

            {/* Sort */}
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground py-1">
                {t("filters.sortLabel")}
              </DropdownMenuLabel>
              {sortDropdownContent}
            </DropdownMenuGroup>

            {/* Clear all */}
            {hasActiveFilters && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={clearAllFilters}
                  className="text-destructive focus:text-destructive gap-2"
                >
                  <X className="w-4 h-4 shrink-0" />
                  {t("filters.clearAll")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort order toggle — always visible on mobile */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={handleSortOrderToggle}
          aria-label={
            filters.sortOrder === "asc"
              ? t("filters.sortDescending")
              : t("filters.sortAscending")
          }
          title={
            filters.sortOrder === "asc"
              ? t("filters.sortDescending")
              : t("filters.sortAscending")
          }
        >
          <SortIcon className="w-4 h-4" />
        </Button>
      </div>

      {/* ── Desktop: individual icon-only dropdowns ────────────────────── */}
      <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
        {/* My Cards */}
        {currentUserId && (
          <Button
            variant={isMyCardsActive ? "default" : "outline"}
            size="icon"
            className="h-8 w-8"
            onClick={handleMyCardsToggle}
            aria-label={t("filters.myCards")}
            title={t("filters.myCards")}
          >
            <User className="w-4 h-4" />
          </Button>
        )}

        {/* Priority filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "h-8 w-8 relative",
                filters.priorities.length > 0 && "bg-blue-50 border-blue-200",
              )}
              aria-label={t("filters.priority")}
              title={t("filters.priority")}
            >
              <Flag className="w-4 h-4" />
              {filters.priorities.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 rounded-full bg-blue-500 text-white text-[10px] font-semibold flex items-center justify-center px-0.5 leading-none">
                  {filters.priorities.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {priorityDropdownContent}
            {filters.priorities.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    onFiltersChange({ ...filters, priorities: [] })
                  }
                  className="gap-2"
                >
                  <X className="w-4 h-4" />
                  {t("filters.clearPriorityFilters")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Assignee filter */}
        {availableAssignees.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "h-8 w-8 relative",
                  filters.assignees.length > 0 &&
                    "bg-green-50 border-green-200",
                )}
                aria-label={t("filters.assignee")}
                title={t("filters.assignee")}
              >
                <Users className="w-4 h-4" />
                {filters.assignees.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 rounded-full bg-green-600 text-white text-[10px] font-semibold flex items-center justify-center px-0.5 leading-none">
                    {filters.assignees.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {assigneeDropdownContent}
              {filters.assignees.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      onFiltersChange({ ...filters, assignees: [] })
                    }
                    className="gap-2"
                  >
                    <X className="w-4 h-4" />
                    {t("filters.clearAssigneeFilters")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label={t("filters.sortLabel")}
              title={t("filters.sortLabel")}
            >
              <SortIcon className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {sortDropdownContent}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear all */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={clearAllFilters}
            aria-label={t("filters.clearAll")}
            title={t("filters.clearAll")}
          >
            <X className="w-4 h-4" />
          </Button>
        )}

        {/* Active priority badges */}
        {filters.priorities.length > 0 && (
          <div className="flex items-center gap-1">
            {filters.priorities.map((priority) => {
              const config = getPriorityConfig(priority);
              const Icon = PRIORITY_ICONS[priority];
              return (
                <Badge
                  key={priority}
                  variant="outline"
                  className={cn(config.badgeClass, "text-xs")}
                >
                  <Icon className="w-3 h-3 mr-1" />
                  {config.label}
                  <button
                    onClick={() => handlePriorityToggle(priority)}
                    className="ml-1 cursor-pointer hover:bg-black/10 rounded-full p-0.5"
                  >
                    <X className="w-2 h-2" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
