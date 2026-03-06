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
import { t } from "@/lib/i18n";

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
        throw new Error(errorData.error || t("admin.failedToFetchAuditLogs"));
      }

      const data = await response.json();
      setAuditLogs(data.auditLogs);
      setPagination(data.pagination);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.anErrorOccurred"));
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
        label: t("admin.auditLog.actions.invite_user"),
        color: "bg-blue-50 text-blue-700 border-blue-200",
      },
      update_user: {
        label: t("admin.auditLog.actions.update_user"),
        color: "bg-yellow-50 text-yellow-700 border-yellow-200",
      },
      remove_user: {
        label: t("admin.auditLog.actions.remove_user"),
        color: "bg-red-50 text-red-700 border-red-200",
      },
      reset_password: {
        label: t("admin.auditLog.actions.reset_password"),
        color: "bg-purple-50 text-purple-700 border-purple-200",
      },
      update_role: {
        label: t("admin.auditLog.actions.update_role"),
        color: "bg-green-50 text-green-700 border-green-200",
      },
      bulk_update_roles: {
        label: t("admin.auditLog.actions.bulk_update_roles"),
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
        return t("admin.auditLog.actionDetails.invite_user", {
          email: details.email || "",
          role: details.role || "",
        });
      case "update_user": {
        const changes = [];
        if (details.nameChanged) {
          changes.push(
            t("admin.auditLog.actionDetails.update_user_name", {
              from: details.nameChanged.from,
              to: details.nameChanged.to,
            }),
          );
        }
        if (details.roleChanged) {
          changes.push(
            t("admin.auditLog.actionDetails.update_user_role", {
              from: details.roleChanged.from,
              to: details.roleChanged.to,
            }),
          );
        }
        return changes.join(", ");
      }
      case "remove_user":
        return t("admin.auditLog.actionDetails.remove_user", {
          name: details.removedUser?.name || details.removedUser?.email || "",
          role: details.removedUser?.role || "",
        });
      case "reset_password":
        return t("admin.auditLog.actionDetails.reset_password", {
          name: details.targetUser?.name || details.targetUser?.email || "",
        });
      case "update_role":
        return t("admin.auditLog.actionDetails.update_role", {
          name: details.targetUser?.name || details.targetUser?.email || "",
          from: details.roleChanged?.from || "",
          to: details.roleChanged?.to || "",
        });
      default:
        return JSON.stringify(details);
    }
  };

  if (loading && auditLogs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">{t("admin.loadingAuditLogs")}</p>
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
            {t("common.tryAgain")}
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
            {t("admin.auditLog.filters")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="action-filter">
                {t("admin.auditLog.actionType")}
              </Label>
              <Select
                value={filters.action}
                onValueChange={(value) => {
                  setFilters({ ...filters, action: value });
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.auditLog.allActions")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    {t("admin.auditLog.allActions")}
                  </SelectItem>
                  <SelectItem value="invite_user">
                    {t("admin.auditLog.actions.invite_user")}
                  </SelectItem>
                  <SelectItem value="update_user">
                    {t("admin.auditLog.actions.update_user")}
                  </SelectItem>
                  <SelectItem value="remove_user">
                    {t("admin.auditLog.actions.remove_user")}
                  </SelectItem>
                  <SelectItem value="reset_password">
                    {t("admin.auditLog.actions.reset_password")}
                  </SelectItem>
                  <SelectItem value="update_role">
                    {t("admin.auditLog.actions.update_role")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="start-date">
                {t("admin.auditLog.startDate")}
              </Label>
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
              <Label htmlFor="end-date">{t("admin.auditLog.endDate")}</Label>
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
                  <p className="text-sm font-medium">
                    {t("admin.auditLog.totalActions")}
                  </p>
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
                  <p className="text-sm font-medium">
                    {t("admin.auditLog.dateRange")}
                  </p>
                  <p className="text-sm text-gray-600">
                    {filters.startDate || t("common.allTime")} -{" "}
                    {filters.endDate || t("common.now")}
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
                  <p className="text-sm font-medium">
                    {t("admin.auditLog.mostCommon")}
                  </p>
                  <p className="text-sm text-gray-600">
                    {Object.entries(summary.actionCounts || {})
                      .sort(
                        ([, a], [, b]) => (b as number) - (a as number),
                      )[0]?.[0]
                      ?.replace(/_/g, " ") || t("common.none")}
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
            {t("admin.auditLog.title")}
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
                        {t("common.timeAgo", {
                          time: formatDistanceToNow(new Date(log.createdAt)),
                        })}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="font-medium">
                        {log.adminUser?.name ||
                          log.adminUser?.email ||
                          t("admin.auditLog.unknownAdmin")}
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
                {t("admin.auditLog.showingLogs", {
                  count: String(auditLogs.length),
                  total: String(pagination.total),
                })}
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={!pagination.hasPrev}
                >
                  <ChevronLeft className="w-4 h-4" />
                  {t("common.previous")}
                </Button>
                <span className="text-sm">
                  {t("admin.auditLog.page", {
                    page: String(page),
                    total: String(pagination.totalPages),
                  })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasNext}
                >
                  {t("common.next")}
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
