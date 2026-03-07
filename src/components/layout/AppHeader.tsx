"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

interface AppHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function AppHeader({ title, subtitle, actions }: AppHeaderProps) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/dashboard" className="flex shrink-0 items-center">
            <Image
              src="/aviam_logo.svg"
              alt="Aviam"
              width={110}
              height={32}
              priority
              className="h-8 w-auto"
            />
          </Link>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-2 border-t border-gray-100 pt-4">
          <h1 className="wrap-break-word text-2xl font-bold text-gray-900">
            {title}
          </h1>
          {subtitle ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
