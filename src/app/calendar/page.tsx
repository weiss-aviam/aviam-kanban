import { AppHeader } from "@/components/layout/AppHeader";
import { HeaderActions } from "@/components/layout/HeaderActions";
import { CalendarView } from "@/components/calendar/CalendarView";
import { t } from "@/lib/i18n";

export default function CalendarPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title={t("calendar.title")}
        subtitle={t("calendar.subtitle")}
        navActions={<HeaderActions />}
      />
      <main>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-xl border bg-white shadow-sm">
            <CalendarView />
          </div>
        </div>
      </main>
    </div>
  );
}
