import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { HeaderMenu } from "@/components/layout/HeaderMenu";

/**
 * Renders the notification bell and user menu side by side.
 * Drop-in replacement for <HeaderMenu /> at all AppHeader call sites.
 */
export function HeaderActions() {
  return (
    <div className="flex items-center gap-1">
      <NotificationCenter />
      <HeaderMenu />
    </div>
  );
}
