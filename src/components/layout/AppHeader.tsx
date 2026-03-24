"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

interface AppHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Row 1 right side — notification bell + user avatar (icon-only controls) */
  navActions?: ReactNode;
  /** Row 2 left — back / breadcrumb button */
  actionsStart?: ReactNode;
  /** Row 2 right — page-specific action buttons */
  actions?: ReactNode;
}

export function AppHeader({
  title,
  subtitle,
  navActions,
  actionsStart,
  actions,
}: AppHeaderProps) {
  const hasRow2 = actionsStart || actions;
  return (
    <header className="border-b bg-white">
      <div className="mx-auto max-w-7xl">
        {/* Row 1: Logo + nav icons (notification bell, user avatar) */}
        <div className="flex items-center justify-between px-4 py-2 sm:px-6 sm:py-2.5 lg:px-8">
          <Link href="/dashboard" className="flex shrink-0 items-center">
            <Image
              src="/aviam_logo.svg"
              alt="Aviam"
              width={110}
              height={32}
              priority
              className="h-7 w-auto sm:h-8"
            />
          </Link>
          {navActions ? (
            <div className="flex items-center gap-1">{navActions}</div>
          ) : null}
        </div>

        {/* Row 2: back button left, page actions right */}
        {hasRow2 ? (
          <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2 sm:px-6 sm:py-2.5 lg:px-8">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {actionsStart}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">{actions}</div>
          </div>
        ) : null}

        {/* Title area */}
        <div className="flex min-w-0 flex-col gap-1 border-t border-gray-100 px-4 pb-3 pt-2.5 sm:gap-2 sm:px-6 sm:pb-4 sm:pt-3 lg:px-8">
          <h1 className="wrap-break-word text-lg font-bold text-gray-900 sm:text-2xl">
            {title}
          </h1>
          {subtitle ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 sm:text-sm">
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
