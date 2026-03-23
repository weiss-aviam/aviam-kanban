import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const {
  checkMigrationFile,
  checkMigrationsDir,
  stripComments,
  splitStatements,
} = require("../../scripts/check-migrations");

// ─── temp file helpers ───────────────────────────────────────────────────────

const tempDirs: string[] = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "migration-checker-"));
  tempDirs.push(dir);
  return dir;
}

function writeSql(dir: string, name: string, sql: string): string {
  const file = path.join(dir, name);
  fs.writeFileSync(file, sql, "utf8");
  return file;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ─── stripComments ───────────────────────────────────────────────────────────

describe("stripComments", () => {
  it("removes line comments", () => {
    const result = stripComments("SELECT 1; -- this is a comment\nSELECT 2;");
    expect(result).not.toContain("this is a comment");
    expect(result).toContain("SELECT 1");
    expect(result).toContain("SELECT 2");
  });

  it("removes block comments", () => {
    const result = stripComments("/* block comment */ SELECT 1;");
    expect(result).not.toContain("block comment");
    expect(result).toContain("SELECT 1");
  });

  it("preserves line count (block comment replaced with spaces)", () => {
    const original = "line1\n/* comment\nspanning\nlines */\nline5";
    const stripped = stripComments(original);
    expect(stripped.split("\n").length).toBe(original.split("\n").length);
  });
});

// ─── splitStatements ─────────────────────────────────────────────────────────

describe("splitStatements", () => {
  it("splits on semicolons", () => {
    const stmts = splitStatements("SELECT 1; SELECT 2; SELECT 3;");
    expect(stmts).toHaveLength(3);
  });

  it("ignores empty statements", () => {
    const stmts = splitStatements("SELECT 1;;; SELECT 2;");
    expect(stmts).toHaveLength(2);
  });

  it("handles trailing content without a semicolon", () => {
    const stmts = splitStatements("SELECT 1; SELECT 2");
    expect(stmts).toHaveLength(2);
  });

  it("records a lineStart for each statement", () => {
    const stmts = splitStatements("SELECT 1;\nSELECT 2;");
    expect(stmts[0]!.lineStart).toBe(1);
    expect(stmts[1]!.lineStart).toBeGreaterThanOrEqual(1);
  });
});

// ─── checkMigrationFile ──────────────────────────────────────────────────────

describe("checkMigrationFile — safe migrations", () => {
  it("passes a plain additive migration", () => {
    const dir = makeTempDir();
    const file = writeSql(
      dir,
      "01_add_table.sql",
      `
      CREATE TABLE items (
        id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL
      );
    `,
    );
    expect(checkMigrationFile(file)).toHaveLength(0);
  });

  it("passes adding a nullable column", () => {
    const dir = makeTempDir();
    const file = writeSql(
      dir,
      "02_add_col.sql",
      "ALTER TABLE items ADD COLUMN description text;",
    );
    expect(checkMigrationFile(file)).toHaveLength(0);
  });

  it("passes creating an index", () => {
    const dir = makeTempDir();
    const file = writeSql(
      dir,
      "03_idx.sql",
      "CREATE INDEX idx_items_name ON items (name);",
    );
    expect(checkMigrationFile(file)).toHaveLength(0);
  });

  it("passes enabling RLS", () => {
    const dir = makeTempDir();
    const file = writeSql(
      dir,
      "04_rls.sql",
      "ALTER TABLE items ENABLE ROW LEVEL SECURITY;",
    );
    expect(checkMigrationFile(file)).toHaveLength(0);
  });
});

describe("checkMigrationFile — destructive operations", () => {
  it("flags DROP TABLE", () => {
    const dir = makeTempDir();
    const file = writeSql(dir, "bad.sql", "DROP TABLE items;");
    const violations = checkMigrationFile(file);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("DROP_TABLE");
  });

  it("flags DROP TABLE IF EXISTS", () => {
    const dir = makeTempDir();
    const file = writeSql(dir, "bad.sql", "DROP TABLE IF EXISTS old_table;");
    const violations = checkMigrationFile(file);
    expect(violations[0].rule).toBe("DROP_TABLE");
  });

  it("flags TRUNCATE", () => {
    const dir = makeTempDir();
    const file = writeSql(dir, "bad.sql", "TRUNCATE users;");
    const violations = checkMigrationFile(file);
    expect(violations[0].rule).toBe("TRUNCATE");
  });

  it("flags ALTER TABLE … DROP COLUMN", () => {
    const dir = makeTempDir();
    const file = writeSql(
      dir,
      "bad.sql",
      "ALTER TABLE items DROP COLUMN legacy_field;",
    );
    const violations = checkMigrationFile(file);
    expect(violations[0].rule).toBe("DROP_COLUMN");
  });

  it("flags DELETE FROM", () => {
    const dir = makeTempDir();
    const file = writeSql(dir, "bad.sql", "DELETE FROM items WHERE id = '1';");
    const violations = checkMigrationFile(file);
    expect(violations[0].rule).toBe("DELETE_FROM");
  });

  it("flags ALTER COLUMN … TYPE", () => {
    const dir = makeTempDir();
    const file = writeSql(
      dir,
      "bad.sql",
      "ALTER TABLE items ALTER COLUMN score TYPE integer;",
    );
    const violations = checkMigrationFile(file);
    expect(violations[0].rule).toBe("ALTER_COLUMN_TYPE");
  });

  it("flags DROP SCHEMA", () => {
    const dir = makeTempDir();
    const file = writeSql(dir, "bad.sql", "DROP SCHEMA myschema CASCADE;");
    const violations = checkMigrationFile(file);
    expect(violations[0].rule).toBe("DROP_SCHEMA");
  });

  it("is case-insensitive", () => {
    const dir = makeTempDir();
    const file = writeSql(dir, "bad.sql", "drop table Items;");
    const violations = checkMigrationFile(file);
    expect(violations[0].rule).toBe("DROP_TABLE");
  });

  it("reports the file path in each violation", () => {
    const dir = makeTempDir();
    const file = writeSql(dir, "bad.sql", "DROP TABLE items;");
    const violations = checkMigrationFile(file);
    expect(violations[0].file).toBe(file);
  });

  it("ignores destructive keywords inside line comments", () => {
    const dir = makeTempDir();
    const file = writeSql(
      dir,
      "safe.sql",
      `
      -- Previously we would have done: DROP TABLE items;
      -- but now we just add a column instead.
      ALTER TABLE items ADD COLUMN archived boolean DEFAULT false;
    `,
    );
    expect(checkMigrationFile(file)).toHaveLength(0);
  });

  it("ignores destructive keywords inside block comments", () => {
    const dir = makeTempDir();
    const file = writeSql(
      dir,
      "safe.sql",
      `
      /* TRUNCATE users; was considered but rejected */
      CREATE INDEX idx ON users (email);
    `,
    );
    expect(checkMigrationFile(file)).toHaveLength(0);
  });

  it("suppresses a violation when -- safe: is on the same line", () => {
    const dir = makeTempDir();
    const file = writeSql(
      dir,
      "approved.sql",
      "DROP TABLE old_staging; -- safe: table was empty, approved by: Alice",
    );
    expect(checkMigrationFile(file)).toHaveLength(0);
  });

  it("still flags a violation when -- safe: is on a different line", () => {
    const dir = makeTempDir();
    const file = writeSql(
      dir,
      "bad.sql",
      `
      -- safe: this comment is on the wrong line
      DROP TABLE items;
    `,
    );
    expect(checkMigrationFile(file)).toHaveLength(1);
  });

  it("collects multiple violations from one file", () => {
    const dir = makeTempDir();
    const file = writeSql(
      dir,
      "multi-bad.sql",
      `
      DROP TABLE old_table;
      TRUNCATE temp_data;
    `,
    );
    expect(checkMigrationFile(file)).toHaveLength(2);
  });
});

// ─── checkMigrationsDir ──────────────────────────────────────────────────────

describe("checkMigrationsDir", () => {
  it("returns an empty array for a clean migrations directory", () => {
    const dir = makeTempDir();
    writeSql(dir, "01_init.sql", "CREATE TABLE users (id uuid PRIMARY KEY);");
    writeSql(dir, "02_idx.sql", "CREATE INDEX idx_users ON users (id);");
    expect(checkMigrationsDir(dir)).toHaveLength(0);
  });

  it("returns violations from all files in the directory", () => {
    const dir = makeTempDir();
    writeSql(dir, "01_ok.sql", "CREATE TABLE a (id uuid PRIMARY KEY);");
    writeSql(dir, "02_bad.sql", "DROP TABLE a;");
    writeSql(dir, "03_bad.sql", "TRUNCATE b;");
    const violations = checkMigrationsDir(dir);
    expect(violations).toHaveLength(2);
  });

  it("returns an empty array when the directory does not exist", () => {
    expect(checkMigrationsDir("/nonexistent/path")).toHaveLength(0);
  });

  it("ignores non-.sql files", () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, "README.md"), "DROP TABLE users;");
    expect(checkMigrationsDir(dir)).toHaveLength(0);
  });
});
