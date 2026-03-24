"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, UserPlus, Shield, Activity } from "lucide-react";
import { UserList } from "@/components/admin/UserList";
import { InviteUserForm } from "@/components/admin/InviteUserForm";
import { MembershipTable } from "@/components/admin/MembershipTable";
import { AuditLogTable } from "@/components/admin/AuditLogTable";
import { AppHeader } from "@/components/layout/AppHeader";
import { HeaderActions } from "@/components/layout/HeaderActions";

export default function AdminUsersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [boardName, setBoardName] = useState<string>("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const checkAdminAccess = async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) {
        router.push("/login");
        return;
      }

      // Get board ID from URL params or localStorage
      const urlParams = new URLSearchParams(window.location.search);
      const boardIdParam =
        urlParams.get("boardId") || localStorage.getItem("currentBoardId");

      if (!boardIdParam) {
        router.push("/boards");
        return;
      }

      setBoardId(boardIdParam);

      // Check if user has admin access to this board
      const { data: membership, error: membershipError } = await supabase
        .from("board_members")
        .select("role, boards!inner(name)")
        .eq("board_id", boardIdParam)
        .eq("user_id", user.id)
        .single();

      if (
        membershipError ||
        !membership ||
        !["owner", "admin"].includes(membership.role)
      ) {
        router.push(`/boards/${boardIdParam}`);
        return;
      }

      setUserRole(membership.role);
      const boards = (
        membership as { boards?: { name?: string } | { name?: string }[] }
      ).boards;
      const boardNameVal = Array.isArray(boards)
        ? boards[0]?.name
        : boards?.name;
      setBoardName(boardNameVal || "Board");
    } catch (error) {
      console.error("Error checking admin access:", error);
      router.push("/boards");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAdminAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleMemberAdded = () => {
    handleRefresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!boardId || !userRole) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="User Management"
        subtitle={`Manage members, roles, and audit activity for ${boardName}`}
        navActions={<HeaderActions />}
        actionsStart={
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/boards/${boardId}`)}
            title="Back to Board"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Board</span>
          </Button>
        }
        actions={
          <>
            <Badge variant={userRole === "owner" ? "default" : "secondary"}>
              <Shield className="h-3 w-3 mr-1" />
              {userRole}
            </Badge>
          </>
        }
      />

      {/* Main Content */}
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 xl:px-10">
        <Tabs defaultValue="users" className="space-y-5 lg:space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1 sm:grid-cols-4">
            <TabsTrigger
              value="users"
              className="flex min-h-11 items-center gap-2 px-3 py-2 text-xs sm:text-sm"
            >
              <Users className="h-4 w-4" />
              <span>Users</span>
            </TabsTrigger>
            <TabsTrigger
              value="members"
              className="flex min-h-11 items-center gap-2 px-3 py-2 text-xs sm:text-sm"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add Members</span>
            </TabsTrigger>
            <TabsTrigger
              value="memberships"
              className="flex min-h-11 items-center gap-2 px-3 py-2 text-xs sm:text-sm"
            >
              <Shield className="h-4 w-4" />
              <span>Memberships</span>
            </TabsTrigger>
            <TabsTrigger
              value="audit"
              className="flex min-h-11 items-center gap-2 px-3 py-2 text-xs sm:text-sm"
            >
              <Activity className="h-4 w-4" />
              <span>Audit Log</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <Card className="overflow-hidden border-gray-200 shadow-sm">
              <CardHeader className="gap-2 px-5 py-5 sm:px-6 lg:px-8">
                <CardTitle className="text-xl">Board Users</CardTitle>
                <CardDescription className="max-w-3xl text-sm leading-6">
                  Manage users who have access to this board
                </CardDescription>
              </CardHeader>
              <CardContent className="px-5 pb-6 sm:px-6 lg:px-8">
                <UserList
                  boardId={boardId}
                  currentUserRole={
                    userRole as "owner" | "admin" | "member" | "viewer"
                  }
                  refreshTrigger={refreshTrigger}
                  onUserAction={handleRefresh}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members" className="space-y-6">
            <Card className="overflow-hidden border-gray-200 shadow-sm">
              <CardHeader className="gap-2 px-5 py-5 sm:px-6 lg:px-8">
                <CardTitle className="text-xl">Add Registered Users</CardTitle>
                <CardDescription className="max-w-3xl text-sm leading-6">
                  Add existing Aviam users to this board and assign their role.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-5 pb-6 sm:px-6 lg:px-8">
                <InviteUserForm
                  boardId={boardId}
                  currentUserRole={
                    userRole as "owner" | "admin" | "member" | "viewer"
                  }
                  onMemberAdded={handleMemberAdded}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="memberships" className="space-y-6">
            <Card className="overflow-hidden border-gray-200 shadow-sm">
              <CardHeader className="gap-2 px-5 py-5 sm:px-6 lg:px-8">
                <CardTitle className="text-xl">Board Memberships</CardTitle>
                <CardDescription className="max-w-3xl text-sm leading-6">
                  Overview of all board members and their roles
                </CardDescription>
              </CardHeader>
              <CardContent className="px-5 pb-6 sm:px-6 lg:px-8">
                <MembershipTable
                  boardId={boardId}
                  currentUserRole={
                    userRole as "owner" | "admin" | "member" | "viewer"
                  }
                  refreshTrigger={refreshTrigger}
                  onMembershipAction={handleRefresh}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            <Card className="overflow-hidden border-gray-200 shadow-sm">
              <CardHeader className="gap-2 px-5 py-5 sm:px-6 lg:px-8">
                <CardTitle className="text-xl">Audit Log</CardTitle>
                <CardDescription className="max-w-3xl text-sm leading-6">
                  Track all administrative actions performed on this board
                </CardDescription>
              </CardHeader>
              <CardContent className="px-5 pb-6 sm:px-6 lg:px-8">
                <AuditLogTable
                  boardId={boardId}
                  refreshTrigger={refreshTrigger}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
