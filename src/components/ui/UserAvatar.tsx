"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getUserAvatarColor, getUserInitials } from "@/lib/role-colors";

interface UserAvatarProps extends React.ComponentPropsWithoutRef<
  typeof Avatar
> {
  name?: string | null | undefined;
  email?: string | null | undefined;
  avatarUrl?: string | null | undefined;
  /** Board role for role-based fallback color (owner/admin/member/viewer) */
  role?: string;
  /** Override fallback background color class (e.g. "bg-[#113c8b]") */
  colorClass?: string;
  /** Extra classes on the AvatarFallback text */
  textClassName?: string;
}

export function UserAvatar({
  name,
  email,
  avatarUrl,
  role,
  colorClass,
  className,
  textClassName,
  ...rest
}: UserAvatarProps) {
  return (
    <Avatar className={className} {...rest}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name ?? email ?? ""} />}
      <AvatarFallback
        className={cn(
          colorClass ?? getUserAvatarColor(role),
          "text-[10px] font-semibold text-white",
          textClassName,
        )}
      >
        {getUserInitials(name ?? undefined, email ?? undefined)}
      </AvatarFallback>
    </Avatar>
  );
}
