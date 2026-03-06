"use client";

import { useState } from "react";
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
// import { Textarea } from '@/components/ui/textarea';
import { Badge } from "@/components/ui/badge";
import { UserPlus, Mail, X, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { t } from "@/lib/i18n";
import {
  addInvitationRow,
  canInviteAdmins,
  createEmptyInvitation,
  getInvitationResultSummary,
  getInvitationValidationError,
  type InvitationData,
  type InvitationRole,
} from "./invite-user-form.utils";

interface InviteUserFormProps {
  boardId: string;
  currentUserRole: "owner" | "admin" | "member" | "viewer";
  onInviteSent: () => void;
}

export function InviteUserForm({
  boardId,
  currentUserRole,
  onInviteSent,
}: InviteUserFormProps) {
  const [invitations, setInvitations] = useState<InvitationData[]>([
    createEmptyInvitation(),
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canInviteAdminRole = canInviteAdmins(currentUserRole);

  const addInvitation = () => {
    setInvitations((currentInvitations) =>
      addInvitationRow(currentInvitations),
    );
  };

  const removeInvitation = (index: number) => {
    if (invitations.length > 1) {
      setInvitations(invitations.filter((_, i) => i !== index));
    }
  };

  const updateInvitationEmail = (index: number, email: string) => {
    setInvitations((currentInvitations) =>
      currentInvitations.map((invitation, currentIndex) =>
        currentIndex === index ? { ...invitation, email } : invitation,
      ),
    );
  };

  const updateInvitationRole = (index: number, role: InvitationRole) => {
    setInvitations((currentInvitations) =>
      currentInvitations.map((invitation, currentIndex) =>
        currentIndex === index ? { ...invitation, role } : invitation,
      ),
    );
  };

  const resetInvitations = () => {
    setInvitations([createEmptyInvitation()]);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = getInvitationValidationError(invitations);
    if (validationError) {
      setError(t(validationError));
      return;
    }

    const validInvitations = invitations.filter((invitation) =>
      invitation.email.trim(),
    );

    setLoading(true);

    try {
      // Send invitations one by one (could be optimized with bulk endpoint)
      const results = await Promise.allSettled(
        validInvitations.map(async (invitation) => {
          const response = await fetch("/api/admin/users", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: invitation.email,
              role: invitation.role,
              boardId,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`${invitation.email}: ${errorData.error}`);
          }

          return response.json();
        }),
      );

      const { successful, failedMessages } =
        getInvitationResultSummary(results);

      if (successful > 0) {
        setSuccess(t("admin.invitationSuccess", { count: String(successful) }));
        setInvitations([createEmptyInvitation()]);
        onInviteSent();
      }

      if (failedMessages.length > 0) {
        setError(
          t("admin.invitationError", { errors: failedMessages.join("\n") }),
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.failedToSendInvitations"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          {t("admin.inviteUsersToBoard")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription className="whitespace-pre-line">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">
                {t("admin.emailInvitations")}
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addInvitation}
                disabled={invitations.length >= 10}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("admin.addAnother")}
              </Button>
            </div>

            {invitations.map((invitation, index) => (
              <div
                key={index}
                className="flex items-end gap-3 p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <Label htmlFor={`email-${index}`}>
                    {t("admin.emailAddress")}
                  </Label>
                  <Input
                    id={`email-${index}`}
                    type="email"
                    placeholder={t("admin.emailPlaceholder")}
                    value={invitation.email}
                    onChange={(e) =>
                      updateInvitationEmail(index, e.target.value)
                    }
                    required
                  />
                </div>

                <div className="w-32">
                  <Label htmlFor={`role-${index}`}>{t("admin.role")}</Label>
                  <Select
                    value={invitation.role}
                    onValueChange={(value) =>
                      updateInvitationRole(index, value as InvitationRole)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {canInviteAdminRole && (
                        <SelectItem value="admin">
                          {t("roles.admin")}
                        </SelectItem>
                      )}
                      <SelectItem value="member">
                        {t("roles.member")}
                      </SelectItem>
                      <SelectItem value="viewer">
                        {t("roles.viewer")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {invitations.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeInvitation(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
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
            <Button type="button" variant="outline" onClick={resetInvitations}>
              {t("admin.clearAll")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t("common.sending")}
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  {t("admin.sendInvitations")}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
