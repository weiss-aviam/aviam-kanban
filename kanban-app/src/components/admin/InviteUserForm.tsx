'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Mail, X, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface InviteUserFormProps {
  boardId: string;
  currentUserRole: 'owner' | 'admin' | 'member' | 'viewer';
  onInviteSent: () => void;
}

interface InvitationData {
  email: string;
  role: 'admin' | 'member' | 'viewer';
}

export function InviteUserForm({ boardId, currentUserRole, onInviteSent }: InviteUserFormProps) {
  const [invitations, setInvitations] = useState<InvitationData[]>([
    { email: '', role: 'member' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canInviteAdmins = currentUserRole === 'owner';

  const addInvitation = () => {
    if (invitations.length < 10) {
      setInvitations([...invitations, { email: '', role: 'member' }]);
    }
  };

  const removeInvitation = (index: number) => {
    if (invitations.length > 1) {
      setInvitations(invitations.filter((_, i) => i !== index));
    }
  };

  const updateInvitation = (index: number, field: keyof InvitationData, value: string) => {
    const updated = [...invitations];
    updated[index] = { ...updated[index], [field]: value };
    setInvitations(updated);
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate all invitations
    const validInvitations = invitations.filter(inv => inv.email.trim());
    
    if (validInvitations.length === 0) {
      setError('Please enter at least one email address');
      return;
    }

    const invalidEmails = validInvitations.filter(inv => !validateEmail(inv.email));
    if (invalidEmails.length > 0) {
      setError('Please enter valid email addresses');
      return;
    }

    // Check for duplicate emails
    const emails = validInvitations.map(inv => inv.email.toLowerCase());
    const duplicates = emails.filter((email, index) => emails.indexOf(email) !== index);
    if (duplicates.length > 0) {
      setError('Duplicate email addresses are not allowed');
      return;
    }

    setLoading(true);

    try {
      // Send invitations one by one (could be optimized with bulk endpoint)
      const results = await Promise.allSettled(
        validInvitations.map(async (invitation) => {
          const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
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
        })
      );

      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected');

      if (successful > 0) {
        setSuccess(`Successfully sent ${successful} invitation${successful > 1 ? 's' : ''}`);
        setInvitations([{ email: '', role: 'member' }]);
        onInviteSent();
      }

      if (failed.length > 0) {
        const errorMessages = failed.map(result => 
          result.status === 'rejected' ? result.reason.message : 'Unknown error'
        );
        setError(`Failed to send some invitations:\n${errorMessages.join('\n')}`);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitations');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Invite Users to Board
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
              <AlertDescription>
                {success}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Email Invitations</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addInvitation}
                disabled={invitations.length >= 10}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Another
              </Button>
            </div>

            {invitations.map((invitation, index) => (
              <div key={index} className="flex items-end gap-3 p-4 border rounded-lg">
                <div className="flex-1">
                  <Label htmlFor={`email-${index}`}>Email Address</Label>
                  <Input
                    id={`email-${index}`}
                    type="email"
                    placeholder="user@example.com"
                    value={invitation.email}
                    onChange={(e) => updateInvitation(index, 'email', e.target.value)}
                    required
                  />
                </div>
                
                <div className="w-32">
                  <Label htmlFor={`role-${index}`}>Role</Label>
                  <Select
                    value={invitation.role}
                    onValueChange={(value) => updateInvitation(index, 'role', value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {canInviteAdmins && (
                        <SelectItem value="admin">Admin</SelectItem>
                      )}
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
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
            <h4 className="font-medium mb-2">Role Permissions</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Admin</Badge>
                <span>Can manage users, edit board settings, and perform all actions</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Member</Badge>
                <span>Can create and edit cards, add comments, and collaborate</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Viewer</Badge>
                <span>Can view the board and cards but cannot make changes</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setInvitations([{ email: '', role: 'member' }]);
                setError(null);
                setSuccess(null);
              }}
            >
              Clear All
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Invitations
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
