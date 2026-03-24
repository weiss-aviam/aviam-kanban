"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useAppStore } from "@/store";
import {
  usePreferencesStore,
  showDesktopNotification,
} from "@/store/preferences";
import { t } from "@/lib/i18n";
import type { NotificationItem } from "@/store";

function toastLabel(n: NotificationItem): string {
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
    case "card_moved": {
      const column = (n.metadata?.columnTitle as string | undefined) ?? "";
      return t("notifications.cardMoved", { actor, card, column });
    }
  }
}

const TOAST_TTL_MS = 10_000;
const RECENT_MS = 8_000;
const MAX_STACK = 3;

type ToastEntry = { id: string; notif: NotificationItem };

export function NotificationToast() {
  const router = useRouter();
  const latest = useAppStore((s) => s.notifications[0] ?? null);
  const markNotificationRead = useAppStore((s) => s.markNotificationRead);
  const dndMode = usePreferencesStore((s) => s.dndMode);
  const desktopNotificationsEnabled = usePreferencesStore(
    (s) => s.desktopNotificationsEnabled,
  );

  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((entry) => entry.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }

  function handleClick(entry: ToastEntry) {
    dismiss(entry.id);
    markNotificationRead(entry.id);
    void fetch(`/api/notifications/${entry.id}`, { method: "PATCH" });
    const { notif } = entry;
    if (notif.board && notif.card) {
      router.push(`/boards/${notif.board.id}?cardId=${notif.card.id}`);
    } else if (notif.board) {
      router.push(`/boards/${notif.board.id}`);
    }
  }

  useEffect(() => {
    if (!latest) return;
    if (seenRef.current.has(latest.id)) return;

    // eslint-disable-next-line react-hooks/purity -- Date.now() in an effect is intentional and safe
    const age = Date.now() - new Date(latest.createdAt).getTime();
    if (age > RECENT_MS) return;

    seenRef.current.add(latest.id);

    if (desktopNotificationsEnabled) {
      showDesktopNotification(t("notifications.liveTitle"), toastLabel(latest));
    }

    if (!dndMode) {
      setToasts((prev) => [{ id: latest.id, notif: latest }, ...prev]);
      const timer = setTimeout(() => dismiss(latest.id), TOAST_TTL_MS);
      timersRef.current.set(latest.id, timer);
    }
  }, [latest, dndMode, desktopNotificationsEnabled]);

  useEffect(
    () => () => {
      for (const timer of timersRef.current.values()) clearTimeout(timer);
    },
    [],
  );

  const visible = toasts.slice(0, MAX_STACK);
  if (visible.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col items-end gap-2">
      {visible.map((entry, i) => (
        <div
          key={entry.id}
          role={i === 0 ? "alert" : undefined}
          style={{
            transform: `scale(${1 - i * 0.03})`,
            transformOrigin: "top right",
            opacity: 1 - i * 0.12,
            zIndex: MAX_STACK - i,
          }}
          className="w-80 flex items-start rounded-lg border border-border bg-white shadow-lg overflow-hidden transition-all"
        >
          {/* Clickable body */}
          <button
            onClick={() => handleClick(entry)}
            className="flex-1 min-w-0 flex flex-col gap-0.5 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
          >
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {t("notifications.liveTitle")}
            </p>
            <p className="text-sm text-gray-800 wrap-break-word">
              {toastLabel(entry.notif)}
            </p>
          </button>
          {/* Dismiss */}
          <button
            onClick={() => dismiss(entry.id)}
            className="self-start mt-2.5 mr-2 shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={t("notifications.dismiss")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
