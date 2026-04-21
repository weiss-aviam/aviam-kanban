#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

export function findDuplicates(rows) {
  const counts = new Map();
  for (const r of rows) {
    const key = `${r.board_id}\u0000${r.title.normalize("NFC")}`;
    const e = counts.get(key) ?? {
      board_id: r.board_id,
      title: r.title.normalize("NFC"),
      count: 0,
    };
    e.count += 1;
    counts.set(key, e);
  }
  return [...counts.values()].filter((e) => e.count > 1);
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const { data, error } = await supabase
    .from("columns")
    .select("board_id, title");
  if (error) {
    console.error("Query failed:", error.message);
    process.exit(2);
  }
  const dups = findDuplicates(data);
  if (dups.length === 0) {
    console.log(
      "✅ No duplicate column titles per board — safe to add UNIQUE constraint.",
    );
    process.exit(0);
  }
  console.error(`❌ Found ${dups.length} duplicate column-title group(s):`);
  for (const d of dups) {
    console.error(`  board ${d.board_id}: "${d.title}" appears ${d.count}×`);
  }
  console.error(
    "\nRename or delete duplicates manually before applying migration 36.",
  );
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
