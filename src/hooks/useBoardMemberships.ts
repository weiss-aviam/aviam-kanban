"use client";

import { useState, useCallback, useEffect } from "react";

export interface Membership {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "member" | "viewer";
  joinedAt: string;
  invitedAt?: string;
  createdAt: string;
  activity: {
    assignedCards: number;
    comments: number;
  };
}

export interface MembershipSummary {
  totalMembers: number;
  roleDistribution: {
    owner: number;
    admin: number;
    member: number;
    viewer: number;
  };
}

export interface UpdateMembershipData {
  userId: string;
  role: "admin" | "member" | "viewer";
}

export interface UseBoardMembershipsOptions {
  boardId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onSuccess?: (message: string) => void;
  onError?: (error: string) => void;
}

export function useBoardMemberships(options: UseBoardMembershipsOptions) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [summary, setSummary] = useState<MembershipSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const {
    boardId,
    autoRefresh = false,
    refreshInterval = 30000,
    onSuccess,
    onError,
  } = options;

  const handleError = useCallback(
    (err: unknown) => {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      onError?.(errorMessage);
    },
    [onError],
  );

  const handleSuccess = useCallback(
    (message: string) => {
      setError(null);
      onSuccess?.(message);
    },
    [onSuccess],
  );

  /**
   * Fetch board memberships
   */
  const fetchMemberships = useCallback(
    async (
      params: {
        page?: number;
        limit?: number;
        search?: string;
        role?: string;
        sortBy?: string;
        sortOrder?: "asc" | "desc";
      } = {},
    ) => {
      setLoading(true);
      setError(null);

      try {
        const searchParams = new URLSearchParams({
          boardId,
          page: (params.page || 1).toString(),
          limit: (params.limit || 100).toString(),
          sortBy: params.sortBy || "name",
          sortOrder: params.sortOrder || "asc",
        });

        if (params.search) searchParams.append("search", params.search);
        if (params.role) searchParams.append("role", params.role);

        const response = await fetch(`/api/admin/memberships?${searchParams}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch memberships");
        }

        const data = await response.json();
        setMemberships(data.memberships);
        setSummary(data.summary);
        return data;
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [boardId, handleError],
  );

  /**
   * Update membership role
   */
  const updateMembership = useCallback(
    async (data: UpdateMembershipData) => {
      setError(null);

      try {
        const response = await fetch(
          `/api/admin/memberships?boardId=${boardId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
          },
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to update membership");
        }

        const result = await response.json();

        // Optimistically update the local state
        setMemberships((prev) =>
          prev.map((membership) =>
            membership.id === data.userId
              ? { ...membership, role: data.role }
              : membership,
          ),
        );

        // Update summary
        setSummary((prev) => {
          if (!prev) return prev;

          const oldMembership = memberships.find((m) => m.id === data.userId);
          if (!oldMembership) return prev;

          const newDistribution = { ...prev.roleDistribution };
          newDistribution[oldMembership.role]--;
          newDistribution[data.role]++;

          return {
            ...prev,
            roleDistribution: newDistribution,
          };
        });

        handleSuccess("Membership role updated successfully");
        return result;
      } catch (err) {
        handleError(err);
        // Refresh data on error to ensure consistency
        fetchMemberships();
        throw err;
      }
    },
    [boardId, memberships, handleError, handleSuccess, fetchMemberships],
  );

  /**
   * Bulk update memberships
   */
  const bulkUpdateMemberships = useCallback(
    async (updates: UpdateMembershipData[]) => {
      setError(null);

      try {
        const response = await fetch(
          `/api/admin/memberships?boardId=${boardId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ updates, boardId }),
          },
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || "Failed to bulk update memberships",
          );
        }

        const result = await response.json();

        // Refresh data after bulk update
        await fetchMemberships();

        handleSuccess(
          `Successfully updated ${updates.length} membership${updates.length > 1 ? "s" : ""}`,
        );
        return result;
      } catch (err) {
        handleError(err);
        throw err;
      }
    },
    [boardId, handleError, handleSuccess, fetchMemberships],
  );

  /**
   * Refresh memberships data
   */
  const refresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  /**
   * Get membership by user ID
   */
  const getMembershipById = useCallback(
    (userId: string) => {
      return memberships.find((membership) => membership.id === userId);
    },
    [memberships],
  );

  /**
   * Get memberships by role
   */
  const getMembershipsByRole = useCallback(
    (role: "owner" | "admin" | "member" | "viewer") => {
      return memberships.filter((membership) => membership.role === role);
    },
    [memberships],
  );

  /**
   * Check if user can change another user's role
   */
  const canChangeRole = useCallback(
    (currentUserRole: string, targetRole: string) => {
      if (targetRole === "owner") return false;
      if (currentUserRole === "owner") return true;
      if (currentUserRole === "admin" && targetRole !== "owner") return true;
      return false;
    },
    [],
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchMemberships();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
    return undefined;
  }, [autoRefresh, refreshInterval, fetchMemberships]);

  // Initial fetch and refresh trigger effect
  useEffect(() => {
    fetchMemberships();
  }, [fetchMemberships, refreshTrigger]);

  return {
    // State
    memberships,
    summary,
    loading,
    error,

    // Actions
    fetchMemberships,
    updateMembership,
    bulkUpdateMemberships,
    refresh,
    clearError,

    // Utilities
    getMembershipById,
    getMembershipsByRole,
    canChangeRole,
  };
}
