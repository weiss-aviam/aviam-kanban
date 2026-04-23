"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatRelativeDate } from "@/lib/date-format";
import { t } from "@/lib/i18n";
import { useOnlineUserIds } from "@/store";
import {
  Check,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldOff,
  Trash2,
  TriangleAlert,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type UserStatus = "pending" | "active" | "deactivated";

interface ManagedUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  status: UserStatus | "unconfirmed";
  lastSeenAt: string | null;
  apiAccessEnabled: boolean;
}

interface PaginationState {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const PAGE_SIZE = 15;

const EMPTY_PAGINATION: PaginationState = {
  total: 0,
  page: 1,
  limit: PAGE_SIZE,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

// ── Edit name dialog ────────────────────────────────────────────────────────

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/super-admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || t("superAdmin.failedToUpdate"));
      await onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("superAdmin.failedToUpdate"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(user)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("superAdmin.editUserTitle")}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
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
              onChange={(e) => setName(e.target.value)}
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

// ── Confirm deactivate/reject dialog ────────────────────────────────────────

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {t("superAdmin.cancelButton")}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Purge (permanent delete) dialog ─────────────────────────────────────────

function PurgeConfirmDialog({
  user,
  onConfirm,
  onCancel,
  loading,
}: {
  user: ManagedUser | null;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [emailInput, setEmailInput] = useState("");
  const [mismatch, setMismatch] = useState(false);

  const handleConfirm = () => {
    if (emailInput.trim().toLowerCase() !== user?.email.toLowerCase()) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    onConfirm();
  };

  return (
    <Dialog open={Boolean(user)} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-lg border-red-300">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <TriangleAlert className="h-5 w-5 flex-shrink-0" />
            {t("superAdmin.purgeConfirmTitle")}
          </DialogTitle>
          <DialogDescription className="text-gray-700">
            {t("superAdmin.purgeConfirmDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 space-y-1">
          <p className="font-semibold">{user?.name || user?.email}</p>
          <p className="text-red-600">{user?.email}</p>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="purge-email-confirm"
            className="text-sm text-gray-700"
          >
            {t("superAdmin.purgeEmailPrompt")}
          </Label>
          <Input
            id="purge-email-confirm"
            type="email"
            value={emailInput}
            onChange={(e) => {
              setEmailInput(e.target.value);
              setMismatch(false);
            }}
            placeholder={user?.email ?? ""}
            className={mismatch ? "border-red-500" : ""}
            disabled={loading}
          />
          {mismatch && (
            <p className="text-xs text-red-600">
              {t("superAdmin.purgeEmailMismatch")}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {t("superAdmin.cancelButton")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading || !emailInput.trim()}
            className="bg-red-700 hover:bg-red-800"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            {t("superAdmin.purgeConfirmLabel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Create user dialog ───────────────────────────────────────────────────────

function CreateUserDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reset = () => {
    setEmail("");
    setName("");
    setPassword("");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/super-admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          password,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const details = Array.isArray(data.details)
          ? data.details
              .map((d: { message?: string }) => d.message)
              .filter(Boolean)
              .join(" ")
          : undefined;
        throw new Error(
          details || data.error || t("superAdmin.failedToCreate"),
        );
      }
      await onCreated();
      handleClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("superAdmin.failedToCreate"),
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("superAdmin.createUserTitle")}</DialogTitle>
          <DialogDescription>
            {t("superAdmin.createUserDescription")}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="new-email">{t("superAdmin.emailLabel")}</Label>
            <Input
              id="new-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-name">{t("superAdmin.nameLabel")}</Label>
            <Input
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">
              {t("superAdmin.passwordLabel")}
            </Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={creating}
            >
              {t("superAdmin.cancelButton")}
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t("superAdmin.creatingUser")}
                </>
              ) : (
                t("superAdmin.createUserSubmit")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── User table ───────────────────────────────────────────────────────────────

function UserStatusDot({ online, label }: { online: boolean; label: string }) {
  if (online) {
    return (
      <span className="relative flex h-2.5 w-2.5 flex-shrink-0" title={label}>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
      </span>
    );
  }
  return (
    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-muted-foreground/30" />
  );
}

function UserActionButtons({
  user,
  status,
  actionLoading,
  onEdit,
  onApprove,
  onReject,
  onDeactivate,
  onReactivate,
  onPurge,
  onToggleApiAccess,
}: {
  user: ManagedUser;
  status: UserStatus;
  actionLoading: string | null;
  onEdit: ((user: ManagedUser) => void) | undefined;
  onApprove: ((user: ManagedUser) => void) | undefined;
  onReject: ((user: ManagedUser) => void) | undefined;
  onDeactivate: ((user: ManagedUser) => void) | undefined;
  onReactivate: ((user: ManagedUser) => void) | undefined;
  onPurge: ((user: ManagedUser) => void) | undefined;
  onToggleApiAccess: ((user: ManagedUser) => void) | undefined;
}) {
  const isLoading = actionLoading === user.id;

  if (status === "pending") {
    return (
      <>
        <Button
          size="sm"
          onClick={() => onApprove?.(user)}
          disabled={isLoading}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
          {t("superAdmin.approveButton")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onReject?.(user)}
          disabled={isLoading}
          className="text-red-600 border-red-200 hover:bg-red-50"
        >
          <X className="h-3 w-3" />
          {t("superAdmin.rejectButton")}
        </Button>
      </>
    );
  }

  if (status === "active") {
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onEdit?.(user)}
          disabled={isLoading}
        >
          <Pencil className="h-3 w-3" />
          {t("superAdmin.editButton")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onToggleApiAccess?.(user)}
          disabled={isLoading}
          className={
            user.apiAccessEnabled
              ? "text-amber-700 border-amber-200 hover:bg-amber-50"
              : "text-blue-700 border-blue-200 hover:bg-blue-50"
          }
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : user.apiAccessEnabled ? (
            <ShieldOff className="h-3 w-3" />
          ) : (
            <KeyRound className="h-3 w-3" />
          )}
          {user.apiAccessEnabled
            ? t("superAdmin.disableApiAccessButton")
            : t("superAdmin.enableApiAccessButton")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onDeactivate?.(user)}
          disabled={isLoading}
          className="text-red-600 border-red-200 hover:bg-red-50"
        >
          <UserMinus className="h-3 w-3" />
          {t("superAdmin.deactivateButton")}
        </Button>
      </>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => onReactivate?.(user)}
        disabled={isLoading}
        className="text-green-600 border-green-200 hover:bg-green-50"
      >
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <UserPlus className="h-3 w-3" />
        )}
        {t("superAdmin.reactivateButton")}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => onPurge?.(user)}
        disabled={isLoading}
        className="text-red-700 border-red-300 hover:bg-red-50"
      >
        <Trash2 className="h-3 w-3" />
        {t("superAdmin.purgeButton")}
      </Button>
    </>
  );
}

function UserTable({
  users,
  loading,
  status,
  pagination,
  onPageChange,
  onEdit,
  onApprove,
  onReject,
  onDeactivate,
  onReactivate,
  onPurge,
  onToggleApiAccess,
  actionLoading,
  emptyMessage,
  onlineUserIds,
}: {
  users: ManagedUser[];
  loading: boolean;
  status: UserStatus;
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  onEdit?: (user: ManagedUser) => void;
  onApprove?: (user: ManagedUser) => void;
  onReject?: (user: ManagedUser) => void;
  onDeactivate?: (user: ManagedUser) => void;
  onReactivate?: (user: ManagedUser) => void;
  onPurge?: (user: ManagedUser) => void;
  onToggleApiAccess?: (user: ManagedUser) => void;
  actionLoading: string | null;
  emptyMessage: string;
  onlineUserIds: Set<string>;
}) {
  const colSpan = status === "active" ? 4 : 3;
  const dateLabel =
    status === "deactivated"
      ? t("superAdmin.deactivatedColumn")
      : t("superAdmin.createdColumn");

  const renderLastSeen = (user: ManagedUser) => {
    if (onlineUserIds.has(user.id)) {
      return (
        <span className="font-medium text-green-600">
          {t("superAdmin.onlineNow")}
        </span>
      );
    }
    if (user.lastSeenAt) {
      return (
        <span className="text-muted-foreground">
          {t("superAdmin.lastSeenPrefix")} {formatRelativeDate(user.lastSeenAt)}
        </span>
      );
    }
    return (
      <span className="text-muted-foreground/60">
        {t("superAdmin.neverSeen")}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">
                {t("superAdmin.userColumn")}
              </th>
              <th className="px-4 py-3 font-medium">{dateLabel}</th>
              {status === "active" && (
                <th className="px-4 py-3 font-medium">
                  {t("superAdmin.lastSeenColumn")}
                </th>
              )}
              <th className="px-4 py-3 font-medium">
                {t("superAdmin.actionsColumn")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {loading ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-muted-foreground"
                  colSpan={colSpan}
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
                  className="px-4 py-8 text-center text-muted-foreground"
                  colSpan={colSpan}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-muted/40">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <UserStatusDot
                        online={onlineUserIds.has(user.id)}
                        label={t("superAdmin.onlineNow")}
                      />
                      <div>
                        <div className="font-medium text-foreground">
                          {user.name || t("superAdmin.unnamedUser")}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {user.email}
                        </div>
                        {user.status === "unconfirmed" && (
                          <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            {t("superAdmin.emailNotConfirmed")}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground text-sm">
                    {formatRelativeDate(user.createdAt)}
                  </td>
                  {status === "active" && (
                    <td className="px-4 py-4 text-sm">
                      {renderLastSeen(user)}
                    </td>
                  )}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <UserActionButtons
                        user={user}
                        status={status}
                        actionLoading={actionLoading}
                        onEdit={onEdit}
                        onApprove={onApprove}
                        onReject={onReject}
                        onDeactivate={onDeactivate}
                        onReactivate={onReactivate}
                        onPurge={onPurge}
                        onToggleApiAccess={onToggleApiAccess}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="rounded-lg border bg-card px-4 py-8 text-center text-muted-foreground">
            <div className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("superAdmin.loadingUsers")}
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-lg border bg-card px-4 py-8 text-center text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          users.map((user) => (
            <div
              key={user.id}
              className="rounded-lg border bg-card p-4 space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <UserStatusDot
                  online={onlineUserIds.has(user.id)}
                  label={t("superAdmin.onlineNow")}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground truncate">
                    {user.name || t("superAdmin.unnamedUser")}
                  </div>
                  <div className="text-muted-foreground text-xs truncate">
                    {user.email}
                  </div>
                  {user.status === "unconfirmed" && (
                    <span className="mt-1.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      {t("superAdmin.emailNotConfirmed")}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground/70">{dateLabel}</span>
                  <span>{formatRelativeDate(user.createdAt)}</span>
                </div>
                {status === "active" && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground/70">
                      {t("superAdmin.lastSeenColumn")}
                    </span>
                    <span className="text-right">{renderLastSeen(user)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/60">
                <UserActionButtons
                  user={user}
                  status={status}
                  actionLoading={actionLoading}
                  onEdit={onEdit}
                  onApprove={onApprove}
                  onReject={onReject}
                  onDeactivate={onDeactivate}
                  onReactivate={onReactivate}
                  onPurge={onPurge}
                  onToggleApiAccess={onToggleApiAccess}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
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
            onClick={() => onPageChange(pagination.page - 1)}
          >
            {t("common.previous")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination.hasNext || loading}
            onClick={() => onPageChange(pagination.page + 1)}
          >
            {t("common.next")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Tab panel hook ───────────────────────────────────────────────────────────

function useUserTab(status: UserStatus) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [sortValue, setSortValue] = useState("createdAt-desc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] =
    useState<PaginationState>(EMPTY_PAGINATION);

  const [sortBy, sortOrder] = useMemo(
    () =>
      sortValue.split("-") as ["name" | "email" | "createdAt", "asc" | "desc"],
    [sortValue],
  );

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: PAGE_SIZE.toString(),
        sortBy,
        sortOrder,
        status,
      });
      if (search.trim()) params.set("search", search.trim());

      const response = await window.fetch(
        `/api/admin/super-admin/users?${params}`,
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || t("superAdmin.failedToFetch"));

      setUsers(data.users ?? []);
      setPagination(data.pagination ?? EMPTY_PAGINATION);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("superAdmin.failedToFetch"),
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, sortOrder, status]);

  return {
    users,
    search,
    setSearch: (v: string) => {
      setSearch(v);
      setPage(1);
    },
    sortValue,
    setSortValue: (v: string) => {
      setSortValue(v);
      setPage(1);
    },
    page,
    setPage,
    loading,
    error,
    pagination,
    refresh: fetch,
  };
}

// ── Main component ───────────────────────────────────────────────────────────

export function SuperAdminUserManagement() {
  const pending = useUserTab("pending");
  const active = useUserTab("active");
  const deactivated = useUserTab("deactivated");

  const onlineUserIdsArray = useOnlineUserIds();
  const onlineSet = useMemo(
    () => new Set(onlineUserIdsArray),
    [onlineUserIdsArray],
  );

  const [activeTab, setActiveTab] = useState<UserStatus>("pending");
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    user: ManagedUser;
    action: "reject" | "deactivate";
  } | null>(null);
  const [purgeUser, setPurgeUser] = useState<ManagedUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const currentTab =
    activeTab === "pending"
      ? pending
      : activeTab === "active"
        ? active
        : deactivated;

  // Fetch all three tabs on mount so every count badge is visible immediately.
  useEffect(() => {
    void Promise.all([
      pending.refresh(),
      active.refresh(),
      deactivated.refresh(),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch current tab when switching tabs.
  useEffect(() => {
    void currentTab.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Re-fetch current tab when search/sort/page changes.
  useEffect(() => {
    void currentTab.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab.refresh]);

  const patchStatus = async (user: ManagedUser, status: UserStatus) => {
    setActionLoading(user.id);
    try {
      const response = await fetch(`/api/admin/super-admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }
      // Refresh all tabs as status changes affect counts
      await Promise.all([
        pending.refresh(),
        active.refresh(),
        deactivated.refresh(),
      ]);
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (user: ManagedUser) => {
    await patchStatus(user, "active");
  };

  const handleRejectConfirm = async () => {
    if (!confirmDialog) return;
    await patchStatus(confirmDialog.user, "deactivated");
    setConfirmDialog(null);
  };

  const handleDeactivateConfirm = async () => {
    if (!confirmDialog) return;
    setActionLoading(confirmDialog.user.id);
    try {
      const response = await fetch(
        `/api/admin/super-admin/users/${confirmDialog.user.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }
      await Promise.all([active.refresh(), deactivated.refresh()]);
    } finally {
      setActionLoading(null);
      setConfirmDialog(null);
    }
  };

  const handleReactivate = async (user: ManagedUser) => {
    await patchStatus(user, "active");
  };

  const handleToggleApiAccess = async (user: ManagedUser) => {
    setActionLoading(user.id);
    try {
      const response = await fetch(`/api/admin/super-admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiAccessEnabled: !user.apiAccessEnabled }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("superAdmin.failedToUpdate"));
      }
      await active.refresh();
    } finally {
      setActionLoading(null);
    }
  };

  const handlePurgeConfirm = async () => {
    if (!purgeUser) return;
    setActionLoading(purgeUser.id);
    try {
      const response = await fetch(
        `/api/admin/super-admin/users/${purgeUser.id}/purge`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("superAdmin.purgeFailed"));
      }
      await deactivated.refresh();
    } finally {
      setActionLoading(null);
      setPurgeUser(null);
    }
  };

  const SortControls = ({ tab }: { tab: ReturnType<typeof useUserTab> }) => (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
      <div className="relative w-full md:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={t("superAdmin.searchPlaceholder")}
          value={tab.search}
          onChange={(e) => tab.setSearch(e.target.value)}
        />
      </div>
      <Button variant="outline" size="sm" onClick={() => void tab.refresh()}>
        <RefreshCw className="h-4 w-4" />
        {t("superAdmin.refresh")}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex justify-end">
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4" />
          {t("superAdmin.createUserButton")}
        </Button>
      </div>

      {/* Tabs */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle>{t("superAdmin.title")}</CardTitle>
          <CardDescription>{t("superAdmin.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as UserStatus)}
          >
            <TabsList className="mb-4 grid w-full grid-cols-3">
              <TabsTrigger value="pending" className="gap-2">
                {t("superAdmin.tabPending")}
                {pending.pagination.total > 0 && (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0">
                    {pending.pagination.total}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="active" className="gap-2">
                {t("superAdmin.tabActive")}
                {active.pagination.total > 0 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    {active.pagination.total}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="deactivated" className="gap-2">
                {t("superAdmin.tabDeactivated")}
                {deactivated.pagination.total > 0 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    {deactivated.pagination.total}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <SortControls tab={pending} />
              {pending.error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{pending.error}</AlertDescription>
                </Alert>
              )}
              <UserTable
                users={pending.users}
                loading={pending.loading}
                status="pending"
                pagination={pending.pagination}
                onPageChange={pending.setPage}
                onApprove={handleApprove}
                onReject={(user) =>
                  setConfirmDialog({ user, action: "reject" })
                }
                actionLoading={actionLoading}
                emptyMessage={t("superAdmin.noPendingUsers")}
                onlineUserIds={onlineSet}
              />
            </TabsContent>

            <TabsContent value="active">
              <SortControls tab={active} />
              {active.error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{active.error}</AlertDescription>
                </Alert>
              )}
              <UserTable
                users={active.users}
                loading={active.loading}
                status="active"
                pagination={active.pagination}
                onPageChange={active.setPage}
                onEdit={setEditingUser}
                onDeactivate={(user) =>
                  setConfirmDialog({ user, action: "deactivate" })
                }
                onToggleApiAccess={handleToggleApiAccess}
                actionLoading={actionLoading}
                emptyMessage={t("superAdmin.noUsersFound")}
                onlineUserIds={onlineSet}
              />
            </TabsContent>

            <TabsContent value="deactivated">
              <SortControls tab={deactivated} />
              {deactivated.error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{deactivated.error}</AlertDescription>
                </Alert>
              )}
              <UserTable
                users={deactivated.users}
                loading={deactivated.loading}
                status="deactivated"
                pagination={deactivated.pagination}
                onPageChange={deactivated.setPage}
                onReactivate={handleReactivate}
                onPurge={setPurgeUser}
                actionLoading={actionLoading}
                emptyMessage={t("superAdmin.noDeactivatedUsers")}
                onlineUserIds={onlineSet}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateUserDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={async () => {
          await active.refresh();
        }}
      />

      <EditUserDialog
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onSaved={active.refresh}
      />

      <ConfirmDialog
        open={confirmDialog?.action === "reject"}
        title={t("superAdmin.rejectConfirmTitle")}
        description={t("superAdmin.rejectConfirmDescription")}
        confirmLabel={t("superAdmin.rejectConfirm")}
        onConfirm={() => void handleRejectConfirm()}
        onCancel={() => setConfirmDialog(null)}
        loading={actionLoading === confirmDialog?.user.id}
      />

      <ConfirmDialog
        open={confirmDialog?.action === "deactivate"}
        title={t("superAdmin.deactivateConfirmTitle")}
        description={t("superAdmin.deactivateConfirmDescription")}
        confirmLabel={t("superAdmin.deactivateConfirm")}
        onConfirm={() => void handleDeactivateConfirm()}
        onCancel={() => setConfirmDialog(null)}
        loading={actionLoading === confirmDialog?.user.id}
      />

      <PurgeConfirmDialog
        key={purgeUser?.id ?? "none"}
        user={purgeUser}
        onConfirm={() => void handlePurgeConfirm()}
        onCancel={() => setPurgeUser(null)}
        loading={actionLoading === purgeUser?.id}
      />
    </div>
  );
}
