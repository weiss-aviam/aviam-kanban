"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { ChevronDown, Kanban, LogOut, Settings, UserRound } from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { t } from "../../lib/i18n";

const SUPER_ADMIN_ROLE_VALUES = new Set([
  "super_admin",
  "super-admin",
  "superadmin",
]);

function isSuperAdminUser(user: SupabaseUser | null | undefined): boolean {
  if (!user) return false;
  const meta = user.app_metadata as Record<string, unknown> | undefined;
  if (!meta) return false;
  const flag = meta.super_admin ?? meta.is_super_admin;
  if (typeof flag === "boolean") return flag;
  const role = meta.role;
  if (
    typeof role === "string" &&
    SUPER_ADMIN_ROLE_VALUES.has(role.toLowerCase())
  )
    return true;
  const roles = meta.roles;
  if (Array.isArray(roles))
    return roles.some(
      (v) =>
        typeof v === "string" && SUPER_ADMIN_ROLE_VALUES.has(v.toLowerCase()),
    );
  return false;
}

function getInitials(
  name: string | null | undefined,
  email: string | undefined,
): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (
        (parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")
      ).toUpperCase();
    }
    return (parts[0] ?? "").slice(0, 2).toUpperCase();
  }
  return (email ?? "").slice(0, 2).toUpperCase();
}

interface UserDisplay {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
}

export function HeaderMenu() {
  const router = useRouter();
  const [display, setDisplay] = useState<UserDisplay | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // getSession() reads from cookies — no network round-trip, renders instantly.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      const u = session.user;
      setDisplay({
        email: u.email ?? "",
        name: (u.user_metadata?.name as string | null) ?? null,
        avatarUrl: (u.user_metadata?.avatar_url as string | null) ?? null,
        isSuperAdmin: isSuperAdminUser(u),
      });

      // Enrich with DB profile in the background (picks up name/avatar changes).
      supabase
        .from("users")
        .select("name, avatar_url")
        .eq("id", u.id)
        .single()
        .then(({ data: profile }) => {
          if (!profile) return;
          setDisplay((prev) =>
            prev
              ? {
                  ...prev,
                  name: profile.name ?? prev.name,
                  avatarUrl: profile.avatar_url ?? prev.avatarUrl,
                }
              : prev,
          );
        });
    });
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const displayName = display?.name ?? display?.email?.split("@")[0] ?? "";
  const initials = getInitials(display?.name, display?.email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <Avatar className="size-8">
            <AvatarImage
              src={display?.avatarUrl ?? undefined}
              alt={displayName}
            />
            <AvatarFallback className="bg-[#113c8b] text-white text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:block max-w-[120px] truncate">
            {displayName}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-gray-400 hidden sm:block" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <div className="px-3 py-2.5">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {displayName}
          </p>
          <p className="text-xs text-gray-500 truncate">{display?.email}</p>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => router.push("/profile")}>
          <UserRound className="mr-2 h-4 w-4" />
          {t("header.profile")}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => router.push("/boards")}>
          <Kanban className="mr-2 h-4 w-4" />
          {t("header.allBoards")}
        </DropdownMenuItem>

        {display?.isSuperAdmin && (
          <DropdownMenuItem
            onClick={() => router.push("/dashboard/super-admin/users")}
          >
            <Settings className="mr-2 h-4 w-4" />
            {t("header.settings")}
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleSignOut}
          className="text-red-600 focus:text-red-600"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t("header.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
