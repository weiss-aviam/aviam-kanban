import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const {
  initializeMigrationTracker,
  parseMigrationTracker,
  readMigrationTracker,
} = require("../../scripts/migration-tracker");

const tempDirs: string[] = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "migration-tracker-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("migration tracker helpers", () => {
  it("parses a valid tracker file", () => {
    const result = parseMigrationTracker(
      JSON.stringify({
        migrations: ["0001_first.sql", "0002_second.sql"],
        lastApplied: "2026-03-07T10:00:00.000Z",
      }),
    );

    expect(result).toEqual({
      tracker: {
        migrations: ["0001_first.sql", "0002_second.sql"],
        lastApplied: "2026-03-07T10:00:00.000Z",
      },
      recovered: false,
    });
  });

  it("recovers migration names from malformed JSON", () => {
    const result = parseMigrationTracker(`{
      "migrations": ["0001_first.sql", "0002_second.sql",],
      "lastApplied": "2026-03-07T10:00:00.000Z"
    }`);

    expect(result).toEqual({
      tracker: {
        migrations: ["0001_first.sql", "0002_second.sql"],
        lastApplied: "2026-03-07T10:00:00.000Z",
      },
      recovered: true,
    });
  });

  it("throws a helpful error for unrecoverable invalid JSON", () => {
    expect(() =>
      parseMigrationTracker(`{
        "migrations": ,
        "lastApplied": "2026-03-07T10:00:00.000Z"
      }`),
    ).toThrow(/Reinitialize it with `bash scripts\/init-migrations\.sh`/);
  });

  it("initializes a valid tracker from migration files without jq", () => {
    const tempDir = makeTempDir();
    const migrationsDir = path.join(tempDir, "migrations");
    const trackerFile = path.join(tempDir, ".migrations-applied.json");

    fs.mkdirSync(migrationsDir, { recursive: true });
    fs.writeFileSync(
      path.join(migrationsDir, "07_add_card_priority.sql"),
      "-- sql",
    );
    fs.writeFileSync(
      path.join(migrationsDir, "04_add_column_templates.sql"),
      "-- sql",
    );

    initializeMigrationTracker(trackerFile, migrationsDir);

    const result = readMigrationTracker(trackerFile);

    expect(result.exists).toBe(true);
    expect(result.recovered).toBe(false);
    expect(result.tracker.migrations).toEqual([
      "04_add_column_templates.sql",
      "07_add_card_priority.sql",
    ]);
    expect(typeof result.tracker.lastApplied).toBe("string");
  });
});
