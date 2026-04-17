import { ContentTopBar } from "@/components/layout/ContentTopBar";
import { CalendarView } from "@/components/calendar/CalendarView";
import { t } from "@/lib/i18n";

export default function CalendarPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <ContentTopBar
        title={t("calendar.title")}
        subtitle={t("calendar.subtitle")}
      />
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-border/50 bg-card shadow-sm">
          <CalendarView />
        </div>
      </div>
    </div>
  );
}
