import { formatDistanceToNow, format } from "date-fns";
import { de } from "date-fns/locale";

type DisplayDateInput = Date | string | number | null | undefined;

// "6. März 26" — used on board cards and kanban cards
const BOARD_DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "long",
  year: "2-digit",
});

const BOARD_DATE_FORMATTER_UTC = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "long",
  year: "2-digit",
  timeZone: "UTC",
});

export function formatDisplayDate(
  value: DisplayDateInput,
  options?: { useUtc?: boolean },
): string {
  if (value === null || value === undefined || value === "") return "";

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  return (
    options?.useUtc ? BOARD_DATE_FORMATTER_UTC : BOARD_DATE_FORMATTER
  ).format(parsed);
}

/** "vor 3 Tagen", "vor einer Stunde" etc. */
export function formatRelativeDate(value: DisplayDateInput): string {
  if (value === null || value === undefined || value === "") return "";

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  return formatDistanceToNow(parsed, { locale: de });
}

/** Full German datetime, e.g. "6. März 2026, 14:32 Uhr" */
export function formatDateTime(value: DisplayDateInput): string {
  if (value === null || value === undefined || value === "") return "";

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  return format(parsed, "d. MMMM yyyy, HH:mm 'Uhr'", { locale: de });
}
