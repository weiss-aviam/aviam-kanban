import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAppStore } from "@/store";
import type { NotificationItem } from "@/store";

// ── Mocks ─────────────────────────────────────────────────────────────────────
// The component calls usePreferencesStore.getState() imperatively (not as a
// React hook), so we mock the whole module to avoid the persist/localStorage
// issue in the forks pool.

const { mockShowDesktopNotification, mockPrefsState } = vi.hoisted(() => ({
  mockShowDesktopNotification: vi.fn(),
  mockPrefsState: { dndMode: false, desktopNotificationsEnabled: false },
}));

vi.mock("@/store/preferences", () => ({
  // The component calls usePreferencesStore(selector) as a React hook.
  // This stub calls the selector against the shared mockPrefsState object.
  usePreferencesStore: (selector: (s: typeof mockPrefsState) => unknown) =>
    selector(mockPrefsState),
  showDesktopNotification: mockShowDesktopNotification,
}));

const { NotificationToast } =
  await import("@/components/notifications/NotificationToast");

// ── Helpers ───────────────────────────────────────────────────────────────────

let counter = 0;
function makeNotification(
  overrides: Partial<NotificationItem> = {},
): NotificationItem {
  counter++;
  return {
    id: `notif-${counter}`,
    type: "card_assigned",
    createdAt: new Date().toISOString(), // fresh — within RECENT_MS (8s)
    readAt: null,
    metadata: {},
    actor: { id: "actor-1", name: "Alice", avatarUrl: null },
    card: { id: "card-1", title: "My Card" },
    board: { id: "board-1", name: "My Board" },
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("NotificationToast", () => {
  beforeEach(() => {
    useAppStore.setState({ notifications: [] });
    mockPrefsState.dndMode = false;
    mockPrefsState.desktopNotificationsEnabled = false;
    mockShowDesktopNotification.mockClear();
  });

  it("shows the toast when a fresh notification arrives", async () => {
    render(<NotificationToast />);
    act(() => {
      useAppStore.setState({ notifications: [makeNotification()] });
    });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("suppresses the in-app toast when dndMode is true", async () => {
    mockPrefsState.dndMode = true;
    render(<NotificationToast />);
    act(() => {
      useAppStore.setState({ notifications: [makeNotification()] });
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("calls showDesktopNotification when desktopNotificationsEnabled is true", async () => {
    mockPrefsState.desktopNotificationsEnabled = true;
    render(<NotificationToast />);
    act(() => {
      useAppStore.setState({ notifications: [makeNotification()] });
    });
    await waitFor(() => {
      expect(mockShowDesktopNotification).toHaveBeenCalledOnce();
    });
  });

  it("fires desktop notification even when dndMode is true", async () => {
    mockPrefsState.dndMode = true;
    mockPrefsState.desktopNotificationsEnabled = true;
    render(<NotificationToast />);
    act(() => {
      useAppStore.setState({ notifications: [makeNotification()] });
    });
    await waitFor(() => {
      expect(mockShowDesktopNotification).toHaveBeenCalledOnce();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not show toast for stale notifications (> 8s old)", async () => {
    render(<NotificationToast />);
    act(() => {
      useAppStore.setState({
        notifications: [
          makeNotification({
            createdAt: new Date(Date.now() - 9_000).toISOString(),
          }),
        ],
      });
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not call showDesktopNotification when desktopNotificationsEnabled is false", async () => {
    render(<NotificationToast />);
    act(() => {
      useAppStore.setState({ notifications: [makeNotification()] });
    });
    await waitFor(() => screen.getByRole("alert"));
    expect(mockShowDesktopNotification).not.toHaveBeenCalled();
  });

  it("dismiss button hides the toast", async () => {
    render(<NotificationToast />);
    act(() => {
      useAppStore.setState({ notifications: [makeNotification()] });
    });
    await waitFor(() => screen.getByRole("alert"));
    await userEvent.click(screen.getByRole("button", { name: /schließen/i }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not show the same notification twice", async () => {
    render(<NotificationToast />);
    const notif = makeNotification();
    act(() => {
      useAppStore.setState({ notifications: [notif] });
    });
    await waitFor(() => screen.getByRole("alert"));
    await userEvent.click(screen.getByRole("button", { name: /schließen/i })); // dismiss

    // Same notification arrives again (e.g. realtime re-delivers)
    act(() => {
      useAppStore.setState({ notifications: [] });
    });
    act(() => {
      useAppStore.setState({ notifications: [notif] });
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
