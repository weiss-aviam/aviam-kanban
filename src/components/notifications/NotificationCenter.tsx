"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  Monitor,
  MonitorOff,
  AtSign,
  MessageSquare,
  CalendarClock,
  Paperclip,
  UserCheck,
  Users,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useNotifications,
  useNotificationsUnreadCount,
  useNotificationsFetchedAt,
  useAppActions,
} from "@/store";
import {
  usePreferencesStore,
  requestDesktopPermission,
  showDesktopNotification,
} from "@/store/preferences";
import type { NotificationResult } from "@/store/preferences";
import { t } from "@/lib/i18n";
import type { NotificationItem, NotificationType } from "@/store";

// ── Helpers ───────────────────────────────────────────────────────────────────

function typeIcon(type: NotificationType) {
  const cls = "h-4 w-4 shrink-0";
  switch (type) {
    case "mention":
      return <AtSign className={cls} />;
    case "comment_on_assigned":
      return <MessageSquare className={cls} />;
    case "deadline_change":
      return <CalendarClock className={cls} />;
    case "file_upload":
      return <Paperclip className={cls} />;
    case "card_assigned":
      return <UserCheck className={cls} />;
    case "board_member_added":
      return <Users className={cls} />;
    case "card_completed":
      return <CheckCircle2 className={cls} />;
  }
}

function typeColor(type: NotificationType): string {
  switch (type) {
    case "mention":
      return "text-purple-500";
    case "comment_on_assigned":
      return "text-blue-500";
    case "deadline_change":
      return "text-amber-500";
    case "file_upload":
      return "text-green-500";
    case "card_assigned":
      return "text-indigo-500";
    case "board_member_added":
      return "text-teal-500";
    case "card_completed":
      return "text-green-500";
  }
}

function notifText(n: NotificationItem): string {
  const actor = n.actor?.name ?? t("common.unknown");
  const card = n.card?.title ?? "";
  const board = n.board?.name ?? "";
  switch (n.type) {
    case "mention":
      return t("notifications.mention", { actor, card });
    case "comment_on_assigned":
      return t("notifications.commentOnAssigned", { actor, card });
    case "deadline_change":
      return t("notifications.deadlineChange", { actor, card });
    case "file_upload":
      return t("notifications.fileUpload", { actor, card });
    case "card_assigned":
      return t("notifications.cardAssigned", { actor, card });
    case "board_member_added":
      return t("notifications.boardMemberAdded", { actor, board });
    case "card_completed":
      return t("notifications.cardCompleted", { actor, card });
  }
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "gerade eben";
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
  return `vor ${Math.floor(diff / 86400)} T.`;
}

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NotificationRow({
  n,
  onRead,
  onDelete,
}: {
  n: NotificationItem;
  onRead: (n: NotificationItem) => void;
  onDelete: (n: NotificationItem) => void;
}) {
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50 ${
        !n.readAt ? "bg-blue-50/40" : ""
      }`}
    >
      {/* Clickable area: icon + avatar + text */}
      <button
        onClick={() => onRead(n)}
        className="flex items-start gap-3 min-w-0 flex-1 text-left"
      >
        {/* Type icon */}
        <span className={`mt-0.5 shrink-0 ${typeColor(n.type)}`}>
          {typeIcon(n.type)}
        </span>

        {/* Actor avatar */}
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarImage src={n.actor?.avatarUrl ?? undefined} />
          <AvatarFallback className="text-xs">
            {initials(n.actor?.name ?? null)}
          </AvatarFallback>
        </Avatar>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-800 leading-snug wrap-break-word line-clamp-2">
            {notifText(n)}
          </p>
          {n.board && (
            <p className="mt-0.5 text-xs text-gray-400 truncate">
              {n.board.name}
            </p>
          )}
          <p className="mt-0.5 text-xs text-gray-400">
            {relativeTime(n.createdAt)}
          </p>
        </div>
      </button>

      {/* Right side: unread dot + delete */}
      <div className="flex flex-col items-center gap-1.5 shrink-0 mt-0.5">
        {!n.readAt && <span className="h-2 w-2 rounded-full bg-blue-500" />}
        <button
          onClick={() => onDelete(n)}
          aria-label="Benachrichtigung löschen"
          className="text-gray-300 hover:text-red-400 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NotificationCenter() {
  const router = useRouter();
  const notifications = useNotifications();
  const unreadCount = useNotificationsUnreadCount();
  const fetchedAt = useNotificationsFetchedAt();
  const {
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    fetchNotifications,
  } = useAppActions();

  // Preferences
  const dndMode = usePreferencesStore((s) => s.dndMode);
  const desktopEnabled = usePreferencesStore(
    (s) => s.desktopNotificationsEnabled,
  );
  const setDndMode = usePreferencesStore((s) => s.setDndMode);
  const setDesktopEnabled = usePreferencesStore(
    (s) => s.setDesktopNotificationsEnabled,
  );

  // Track browser-level Notification permission so we can show the right state.
  // Lazy initializer reads the real value on mount without needing a useEffect.
  const [browserPermission, setBrowserPermission] = useState<
    "granted" | "denied" | "default" | "unsupported"
  >(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }
    return Notification.permission as "granted" | "denied" | "default";
  });
  const [testResult, setTestResult] = useState<NotificationResult | null>(null);

  function refreshBrowserPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setBrowserPermission("unsupported");
    } else {
      setBrowserPermission(
        Notification.permission as "granted" | "denied" | "default",
      );
    }
  }

  async function handleToggleDesktop() {
    if (desktopEnabled) {
      setDesktopEnabled(false);
      return;
    }
    if (browserPermission === "unsupported") return;
    if (browserPermission === "denied") {
      // Can't re-request; user must unblock in browser settings
      return;
    }
    const granted = await requestDesktopPermission();
    setBrowserPermission(granted ? "granted" : "denied");
    if (granted) setDesktopEnabled(true);
  }

  function handleTestNotification() {
    // Re-read live permission in case the user changed it in browser settings
    // without re-opening the popover.
    if (typeof window !== "undefined" && "Notification" in window) {
      setBrowserPermission(
        Notification.permission as "granted" | "denied" | "default",
      );
    }
    const result = showDesktopNotification(
      t("notifications.liveTitle"),
      t("notifications.desktopTest"),
    );
    setTestResult(result);
    if (result !== "sent") {
      setTimeout(() => setTestResult(null), 3000);
    } else {
      setTimeout(() => setTestResult(null), 2000);
    }
  }

  function handleOpen(open: boolean) {
    if (open) {
      void fetchNotifications();
      // Refresh permission state — user may have changed it in browser settings
      refreshBrowserPermission();
    }
    if (!open) setTestResult(null);
  }

  async function handleRead(n: NotificationItem) {
    markNotificationRead(n.id);
    if (!n.readAt) {
      await fetch(`/api/notifications/${n.id}`, { method: "PATCH" });
    }
    if (n.board && n.card) {
      router.push(`/boards/${n.board.id}?cardId=${n.card.id}`);
    } else if (n.board) {
      router.push(`/boards/${n.board.id}`);
    }
  }

  async function handleMarkAllRead() {
    markAllNotificationsRead();
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
  }

  async function handleDelete(n: NotificationItem) {
    deleteNotification(n.id);
    await fetch(`/api/notifications/${n.id}`, { method: "DELETE" });
  }

  const badgeCount =
    unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <Popover onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("notifications.openCenter")}
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {badgeCount && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white leading-none">
              {badgeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0 overflow-hidden">
        {/* Header */}
        <div className="border-b">
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-sm font-semibold">
              {t("notifications.title")}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-blue-600 hover:underline"
              >
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>

          {/* Quick-settings row */}
          <div className="flex items-center gap-1 px-3 pb-2">
            {/* DnD toggle */}
            <button
              onClick={() => setDndMode(!dndMode)}
              title={
                dndMode
                  ? t("notificationSettings.dndMode") + " (an)"
                  : t("notificationSettings.dndMode")
              }
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
                dndMode
                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {dndMode ? (
                <BellOff className="h-3.5 w-3.5" />
              ) : (
                <Bell className="h-3.5 w-3.5" />
              )}
              {t("notificationSettings.dndMode")}
            </button>

            {/* Desktop notifications toggle + test button */}
            {browserPermission !== "unsupported" && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => void handleToggleDesktop()}
                  title={
                    browserPermission === "denied"
                      ? t("notificationSettings.desktopNotificationsDenied")
                      : t("notificationSettings.desktopNotifications")
                  }
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
                    desktopEnabled && browserPermission === "granted"
                      ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                      : browserPermission === "denied"
                        ? "text-red-400 hover:bg-red-50"
                        : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  {desktopEnabled && browserPermission === "granted" ? (
                    <Monitor className="h-3.5 w-3.5" />
                  ) : (
                    <MonitorOff className="h-3.5 w-3.5" />
                  )}
                  {t("notificationSettings.desktopNotifications")}
                </button>

                {/* Test button — only shown when enabled */}
                {desktopEnabled && browserPermission === "granted" && (
                  <button
                    onClick={handleTestNotification}
                    title={t("notifications.desktopTest")}
                    className="rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    {t("notifications.desktopTest")}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Test result feedback */}
          {testResult && (
            <div
              className={`mx-3 mb-2 rounded-md px-3 py-1.5 text-xs ${
                testResult === "sent"
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {testResult === "sent"
                ? t("notifications.desktopTestSent")
                : testResult === "not-granted"
                  ? t("notifications.desktopTestNoPermission")
                  : t("notifications.desktopTestError")}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="max-h-[480px] overflow-y-auto">
          {fetchedAt === null ? (
            // Loading skeletons
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-4/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 px-6 text-center">
              <Bell className="h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">
                {t("notifications.noNotifications")}
              </p>
              <p className="text-xs text-gray-400">
                {t("notifications.noNotificationsDescription")}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  onRead={handleRead}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
