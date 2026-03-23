"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationPreferences = {
  /** Suppress in-app toast banners entirely. */
  dndMode: boolean;
  /** Show OS-level desktop notifications for incoming alerts. */
  desktopNotificationsEnabled: boolean;
};

type PreferencesActions = {
  setDndMode: (enabled: boolean) => void;
  setDesktopNotificationsEnabled: (enabled: boolean) => void;
};

type PreferencesStore = NotificationPreferences & PreferencesActions;

// ── Store ─────────────────────────────────────────────────────────────────────

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      dndMode: false,
      desktopNotificationsEnabled: false,

      setDndMode: (enabled) => set({ dndMode: enabled }),
      setDesktopNotificationsEnabled: (enabled) =>
        set({ desktopNotificationsEnabled: enabled }),
    }),
    {
      name: "aviam-notification-preferences",
    },
  ),
);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Request browser Notification permission.
 * Returns true if permission is (or becomes) granted.
 */
export async function requestDesktopPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window))
    return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export type NotificationResult =
  | "sent"
  | "unsupported"
  | "not-granted"
  | "error";

/**
 * Show a one-shot OS desktop notification.
 * Returns a result code so callers can surface diagnostics.
 */
export function showDesktopNotification(
  title: string,
  body: string,
): NotificationResult {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission !== "granted") {
    return "not-granted";
  }
  try {
    // Always use the Notification constructor directly.
    // ServiceWorker.showNotification() requires a SW with a notificationclick
    // handler; without one Chrome/Firefox silently drop it.
    //
    // Use an absolute icon URL — relative paths are not reliably resolved by
    // the OS notification system in Firefox (and some Linux environments).
    const icon = `${window.location.origin}/favicon.png`;
    new Notification(title, { body, icon });
    console.info("[Desktop Notifications] Notification created:", {
      title,
      body,
    });
    return "sent";
  } catch (err) {
    console.error(
      "[Desktop Notifications] Failed to create notification:",
      err,
    );
    return "error";
  }
}
