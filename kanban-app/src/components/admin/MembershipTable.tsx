'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, TrendingUp, Activity } from 'lucide-react';
import { getRoleBadgeClasses, getRoleLabel } from '@/lib/role-colors';
import { formatDistanceToNow } from 'date-fns';

interface Membership {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: string;
  invitedAt?: string;
  createdAt: string;
  activity: {
    assignedCards: number;
    comments: number;
  };
}

interface MembershipTableProps {
  boardId: string;
  currentUserRole: 'owner' | 'admin' | 'member' | 'viewer';
  refreshTrigger: number;
  onMembershipAction: () => void;
}

export function MembershipTable({
  boardId,
  currentUserRole,
  refreshTrigger,
  onMembershipAction,
}: MembershipTableProps) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);

  const fetchMemberships = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/memberships?boardId=${boardId}&limit=100`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch memberships');
      }

      const data = await response.json();
      setMemberships(data.memberships);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemberships();
  }, [boardId, refreshTrigger]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/admin/memberships?boardId=${boardId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          role: newRole,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update role');
      }

      onMembershipAction();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const canChangeRole = (membership: Membership) => {
    if (membership.role === 'owner') return false;
    if (currentUserRole === 'owner') return true;
    if (currentUserRole === 'admin') return true;
    return false;
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading memberships...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-2">{error}</p>
          <Button onClick={fetchMemberships} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Total Members</p>
                  <p className="text-2xl font-bold">{summary.totalMembers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Admins</p>
                  <p className="text-2xl font-bold">{summary.roleDistribution.admin}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-purple-600" />
                <div>
                  <p className="text-sm font-medium">Members</p>
                  <p className="text-2xl font-bold">{summary.roleDistribution.member}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-gray-600" />
                <div>
                  <p className="text-sm font-medium">Viewers</p>
                  <p className="text-2xl font-bold">{summary.roleDistribution.viewer}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Memberships Table */}
      <Card>
        <CardHeader>
          <CardTitle>Board Memberships</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {memberships.map((membership) => (
              <div key={membership.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium">{membership.name || 'No name'}</h4>
                      <Badge className={getRoleBadgeClasses(membership.role)} variant="outline">
                        {getRoleLabel(membership.role)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{membership.email}</p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                      <span>Joined {formatDistanceToNow(new Date(membership.joinedAt))} ago</span>
                      <span>•</span>
                      <span>{membership.activity.assignedCards} cards assigned</span>
                      <span>•</span>
                      <span>{membership.activity.comments} comments</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {canChangeRole(membership) ? (
                    <Select
                      value={membership.role}
                      onValueChange={(value) => handleRoleChange(membership.id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currentUserRole === 'owner' && (
                          <SelectItem value="admin">Admin</SelectItem>
                        )}
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="w-32 justify-center">
                      {getRoleLabel(membership.role)}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
