"use client";

import { useActionState, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, UserPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { t } from "@/lib/i18n";
import {
  canAssignAdminRole,
  createDefaultMemberRole,
  formatAvailableUserLabel,
  type AvailableBoardUser,
  type AddMemberRole,
} from "./invite-user-form.utils";
import {
  addMemberAction,
  INITIAL_ADD_MEMBER_STATE,
  type AddMemberActionState,
} from "@/app/actions/memberships";

interface InviteUserFormProps {
  boardId: string;
  currentUserRole: "owner" | "admin" | "member" | "viewer";
  onMemberAdded: () => void;
}

interface AvailableUsersResponse {
  users: AvailableBoardUser[];
}

export function InviteUserForm({
  boardId,
  currentUserRole,
  onMemberAdded,
}: InviteUserFormProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [role, setRole] = useState<AddMemberRole>(createDefaultMemberRole());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canAssignAdmin = canAssignAdminRole(currentUserRole);

  const trimmedSearch = searchTerm.trim();
  const searchParams = new URLSearchParams({
    boardId,
    available: "true",
    limit: "10",
  });
  if (trimmedSearch) searchParams.append("search", trimmedSearch);

  const {
    data,
    error: fetchError,
    isLoading: loadingUsers,
  } = useSWR<AvailableUsersResponse>(`/api/admin/memberships?${searchParams}`, {
    keepPreviousData: true,
  });

  const availableUsers = data?.users ?? [];
  const fetchErrorMessage = fetchError
    ? fetchError instanceof Error
      ? fetchError.message
      : t("admin.failedToFetchAvailableUsers")
    : null;

  const selectedUser =
    availableUsers.find((user) => user.id === selectedUserId) ?? null;

  const handleAction = async (
    prev: AddMemberActionState,
    formData: FormData,
  ): Promise<AddMemberActionState> => {
    if (!selectedUserId) {
      return {
        status: "error",
        error: t("admin.validationErrors.noUserSelected"),
      };
    }
    const result = await addMemberAction(prev, formData);
    if (result.status === "success") {
      const addedLabel =
        result.membership.name ||
        result.membership.email ||
        selectedUser?.name ||
        selectedUser?.email ||
        t("common.unknown");
      setSuccessMessage(t("admin.memberAddedSuccess", { name: addedLabel }));
      setSelectedUserId(null);
      setRole(createDefaultMemberRole());
      setSearchTerm("");
      onMemberAdded();
    }
    return result;
  };

  const [submitState, formAction, submitting] = useActionState(
    handleAction,
    INITIAL_ADD_MEMBER_STATE,
  );

  const submitError = submitState.status === "error" ? submitState.error : null;
  const error = submitError ?? fetchErrorMessage;

  const resetForm = () => {
    setSearchTerm("");
    setSelectedUserId(null);
    setRole(createDefaultMemberRole());
    setSuccessMessage(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          {t("admin.addExistingUsersToBoard")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="boardId" value={boardId} />
          <input type="hidden" name="userId" value={selectedUserId ?? ""} />
          <input type="hidden" name="role" value={role} />

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <Label htmlFor="member-search" className="text-base font-medium">
              {t("admin.registeredUsers")}
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="member-search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("admin.searchRegisteredUsers")}
                className="pl-10"
              />
            </div>
            <p className="text-sm text-gray-600">
              {t("admin.onlyRegisteredUsersHelp")}
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">
              {t("admin.availableUsers")}
            </Label>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-2">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-6 text-sm text-gray-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("admin.loadingAvailableUsers")}
                </div>
              ) : availableUsers.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-500">
                  {t("admin.noAvailableUsers")}
                </div>
              ) : (
                availableUsers.map((user) => {
                  const isSelected = user.id === selectedUserId;

                  return (
                    <button
                      key={user.id}
                      type="button"
                      className={`w-full cursor-pointer rounded-md border px-3 py-2 text-left transition ${
                        isSelected
                          ? "border-blue-500 bg-blue-50"
                          : "border-transparent hover:border-gray-200 hover:bg-gray-50"
                      }`}
                      onClick={() => {
                        setSelectedUserId(user.id);
                        setSuccessMessage(null);
                      }}
                    >
                      <div className="font-medium text-gray-900">
                        {formatAvailableUserLabel(user)}
                      </div>
                      {user.name ? (
                        <div className="text-sm text-gray-500">
                          {user.email}
                        </div>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_10rem] md:items-end">
            <div className="space-y-2">
              <Label>{t("admin.selectedUser")}</Label>
              <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {selectedUser
                  ? formatAvailableUserLabel(selectedUser)
                  : t("admin.noUserSelected")}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="member-role">{t("admin.role")}</Label>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as AddMemberRole)}
              >
                <SelectTrigger id="member-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {canAssignAdmin && (
                    <SelectItem value="admin">{t("roles.admin")}</SelectItem>
                  )}
                  <SelectItem value="member">{t("roles.member")}</SelectItem>
                  <SelectItem value="viewer">{t("roles.viewer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">{t("admin.rolePermissions")}</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-red-50 text-red-700 border-red-200"
                >
                  {t("roles.admin")}
                </Badge>
                <span>{t("admin.rolePermissionDescriptions.admin")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-700 border-blue-200"
                >
                  {t("roles.member")}
                </Badge>
                <span>{t("admin.rolePermissionDescriptions.member")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-gray-50 text-gray-700 border-gray-200"
                >
                  {t("roles.viewer")}
                </Badge>
                <span>{t("admin.rolePermissionDescriptions.viewer")}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={resetForm}>
              {t("admin.clearSelection")}
            </Button>
            <Button
              type="submit"
              disabled={submitting || loadingUsers || !selectedUserId}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("admin.addingMember")}
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  {t("admin.addMember")}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
