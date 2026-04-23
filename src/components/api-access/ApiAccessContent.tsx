"use client";

import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const enabled = initialEnabled;

  const { data, mutate } = useSWR<{ tokens: TokenRow[] }>(
    "/api/api-tokens",
    fetcher,
    { fallbackData: { tokens: initialTokens } },
  );
  const tokens = data?.tokens ?? [];

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
              <CardTitle>{t("apiAccess.statusTitle")}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t("apiAccess.statusDescription")}
              </p>
            </div>
            <Badge
              variant={enabled ? "default" : "secondary"}
              className={
                enabled
                  ? "bg-green-100 text-green-800 hover:bg-green-100"
                  : undefined
              }
            >
              {enabled
                ? t("apiAccess.statusEnabled")
                : t("apiAccess.statusDisabled")}
            </Badge>
          </CardHeader>
        </Card>

        {!enabled && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
            {t("apiAccess.contactAdminBanner")}
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRevoke(tok.id)}
                      disabled={!enabled}
                    >
                      {t("apiAccess.revoke")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <ClaudeMdSnippetCard />
      </main>
    </div>
  );
}
