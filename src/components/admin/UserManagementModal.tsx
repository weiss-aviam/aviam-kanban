"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, History, Settings } from "lucide-react";
import { t } from "@/lib/i18n";
import { UserList } from "./UserList";
import { InviteUserForm } from "./InviteUserForm";
import { MembershipTable } from "./MembershipTable";
import { AuditLogTable } from "./AuditLogTable";
import {
  DEFAULT_USER_MANAGEMENT_TAB,
  canAccessUserManagement,
  getUserManagementRoleLabelKey,
  nextRefreshTrigger,
  shouldShowRefreshButton,
  type UserManagementTab,
} from "./user-management-modal.utils";

interface UserManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  boardName: string;
  currentUserRole: "owner" | "admin" | "member" | "viewer";
}

export function UserManagementModal({
  open,
  onOpenChange,
  boardId,
  boardName,
  currentUserRole,
}: UserManagementModalProps) {
  const [activeTab, setActiveTab] = useState<UserManagementTab>(
    DEFAULT_USER_MANAGEMENT_TAB,
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  if (!canAccessUserManagement(currentUserRole)) {
    return null;
  }

  const handleRefresh = () => {
    setRefreshTrigger((prev) => nextRefreshTrigger(prev));
  };

  const handleUserAction = () => {
    handleRefresh();
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as UserManagementTab);
  };

  const refreshButton = shouldShowRefreshButton(activeTab) ? (
    <Button variant="outline" size="sm" onClick={handleRefresh}>
      {t("common.refresh")}
    </Button>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-[95vw] flex-col overflow-hidden sm:max-w-6xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Users className="w-5 h-5" />
            {t("admin.userManagementTitle", { boardName })}
            <Badge variant="outline">
              {t(getUserManagementRoleLabelKey(currentUserRole))}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <TabsList className="grid h-auto w-full shrink-0 grid-cols-2 gap-1 sm:grid-cols-4">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t("admin.tabs.users")}
            </TabsTrigger>
            <TabsTrigger value="members" className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              {t("admin.tabs.members")}
            </TabsTrigger>
            <TabsTrigger
              value="memberships"
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              {t("admin.tabs.memberships")}
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              {t("admin.tabs.auditLog")}
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
            <TabsContent value="users" className="mt-0 min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-6 pr-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {t("admin.boardUsers")}
                  </h3>
                  {refreshButton}
                </div>
                <UserList
                  boardId={boardId}
                  currentUserRole={currentUserRole}
                  refreshTrigger={refreshTrigger}
                  onUserAction={handleUserAction}
                />
              </div>
            </TabsContent>

            <TabsContent
              value="members"
              className="mt-0 min-h-0 flex-1 overflow-y-auto"
            >
              <div className="space-y-6 pr-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {t("admin.addExistingUsersToBoard")}
                  </h3>
                </div>
                <InviteUserForm
                  boardId={boardId}
                  currentUserRole={currentUserRole}
                  onMemberAdded={handleUserAction}
                />
              </div>
            </TabsContent>

            <TabsContent
              value="memberships"
              className="mt-0 min-h-0 flex-1 overflow-y-auto"
            >
              <div className="space-y-6 pr-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {t("admin.boardMemberships")}
                  </h3>
                  {refreshButton}
                </div>
                <MembershipTable
                  boardId={boardId}
                  currentUserRole={currentUserRole}
                  refreshTrigger={refreshTrigger}
                  onMembershipAction={handleUserAction}
                />
              </div>
            </TabsContent>

            <TabsContent
              value="audit"
              className="mt-0 min-h-0 flex-1 overflow-y-auto"
            >
              <div className="space-y-6 pr-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {t("admin.adminActionsAuditLog")}
                  </h3>
                  {refreshButton}
                </div>
                <AuditLogTable
                  boardId={boardId}
                  refreshTrigger={refreshTrigger}
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
