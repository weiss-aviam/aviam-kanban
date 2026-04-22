const TOKEN_PLACEHOLDER = "<HIER-DEINEN-TOKEN-EINSETZEN>";

export function buildClaudeMdSnippet(opts: {
  baseUrl: string;
  token?: string;
}): string {
  const token = opts.token ?? TOKEN_PLACEHOLDER;
  return `# Aviam Kanban — Push-Berechtigung für Claude Code

Du darfst die Aviam Kanban REST API verwenden, um in meinem Namen
Boards, Spalten, Karten und Subtasks anzulegen und zu bearbeiten.
Authentifiziere dich mit dem persönlichen Token aus AVIAM_KANBAN_TOKEN.

## Environment

Setze in \`.env\` (oder exportiere im Shell):

\`\`\`bash
AVIAM_KANBAN_URL="${opts.baseUrl}"
AVIAM_KANBAN_TOKEN="${token}"
\`\`\`

${
  opts.token
    ? "Der Token oben ist bereits eingesetzt. Behandle ihn wie ein Passwort — nicht in Git committen, nicht in Logs schreiben."
    : `Mint den Token unter \`\${AVIAM_KANBAN_URL}/profile/api-access\`.`
}

## Ablauf — vorschlagen → bestätigen → senden

Wenn ich dich bitte, "ein Board für X zu erstellen" oder "diese Aufgaben
ins Kanban zu übernehmen":

1. **Vorschlagen.** Liste mir die geplanten Spalten, Karten, **Beschreibungen**,
   Prioritäten und Subtasks als Markdown-Tabelle im Chat — bevor du irgendetwas
   sendest. Beispiel:

   | Spalte  | Karte           | Beschreibung                              | Priorität | Subtasks            |
   | ------- | --------------- | ----------------------------------------- | --------- | ------------------- |
   | Backlog | Metriken wählen | KPIs für Q3 finalisieren und reviewen     | high      | KPI-Liste entwerfen |

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
         "description": "KPIs für Q3 finalisieren, mit Stakeholdern reviewen, Definition of Done festlegen.",
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

## Karten brauchen IMMER eine Beschreibung

Jede Karte, die du anlegst, **muss** ein \`description\`-Feld haben — auch
bei kurzen Aufgaben. Ohne Beschreibung weiß niemand im Team, was die Karte
wirklich bedeutet, wenn sie später aufgemacht wird.

- Mindestens 1–2 Sätze, die das *Was* und das *Warum* klären.
- Akzeptanzkriterien oder Definition of Done, falls bekannt.
- Markdown ist erlaubt (Listen, Links, Code-Blöcke).
- Maximal 8000 Zeichen.

Karten ohne sinnvolle Beschreibung darfst du nicht anlegen — frag mich
in dem Fall lieber zurück, was rein soll.

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
- Keine Karten ohne sinnvolle Beschreibung anlegen.
`;
}
