"use client";

import Link from "next/link";
import { CalendarClock, Flag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDisplayDate } from "@/lib/date-format";
import { t } from "@/lib/i18n";
import type { DashboardDeadline } from "@/lib/data/dashboard";

interface UpcomingDeadlinesCardProps {
  deadlines: DashboardDeadline[];
}

const PRIORITY_COLOR: Record<DashboardDeadline["priority"], string> = {
  high: "text-red-500",
  medium: "text-amber-500",
  low: "text-emerald-500",
};

function dueLabel(iso: string): string {
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return "";
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const days = Math.round(
    (startOfDue.getTime() - startOfToday.getTime()) / 86_400_000,
  );
  if (days <= 0) return t("dashboard.dueToday");
  if (days === 1) return t("dashboard.dueTomorrow");
  if (days <= 7) return t("dashboard.dueInDays", { count: days });
  return formatDisplayDate(iso);
}

export function UpcomingDeadlinesCard({
  deadlines,
}: UpcomingDeadlinesCardProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {t("dashboard.upcomingDeadlines")}
        </CardTitle>
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
      </CardHeader>

      <CardContent className="flex-1">
        {deadlines.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-8 text-center">
            <CalendarClock className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              {t("dashboard.noUpcomingDeadlines")}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {deadlines.map((d) => (
              <li key={d.cardId}>
                <Link
                  href={`/boards/${d.boardId}?card=${d.cardId}`}
                  className="flex items-start gap-3 py-2.5 -mx-2 px-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <Flag
                    className={`h-4 w-4 mt-0.5 shrink-0 ${PRIORITY_COLOR[d.priority]}`}
                    aria-label={t(`priorities.${d.priority}` as const)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {d.boardName}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {dueLabel(d.dueDate)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
