"use client";

import { useState, useTransition } from "react";
import useSWR from "swr";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ContentTopBar } from "@/components/layout/ContentTopBar";
import { CreateTokenDialog } from "./CreateTokenDialog";
import { ClaudeMdSnippetCard } from "./ClaudeMdSnippetCard";
import { t } from "@/lib/i18n";

export interface TokenRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ApiAccessContent({
  initialEnabled,
  initialTokens,
}: {
  initialEnabled: boolean;
  initialTokens: TokenRow[];
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [, startTransition] = useTransition();

  const { data, mutate } = useSWR<{ tokens: TokenRow[] }>(
    "/api/api-tokens",
    fetcher,
    { fallbackData: { tokens: initialTokens } },
  );
  const tokens = data?.tokens ?? [];

  const writeFlag = (next: boolean) => {
    startTransition(async () => {
      const res = await fetch("/api/users/api-access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (res.ok) setEnabled(next);
    });
  };

  const onToggle = (next: boolean) => {
    if (!next) setConfirmDisable(true);
    else writeFlag(true);
  };

  const onRevoke = async (id: string) => {
    if (!confirm(t("apiAccess.revokeConfirmDescription"))) return;
    const res = await fetch(`/api/api-tokens/${id}`, { method: "DELETE" });
    if (res.ok) await mutate();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <ContentTopBar
        title={t("apiAccess.title")}
        subtitle={t("apiAccess.subtitle")}
      />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("apiAccess.masterToggle")}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t("apiAccess.masterToggleDescription")}
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={onToggle}
              aria-label={t("apiAccess.masterToggle")}
            />
          </CardHeader>
        </Card>

        {!enabled && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
            {t("apiAccess.masterDisabledBanner")}
          </div>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("apiAccess.tokenListTitle")}</CardTitle>
            <CreateTokenDialog disabled={!enabled} onCreated={() => mutate()} />
          </CardHeader>
          <CardContent>
            {tokens.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center">
                {t("apiAccess.tokenListEmpty")}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {tokens.map((tok) => (
                  <li
                    key={tok.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{tok.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {tok.prefix}…
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {tok.lastUsedAt
                          ? `${t("apiAccess.tokenLastUsed")} ${new Date(
                              tok.lastUsedAt,
                            ).toLocaleString()}`
                          : t("apiAccess.tokenLastUsedNever")}
                      </div>
                    </div>
                    {!tok.revokedAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRevoke(tok.id)}
                        disabled={!enabled}
                      >
                        {t("apiAccess.revoke")}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <ClaudeMdSnippetCard />
      </main>

      <AlertDialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("apiAccess.disableConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("apiAccess.disableConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                writeFlag(false);
                setConfirmDisable(false);
              }}
            >
              {t("apiAccess.masterToggle")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
