"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check } from "lucide-react";
import { t } from "@/lib/i18n";
import { buildClaudeMdSnippet } from "./claude-md-snippet";

const baseUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "")
).replace(/\/$/, "");

const snippet = buildClaudeMdSnippet({ baseUrl });

export function ClaudeMdSnippetCard() {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{t("apiAccess.claudeMdCardTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {t("apiAccess.claudeMdCardDescription")}
          </p>
        </div>
        <Button onClick={onCopy} size="sm" className="shrink-0">
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              {t("apiAccess.claudeMdCopied")}
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              {t("apiAccess.claudeMdCopy")}
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <pre className="rounded-md border bg-muted px-3 py-3 text-xs leading-relaxed overflow-x-auto max-h-96 font-mono whitespace-pre-wrap break-words">
          {snippet}
        </pre>
        <p className="text-xs text-muted-foreground mt-2">
          {t("apiAccess.claudeMdReplaceTokenHint")}
        </p>
      </CardContent>
    </Card>
  );
}
