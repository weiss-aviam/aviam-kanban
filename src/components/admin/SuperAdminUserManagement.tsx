"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatRelativeDate } from "@/lib/date-format";
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
        throw new Error(responseData.error || "Failed to update user");
      }

      await onSaved();
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to update user",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit user details</DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Email</Label>
              <Badge variant="outline">Read only</Badge>
            </div>
            <Input disabled value={user?.email ?? ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-user-name">Display name</Label>
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
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save changes
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
        throw new Error(responseData.error || "Failed to fetch users");
      }

      setUsers(responseData.users ?? []);
      setPagination(responseData.pagination ?? EMPTY_PAGINATION);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to fetch users",
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
          details || responseData.error || "Failed to create user",
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
          : "Failed to create user",
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
            Create user
          </CardTitle>
          <CardDescription>
            Provision a new Aviam account with an initial password and optional
            display name.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-3"
            onSubmit={handleCreateUser}
          >
            <div className="space-y-2">
              <Label htmlFor="create-user-email">Email</Label>
              <Input
                id="create-user-email"
                type="email"
                value={createEmail}
                onChange={(event) => setCreateEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-user-name">Display name</Label>
              <Input
                id="create-user-name"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-user-password">Initial password</Label>
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
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create user
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
          <CardDescription>
            Review every user account across Aviam and update supported profile
            fields.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Search by name or email"
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
                  <SelectItem value="createdAt-desc">Newest first</SelectItem>
                  <SelectItem value="createdAt-asc">Oldest first</SelectItem>
                  <SelectItem value="name-asc">Name A-Z</SelectItem>
                  <SelectItem value="name-desc">Name Z-A</SelectItem>
                  <SelectItem value="email-asc">Email A-Z</SelectItem>
                  <SelectItem value="email-desc">Email Z-A</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => void fetchUsers()}>
                <RefreshCw className="h-4 w-4" />
                Refresh
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
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
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
                        Loading users…
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-gray-500"
                      colSpan={3}
                    >
                      No users matched this query.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900">
                          {user.name || "Unnamed user"}
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
                          Edit
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
              Showing page {pagination.page} of {pagination.totalPages} ·{" "}
              {pagination.total} users total
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasPrev || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasNext || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
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
