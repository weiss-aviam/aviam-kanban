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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Copy, Check } from "lucide-react";
import { t } from "@/lib/i18n";

export function CreateTokenDialog({
  disabled,
  onCreated,
}: {
  disabled: boolean;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    const res = await fetch("/api/api-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSubmitting(false);
    if (!res.ok) return;
    const json = (await res.json()) as { token: string };
    setCreated(json);
    onCreated();
  };

  const close = () => {
    setOpen(false);
    setName("");
    setCreated(null);
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <Plus className="w-4 h-4 mr-2" />
          {t("apiAccess.createToken")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        {!created ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("apiAccess.createToken")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="token-name">{t("apiAccess.tokenName")}</Label>
              <Input
                id="token-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("apiAccess.tokenNamePlaceholder")}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={close}>
                Abbrechen
              </Button>
              <Button onClick={submit} disabled={submitting || !name.trim()}>
                {t("apiAccess.createToken")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("apiAccess.tokenCreatedTitle")}</DialogTitle>
              <DialogDescription>
                {t("apiAccess.tokenCreatedOnce")}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border bg-muted px-3 py-2 font-mono text-sm break-all">
              {created.token}
            </div>
            <DialogFooter>
              <Button
                onClick={async () => {
                  await navigator.clipboard.writeText(created.token);
                  setCopied(true);
                }}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    {t("apiAccess.tokenCopied")}
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    {t("apiAccess.tokenCopy")}
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={close}>
                Schließen
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
