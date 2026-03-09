"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatRelativeDate } from "@/lib/date-format";
import { t } from "@/lib/i18n";
import { Loader2, Pencil, RefreshCw, Search, UserPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ManagedUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

interface PaginationState {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const PAGE_SIZE = 10;

const EMPTY_PAGINATION: PaginationState = {
  total: 0,
  page: 1,
  limit: PAGE_SIZE,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

function EditUserDialog({
  user,
  onClose,
  onSaved,
}: {
  user: ManagedUser | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name ?? "");
    setError(null);
  }, [user]);

  const isOpen = Boolean(user);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/super-admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || t("superAdmin.failedToUpdate"));
      }

      await onSaved();
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t("superAdmin.failedToUpdate"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("superAdmin.editUserTitle")}</DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>{t("superAdmin.emailLabel")}</Label>
              <Badge variant="outline">
                {t("superAdmin.editUserEmailReadOnly")}
              </Badge>
            </div>
            <Input disabled value={user?.email ?? ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-user-name">{t("superAdmin.nameLabel")}</Label>
            <Input
              id="edit-user-name"
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              {t("superAdmin.cancelButton")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? t("superAdmin.savingChanges")
                : t("superAdmin.saveChanges")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SuperAdminUserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [sortValue, setSortValue] = useState("createdAt-desc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] =
    useState<PaginationState>(EMPTY_PAGINATION);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);

  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [sortBy, sortOrder] = useMemo(
    () =>
      sortValue.split("-") as ["name" | "email" | "createdAt", "asc" | "desc"],
    [sortValue],
  );

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: PAGE_SIZE.toString(),
        sortBy,
        sortOrder,
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const response = await fetch(`/api/admin/super-admin/users?${params}`);
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || t("superAdmin.failedToFetch"));
      }

      setUsers(responseData.users ?? []);
      setPagination(responseData.pagination ?? EMPTY_PAGINATION);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t("superAdmin.failedToFetch"),
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, sortOrder]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const response = await fetch("/api/admin/super-admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: createEmail.trim(),
          name: createName.trim() || undefined,
          password: createPassword,
        }),
      });
      const responseData = await response.json();

      if (!response.ok) {
        const details = Array.isArray(responseData.details)
          ? responseData.details
              .map((detail: { message?: string }) => detail.message)
              .filter(Boolean)
              .join(" ")
          : undefined;
        throw new Error(
          details || responseData.error || t("superAdmin.failedToCreate"),
        );
      }

      setCreateEmail("");
      setCreateName("");
      setCreatePassword("");
      setCreateSuccess(`Created ${responseData.user.email}.`);
      setPage(1);
      await fetchUsers();
    } catch (requestError) {
      setCreateError(
        requestError instanceof Error
          ? requestError.message
          : t("superAdmin.failedToCreate"),
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {t("superAdmin.createUserTitle")}
          </CardTitle>
          <CardDescription>
            {t("superAdmin.createUserDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-3"
            onSubmit={handleCreateUser}
          >
            <div className="space-y-2">
              <Label htmlFor="create-user-email">
                {t("superAdmin.emailLabel")}
              </Label>
              <Input
                id="create-user-email"
                type="email"
                value={createEmail}
                onChange={(event) => setCreateEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-user-name">
                {t("superAdmin.nameLabel")}
              </Label>
              <Input
                id="create-user-name"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-user-password">
                {t("superAdmin.passwordLabel")}
              </Label>
              <Input
                id="create-user-password"
                type="password"
                value={createPassword}
                onChange={(event) => setCreatePassword(event.target.value)}
                required
              />
            </div>

            <div className="md:col-span-3 space-y-3">
              {createError ? (
                <Alert variant="destructive">
                  <AlertDescription>{createError}</AlertDescription>
                </Alert>
              ) : null}
              {createSuccess ? (
                <Alert>
                  <AlertDescription>{createSuccess}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" disabled={creating}>
                {creating
                  ? t("superAdmin.creatingUser")
                  : t("superAdmin.createUserButton")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("superAdmin.allUsersTitle")}</CardTitle>
          <CardDescription>
            {t("superAdmin.allUsersDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-9"
                placeholder={t("superAdmin.searchPlaceholder")}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={sortValue}
                onValueChange={(value) => {
                  setSortValue(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Sort users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt-desc">
                    {t("superAdmin.sortNewest")}
                  </SelectItem>
                  <SelectItem value="createdAt-asc">
                    {t("superAdmin.sortOldest")}
                  </SelectItem>
                  <SelectItem value="name-asc">
                    {t("superAdmin.sortNameAZ")}
                  </SelectItem>
                  <SelectItem value="name-desc">
                    {t("superAdmin.sortNameZA")}
                  </SelectItem>
                  <SelectItem value="email-asc">
                    {t("superAdmin.sortEmailAZ")}
                  </SelectItem>
                  <SelectItem value="email-desc">
                    {t("superAdmin.sortEmailZA")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => void fetchUsers()}>
                <RefreshCw className="h-4 w-4" />
                {t("superAdmin.refresh")}
              </Button>
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="overflow-hidden rounded-lg border bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">
                    {t("superAdmin.userColumn")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("superAdmin.createdColumn")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("superAdmin.actionsColumn")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-gray-500"
                      colSpan={3}
                    >
                      <div className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("superAdmin.loadingUsers")}
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-gray-500"
                      colSpan={3}
                    >
                      {t("superAdmin.noUsersFound")}
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900">
                          {user.name || t("superAdmin.unnamedUser")}
                        </div>
                        <div className="text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        {formatRelativeDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingUser(user)}
                        >
                          <Pencil className="h-4 w-4" />
                          {t("superAdmin.editButton")}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 text-sm text-gray-500 md:flex-row md:items-center md:justify-between">
            <span>
              {t("superAdmin.paginationInfo", {
                page: pagination.page,
                totalPages: pagination.totalPages,
                total: pagination.total,
              })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasPrev || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                {t("common.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasNext || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                {t("common.next")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <EditUserDialog
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onSaved={fetchUsers}
      />
    </div>
  );
}
