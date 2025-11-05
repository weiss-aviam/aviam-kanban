"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  History,
  Filter,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  Activity,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface AuditLogDetails {
  email?: string;
  role?: string;
  nameChanged?: { from: string; to: string };
  roleChanged?: { from: string; to: string };
  removedUser?: { name?: string; email?: string; role?: string };
  targetUser?: { name?: string; email?: string };
  [key: string]: unknown;
}

interface AuditLogSummary {
  totalActions: number;
  actionCounts: Record<string, number>;
}

interface AuditLog {
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

interface AuditLogTableProps {
  boardId: string;
  refreshTrigger: number;
}

export function AuditLogTable({ boardId, refreshTrigger }: AuditLogTableProps) {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [filters, setFilters] = useState({
    action: "",
    startDate: "",
    endDate: "",
  });
  const [summary, setSummary] = useState<AuditLogSummary | null>(null);

  const limit = 20;

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        boardId,
        page: page.toString(),
        limit: limit.toString(),
      });

      if (filters.action) params.append("action", filters.action);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);

      const response = await fetch(`/api/admin/audit-logs?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch audit logs");
      }

      const data = await response.json();
      setAuditLogs(data.auditLogs);
      setPagination(data.pagination);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, page, filters, refreshTrigger]);

  const getActionBadge = (action: string) => {
    const actionConfig = {
      invite_user: {
        label: "User Invited",
        color: "bg-blue-50 text-blue-700 border-blue-200",
      },
      update_user: {
        label: "User Updated",
        color: "bg-yellow-50 text-yellow-700 border-yellow-200",
      },
      remove_user: {
        label: "User Removed",
        color: "bg-red-50 text-red-700 border-red-200",
      },
      reset_password: {
        label: "Password Reset",
        color: "bg-purple-50 text-purple-700 border-purple-200",
      },
      update_role: {
        label: "Role Changed",
        color: "bg-green-50 text-green-700 border-green-200",
      },
      bulk_update_roles: {
        label: "Bulk Role Update",
        color: "bg-orange-50 text-orange-700 border-orange-200",
      },
    };

    const config = actionConfig[action as keyof typeof actionConfig] || {
      label: action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      color: "bg-gray-50 text-gray-700 border-gray-200",
    };

    return (
      <Badge variant="outline" className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const formatDetails = (action: string, details: AuditLogDetails) => {
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
  };

  if (loading && auditLogs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading audit logs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-2">{error}</p>
          <Button onClick={fetchAuditLogs} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="action-filter">Action Type</Label>
              <Select
                value={filters.action}
                onValueChange={(value) => {
                  setFilters({ ...filters, action: value });
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Actions</SelectItem>
                  <SelectItem value="invite_user">User Invited</SelectItem>
                  <SelectItem value="update_user">User Updated</SelectItem>
                  <SelectItem value="remove_user">User Removed</SelectItem>
                  <SelectItem value="reset_password">Password Reset</SelectItem>
                  <SelectItem value="update_role">Role Changed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={filters.startDate}
                onChange={(e) => {
                  setFilters({ ...filters, startDate: e.target.value });
                  setPage(1);
                }}
              />
            </div>

            <div>
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={filters.endDate}
                onChange={(e) => {
                  setFilters({ ...filters, endDate: e.target.value });
                  setPage(1);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Total Actions</p>
                  <p className="text-2xl font-bold">{summary.totalActions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Date Range</p>
                  <p className="text-sm text-gray-600">
                    {filters.startDate || "All time"} -{" "}
                    {filters.endDate || "Now"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-purple-600" />
                <div>
                  <p className="text-sm font-medium">Most Common</p>
                  <p className="text-sm text-gray-600">
                    {Object.entries(summary.actionCounts || {})
                      .sort(
                        ([, a], [, b]) => (b as number) - (a as number),
                      )[0]?.[0]
                      ?.replace(/_/g, " ") || "None"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Audit Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Audit Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {auditLogs.map((log) => (
              <div key={log.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      {getActionBadge(log.action)}
                      <span className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(log.createdAt))} ago
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="font-medium">
                        {log.adminUser?.name ||
                          log.adminUser?.email ||
                          "Unknown admin"}
                      </p>
                      <p className="text-sm text-gray-600">
                        {formatDetails(log.action, log.details)}
                      </p>
                    </div>

                    <div className="text-xs text-gray-500">
                      <p>{format(new Date(log.createdAt), "PPpp")}</p>
                      {log.ipAddress && <p>IP: {log.ipAddress}</p>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-600">
                Showing {auditLogs.length} of {pagination.total} logs
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={!pagination.hasPrev}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <span className="text-sm">
                  Page {page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasNext}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
