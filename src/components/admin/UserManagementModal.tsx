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
import { UserList } from "./UserList";
import { InviteUserForm } from "./InviteUserForm";
import { MembershipTable } from "./MembershipTable";
import { AuditLogTable } from "./AuditLogTable";

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
  const [activeTab, setActiveTab] = useState("users");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const isAdmin = currentUserRole === "owner" || currentUserRole === "admin";

  if (!isAdmin) {
    return null;
  }

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleUserAction = () => {
    handleRefresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            User Management - {boardName}
            <Badge variant="outline" className="ml-2">
              {currentUserRole === "owner" ? "Owner" : "Admin"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="invite" className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Invite
            </TabsTrigger>
            <TabsTrigger
              value="memberships"
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Memberships
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="users" className="h-full">
              <div className="space-y-6 h-full">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Board Users</h3>
                  <Button variant="outline" size="sm" onClick={handleRefresh}>
                    Refresh
                  </Button>
                </div>
                <UserList
                  boardId={boardId}
                  currentUserRole={currentUserRole}
                  refreshTrigger={refreshTrigger}
                  onUserAction={handleUserAction}
                />
              </div>
            </TabsContent>

            <TabsContent value="invite" className="h-full">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Invite New Users</h3>
                </div>
                <InviteUserForm
                  boardId={boardId}
                  currentUserRole={currentUserRole}
                  onInviteSent={handleUserAction}
                />
              </div>
            </TabsContent>

            <TabsContent value="memberships" className="h-full">
              <div className="space-y-6 h-full">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Board Memberships</h3>
                  <Button variant="outline" size="sm" onClick={handleRefresh}>
                    Refresh
                  </Button>
                </div>
                <MembershipTable
                  boardId={boardId}
                  currentUserRole={currentUserRole}
                  refreshTrigger={refreshTrigger}
                  onMembershipAction={handleUserAction}
                />
              </div>
            </TabsContent>

            <TabsContent value="audit" className="h-full">
              <div className="space-y-6 h-full">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    Admin Actions Audit Log
                  </h3>
                  <Button variant="outline" size="sm" onClick={handleRefresh}>
                    Refresh
                  </Button>
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
