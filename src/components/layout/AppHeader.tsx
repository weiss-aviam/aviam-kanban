"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Kanban, User as UserIcon } from "lucide-react";

export function AppHeader() {
  return (
    <header className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <Kanban className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-semibold text-gray-900">
              Aviam Kanban
            </span>
          </Link>
          <div className="flex items-center space-x-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/profile">
                <UserIcon className="w-4 h-4 mr-2" />
                Profile
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
