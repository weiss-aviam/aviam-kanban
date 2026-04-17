"use client";

import { useState, useCallback, useMemo } from "react";
import useSWR from "swr";

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

interface MembershipsResponse {
  memberships: Membership[];
  summary: MembershipSummary | null;
}

interface MembershipsParams {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
  search?: string;
  role?: string;
}

export function useBoardMemberships(options: UseBoardMembershipsOptions) {
  const {
    boardId,
    autoRefresh = false,
    refreshInterval = 30000,
    onSuccess,
    onError,
  } = options;

  const [params, setParams] = useState<MembershipsParams>({
    page: 1,
    limit: 100,
    sortBy: "name",
    sortOrder: "asc",
  });
  const [mutationError, setMutationError] = useState<string | null>(null);

  const url = useMemo(() => {
    const sp = new URLSearchParams({
      boardId,
      page: String(params.page),
      limit: String(params.limit),
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    });
    if (params.search) sp.append("search", params.search);
    if (params.role) sp.append("role", params.role);
    return `/api/admin/memberships?${sp}`;
  }, [boardId, params]);

  const {
    data,
    error: swrError,
    isLoading,
    mutate,
  } = useSWR<MembershipsResponse>(boardId ? url : null, {
    refreshInterval: autoRefresh ? refreshInterval : 0,
    onError: (err) => {
      const msg =
        err instanceof Error ? err.message : "Failed to fetch memberships";
      onError?.(msg);
    },
  });

  const memberships = data?.memberships ?? [];
  const summary = data?.summary ?? null;
  const error =
    mutationError ??
    (swrError
      ? swrError instanceof Error
        ? swrError.message
        : "Failed"
      : null);

  const handleSuccess = useCallback(
    (message: string) => {
      setMutationError(null);
      onSuccess?.(message);
    },
    [onSuccess],
  );

  const handleError = useCallback(
    (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setMutationError(msg);
      onError?.(msg);
    },
    [onError],
  );

  const fetchMemberships = useCallback(
    (
      next: {
        page?: number;
        limit?: number;
        search?: string;
        role?: string;
        sortBy?: string;
        sortOrder?: "asc" | "desc";
      } = {},
    ) => {
      setParams((prev) => ({
        ...prev,
        ...(next.page !== undefined ? { page: next.page } : {}),
        ...(next.limit !== undefined ? { limit: next.limit } : {}),
        ...(next.sortBy !== undefined ? { sortBy: next.sortBy } : {}),
        ...(next.sortOrder !== undefined ? { sortOrder: next.sortOrder } : {}),
        ...(next.search !== undefined ? { search: next.search } : {}),
        ...(next.role !== undefined ? { role: next.role } : {}),
      }));
      return mutate();
    },
    [mutate],
  );

  const updateMembership = useCallback(
    async (patch: UpdateMembershipData) => {
      setMutationError(null);
      try {
        const response = await fetch(
          `/api/admin/memberships?boardId=${boardId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          },
        );
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to update membership");
        }
        const result = await response.json();

        await mutate(
          (prev) => {
            if (!prev) return prev;
            const oldMembership = prev.memberships.find(
              (m) => m.id === patch.userId,
            );
            const updatedSummary =
              prev.summary && oldMembership
                ? {
                    ...prev.summary,
                    roleDistribution: {
                      ...prev.summary.roleDistribution,
                      [oldMembership.role]:
                        prev.summary.roleDistribution[oldMembership.role] - 1,
                      [patch.role]:
                        prev.summary.roleDistribution[patch.role] + 1,
                    },
                  }
                : prev.summary;
            return {
              ...prev,
              memberships: prev.memberships.map((m) =>
                m.id === patch.userId ? { ...m, role: patch.role } : m,
              ),
              summary: updatedSummary,
            };
          },
          { revalidate: false },
        );

        handleSuccess("Membership role updated successfully");
        return result;
      } catch (err) {
        handleError(err);
        mutate();
        throw err;
      }
    },
    [boardId, mutate, handleSuccess, handleError],
  );

  const bulkUpdateMemberships = useCallback(
    async (updates: UpdateMembershipData[]) => {
      setMutationError(null);
      try {
        const response = await fetch(
          `/api/admin/memberships?boardId=${boardId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
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
        await mutate();
        handleSuccess(
          `Successfully updated ${updates.length} membership${updates.length > 1 ? "s" : ""}`,
        );
        return result;
      } catch (err) {
        handleError(err);
        throw err;
      }
    },
    [boardId, mutate, handleSuccess, handleError],
  );

  const refresh = useCallback(() => mutate(), [mutate]);
  const clearError = useCallback(() => setMutationError(null), []);

  const getMembershipById = useCallback(
    (userId: string) => memberships.find((m) => m.id === userId),
    [memberships],
  );

  const getMembershipsByRole = useCallback(
    (role: "owner" | "admin" | "member" | "viewer") =>
      memberships.filter((m) => m.role === role),
    [memberships],
  );

  const canChangeRole = useCallback(
    (currentUserRole: string, targetRole: string) => {
      if (targetRole === "owner") return false;
      if (currentUserRole === "owner") return true;
      if (currentUserRole === "admin" && targetRole !== "owner") return true;
      return false;
    },
    [],
  );

  return {
    memberships,
    summary,
    loading: isLoading,
    error,
    fetchMemberships,
    updateMembership,
    bulkUpdateMemberships,
    refresh,
    clearError,
    getMembershipById,
    getMembershipsByRole,
    canChangeRole,
  };
}
