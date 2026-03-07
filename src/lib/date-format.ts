type DisplayDateInput = Date | string | number | null | undefined;

const DISPLAY_DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const DISPLAY_DATE_FORMATTER_UTC = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
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
    options?.useUtc ? DISPLAY_DATE_FORMATTER_UTC : DISPLAY_DATE_FORMATTER
  ).format(parsed);
}
