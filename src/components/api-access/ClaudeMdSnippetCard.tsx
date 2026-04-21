"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check } from "lucide-react";
import { t } from "@/lib/i18n";

const baseUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "")
).replace(/\/$/, "");

const snippet = `# Aviam Kanban — Push-Berechtigung für Claude Code

Du darfst die Aviam Kanban REST API verwenden, um in meinem Namen
Boards, Spalten, Karten und Subtasks anzulegen und zu bearbeiten.
Authentifiziere dich mit dem persönlichen Token aus AVIAM_KANBAN_TOKEN.

## Environment

Setze in \`.env\` (oder exportiere im Shell):

\`\`\`bash
AVIAM_KANBAN_URL="${baseUrl}"
AVIAM_KANBAN_TOKEN="<HIER-DEINEN-TOKEN-EINSETZEN>"
\`\`\`

Mint den Token unter \`\${AVIAM_KANBAN_URL}/profile/api-access\`.

## Ablauf — vorschlagen → bestätigen → senden

Wenn ich dich bitte, "ein Board für X zu erstellen" oder "diese Aufgaben
ins Kanban zu übernehmen":

1. **Vorschlagen.** Liste mir die geplanten Spalten, Karten, Prioritäten
   und Subtasks als Markdown-Tabelle im Chat — bevor du irgendetwas sendest.

2. **Auf Bestätigung warten.** Erst wenn ich "ja", "go", "passt" oder
   "anwenden" sage, darfst du den HTTP-Request absetzen.

3. **Senden.** Ein einziger atomarer POST erstellt Board + Spalten +
   Karten + Subtasks in einer Transaktion:

   \`\`\`bash
   curl -X POST "$AVIAM_KANBAN_URL/api/changesets/board" \\
     -H "Authorization: Bearer $AVIAM_KANBAN_TOKEN" \\
     -H "Content-Type: application/json" \\
     -H "Idempotency-Key: $(uuidgen)" \\
     -d @changeset.json
   \`\`\`

   Body-Schema:
   \`\`\`json
   {
     "board":   { "name": "Q3 Roadmap", "description": "optional" },
     "columns": [
       { "title": "Backlog", "position": 1 },
       { "title": "Doing",   "position": 2 },
       { "title": "Done",    "position": 3 }
     ],
     "cards": [
       {
         "columnRef": "Backlog",
         "title": "Metriken auswählen",
         "priority": "high",
         "subtasks": [{ "title": "KPI-Liste entwerfen" }]
       }
     ]
   }
   \`\`\`

4. **Folgeänderungen** (eine Karte hinzufügen, Datei anhängen, Subtask
   nachtragen) gehen über die Einzel-Endpoints — keine erneute
   Bestätigungsschleife nötig, das Tool-Permission-System von Claude
   Code deckt das ab.

## Titel-Regeln (alle Titel: Board, Spalte, Karte, Subtask)

- 1–80 Zeichen
- Buchstaben, Ziffern, Satzzeichen, Leerzeichen
  (\`\\p{L}\\p{N}\\p{P}\\p{Zs}\`)
- **Keine Emojis, keine Steuerzeichen** — werden vom Validator abgelehnt
- Spaltentitel müssen **innerhalb eines Boards eindeutig** sein

## Was du tun darfst

Die Routen unten sind **alle Endpoints, die existieren**. Andere Pfade
(\`GET /api/cards\`, \`GET /api/columns\`, \`PUT\` auf Cards/Columns/Subtasks)
gibt es nicht — sie liefern 404 oder 405.

| Ressource    | Echte Endpoints                                                                  |
| ------------ | -------------------------------------------------------------------------------- |
| Boards       | \`GET, POST /api/boards\` · \`GET, PUT, DELETE /api/boards/:id\`                 |
| Gruppen      | \`GET, POST /api/board-groups\` · \`PUT, DELETE /api/board-groups/:id\`          |
| Spalten      | \`POST /api/columns\` · \`PATCH, DELETE /api/columns/:id\` · \`POST /api/columns/bulk-update\` |
| Karten       | \`POST /api/cards\` · \`PATCH, DELETE /api/cards/:id\` · \`POST /api/cards/bulk-update\` · \`POST /api/cards/bulk-reorder\` |
| Subtasks     | \`GET, POST /api/cards/:id/subtasks\` · \`PATCH, DELETE /api/cards/:id/subtasks/:subtaskId\` |
| Anhänge      | \`GET, POST, DELETE /api/cards/:id/attachments\` (POST = multipart)              |
| Kalender     | \`GET /api/calendar/cards\` (alle Karten mit Fälligkeit über alle Boards)        |
| Composite    | \`POST /api/changesets/board\` (Board + Spalten + Karten + Subtasks atomar)      |

**Lese-Strategie:** Es gibt **keinen** \`GET /api/cards\` oder \`GET /api/columns\`.
Den vollständigen Stand eines Boards (Spalten, Karten, Members) holst du über
\`GET /api/boards/:id\`. Eine Liste aller Karten mit Fälligkeit gibt es über
\`GET /api/calendar/cards\`.

## Fehlerbehandlung

- **401** — Token ungültig, abgelaufen oder Master-Schalter aus → sag mir,
  dass ich unter \`/profile/api-access\` neu minten muss.
- **429** — Rate-Limit (60 req/min); halte dich an den \`Retry-After\`-Header.
- **400** — Validierungsfehler; \`error\` und \`at\` zeigen die Stelle, korrigieren und erneut senden.

## Was du **nicht** tun darfst

- Keine Boards, Karten oder Anhänge **löschen** ohne meine ausdrückliche
  Bestätigung im aktuellen Chat-Turn.
- Keine fremden Boards anfassen — du arbeitest mit meinen Berechtigungen
  (RLS sorgt dafür, dass du nur siehst was ich sehen darf, aber frag im
  Zweifel nach).
- Keine Massenoperationen über mehrere Boards ohne explizite Anweisung.
`;

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
