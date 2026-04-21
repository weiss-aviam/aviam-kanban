"use client";

import Link from "next/link";
import {
  Activity,
  AtSign,
  MessageSquare,
  CalendarClock,
  Paperclip,
  UserCheck,
  Users,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { t } from "@/lib/i18n";
import type {
  DashboardActivity,
  DashboardActivityType,
} from "@/lib/data/dashboard";

interface RecentActivityCardProps {
  activities: DashboardActivity[];
}

function typeIcon(type: DashboardActivityType) {
  const cls = "h-3.5 w-3.5";
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
    case "card_moved":
      return <ArrowRight className={cls} />;
  }
}

function typeColor(type: DashboardActivityType): string {
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
    case "card_moved":
      return "text-blue-500";
  }
}

function activityText(a: DashboardActivity): string {
  const actor = a.actor?.name ?? t("common.unknown");
  const card = a.card?.title ?? "";
  const board = a.board?.name ?? "";
  switch (a.type) {
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
    case "card_moved":
      return t("notifications.cardMoved", { actor, card, column: "" });
  }
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return t("dashboard.justNow");
  if (diff < 3600)
    return t("dashboard.minutesAgo", { count: Math.floor(diff / 60) });
  if (diff < 86400)
    return t("dashboard.hoursAgo", { count: Math.floor(diff / 3600) });
  return t("dashboard.daysAgo", { count: Math.floor(diff / 86400) });
}

function activityHref(a: DashboardActivity): string | null {
  if (a.card && a.board) return `/boards/${a.board.id}?card=${a.card.id}`;
  if (a.board) return `/boards/${a.board.id}`;
  return null;
}

export function RecentActivityCard({ activities }: RecentActivityCardProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {t("dashboard.recentActivity")}
        </CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>

      <CardContent className="flex-1">
        {activities.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-8 text-center">
            <Activity className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              {t("dashboard.noRecentActivity")}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {activities.map((a) => {
              const href = activityHref(a);
              const inner = (
                <div className="flex items-start gap-3 py-2.5">
                  <UserAvatar
                    name={a.actor?.name}
                    avatarUrl={a.actor?.avatarUrl}
                    className="size-7 shrink-0"
                    textClassName="text-xs"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-1.5">
                      <span className={`mt-0.5 shrink-0 ${typeColor(a.type)}`}>
                        {typeIcon(a.type)}
                      </span>
                      <p className="text-sm leading-snug line-clamp-2 min-w-0">
                        {activityText(a)}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {relativeTime(a.createdAt)}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={a.id}>
                  {href ? (
                    <Link
                      href={href}
                      className="block -mx-2 px-2 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
