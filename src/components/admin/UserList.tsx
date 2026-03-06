"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditUserModal } from "./EditUserModal";
import { getRoleBadgeClasses, getRoleLabel } from "@/lib/role-colors";
import { formatDistanceToNow } from "date-fns";
import { t } from "@/lib/i18n";

interface User {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "member" | "viewer";
  joinedAt: string;
  invitedAt?: string;
  createdAt: string;
}

interface UserListProps {
  boardId: string;
  currentUserRole: "owner" | "admin" | "member" | "viewer";
  refreshTrigger: number;
  onUserAction: () => void;
}

export function UserList({
  boardId,
  currentUserRole,
  refreshTrigger,
  onUserAction,
}: UserListProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const limit = 10;

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        boardId,
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
      });

      if (search) params.append("search", search);
      if (roleFilter !== "all") params.append("role", roleFilter);

      const response = await fetch(`/api/admin/users?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t("admin.failedToFetchUsers"));
      }

      const data = await response.json();
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.anErrorOccurred"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, page, search, roleFilter, sortBy, sortOrder, refreshTrigger]);

  const handleRemoveUser = async (userId: string) => {
    if (!confirm(t("admin.confirmRemoveUser"))) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/users/${userId}?boardId=${boardId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t("admin.failedToRemoveUser"));
      }

      onUserAction();
    } catch (err) {
      alert(err instanceof Error ? err.message : t("admin.failedToRemoveUser"));
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!confirm(t("admin.confirmResetPassword"))) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/users/${userId}/reset-password?boardId=${boardId}`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t("admin.failedToResetPassword"));
      }

      alert(t("admin.passwordResetSent"));
    } catch (err) {
      alert(
        err instanceof Error ? err.message : t("admin.failedToResetPassword"),
      );
    }
  };

  const canEditUser = (user: User) => {
    if (currentUserRole === "owner") return true;
    if (currentUserRole === "admin") {
      if (user.role === "owner") return false;
      return true;
    }
    return false;
  };

  const canRemoveUser = (user: User) => {
    if (user.role === "owner") return false;
    if (currentUserRole === "owner") return true;
    if (currentUserRole === "admin") return true;
    return false;
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">{t("admin.loadingUsers")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-2">{error}</p>
          <Button onClick={fetchUsers} variant="outline" size="sm">
            {t("common.tryAgain")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder={t("admin.searchUsers")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(value) => {
            setRoleFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("admin.filterByRole")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.allRoles")}</SelectItem>
            <SelectItem value="owner">{t("roles.owner")}</SelectItem>
            <SelectItem value="admin">{t("roles.admin")}</SelectItem>
            <SelectItem value="member">{t("roles.member")}</SelectItem>
            <SelectItem value="viewer">{t("roles.viewer")}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={`${sortBy}-${sortOrder}`}
          onValueChange={(value) => {
            const [newSortBy, newSortOrder] = value.split("-");
            setSortBy(newSortBy ?? "name");
            setSortOrder((newSortOrder as "asc" | "desc") ?? "asc");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("admin.sortBy")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">
              {t("admin.sortOptions.nameAZ")}
            </SelectItem>
            <SelectItem value="name-desc">
              {t("admin.sortOptions.nameZA")}
            </SelectItem>
            <SelectItem value="email-asc">
              {t("admin.sortOptions.emailAZ")}
            </SelectItem>
            <SelectItem value="email-desc">
              {t("admin.sortOptions.emailZA")}
            </SelectItem>
            <SelectItem value="role-asc">
              {t("admin.sortOptions.roleAZ")}
            </SelectItem>
            <SelectItem value="role-desc">
              {t("admin.sortOptions.roleZA")}
            </SelectItem>
            <SelectItem value="joinedAt-desc">
              {t("admin.sortOptions.recentlyJoined")}
            </SelectItem>
            <SelectItem value="joinedAt-asc">
              {t("admin.sortOptions.oldestMembers")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* User List */}
      <div className="space-y-2">
        {users.map((user) => (
          <Card key={user.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar>
                    <AvatarFallback>
                      {user.name
                        ? user.name.charAt(0).toUpperCase()
                        : user.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium">
                        {user.name || t("common.noName")}
                      </h4>
                      <Badge
                        className={getRoleBadgeClasses(user.role)}
                        variant="outline"
                      >
                        {getRoleLabel(user.role)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {t("admin.joinedAgo", {
                            time: formatDistanceToNow(new Date(user.joinedAt)),
                          })}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canEditUser(user) && (
                      <DropdownMenuItem onClick={() => setEditingUser(user)}>
                        <Edit className="w-4 h-4 mr-2" />
                        {t("admin.editUser")}
                      </DropdownMenuItem>
                    )}
                    {canEditUser(user) && (
                      <DropdownMenuItem
                        onClick={() => handleResetPassword(user.id)}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        {t("admin.resetPassword")}
                      </DropdownMenuItem>
                    )}
                    {canRemoveUser(user) && (
                      <DropdownMenuItem
                        onClick={() => handleRemoveUser(user.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t("admin.removeFromBoard")}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
          <p className="text-sm text-gray-600 order-2 sm:order-1">
            {t("admin.showingUsers", {
              count: String(users.length),
              total: String(pagination.total),
            })}
          </p>
          <div className="flex items-center space-x-2 order-1 sm:order-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={!pagination.hasPrev}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{t("common.previous")}</span>
            </Button>
            <span className="text-sm font-medium px-2">
              {page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={!pagination.hasNext}
              className="flex items-center gap-1"
            >
              <span className="hidden sm:inline">{t("common.next")}</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          user={editingUser}
          boardId={boardId}
          currentUserRole={currentUserRole}
          onUserUpdated={onUserAction}
        />
      )}
    </div>
  );
}
