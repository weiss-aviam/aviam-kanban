# Attachments

Source: `src/app/api/cards/[id]/attachments/route.ts`

Attachments are stored in the `card-attachments` Supabase Storage bucket under
the path `{cardId}/{sanitized-filename}`. Download URLs are time-limited signed
URLs (1 hour TTL). The default upload limit is 10 MB per file (configurable via
`UPLOAD_MAX_SIZE_MB` env var).

## GET /api/cards/{id}/attachments

Lists all attachments for a card with fresh signed download URLs.

**Response 200**

```json
{
  "attachments": [
    {
      "name": "screenshot.png",
      "path": "{cardId}/screenshot.png",
      "size": 204800,
      "mimeType": "image/png",
      "createdAt": "ISO8601",
      "downloadUrl": "https://…supabase…/storage/…?token=…"
    }
  ]
}
```

Returns `{ "attachments": [] }` when the card has no files.

## POST /api/cards/{id}/attachments

Uploads a file using `multipart/form-data`. The field name must be `file`.

Non-ASCII characters and most special characters in the filename are
replaced with `_` server-side; the stored name may differ from the
original. Max filename length after sanitization is 200 characters.

**Response 201**

```json
{
  "attachment": {
    "name": "sanitized_filename.pdf",
    "path": "{cardId}/sanitized_filename.pdf",
    "size": 51200,
    "mimeType": "application/pdf",
    "downloadUrl": "https://…supabase…/storage/…?token=…"
  }
}
```

## DELETE /api/cards/{id}/attachments

Deletes a single file. The storage path is passed as a **query parameter**.

```
DELETE /api/cards/{id}/attachments?path={cardId}/filename.png
```

`path` must start with `{cardId}/` — any attempt to reference another card's
files returns 400.

**Response 200** `{ "ok": true }`

## Status codes

| Status | Meaning                                  |
| ------ | ---------------------------------------- |
| 200    | Success                                  |
| 201    | File uploaded                            |
| 400    | No file, invalid path, or file too large |
| 401    | Unauthenticated                          |
| 404    | Card not found or not a board member     |
| 500    | Storage error                            |

## curl

```bash
# Upload
curl -X POST "https://kanban.aviam.ag/api/cards/${CARD_ID}/attachments" \
  -H "Authorization: Bearer $AVIAM_KANBAN_TOKEN" \
  -F "file=@/path/to/report.pdf"

# List
curl -H "Authorization: Bearer $AVIAM_KANBAN_TOKEN" \
     "https://kanban.aviam.ag/api/cards/${CARD_ID}/attachments"

# Delete
curl -X DELETE \
  "https://kanban.aviam.ag/api/cards/${CARD_ID}/attachments?path=${CARD_ID}/report.pdf" \
  -H "Authorization: Bearer $AVIAM_KANBAN_TOKEN"
```

## fetch (Node.js — fs stream example)

```ts
import { createReadStream, statSync } from "node:fs";
import { basename } from "node:path";

const BASE = "https://kanban.aviam.ag";
const token = process.env.AVIAM_KANBAN_TOKEN!;

async function uploadAttachment(cardId: string, filePath: string) {
  const form = new FormData();
  const stream = createReadStream(filePath);
  const { size } = statSync(filePath);
  // Node 18+ Blob from stream
  const blob = new Blob([await streamToBuffer(stream)], {
    type: "application/octet-stream",
  });
  form.append("file", blob, basename(filePath));

  const res = await fetch(`${BASE}/api/cards/${cardId}/attachments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return (await res.json()).attachment;
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks);
}
```
