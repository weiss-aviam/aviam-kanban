"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { BoardPresenceMember } from "@/hooks/useBoardPresence";
import { t } from "@/lib/i18n";
import { getUserInitials } from "@/lib/role-colors";
import { cn } from "@/lib/utils";

export type { BoardPresenceEditingTarget as BoardPresenceEditingCard } from "@/hooks/useBoardPresence";

const getPresenceMemberName = (
  member: BoardPresenceMember,
  currentUserId?: string | null,
) => {
  if (currentUserId && member.userId === currentUserId) {
    return t("boardDetail.you");
  }

  return member.name || member.email || t("common.unknown");
};

const getPresenceActivityLabel = (activity: BoardPresenceMember["activity"]) => {
  if (activity.type === "editing-card") {
    return t("boardDetail.editingCardActivity", {
      title: activity.cardTitle || t("common.current"),
    });
  }

  return t("boardDetail.viewingBoard");
};

const getPresenceMemberLabel = (
  member: BoardPresenceMember,
  currentUserId?: string | null,
) => {
  return `${getPresenceMemberName(member, currentUserId)}: ${getPresenceActivityLabel(member.activity)}`;
};

function PresenceAvatarStack({
  members,
  currentUserId,
  maxVisible = 3,
}: {
  members: BoardPresenceMember[];
  currentUserId?: string | null;
  maxVisible?: number;
}) {
  const visibleMembers = members.slice(0, maxVisible);
  const hiddenCount = Math.max(0, members.length - visibleMembers.length);

  return (
    <div className="flex items-center -space-x-2">
      {visibleMembers.map((member) => (
        <Avatar
          key={member.userId}
          aria-label={getPresenceMemberLabel(member, currentUserId)}
          className="h-7 w-7 border-2 border-white shadow-sm"
        >
          <AvatarFallback className="bg-emerald-600 text-[11px] font-semibold text-white">
            {getUserInitials(member.name || "", member.email || "")}
          </AvatarFallback>
        </Avatar>
      ))}
      {hiddenCount > 0 ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[11px] font-semibold text-gray-700 shadow-sm">
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
}

export function getCardEditingMembers(
  members: BoardPresenceMember[],
  cardId: string,
) {
  return members.filter(
    (member) =>
      member.activity.type === "editing-card" && member.activity.cardId === cardId,
  );
}

export function BoardPresenceSummary({
  members,
  currentUserId,
  className,
}: {
  members: BoardPresenceMember[];
  currentUserId?: string | null;
  className?: string;
}) {
  if (members.length === 0) return null;

  const editingMembers = members.filter(
    (member) => member.activity.type === "editing-card",
  );

  return (
    <div
      aria-label={t("boardDetail.livePresenceLabel")}
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-900",
        className,
      )}
      role="status"
    >
      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
        {t("boardDetail.livePresenceLabel")}
      </Badge>
      <PresenceAvatarStack currentUserId={currentUserId} members={members} />
      <span className="font-medium">
        {t("boardDetail.onlineCount", { count: members.length })}
      </span>
      {editingMembers.length > 0 ? (
        <span className="text-emerald-800/80">
          • {t("boardDetail.editingCount", { count: editingMembers.length })}
        </span>
      ) : null}
    </div>
  );
}

export function CardEditorsIndicator({
  members,
  currentUserId,
  className,
}: {
  members: BoardPresenceMember[];
  currentUserId?: string | null;
  className?: string;
}) {
  if (members.length === 0) return null;

  return (
    <div
      aria-label={members.map((member) => getPresenceMemberLabel(member, currentUserId)).join(", ")}
      aria-live="polite"
      className={cn(
        "mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800",
        className,
      )}
      role="status"
    >
      <PresenceAvatarStack
        currentUserId={currentUserId}
        members={members}
        maxVisible={2}
      />
      <span>{t("boardDetail.editingThisCard")}</span>
    </div>
  );
}