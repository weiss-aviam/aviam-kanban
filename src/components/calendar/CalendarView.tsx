"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  parseISO,
  isBefore,
  startOfDay,
  isWithinInterval,
} from "date-fns";
import { de as dateFnsLocale } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { CalendarCard } from "@/app/api/calendar/cards/route";
import type {
  RealtimePostgresChangesPayload,
  RealtimeChannel,
} from "@supabase/supabase-js";

export type { CalendarCard };

export type CalendarViewMode = "month" | "week" | "day";

type DbRow = Record<string, unknown>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns Tailwind classes for a card chip based on priority / completion / overdue state. */
export function getCardChipClasses(card: CalendarCard): string {
  if (card.completedAt) {
    return "bg-gray-100 text-gray-400 line-through";
  }
  const overdue = isBefore(parseISO(card.dueDate), startOfDay(new Date()));
  if (overdue) {
    return "bg-red-100 text-red-700 border border-red-200";
  }
  switch (card.priority) {
    case "high":
      return "bg-red-50 text-red-700 border border-red-200";
    case "medium":
      return "bg-amber-50 text-amber-700 border border-amber-200";
    case "low":
      return "bg-green-50 text-green-700 border border-green-200";
  }
}

/** Filter cards that fall on a specific day. */
export function getCardsForDay(
  cards: CalendarCard[],
  day: Date,
): CalendarCard[] {
  return cards.filter((card) => isSameDay(parseISO(card.dueDate), day));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CardChip({
  card,
  onClick,
}: {
  card: CalendarCard;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`w-full cursor-pointer truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium leading-snug transition-opacity hover:opacity-75 ${getCardChipClasses(card)}`}
      title={`${card.title} — ${card.boardName}`}
    >
      {card.title}
    </button>
  );
}

function PriorityBadge({
  priority,
  completed,
  dueDate,
}: {
  priority: CalendarCard["priority"];
  completed: boolean;
  dueDate: string;
}) {
  if (completed) {
    return (
      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
        {t("calendar.completed")}
      </span>
    );
  }
  const overdue = isBefore(parseISO(dueDate), startOfDay(new Date()));
  if (overdue) {
    return (
      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
        {t("calendar.overdue")}
      </span>
    );
  }
  const labels: Record<CalendarCard["priority"], string> = {
    high: "HOCH",
    medium: "MITTEL",
    low: "NIEDRIG",
  };
  const colors: Record<CalendarCard["priority"], string> = {
    high: "bg-red-50 text-red-700",
    medium: "bg-amber-50 text-amber-700",
    low: "bg-green-50 text-green-700",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors[priority]}`}
    >
      {labels[priority]}
    </span>
  );
}

// ─── Month view ───────────────────────────────────────────────────────────────

const DAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;
const MAX_CHIPS_PER_DAY = 3;

function MonthView({
  currentDate,
  cards,
  onCardClick,
}: {
  currentDate: Date;
  cards: CalendarCard[];
  onCardClick: (card: CalendarCard) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div>
      {/* Day name header */}
      <div className="grid grid-cols-7 border-b bg-gray-50">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="py-2 text-center text-xs font-semibold text-gray-500"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid — rows size to their content */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayCards = getCardsForDay(cards, day);
          const inMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);
          const visible = dayCards.slice(0, MAX_CHIPS_PER_DAY);
          const overflow = dayCards.length - MAX_CHIPS_PER_DAY;

          return (
            <div
              key={day.toISOString()}
              className={`min-h-20 border-b border-r p-1 last-of-type:border-r-0 ${
                inMonth ? "bg-white" : "bg-gray-50"
              }`}
            >
              <span
                className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  isCurrentDay
                    ? "bg-blue-600 text-white"
                    : inMonth
                      ? "text-gray-900"
                      : "text-gray-400"
                }`}
              >
                {format(day, "d")}
              </span>
              <div className="flex flex-col gap-0.5">
                {visible.map((card) => (
                  <CardChip
                    key={card.id}
                    card={card}
                    onClick={() => onCardClick(card)}
                  />
                ))}
                {overflow > 0 && (
                  <span className="px-1 text-[10px] text-gray-400">
                    {t("calendar.moreItems", { count: overflow })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week view ────────────────────────────────────────────────────────────────

function WeekView({
  currentDate,
  cards,
  onCardClick,
}: {
  currentDate: Date;
  cards: CalendarCard[];
  onCardClick: (card: CalendarCard) => void;
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 6),
  });

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b bg-gray-50">
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className="border-r py-3 text-center last:border-r-0"
          >
            <div className="text-xs font-semibold uppercase text-gray-500">
              {format(day, "EEE", { locale: dateFnsLocale })}
            </div>
            <div
              className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                isToday(day) ? "bg-blue-600 text-white" : "text-gray-900"
              }`}
            >
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* Day columns */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayCards = getCardsForDay(cards, day);
          return (
            <div
              key={day.toISOString()}
              className="min-h-40 border-r p-2 last:border-r-0"
            >
              {dayCards.length === 0 ? (
                <p className="mt-4 text-center text-xs text-gray-300">–</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {dayCards.map((card) => (
                    <CardChip
                      key={card.id}
                      card={card}
                      onClick={() => onCardClick(card)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day view ─────────────────────────────────────────────────────────────────

function DayView({
  currentDate,
  cards,
  onCardClick,
}: {
  currentDate: Date;
  cards: CalendarCard[];
  onCardClick: (card: CalendarCard) => void;
}) {
  const dayCards = getCardsForDay(cards, currentDate);

  if (dayCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
        <CalendarDays className="h-10 w-10" />
        <p className="text-sm">{t("calendar.noDeadlinesDay")}</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-3">
        {dayCards.map((card) => (
          <button
            key={card.id}
            onClick={() => onCardClick(card)}
            className="w-full cursor-pointer rounded-lg border bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={`font-medium text-gray-900 ${card.completedAt ? "text-gray-400 line-through" : ""}`}
                >
                  {card.title}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {card.boardName} · {card.columnTitle}
                </p>
              </div>
              <PriorityBadge
                priority={card.priority}
                completed={!!card.completedAt}
                dueDate={card.dueDate}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main CalendarView ────────────────────────────────────────────────────────

export function CalendarView() {
  const router = useRouter();
  const [view, setView] = useState<CalendarViewMode>("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [cards, setCards] = useState<CalendarCard[]>([]);
  // Start as false so the calendar grid renders immediately when the dialog opens,
  // keeping the dialog size stable for its zoom-in animation.
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lookup tables populated from fetched cards so realtime can enrich new cards.
  const boardNamesRef = useRef<Record<string, string>>({});
  const columnTitlesRef = useRef<Record<number, string>>({});
  // Always-current date range and fetchCards for the one-time realtime handler.
  const rangeRef = useRef<{ start: Date; end: Date } | null>(null);
  const fetchCardsRef = useRef<(silent?: boolean) => Promise<void>>(
    async () => {},
  );

  /** Compute the date range the current view needs to display. */
  const getDateRange = useCallback((): { start: Date; end: Date } => {
    switch (view) {
      case "month": {
        const ms = startOfMonth(currentDate);
        const me = endOfMonth(currentDate);
        return {
          start: startOfWeek(ms, { weekStartsOn: 1 }),
          end: endOfWeek(me, { weekStartsOn: 1 }),
        };
      }
      case "week": {
        const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
        return { start: ws, end: addDays(ws, 6) };
      }
      case "day":
        return {
          start: startOfDay(currentDate),
          end: startOfDay(addDays(currentDate, 1)),
        };
    }
  }, [view, currentDate]);

  const fetchCards = useCallback(
    async (silent = false) => {
      if (!silent) setFetching(true);
      setError(null);
      try {
        const { start, end } = getDateRange();
        const params = new URLSearchParams({
          start: start.toISOString(),
          end: end.toISOString(),
        });
        const res = await fetch(`/api/calendar/cards?${params}`);
        if (!res.ok) throw new Error("Failed to fetch cards");
        const data: { cards: CalendarCard[] } = await res.json();
        setCards(data.cards ?? []);
      } catch {
        if (!silent) setError(t("calendar.errorLoading"));
      } finally {
        if (!silent) setFetching(false);
      }
    },
    [getDateRange],
  );

  // Keep refs current so the one-time realtime effect always sees the latest values.
  useEffect(() => {
    rangeRef.current = getDateRange();
  }, [getDateRange]);

  useEffect(() => {
    fetchCardsRef.current = fetchCards;
  }, [fetchCards]);

  // Fetch on mount and whenever the visible range changes.
  useEffect(() => {
    void fetchCards();
  }, [fetchCards]);

  // Populate lookup refs whenever we get fresh data.
  useEffect(() => {
    for (const card of cards) {
      boardNamesRef.current[card.boardId] = card.boardName;
      columnTitlesRef.current[card.columnId] = card.columnTitle;
    }
  }, [cards]);

  // ── Realtime subscription — set up once, never torn down on navigation ───────
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("calendar-cards-realtime");

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cards" },
      (payload: RealtimePostgresChangesPayload<DbRow>) => {
        const range = rangeRef.current;
        if (!range) return;

        const { eventType } = payload;

        if (eventType === "DELETE") {
          const deletedId = (payload.old as DbRow).id as string;
          setCards((prev) => prev.filter((c) => c.id !== deletedId));
          return;
        }

        const row = payload.new as DbRow;
        const id = row.id as string;
        const newDueDate = row.due_date as string | null;

        if (eventType === "UPDATE") {
          // Compute whether a silent refetch is needed BEFORE calling setCards,
          // so we never call async work inside a state updater.
          let needsRefetch = false;

          setCards((prev) => {
            const existingIdx = prev.findIndex((c) => c.id === id);

            // Due date removed or moved outside the visible window → drop the card.
            if (!newDueDate || !isWithinInterval(parseISO(newDueDate), range)) {
              return prev.filter((c) => c.id !== id);
            }

            if (existingIdx >= 0) {
              // Update the existing entry in place.
              const existing = prev[existingIdx]!;
              const columnId = row.column_id as number;
              const updated: CalendarCard = {
                ...existing,
                title: row.title as string,
                dueDate: newDueDate,
                priority: row.priority as CalendarCard["priority"],
                completedAt: (row.completed_at as string | null) ?? null,
                columnId,
                columnTitle:
                  columnTitlesRef.current[columnId] ?? existing.columnTitle,
              };
              return prev.map((c) => (c.id === id ? updated : c));
            }

            // Card not yet visible — try to construct it from known lookups.
            const boardId = row.board_id as string;
            const columnId = row.column_id as number;
            const boardName = boardNamesRef.current[boardId];
            const columnTitle = columnTitlesRef.current[columnId];

            if (boardName && columnTitle) {
              const newCard: CalendarCard = {
                id,
                title: row.title as string,
                dueDate: newDueDate,
                priority: row.priority as CalendarCard["priority"],
                boardId,
                boardName,
                columnId,
                columnTitle,
                completedAt: (row.completed_at as string | null) ?? null,
              };
              return [...prev, newCard].sort((a, b) =>
                a.dueDate.localeCompare(b.dueDate),
              );
            }

            // Board/column names unknown — schedule a silent refetch after this render.
            needsRefetch = true;
            return prev;
          });

          if (needsRefetch) void fetchCardsRef.current(true);
          return;
        }

        if (eventType === "INSERT") {
          if (newDueDate && isWithinInterval(parseISO(newDueDate), range)) {
            void fetchCardsRef.current(true);
          }
        }
      },
    );

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []); // intentionally empty — one stable channel for the component's lifetime

  // ── Navigation ───────────────────────────────────────────────────────────────

  const navigate = (direction: "prev" | "next") => {
    const delta = direction === "prev" ? -1 : 1;
    switch (view) {
      case "month":
        setCurrentDate((d) => (delta < 0 ? subMonths(d, 1) : addMonths(d, 1)));
        break;
      case "week":
        setCurrentDate((d) => (delta < 0 ? subWeeks(d, 1) : addWeeks(d, 1)));
        break;
      case "day":
        setCurrentDate((d) => (delta < 0 ? subDays(d, 1) : addDays(d, 1)));
        break;
    }
  };

  const getTitle = (): string => {
    switch (view) {
      case "month":
        return format(currentDate, "MMMM yyyy", { locale: dateFnsLocale });
      case "week": {
        const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
        const we = addDays(ws, 6);
        if (ws.getMonth() === we.getMonth()) {
          return (
            format(ws, "d.", { locale: dateFnsLocale }) +
            "–" +
            format(we, "d. MMMM yyyy", { locale: dateFnsLocale })
          );
        }
        return (
          format(ws, "d. MMM", { locale: dateFnsLocale }) +
          " – " +
          format(we, "d. MMM yyyy", { locale: dateFnsLocale })
        );
      }
      case "day":
        return format(currentDate, "EEEE, d. MMMM yyyy", {
          locale: dateFnsLocale,
        });
    }
  };

  const handleCardClick = (card: CalendarCard) => {
    router.push(`/boards/${card.boardId}`);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-white px-4 pt-12 pb-3 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            {t("calendar.today")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("prev")}
            aria-label={t("common.previous")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("next")}
            aria-label={t("common.next")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="truncate text-sm font-semibold capitalize text-gray-900 sm:text-base">
            {getTitle()}
          </h2>
        </div>

        {/* View switcher — dropdown on mobile, segmented on desktop */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="sm:hidden">
              {t(`calendar.${view}`)}
              <MoreVertical className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(["month", "week", "day"] as const).map((v) => (
              <DropdownMenuItem
                key={v}
                onClick={() => setView(v)}
                className={view === v ? "font-semibold" : ""}
              >
                {t(`calendar.${v}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="hidden shrink-0 items-center rounded-lg border bg-gray-50 p-0.5 sm:flex">
          {(["month", "week", "day"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`cursor-pointer rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                view === v
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t(`calendar.${v}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {error ? (
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-red-600">
          {error}
        </div>
      ) : (
        <div
          className={`min-h-0 flex-1 overflow-auto transition-opacity duration-150 ${fetching ? "opacity-50" : "opacity-100"}`}
        >
          {view === "month" && (
            <MonthView
              currentDate={currentDate}
              cards={cards}
              onCardClick={handleCardClick}
            />
          )}
          {view === "week" && (
            <WeekView
              currentDate={currentDate}
              cards={cards}
              onCardClick={handleCardClick}
            />
          )}
          {view === "day" && (
            <DayView
              currentDate={currentDate}
              cards={cards}
              onCardClick={handleCardClick}
            />
          )}
        </div>
      )}
    </div>
  );
}
