import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { CalendarModal } from "@/components/calendar/CalendarModal";
import { HeaderMenu } from "@/components/layout/HeaderMenu";

/**
 * Renders the calendar button, notification bell, and user menu side by side.
 * Drop-in replacement for <HeaderMenu /> at all AppHeader call sites.
 */
export function HeaderActions() {
  return (
    <div className="flex items-center gap-1">
      <CalendarModal />
      <NotificationCenter />
      <HeaderMenu />
    </div>
  );
}
