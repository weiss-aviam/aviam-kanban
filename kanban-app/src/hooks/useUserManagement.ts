'use client';

import { useState, useCallback } from 'react';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: string;
  invitedAt?: string;
  createdAt: string;
}

export interface InviteUserData {
  email: string;
  role: 'admin' | 'member' | 'viewer';
  boardId: string;
}

export interface UpdateUserData {
  name?: string;
  role?: 'admin' | 'member' | 'viewer';
}

export interface UseUserManagementOptions {
  onSuccess?: (message: string) => void;
  onError?: (error: string) => void;
}

export function useUserManagement(options: UseUserManagementOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { onSuccess, onError } = options;

  const handleError = useCallback((err: unknown) => {
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
    setError(errorMessage);
    onError?.(errorMessage);
  }, [onError]);

  const handleSuccess = useCallback((message: string) => {
    setError(null);
    onSuccess?.(message);
  }, [onSuccess]);

  /**
   * Fetch users for a board with pagination and filtering
   */
  const fetchUsers = useCallback(async (params: {
    boardId: string;
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams({
        boardId: params.boardId,
        page: (params.page || 1).toString(),
        limit: (params.limit || 20).toString(),
        sortBy: params.sortBy || 'name',
        sortOrder: params.sortOrder || 'asc',
      });

      if (params.search) searchParams.append('search', params.search);
      if (params.role) searchParams.append('role', params.role);

      const response = await fetch(`/api/admin/users?${searchParams}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch users');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  /**
   * Invite a new user to the board
   */
  const inviteUser = useCallback(async (data: InviteUserData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to invite user');
      }

      const result = await response.json();
      handleSuccess('User invitation sent successfully');
      return result;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError, handleSuccess]);

  /**
   * Update user details and role
   */
  const updateUser = useCallback(async (userId: string, boardId: string, data: UpdateUserData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}?boardId=${boardId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user');
      }

      const result = await response.json();
      handleSuccess('User updated successfully');
      return result;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError, handleSuccess]);

  /**
   * Remove user from board
   */
  const removeUser = useCallback(async (userId: string, boardId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}?boardId=${boardId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove user');
      }

      const result = await response.json();
      handleSuccess('User removed from board successfully');
      return result;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError, handleSuccess]);

  /**
   * Reset user password
   */
  const resetPassword = useCallback(async (userId: string, boardId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password?boardId=${boardId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reset password');
      }

      const result = await response.json();
      handleSuccess('Password reset email sent successfully');
      return result;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError, handleSuccess]);

  /**
   * Bulk invite users
   */
  const bulkInviteUsers = useCallback(async (invitations: Array<{ email: string; role: 'admin' | 'member' | 'viewer' }>, boardId: string) => {
    setLoading(true);
    setError(null);

    try {
      // Send invitations one by one (could be optimized with bulk endpoint)
      const results = await Promise.allSettled(
        invitations.map(invitation => 
          inviteUser({ ...invitation, boardId })
        )
      );

      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected');

      if (successful > 0) {
        handleSuccess(`Successfully sent ${successful} invitation${successful > 1 ? 's' : ''}`);
      }

      if (failed.length > 0) {
        const errorMessages = failed.map(result => 
          result.status === 'rejected' ? result.reason.message : 'Unknown error'
        );
        throw new Error(`Failed to send some invitations:\n${errorMessages.join('\n')}`);
      }

      return { successful, failed: failed.length };
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [inviteUser, handleError, handleSuccess]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    loading,
    error,
    
    // Actions
    fetchUsers,
    inviteUser,
    updateUser,
    removeUser,
    resetPassword,
    bulkInviteUsers,
    clearError,
  };
}
