"use client";

import { useState, useCallback, useEffect } from "react";

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

export function useAuditLogs(options: UseAuditLogsOptions) {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [summary, setSummary] = useState<AuditLogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const {
    boardId,
    autoRefresh = false,
    refreshInterval = 60000, // 1 minute default for audit logs
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

  /**
   * Fetch audit logs with filters
   */
  const fetchAuditLogs = useCallback(
    async (newFilters: AuditLogFilters = {}) => {
      setLoading(true);
      setError(null);

      try {
        const searchParams = new URLSearchParams({
          boardId,
          page: (newFilters.page || filters.page || 1).toString(),
          limit: (newFilters.limit || filters.limit || 20).toString(),
        });

        const currentFilters = { ...filters, ...newFilters };

        if (currentFilters.action)
          searchParams.append("action", currentFilters.action);
        if (currentFilters.targetUserId)
          searchParams.append("targetUserId", currentFilters.targetUserId);
        if (currentFilters.startDate)
          searchParams.append("startDate", currentFilters.startDate);
        if (currentFilters.endDate)
          searchParams.append("endDate", currentFilters.endDate);

        const response = await fetch(`/api/admin/audit-logs?${searchParams}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch audit logs");
        }

        const data = await response.json();
        setAuditLogs(data.auditLogs);
        setSummary(data.summary);
        setPagination(data.pagination);
        setFilters(currentFilters);

        return data;
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [boardId, filters, handleError],
  );

  /**
   * Update filters and fetch new data
   */
  const updateFilters = useCallback(
    (newFilters: Partial<AuditLogFilters>) => {
      const updatedFilters = { ...filters, ...newFilters, page: 1 }; // Reset to page 1 when filtering
      fetchAuditLogs(updatedFilters);
    },
    [filters, fetchAuditLogs],
  );

  /**
   * Go to specific page
   */
  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= pagination.totalPages) {
        fetchAuditLogs({ ...filters, page });
      }
    },
    [filters, pagination.totalPages, fetchAuditLogs],
  );

  /**
   * Go to next page
   */
  const nextPage = useCallback(() => {
    if (pagination.hasNext) {
      goToPage(pagination.page + 1);
    }
  }, [pagination.hasNext, pagination.page, goToPage]);

  /**
   * Go to previous page
   */
  const prevPage = useCallback(() => {
    if (pagination.hasPrev) {
      goToPage(pagination.page - 1);
    }
  }, [pagination.hasPrev, pagination.page, goToPage]);

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    const clearedFilters = { page: 1, limit: filters.limit || 20 };
    fetchAuditLogs(clearedFilters);
  }, [filters.limit, fetchAuditLogs]);

  /**
   * Refresh audit logs
   */
  const refresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  /**
   * Get action label for display
   */
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

  /**
   * Format audit log details for display
   */
  const formatLogDetails = useCallback(
    (action: string, details: AuditLogDetails) => {
      if (!details) return null;

      switch (action) {
        case "invite_user":
          return `Invited ${details.email || ""} as ${details.role || ""}`;
        case "update_user":
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

  /**
   * Export audit logs (client-side CSV generation)
   */
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
        fetchAuditLogs();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
    return undefined;
  }, [autoRefresh, refreshInterval, fetchAuditLogs]);

  // Initial fetch and refresh trigger effect
  useEffect(() => {
    fetchAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  return {
    // State
    auditLogs,
    summary,
    loading,
    error,
    pagination,
    filters,

    // Actions
    fetchAuditLogs,
    updateFilters,
    goToPage,
    nextPage,
    prevPage,
    clearFilters,
    refresh,
    exportLogs,
    clearError,

    // Utilities
    getActionLabel,
    formatLogDetails,
  };
}
