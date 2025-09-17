'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, UserPlus, Shield, Activity } from 'lucide-react';
import { UserList } from '@/components/admin/UserList';
import { InviteUserForm } from '@/components/admin/InviteUserForm';
import { MembershipTable } from '@/components/admin/MembershipTable';
import { AuditLogTable } from '@/components/admin/AuditLogTable';

interface BoardMember {
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  created_at: string;
}

interface UserInvitation {
  id: string;
  board_id: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  status: 'pending' | 'accepted' | 'expired';
  invited_at: string;
  invited_by: string;
  accepted_at?: string;
  expires_at: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [boardName, setBoardName] = useState<string>('');
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login');
        return;
      }

      // Get board ID from URL params or localStorage
      const urlParams = new URLSearchParams(window.location.search);
      const boardIdParam = urlParams.get('boardId') || localStorage.getItem('currentBoardId');

      if (!boardIdParam) {
        router.push('/boards');
        return;
      }

      setBoardId(boardIdParam);

      // Check if user has admin access to this board
      const { data: membership, error: membershipError } = await supabase
        .from('board_members')
        .select('role, boards!inner(name)')
        .eq('board_id', boardIdParam)
        .eq('user_id', user.id)
        .single();

      if (membershipError || !membership || !['owner', 'admin'].includes(membership.role)) {
        router.push(`/boards/${boardIdParam}`);
        return;
      }

      setUserRole(membership.role);
      setBoardName(membership.boards?.name || 'Board');
      await fetchInvitations(boardIdParam);
    } catch (error) {
      console.error('Error checking admin access:', error);
      router.push('/boards');
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async (boardId: string) => {
    try {
      const response = await fetch(`/api/admin/invitations?boardId=${boardId}`);
      if (response.ok) {
        const data = await response.json();
        setInvitations(data.invitations || []);
      }
    } catch (error) {
      console.error('Error fetching invitations:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    if (boardId) {
      fetchInvitations(boardId);
    }
  };

  const handleInviteSuccess = () => {
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
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/boards/${boardId}`)}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Board</span>
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">User Management</h1>
                <p className="text-sm text-gray-600">{boardName}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={userRole === 'owner' ? 'default' : 'secondary'}>
                <Shield className="h-3 w-3 mr-1" />
                {userRole}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Users</span>
            </TabsTrigger>
            <TabsTrigger value="invite" className="flex items-center space-x-2">
              <UserPlus className="h-4 w-4" />
              <span>Invite Users</span>
            </TabsTrigger>
            <TabsTrigger value="memberships" className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>Memberships</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span>Audit Log</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Board Users</CardTitle>
                <CardDescription>
                  Manage users who have access to this board
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UserList 
                  boardId={boardId} 
                  refreshTrigger={refreshTrigger}
                  onRefresh={handleRefresh}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invite" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Invite New Users</CardTitle>
                  <CardDescription>
                    Send invitations to new users to join this board
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <InviteUserForm 
                    boardId={boardId} 
                    onSuccess={handleInviteSuccess}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pending Invitations</CardTitle>
                  <CardDescription>
                    Users who have been invited but haven't joined yet
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <InvitationsList 
                    invitations={invitations}
                    onRefresh={handleRefresh}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="memberships" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Board Memberships</CardTitle>
                <CardDescription>
                  Overview of all board members and their roles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MembershipTable 
                  boardId={boardId} 
                  refreshTrigger={refreshTrigger}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Audit Log</CardTitle>
                <CardDescription>
                  Track all administrative actions performed on this board
                </CardDescription>
              </CardHeader>
              <CardContent>
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

// Component for displaying invitations list
function InvitationsList({
  invitations,
  onRefresh
}: {
  invitations: UserInvitation[];
  onRefresh: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleCancelInvitation = async (invitationId: string, boardId: string) => {
    setLoading(invitationId);
    try {
      const response = await fetch(`/api/admin/invitations?id=${invitationId}&boardId=${boardId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onRefresh();
      } else {
        const error = await response.json();
        console.error('Failed to cancel invitation:', error);
      }
    } catch (error) {
      console.error('Error cancelling invitation:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleResendInvitation = async (invitationId: string, boardId: string) => {
    setLoading(invitationId);
    try {
      const response = await fetch('/api/admin/invitations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId, boardId }),
      });

      if (response.ok) {
        onRefresh();
      } else {
        const error = await response.json();
        console.error('Failed to resend invitation:', error);
      }
    } catch (error) {
      console.error('Error resending invitation:', error);
    } finally {
      setLoading(null);
    }
  };

  if (invitations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No pending invitations</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {invitations.map((invitation) => {
        const isExpired = new Date(invitation.expires_at) < new Date();
        const isLoading = loading === invitation.id;

        return (
          <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex-1">
              <p className="font-medium">{invitation.email}</p>
              <p className="text-sm text-gray-600">
                Role: {invitation.role} • Invited {new Date(invitation.invited_at).toLocaleDateString()}
                {isExpired && ' • Expired'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge
                variant={
                  invitation.status === 'pending' && !isExpired ? 'secondary' :
                  invitation.status === 'accepted' ? 'default' : 'destructive'
                }
              >
                {isExpired ? 'expired' : invitation.status}
              </Badge>

              {invitation.status === 'pending' && (
                <div className="flex space-x-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResendInvitation(invitation.id, invitation.board_id)}
                    disabled={isLoading}
                  >
                    {isLoading ? '...' : 'Resend'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleCancelInvitation(invitation.id, invitation.board_id)}
                    disabled={isLoading}
                  >
                    {isLoading ? '...' : 'Cancel'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
