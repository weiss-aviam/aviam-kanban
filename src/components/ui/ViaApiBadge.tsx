import { Bot } from "lucide-react";
import { t } from "@/lib/i18n";

export function ViaApiBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 text-[10px] font-medium"
      title={t("apiAccess.viaApiBadgeTitle")}
    >
      <Bot className="w-3 h-3" />
      {t("apiAccess.viaApiBadge")}
    </span>
  );
}
