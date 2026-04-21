"use client";

import { useState, type ReactNode } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";
import { t } from "@/lib/i18n";
import type { DashboardBoardGroup } from "@/lib/data/board-groups";

const PRESET_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#6b7280", // grey
];

interface CreateGroupDialogProps {
  trigger: ReactNode;
  onGroupCreated: (group: DashboardBoardGroup) => void;
  /** Optional: open externally (e.g. from "New group..." menu item). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateGroupDialog({
  trigger,
  onGroupCreated,
  open,
  onOpenChange,
}: CreateGroupDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(PRESET_COLORS[0] ?? null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isPending) return;
    setIsPending(true);
    setError(null);
    try {
      const res = await fetch("/api/board-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? t("boardGroups.requestFailed"));
        return;
      }
      const { group } = await res.json();
      onGroupCreated(group as DashboardBoardGroup);
      setName("");
      setColor(PRESET_COLORS[0] ?? null);
      setOpen(false);
    } catch (err) {
      console.error("Failed to create group:", err);
      setError(t("boardGroups.requestFailed"));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("boardGroups.createTitle")}</DialogTitle>
          <DialogDescription>
            {t("boardGroups.createDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="group-name">{t("boardGroups.nameLabel")}</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("boardGroups.namePlaceholder")}
              disabled={isPending}
              autoFocus
              required
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label>
              {t("boardGroups.colorLabel")}{" "}
              <span className="text-xs text-muted-foreground">
                ({t("boardGroups.colorOptional")})
              </span>
            </Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("boardGroups.creating")}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {t("boardGroups.create")}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (color: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`h-7 w-7 rounded-full border-2 transition ${
            value === c ? "border-foreground scale-110" : "border-transparent"
          }`}
          style={{ backgroundColor: c }}
          aria-label={c}
        />
      ))}
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`h-7 w-7 rounded-full border-2 bg-muted text-xs flex items-center justify-center ${
          value === null ? "border-foreground" : "border-transparent"
        }`}
        aria-label="No color"
      >
        ×
      </button>
    </div>
  );
}
