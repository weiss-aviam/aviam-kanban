"use client";

import { useState, useMemo } from "react";
import type { Card, CardPriority } from "@/types/database";
// import { sortCardsByPriority } from '@/lib/priority-colors';
import type { BoardFilters } from "@/components/kanban/BoardFilters";

interface BoardMember {
  id: string;
  name: string;
  email: string;
}

export function useBoardFilters(cards: Card[], boardMembers?: BoardMember[]) {
  const [filters, setFilters] = useState<BoardFilters>({
    priorities: [],
    assignees: [],
    sortBy: "created",
    sortOrder: "desc",
  });

  // Get available assignees from cards
  const availableAssignees = useMemo(() => {
    const assigneeMap = new Map<string, BoardMember>();

    cards.forEach((card) => {
      if (card.assigneeId && boardMembers) {
        const assignee = boardMembers.find(
          (member) => member.id === card.assigneeId,
        );
        if (assignee) {
          assigneeMap.set(assignee.id, {
            id: assignee.id,
            name: assignee.name,
            email: assignee.email,
          });
        }
      }
    });

    return Array.from(assigneeMap.values());
  }, [cards, boardMembers]);

  // Filter and sort cards
  const filteredAndSortedCards = useMemo(() => {
    let filtered = [...cards];

    // Apply priority filters
    if (filters.priorities.length > 0) {
      filtered = filtered.filter((card) => {
        const cardPriority = (card.priority || "medium") as CardPriority;
        return filters.priorities.includes(cardPriority);
      });
    }

    // Apply assignee filters
    if (filters.assignees.length > 0) {
      filtered = filtered.filter((card) => {
        if (filters.assignees.includes("unassigned")) {
          return (
            !card.assigneeId || filters.assignees.includes(card.assigneeId)
          );
        }
        return card.assigneeId && filters.assignees.includes(card.assigneeId);
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case "priority":
          // Use priority sorting utility
          const priorityA = (a.priority || "medium") as CardPriority;
          const priorityB = (b.priority || "medium") as CardPriority;
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          comparison = priorityOrder[priorityB] - priorityOrder[priorityA];
          break;

        case "dueDate":
          const dueDateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const dueDateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          comparison = dueDateA - dueDateB;
          break;

        case "title":
          comparison = a.title.localeCompare(b.title);
          break;

        case "created":
          const createdA = new Date(a.createdAt).getTime();
          const createdB = new Date(b.createdAt).getTime();
          comparison = createdA - createdB;
          break;

        case "updated":
          // Use createdAt as fallback since updatedAt doesn't exist in Card type
          const updatedA = new Date(a.createdAt).getTime();
          const updatedB = new Date(b.createdAt).getTime();
          comparison = updatedA - updatedB;
          break;

        default:
          comparison = 0;
      }

      // Apply sort order
      return filters.sortOrder === "desc" ? -comparison : comparison;
    });

    return filtered;
  }, [cards, filters]);

  // Group filtered cards by column
  const cardsByColumn = useMemo(() => {
    const grouped: Record<number, Card[]> = {};

    filteredAndSortedCards.forEach((card) => {
      if (!grouped[card.columnId]) {
        grouped[card.columnId] = [];
      }
      grouped[card.columnId]!.push(card);
    });

    return grouped;
  }, [filteredAndSortedCards]);

  // Statistics
  const stats = useMemo(() => {
    const total = cards.length;
    const filtered = filteredAndSortedCards.length;
    const hidden = total - filtered;

    const priorityStats = {
      high: cards.filter((c) => (c.priority || "medium") === "high").length,
      medium: cards.filter((c) => (c.priority || "medium") === "medium").length,
      low: cards.filter((c) => (c.priority || "medium") === "low").length,
    };

    const assigneeStats = {
      assigned: cards.filter((c) => c.assigneeId).length,
      unassigned: cards.filter((c) => !c.assigneeId).length,
    };

    return {
      total,
      filtered,
      hidden,
      priorityStats,
      assigneeStats,
    };
  }, [cards, filteredAndSortedCards]);

  // Helper functions
  const hasActiveFilters =
    filters.priorities.length > 0 || filters.assignees.length > 0;

  const clearFilters = () => {
    setFilters({
      priorities: [],
      assignees: [],
      sortBy: "created",
      sortOrder: "desc",
    });
  };

  const setQuickFilter = (
    type: "high-priority" | "overdue" | "unassigned" | "my-cards",
    userId?: string,
  ) => {
    switch (type) {
      case "high-priority":
        setFilters((prev) => ({
          ...prev,
          priorities: ["high"],
        }));
        break;

      case "overdue":
        // This would require additional logic to filter by overdue cards
        // For now, we'll sort by due date
        setFilters((prev) => ({
          ...prev,
          sortBy: "dueDate",
          sortOrder: "asc",
        }));
        break;

      case "unassigned":
        setFilters((prev) => ({
          ...prev,
          assignees: ["unassigned"],
        }));
        break;

      case "my-cards":
        if (userId) {
          setFilters((prev) => ({
            ...prev,
            assignees: [userId],
          }));
        }
        break;
    }
  };

  return {
    filters,
    setFilters,
    filteredAndSortedCards,
    cardsByColumn,
    availableAssignees,
    stats,
    hasActiveFilters,
    clearFilters,
    setQuickFilter,
  };
}
