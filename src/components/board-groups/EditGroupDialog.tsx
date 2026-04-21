"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Save } from "lucide-react";
import { t } from "@/lib/i18n";
import type { DashboardBoardGroup } from "@/lib/data/board-groups";
import { ColorPicker } from "./CreateGroupDialog";

interface EditGroupDialogProps {
  group: DashboardBoardGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupUpdated: (group: DashboardBoardGroup) => void;
}

export function EditGroupDialog({
  group,
  open,
  onOpenChange,
  onGroupUpdated,
}: EditGroupDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("boardGroups.editTitle")}</DialogTitle>
          <DialogDescription>
            {t("boardGroups.editDescription")}
          </DialogDescription>
        </DialogHeader>
        {group && (
          <EditGroupForm
            key={group.id}
            group={group}
            onClose={() => onOpenChange(false)}
            onGroupUpdated={onGroupUpdated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditGroupForm({
  group,
  onClose,
  onGroupUpdated,
}: {
  group: DashboardBoardGroup;
  onClose: () => void;
  onGroupUpdated: (group: DashboardBoardGroup) => void;
}) {
  const [name, setName] = useState(group.name);
  const [color, setColor] = useState<string | null>(group.color);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isPending) return;
    setIsPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/board-groups/${group.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? t("boardGroups.requestFailed"));
        return;
      }
      const { group: updated } = await res.json();
      onGroupUpdated(updated as DashboardBoardGroup);
      onClose();
    } catch (err) {
      console.error("Failed to update group:", err);
      setError(t("boardGroups.requestFailed"));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="edit-group-name">{t("boardGroups.nameLabel")}</Label>
        <Input
          id="edit-group-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
          autoFocus
          required
          maxLength={120}
        />
      </div>
      <div className="space-y-2">
        <Label>{t("boardGroups.colorLabel")}</Label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={isPending || !name.trim()}>
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t("boardGroups.saving")}
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {t("boardGroups.save")}
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
