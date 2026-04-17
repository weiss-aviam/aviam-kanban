"use client";

import { useState, useCallback, useMemo } from "react";
import useSWR from "swr";

interface AuditLogDetails {
  email?: string;
  role?: string;
  nameChanged?: { from: string; to: string };
  roleChanged?: { from: string; to: string };
  removedUser?: { name?: string; email?: string; role?: string };
  targetUser?: { name?: string; email?: string };
  [key: string]: unknown;
}

export interface AuditLog {
  id: string;
  action: string;
  details: AuditLogDetails;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  adminUser: {
    id: string;
    email: string;
    name: string;
  } | null;
  targetUser: {
    id: string;
    email: string;
    name: string;
  } | null;
}

export interface AuditLogSummary {
  totalActions: number;
  actionCounts: Record<string, number>;
  dateRange: {
    startDate?: string;
    endDate?: string;
  };
}

export interface AuditLogFilters {
  action?: string;
  targetUserId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface UseAuditLogsOptions {
  boardId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onError?: (error: string) => void;
}

interface AuditLogsResponse {
  auditLogs: AuditLog[];
  summary: AuditLogSummary | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const DEFAULT_PAGINATION = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
};

export function useAuditLogs(options: UseAuditLogsOptions) {
  const {
    boardId,
    autoRefresh = false,
    refreshInterval = 60000,
    onError,
  } = options;

  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    limit: 20,
  });
  const [localError, setLocalError] = useState<string | null>(null);

  const url = useMemo(() => {
    const sp = new URLSearchParams({
      boardId,
      page: (filters.page ?? 1).toString(),
      limit: (filters.limit ?? 20).toString(),
    });
    if (filters.action) sp.append("action", filters.action);
    if (filters.targetUserId) sp.append("targetUserId", filters.targetUserId);
    if (filters.startDate) sp.append("startDate", filters.startDate);
    if (filters.endDate) sp.append("endDate", filters.endDate);
    return `/api/admin/audit-logs?${sp}`;
  }, [boardId, filters]);

  const {
    data,
    error: swrError,
    isLoading,
    mutate,
  } = useSWR<AuditLogsResponse>(boardId ? url : null, {
    refreshInterval: autoRefresh ? refreshInterval : 0,
    onError: (err) => {
      const msg =
        err instanceof Error ? err.message : "Failed to fetch audit logs";
      onError?.(msg);
    },
  });

  const auditLogs = data?.auditLogs ?? [];
  const summary = data?.summary ?? null;
  const pagination = data?.pagination ?? DEFAULT_PAGINATION;
  const error =
    localError ??
    (swrError
      ? swrError instanceof Error
        ? swrError.message
        : "Failed"
      : null);

  const fetchAuditLogs = useCallback(
    (newFilters: AuditLogFilters = {}) => {
      setFilters((prev) => ({ ...prev, ...newFilters }));
      return mutate();
    },
    [mutate],
  );

  const updateFilters = useCallback((newFilters: Partial<AuditLogFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  }, []);

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= pagination.totalPages) {
        setFilters((prev) => ({ ...prev, page }));
      }
    },
    [pagination.totalPages],
  );

  const nextPage = useCallback(() => {
    if (pagination.hasNext) {
      setFilters((prev) => ({ ...prev, page: pagination.page + 1 }));
    }
  }, [pagination.hasNext, pagination.page]);

  const prevPage = useCallback(() => {
    if (pagination.hasPrev) {
      setFilters((prev) => ({ ...prev, page: pagination.page - 1 }));
    }
  }, [pagination.hasPrev, pagination.page]);

  const clearFilters = useCallback(() => {
    setFilters({ page: 1, limit: filters.limit ?? 20 });
  }, [filters.limit]);

  const refresh = useCallback(() => mutate(), [mutate]);

  const getActionLabel = useCallback((action: string) => {
    const actionLabels: Record<string, string> = {
      invite_user: "User Invited",
      update_user: "User Updated",
      remove_user: "User Removed",
      reset_password: "Password Reset",
      update_role: "Role Changed",
      bulk_update_roles: "Bulk Role Update",
    };
    return (
      actionLabels[action] ||
      action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    );
  }, []);

  const formatLogDetails = useCallback(
    (action: string, details: AuditLogDetails) => {
      if (!details) return null;
      switch (action) {
        case "invite_user":
          return `Invited ${details.email || ""} as ${details.role || ""}`;
        case "update_user": {
          const changes = [];
          if (details.nameChanged) {
            changes.push(
              `name: "${details.nameChanged.from}" → "${details.nameChanged.to}"`,
            );
          }
          if (details.roleChanged) {
            changes.push(
              `role: ${details.roleChanged.from} → ${details.roleChanged.to}`,
            );
          }
          return changes.join(", ");
        }
        case "remove_user":
          return `Removed ${details.removedUser?.name || details.removedUser?.email} (${details.removedUser?.role})`;
        case "reset_password":
          return `Reset password for ${details.targetUser?.name || details.targetUser?.email}`;
        case "update_role":
          return `Changed ${details.targetUser?.name || details.targetUser?.email} role: ${details.roleChanged?.from} → ${details.roleChanged?.to}`;
        default:
          return JSON.stringify(details);
      }
    },
    [],
  );

  const exportLogs = useCallback(() => {
    if (auditLogs.length === 0) return;
    const csvHeaders = [
      "Date",
      "Action",
      "Admin User",
      "Target User",
      "Details",
      "IP Address",
    ];
    const csvRows = auditLogs.map((log) => [
      new Date(log.createdAt).toLocaleString(),
      getActionLabel(log.action),
      log.adminUser?.name || log.adminUser?.email || "Unknown",
      log.targetUser?.name || log.targetUser?.email || "N/A",
      formatLogDetails(log.action, log.details) || "N/A",
      log.ipAddress || "N/A",
    ]);
    const csvContent = [csvHeaders, ...csvRows]
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-logs-${boardId}-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [auditLogs, boardId, getActionLabel, formatLogDetails]);

  const clearError = useCallback(() => setLocalError(null), []);

  return {
    auditLogs,
    summary,
    loading: isLoading,
    error,
    pagination,
    filters,
    fetchAuditLogs,
    updateFilters,
    goToPage,
    nextPage,
    prevPage,
    clearFilters,
    refresh,
    exportLogs,
    clearError,
    getActionLabel,
    formatLogDetails,
  };
}
