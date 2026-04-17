"use client";

import type { ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface ContentTopBarProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Left side — back/breadcrumb buttons */
  actionsStart?: ReactNode;
  /** Right side — page-specific action buttons */
  actions?: ReactNode;
}

export function ContentTopBar({
  title,
  subtitle,
  actionsStart,
  actions,
}: ContentTopBarProps) {
  return (
    <header className="flex flex-col border-b border-sidebar-border/40 bg-background/80 backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <SidebarTrigger className="-ml-1 size-8 text-muted-foreground hover:text-foreground" />

        {actionsStart ? (
          <div className="flex items-center gap-1.5">{actionsStart}</div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {title}
          </h1>
          {subtitle ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-sm">
              {subtitle}
            </div>
          ) : null}
        </div>

        {actions ? (
          <div className="flex items-center gap-1.5 sm:gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
