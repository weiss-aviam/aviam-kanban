"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

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

export function getInitials(
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

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
}

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const u = session.user;
  const base: CurrentUser = {
    id: u.id,
    email: u.email ?? "",
    name: (u.user_metadata?.name as string | null) ?? null,
    avatarUrl: (u.user_metadata?.avatar_url as string | null) ?? null,
    isSuperAdmin: isSuperAdminUser(u),
  };

  // Enrich with DB profile
  const { data: profile } = await supabase
    .from("users")
    .select("name, avatar_url")
    .eq("id", u.id)
    .single();

  if (profile) {
    return {
      ...base,
      name: profile.name ?? base.name,
      avatarUrl: profile.avatar_url ?? base.avatarUrl,
    };
  }

  return base;
}

export function useCurrentUser() {
  const { data, isLoading } = useSWR("current-user", fetchCurrentUser, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });

  return {
    user: data ?? null,
    isLoading,
  };
}
