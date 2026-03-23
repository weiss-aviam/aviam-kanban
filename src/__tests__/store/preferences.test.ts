import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Stub localStorage so the Zustand persist middleware can write ─────────────
// The vitest `forks` pool does not provide a functional localStorage.

const storageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(globalThis, "localStorage", {
  value: storageMock,
  writable: true,
  configurable: true,
});

// ── import store after clearing module cache so each test gets a fresh store ──

// We test actions directly without rendering, so we can import store functions
const {
  usePreferencesStore,
  showDesktopNotification,
  requestDesktopPermission,
} = await import("@/store/preferences");

// ── helpers ───────────────────────────────────────────────────────────────────

function getState() {
  return usePreferencesStore.getState();
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("usePreferencesStore — defaults", () => {
  it("dndMode defaults to false", () => {
    expect(getState().dndMode).toBe(false);
  });

  it("desktopNotificationsEnabled defaults to false", () => {
    expect(getState().desktopNotificationsEnabled).toBe(false);
  });
});

describe("usePreferencesStore — setDndMode", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ dndMode: false });
  });

  it("enables DnD mode", () => {
    getState().setDndMode(true);
    expect(getState().dndMode).toBe(true);
  });

  it("disables DnD mode", () => {
    getState().setDndMode(true);
    getState().setDndMode(false);
    expect(getState().dndMode).toBe(false);
  });
});

describe("usePreferencesStore — setDesktopNotificationsEnabled", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ desktopNotificationsEnabled: false });
  });

  it("enables desktop notifications", () => {
    getState().setDesktopNotificationsEnabled(true);
    expect(getState().desktopNotificationsEnabled).toBe(true);
  });

  it("disables desktop notifications", () => {
    getState().setDesktopNotificationsEnabled(true);
    getState().setDesktopNotificationsEnabled(false);
    expect(getState().desktopNotificationsEnabled).toBe(false);
  });
});

describe("showDesktopNotification", () => {
  it("calls new Notification when permission is granted", () => {
    const mockNotification = vi.fn();
    Object.defineProperty(window, "Notification", {
      value: Object.assign(mockNotification, { permission: "granted" }),
      writable: true,
      configurable: true,
    });

    showDesktopNotification("Test title", "Test body");

    expect(mockNotification).toHaveBeenCalledWith("Test title", {
      body: "Test body",
      icon: `${window.location.origin}/favicon.png`,
    });
  });

  it("does not call new Notification when permission is denied", () => {
    const mockNotification = vi.fn();
    Object.defineProperty(window, "Notification", {
      value: Object.assign(mockNotification, { permission: "denied" }),
      writable: true,
      configurable: true,
    });

    showDesktopNotification("Test title", "Test body");

    expect(mockNotification).not.toHaveBeenCalled();
  });

  it("does not throw when Notification is not in window", () => {
    const original = window.Notification;
    // @ts-expect-error intentional
    delete window.Notification;

    expect(() => showDesktopNotification("title", "body")).not.toThrow();

    Object.defineProperty(window, "Notification", {
      value: original,
      writable: true,
      configurable: true,
    });
  });
});

describe("requestDesktopPermission", () => {
  it("returns true immediately when permission is already granted", async () => {
    Object.defineProperty(window, "Notification", {
      value: Object.assign(vi.fn(), {
        permission: "granted",
        requestPermission: vi.fn(),
      }),
      writable: true,
      configurable: true,
    });

    const result = await requestDesktopPermission();
    expect(result).toBe(true);
    expect(window.Notification.requestPermission).not.toHaveBeenCalled();
  });

  it("returns false when permission is denied without requesting", async () => {
    Object.defineProperty(window, "Notification", {
      value: Object.assign(vi.fn(), {
        permission: "denied",
        requestPermission: vi.fn(),
      }),
      writable: true,
      configurable: true,
    });

    const result = await requestDesktopPermission();
    expect(result).toBe(false);
    expect(window.Notification.requestPermission).not.toHaveBeenCalled();
  });

  it("calls requestPermission when permission is default and returns result", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    Object.defineProperty(window, "Notification", {
      value: Object.assign(vi.fn(), {
        permission: "default",
        requestPermission,
      }),
      writable: true,
      configurable: true,
    });

    const result = await requestDesktopPermission();
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(result).toBe(true);
  });

  it("returns false when requestPermission is denied", async () => {
    const requestPermission = vi.fn().mockResolvedValue("denied");
    Object.defineProperty(window, "Notification", {
      value: Object.assign(vi.fn(), {
        permission: "default",
        requestPermission,
      }),
      writable: true,
      configurable: true,
    });

    const result = await requestDesktopPermission();
    expect(result).toBe(false);
  });
});
