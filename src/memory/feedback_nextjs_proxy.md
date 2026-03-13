---
name: Next.js 16 proxy.ts replaces middleware.ts
description: In this project Next.js 16 is used where proxy.ts replaces middleware.ts
type: feedback
---

Next.js 16 renamed `middleware.ts` to `proxy.ts`. The active request-interception file is `src/proxy.ts`, which exports a named `proxy` function (not a default export). `src/middleware.ts` / `src/lib/supabase/middleware.ts` are deprecated helpers that are no longer the entry point.

**Why:** Next.js 16 changed the convention — the file is `proxy.ts` and the export is `export function proxy(...)` or `export default`.

**How to apply:** When adding middleware/proxy logic (auth, redirects, cookie handling), edit `src/proxy.ts`. Do NOT create or restore a `src/middleware.ts`.
