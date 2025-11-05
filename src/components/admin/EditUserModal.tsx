"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Edit, Save, X } from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "member" | "viewer";
  joinedAt: string;
  createdAt: string;
}

interface EditUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  boardId: string;
  currentUserRole: "owner" | "admin" | "member" | "viewer";
  onUserUpdated: () => void;
}

export function EditUserModal({
  open,
  onOpenChange,
  user,
  boardId,
  currentUserRole,
  onUserUpdated,
}: EditUserModalProps) {
  const [name, setName] = useState(user.name || "");
  const [role, setRole] = useState(user.role);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canChangeRole =
    currentUserRole === "owner" ||
    (currentUserRole === "admin" && user.role !== "owner");
  const canAssignAdmin = currentUserRole === "owner";

  useEffect(() => {
    if (open) {
      setName(user.name || "");
      setRole(user.role);
      setError(null);
    }
  }, [open, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const updates: Record<string, unknown> = {};
    let hasChanges = false;

    if (name.trim() !== (user.name || "")) {
      updates.name = name.trim();
      hasChanges = true;
    }

    if (role !== user.role && canChangeRole) {
      updates.role = role;
      hasChanges = true;
    }

    if (!hasChanges) {
      onOpenChange(false);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/admin/users/${user.id}?boardId=${boardId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update user");
      }

      onUserUpdated();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  const getRoleDescription = (roleValue: string) => {
    switch (roleValue) {
      case "owner":
        return "Full control over the board and all settings";
      case "admin":
        return "Can manage users and board settings";
      case "member":
        return "Can create and edit cards and collaborate";
      case "viewer":
        return "Can view the board but cannot make changes";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Edit User
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* User Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Email</Label>
              <Badge variant="outline" className="text-xs">
                Cannot be changed
              </Badge>
            </div>
            <Input value={user.email} disabled className="bg-gray-50" />
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter display name"
              maxLength={100}
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Role</Label>
              {!canChangeRole && (
                <Badge variant="outline" className="text-xs">
                  Cannot be changed
                </Badge>
              )}
            </div>

            {canChangeRole ? (
              <Select
                value={role}
                onValueChange={(value) => setRole(value as typeof role)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {canAssignAdmin && (
                    <SelectItem value="admin">Admin</SelectItem>
                  )}
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="p-2 bg-gray-50 rounded border">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Badge>
                  <span className="text-sm text-gray-600">
                    {getRoleDescription(role)}
                  </span>
                </div>
              </div>
            )}

            {canChangeRole && (
              <p className="text-xs text-gray-600">
                {getRoleDescription(role)}
              </p>
            )}
          </div>

          {/* Warnings */}
          {role !== user.role && (
            <Alert>
              <AlertDescription>
                Changing this user&apos;s role will immediately update their
                permissions on the board.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
