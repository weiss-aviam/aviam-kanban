import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUserManagement } from "@/hooks/useUserManagement";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useUserManagement", () => {
  const mockOnSuccess = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchUsers", () => {
    it("should fetch users successfully", async () => {
      const mockResponse = {
        users: [
          {
            id: "1",
            email: "user1@example.com",
            name: "User 1",
            role: "member",
          },
          {
            id: "2",
            email: "user2@example.com",
            name: "User 2",
            role: "viewer",
          },
        ],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() =>
        useUserManagement({ onSuccess: mockOnSuccess, onError: mockOnError }),
      );

      let fetchResult;
      await act(async () => {
        fetchResult = await result.current.fetchUsers({
          boardId: "board-123",
          page: 1,
          limit: 20,
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "/api/admin/users?boardId=board-123&page=1&limit=20&sortBy=name&sortOrder=asc",
        ),
      );
      expect(fetchResult).toEqual(mockResponse);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it("should handle fetch errors", async () => {
      const errorMessage = "Failed to fetch users";
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: errorMessage }),
      });

      const { result } = renderHook(() =>
        useUserManagement({ onSuccess: mockOnSuccess, onError: mockOnError }),
      );

      await act(async () => {
        try {
          await result.current.fetchUsers({ boardId: "board-123" });
        } catch (_error) {
          // Expected to throw
        }
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(errorMessage);
      expect(mockOnError).toHaveBeenCalledWith(errorMessage);
    });

    it("should include search and filter parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ users: [], pagination: {} }),
      });

      const { result } = renderHook(() => useUserManagement());

      await act(async () => {
        await result.current.fetchUsers({
          boardId: "board-123",
          search: "john",
          role: "admin",
          sortBy: "email",
          sortOrder: "desc",
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "search=john&role=admin&sortBy=email&sortOrder=desc",
        ),
      );
    });
  });

  describe("inviteUser", () => {
    it("should invite user successfully", async () => {
      const mockResponse = {
        message: "User invitation sent successfully",
        user: { id: "new-user-id", email: "newuser@example.com" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() =>
        useUserManagement({ onSuccess: mockOnSuccess, onError: mockOnError }),
      );

      let inviteResult;
      await act(async () => {
        inviteResult = await result.current.inviteUser({
          email: "newuser@example.com",
          role: "member",
          boardId: "board-123",
        });
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "newuser@example.com",
          role: "member",
          boardId: "board-123",
        }),
      });
      expect(inviteResult).toEqual(mockResponse);
      expect(mockOnSuccess).toHaveBeenCalledWith(
        "User invitation sent successfully",
      );
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it("should handle invite errors", async () => {
      const errorMessage = "User already exists";
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: errorMessage }),
      });

      const { result } = renderHook(() =>
        useUserManagement({ onSuccess: mockOnSuccess, onError: mockOnError }),
      );

      await act(async () => {
        try {
          await result.current.inviteUser({
            email: "existing@example.com",
            role: "member",
            boardId: "board-123",
          });
        } catch (_error) {
          // Expected to throw
        }
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(errorMessage);
      expect(mockOnError).toHaveBeenCalledWith(errorMessage);
    });
  });

  describe("updateUser", () => {
    it("should update user successfully", async () => {
      const mockResponse = {
        message: "User updated successfully",
        user: { id: "user-123", name: "Updated Name", role: "admin" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() =>
        useUserManagement({ onSuccess: mockOnSuccess, onError: mockOnError }),
      );

      let updateResult;
      await act(async () => {
        updateResult = await result.current.updateUser(
          "user-123",
          "board-123",
          {
            name: "Updated Name",
            role: "admin",
          },
        );
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/users/user-123?boardId=board-123",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Updated Name",
            role: "admin",
          }),
        },
      );
      expect(updateResult).toEqual(mockResponse);
      expect(mockOnSuccess).toHaveBeenCalledWith("User updated successfully");
    });
  });

  describe("removeUser", () => {
    it("should remove user successfully", async () => {
      const mockResponse = {
        message: "User removed from board successfully",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() =>
        useUserManagement({ onSuccess: mockOnSuccess, onError: mockOnError }),
      );

      let removeResult;
      await act(async () => {
        removeResult = await result.current.removeUser("user-123", "board-123");
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/users/user-123?boardId=board-123",
        {
          method: "DELETE",
        },
      );
      expect(removeResult).toEqual(mockResponse);
      expect(mockOnSuccess).toHaveBeenCalledWith(
        "User removed from board successfully",
      );
    });
  });

  describe("resetPassword", () => {
    it("should reset password successfully", async () => {
      const mockResponse = {
        message: "Password reset email sent successfully",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() =>
        useUserManagement({ onSuccess: mockOnSuccess, onError: mockOnError }),
      );

      let resetResult;
      await act(async () => {
        resetResult = await result.current.resetPassword(
          "user-123",
          "board-123",
        );
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/users/user-123/reset-password?boardId=board-123",
        {
          method: "POST",
        },
      );
      expect(resetResult).toEqual(mockResponse);
      expect(mockOnSuccess).toHaveBeenCalledWith(
        "Password reset email sent successfully",
      );
    });
  });

  describe("bulkInviteUsers", () => {
    it("should bulk invite users successfully", async () => {
      // Mock successful invitations
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ message: "User invitation sent successfully" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ message: "User invitation sent successfully" }),
        });

      const { result } = renderHook(() =>
        useUserManagement({ onSuccess: mockOnSuccess, onError: mockOnError }),
      );

      let bulkResult;
      await act(async () => {
        bulkResult = await result.current.bulkInviteUsers(
          [
            { email: "user1@example.com", role: "member" },
            { email: "user2@example.com", role: "viewer" },
          ],
          "board-123",
        );
      });

      expect(bulkResult).toEqual({ successful: 2, failed: 0 });
      expect(mockOnSuccess).toHaveBeenCalledWith(
        "Successfully sent 2 invitations",
      );
    });

    it("should handle partial failures in bulk invite", async () => {
      // Mock one success and one failure
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ message: "User invitation sent successfully" }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: "User already exists" }),
        });

      const { result } = renderHook(() =>
        useUserManagement({ onSuccess: mockOnSuccess, onError: mockOnError }),
      );

      await act(async () => {
        try {
          await result.current.bulkInviteUsers(
            [
              { email: "user1@example.com", role: "member" },
              { email: "existing@example.com", role: "viewer" },
            ],
            "board-123",
          );
        } catch (_error) {
          // Expected to throw due to failures
        }
      });

      expect(mockOnSuccess).toHaveBeenCalledWith(
        "Successfully sent 1 invitation",
      );
      expect(mockOnError).toHaveBeenCalled();
    });
  });

  describe("clearError", () => {
    it("should clear error state", async () => {
      // First, create an error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Test error" }),
      });

      const { result } = renderHook(() => useUserManagement());

      await act(async () => {
        try {
          await result.current.fetchUsers({ boardId: "board-123" });
        } catch (_error) {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe("Test error");

      // Clear the error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBe(null);
    });
  });

  describe("loading state", () => {
    it("should set loading state during async operations", async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(promise);

      const { result } = renderHook(() => useUserManagement());

      // Start async operation
      act(() => {
        result.current.fetchUsers({ boardId: "board-123" });
      });

      // Should be loading
      expect(result.current.loading).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolvePromise!({
          ok: true,
          json: () => Promise.resolve({ users: [], pagination: {} }),
        });
        await promise;
      });

      // Should no longer be loading
      expect(result.current.loading).toBe(false);
    });
  });
});
