"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Menu, Kanban, User, Settings, LogOut } from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { t } from "../../lib/i18n";

const SUPER_ADMIN_ROLE_VALUES = new Set([
  "super_admin",
  "super-admin",
  "superadmin",
]);

function isSuperAdminUser(
  user: Pick<SupabaseUser, "app_metadata"> | null | undefined,
): boolean {
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

export function HeaderMenu() {
  const router = useRouter();
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsSuperAdmin(isSuperAdminUser(user));
    });
  }, [supabase.auth]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Menu className="w-4 h-4 mr-2" />
          {t("header.menu")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => router.push("/boards")}>
          <Kanban className="mr-2 h-4 w-4" />
          {t("header.allBoards")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/profile")}>
          <User className="mr-2 h-4 w-4" />
          {t("header.profile")}
        </DropdownMenuItem>
        {isSuperAdmin && (
          <DropdownMenuItem
            onClick={() => router.push("/dashboard/super-admin/users")}
          >
            <Settings className="mr-2 h-4 w-4" />
            {t("header.settings")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          {t("header.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
