"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  Kanban,
  CalendarDays,
  Shield,
  LogOut,
  UserRound,
  ChevronsUpDown,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/i18n";

const NAV_ITEMS = [
  {
    labelKey: "sidebar.dashboard" as const,
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    labelKey: "sidebar.boards" as const,
    href: "/boards",
    icon: Kanban,
  },
  {
    labelKey: "sidebar.calendar" as const,
    href: "/calendar",
    icon: CalendarDays,
  },
];

const ADMIN_ITEMS = [
  {
    labelKey: "sidebar.admin" as const,
    href: "/dashboard/super-admin/users",
    icon: Shield,
  },
];

function SidebarLogo() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <div className="flex items-center px-2 py-1">
      {isCollapsed ? (
        <Image
          src="/aviam_signet_circle.svg"
          alt="Aviam"
          width={28}
          height={28}
          priority
          className="h-7 w-7"
        />
      ) : (
        <Image
          src="/aviam_logo.svg"
          alt="Aviam"
          width={110}
          height={32}
          priority
          className="h-7 w-auto"
        />
      )}
    </div>
  );
}

function SidebarUserMenu() {
  const { user } = useCurrentUser();
  const router = useRouter();

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  }, [router]);

  const displayName = user?.name ?? user?.email?.split("@")[0] ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <UserAvatar
            name={user?.name}
            email={user?.email}
            avatarUrl={user?.avatarUrl}
            colorClass="bg-[#1B3481]"
            className="size-8"
            textClassName="text-xs"
          />
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{displayName}</span>
            <span className="truncate text-xs text-muted-foreground">
              {user?.email}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto size-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl"
        side="top"
        align="start"
        sideOffset={4}
      >
        <div className="px-3 py-2.5">
          <p className="text-sm font-semibold truncate">{displayName}</p>
          <p className="text-xs text-muted-foreground truncate">
            {user?.email}
          </p>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => router.push("/profile")}>
          <UserRound className="mr-2 size-4" />
          {t("sidebar.profile")}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleSignOut}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 size-4" />
          {t("sidebar.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useCurrentUser();

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarLogo />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("sidebar.navigation")}</SidebarGroupLabel>
          <SidebarMenu>
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={t(item.labelKey)}
                  >
                    <a href={item.href}>
                      <item.icon />
                      <span>{t(item.labelKey)}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {user?.isSuperAdmin ? (
          <SidebarGroup>
            <SidebarGroupLabel>{t("sidebar.adminSection")}</SidebarGroupLabel>
            <SidebarMenu>
              {ADMIN_ITEMS.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={t(item.labelKey)}
                    >
                      <a href={item.href}>
                        <item.icon />
                        <span>{t(item.labelKey)}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <NotificationCenter />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarUserMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
