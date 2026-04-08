"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CalendarView } from "@/components/calendar/CalendarView";
import { t } from "@/lib/i18n";

export function CalendarModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("calendar.openModal")}
        onClick={() => setOpen(true)}
      >
        <CalendarDays className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="h-dvh max-w-none rounded-none border-0 p-0 overflow-hidden sm:h-auto sm:max-w-7xl sm:rounded-lg sm:border"
          aria-describedby={undefined}
        >
          {/* Visually hidden title for accessibility */}
          <DialogTitle className="sr-only">{t("calendar.title")}</DialogTitle>
          <CalendarView />
        </DialogContent>
      </Dialog>
    </>
  );
}
