"use client";

import { useMemo, useState } from "react";
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
import { buildClaudeMdSnippet } from "./claude-md-snippet";

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
  const [snippetCopied, setSnippetCopied] = useState(false);

  const personalizedSnippet = useMemo(() => {
    if (!created) return "";
    const baseUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      (typeof window !== "undefined" ? window.location.origin : "")
    ).replace(/\/$/, "");
    return buildClaudeMdSnippet({ baseUrl, token: created.token });
  }, [created]);

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
    setSnippetCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <Plus className="w-4 h-4 mr-2" />
          {t("apiAccess.createToken")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="rounded-md border bg-muted px-3 py-2 font-mono text-sm break-all">
                  {created.token}
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(created.token);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
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
              </div>

              <div className="space-y-2 border-t pt-4">
                <div className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-sm">
                      {t("apiAccess.tokenCreatedClaudeMdTitle")}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("apiAccess.tokenCreatedClaudeMdHint")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0"
                    onClick={async () => {
                      await navigator.clipboard.writeText(personalizedSnippet);
                      setSnippetCopied(true);
                      window.setTimeout(() => setSnippetCopied(false), 2000);
                    }}
                  >
                    {snippetCopied ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        {t("apiAccess.tokenCreatedClaudeMdCopied")}
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        {t("apiAccess.tokenCreatedClaudeMdCopy")}
                      </>
                    )}
                  </Button>
                </div>
                <pre className="rounded-md border bg-muted px-3 py-3 text-xs leading-relaxed overflow-x-auto max-h-72 font-mono whitespace-pre-wrap break-words">
                  {personalizedSnippet}
                </pre>
              </div>
            </div>
            <DialogFooter>
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
