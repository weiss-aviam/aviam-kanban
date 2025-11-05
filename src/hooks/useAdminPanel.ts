"use client";

import { useState, useCallback, useMemo } from "react";
import { useUserManagement } from "./useUserManagement";
import { useBoardMemberships } from "./useBoardMemberships";
import { useAuditLogs } from "./useAuditLogs";

export interface UseAdminPanelOptions {
  boardId: string;
  currentUserRole: "owner" | "admin" | "member" | "viewer";
  autoRefresh?: boolean;
  onSuccess?: (message: string) => void;
  onError?: (error: string) => void;
}

export function useAdminPanel(options: UseAdminPanelOptions) {
  const [activeTab, setActiveTab] = useState<
    "users" | "invite" | "memberships" | "audit"
  >("users");
  const [globalLoading, setGlobalLoading] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      type: "success" | "error" | "info";
      message: string;
      timestamp: Date;
    }>
  >([]);

  const {
    boardId,
    currentUserRole,
    autoRefresh = false,
    onSuccess,
    onError,
  } = options;

  // Check if user has admin permissions
  const isAdmin = useMemo(() => {
    return currentUserRole === "owner" || currentUserRole === "admin";
  }, [currentUserRole]);

  // Notification handlers
  const addNotification = useCallback(
    (type: "success" | "error" | "info", message: string) => {
      const notification = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        message,
        timestamp: new Date(),
      };
      setNotifications((prev) => [notification, ...prev.slice(0, 4)]); // Keep only 5 notifications

      // Auto-remove after 5 seconds
      setTimeout(() => {
        setNotifications((prev) =>
          prev.filter((n) => n.id !== notification.id),
        );
      }, 5000);
    },
    [],
  );

  const handleSuccess = useCallback(
    (message: string) => {
      addNotification("success", message);
      onSuccess?.(message);
    },
    [addNotification, onSuccess],
  );

  const handleError = useCallback(
    (error: string) => {
      addNotification("error", error);
      onError?.(error);
    },
    [addNotification, onError],
  );

  // Initialize hooks
  const userManagement = useUserManagement({
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const boardMemberships = useBoardMemberships({
    boardId,
    autoRefresh,
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const auditLogs = useAuditLogs({
    boardId,
    autoRefresh,
    onError: handleError,
  });

  /**
   * Refresh all data
   */
  const refreshAll = useCallback(async () => {
    setGlobalLoading(true);
    try {
      await Promise.all([boardMemberships.refresh(), auditLogs.refresh()]);
      addNotification("success", "Data refreshed successfully");
    } catch (_error) {
      handleError("Failed to refresh data");
    } finally {
      setGlobalLoading(false);
    }
  }, [boardMemberships, auditLogs, addNotification, handleError]);

  /**
   * Invite user with automatic refresh
   */
  const inviteUserWithRefresh = useCallback(
    async (data: { email: string; role: "admin" | "member" | "viewer" }) => {
      try {
        const result = await userManagement.inviteUser({ ...data, boardId });
        // Refresh memberships after successful invite
        boardMemberships.refresh();
        return result;
      } catch (error) {
        throw error;
      }
    },
    [userManagement, boardMemberships, boardId],
  );

  /**
   * Update user with automatic refresh
   */
  const updateUserWithRefresh = useCallback(
    async (
      userId: string,
      data: {
        name?: string;
        role?: "admin" | "member" | "viewer";
      },
    ) => {
      try {
        const result = await userManagement.updateUser(userId, boardId, data);
        // Refresh memberships after successful update
        boardMemberships.refresh();
        return result;
      } catch (error) {
        throw error;
      }
    },
    [userManagement, boardMemberships, boardId],
  );

  /**
   * Remove user with automatic refresh
   */
  const removeUserWithRefresh = useCallback(
    async (userId: string) => {
      try {
        const result = await userManagement.removeUser(userId, boardId);
        // Refresh memberships after successful removal
        boardMemberships.refresh();
        return result;
      } catch (error) {
        throw error;
      }
    },
    [userManagement, boardMemberships, boardId],
  );

  /**
   * Update membership role with automatic refresh
   */
  const updateMembershipWithRefresh = useCallback(
    async (data: { userId: string; role: "admin" | "member" | "viewer" }) => {
      try {
        const result = await boardMemberships.updateMembership(data);
        // Refresh audit logs to show the change
        auditLogs.refresh();
        return result;
      } catch (error) {
        throw error;
      }
    },
    [boardMemberships, auditLogs],
  );

  /**
   * Bulk invite users
   */
  const bulkInviteUsersWithRefresh = useCallback(
    async (
      invitations: Array<{
        email: string;
        role: "admin" | "member" | "viewer";
      }>,
    ) => {
      try {
        const result = await userManagement.bulkInviteUsers(
          invitations,
          boardId,
        );
        // Refresh memberships after bulk invite
        boardMemberships.refresh();
        return result;
      } catch (error) {
        throw error;
      }
    },
    [userManagement, boardMemberships, boardId],
  );

  /**
   * Clear all notifications
   */
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  /**
   * Remove specific notification
   */
  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  /**
   * Get combined loading state
   */
  const isLoading = useMemo(() => {
    return (
      globalLoading ||
      userManagement.loading ||
      boardMemberships.loading ||
      auditLogs.loading
    );
  }, [
    globalLoading,
    userManagement.loading,
    boardMemberships.loading,
    auditLogs.loading,
  ]);

  /**
   * Get combined error state
   */
  const hasError = useMemo(() => {
    return !!(
      userManagement.error ||
      boardMemberships.error ||
      auditLogs.error
    );
  }, [userManagement.error, boardMemberships.error, auditLogs.error]);

  /**
   * Get all errors
   */
  const allErrors = useMemo(() => {
    const errors = [];
    if (userManagement.error) errors.push(userManagement.error);
    if (boardMemberships.error) errors.push(boardMemberships.error);
    if (auditLogs.error) errors.push(auditLogs.error);
    return errors;
  }, [userManagement.error, boardMemberships.error, auditLogs.error]);

  /**
   * Clear all errors
   */
  const clearAllErrors = useCallback(() => {
    userManagement.clearError();
    boardMemberships.clearError();
    auditLogs.clearError();
  }, [userManagement, boardMemberships, auditLogs]);

  // Return null if user is not admin
  if (!isAdmin) {
    return null;
  }

  return {
    // State
    activeTab,
    setActiveTab,
    isLoading,
    hasError,
    allErrors,
    notifications,
    isAdmin,

    // Individual hook data
    users: userManagement,
    memberships: boardMemberships,
    audit: auditLogs,

    // Enhanced actions with auto-refresh
    inviteUser: inviteUserWithRefresh,
    updateUser: updateUserWithRefresh,
    removeUser: removeUserWithRefresh,
    updateMembership: updateMembershipWithRefresh,
    bulkInviteUsers: bulkInviteUsersWithRefresh,
    resetPassword: userManagement.resetPassword,

    // Global actions
    refreshAll,
    clearAllErrors,
    clearNotifications,
    removeNotification,
  };
}
