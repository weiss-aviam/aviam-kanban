#!/usr/bin/env node

/**
 * Migration Safety Checker
 *
 * Scans SQL migration files for operations that could delete or corrupt
 * user-created content or user accounts. Exits with code 1 if any
 * violations are found so CI and the apply-migrations script can block
 * the deployment.
 *
 * Usage:
 *   node scripts/check-migrations.js                   # checks all files
 *   node scripts/check-migrations.js path/to/file.sql  # checks one file
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Destructive pattern definitions
// ---------------------------------------------------------------------------

const DESTRUCTIVE_PATTERNS = [
  {
    id: "DROP_TABLE",
    pattern: /\bDROP\s+TABLE\b/i,
    label: "DROP TABLE",
    description: "Permanently removes a table and all its rows.",
  },
  {
    id: "TRUNCATE",
    pattern: /\bTRUNCATE\b/i,
    label: "TRUNCATE",
    description: "Deletes all rows in a table without a WHERE clause.",
  },
  {
    id: "DROP_COLUMN",
    pattern: /\bDROP\s+COLUMN\b/i,
    label: "DROP COLUMN",
    description: "Removes a column and all data stored in it.",
  },
  {
    id: "DROP_SCHEMA",
    pattern: /\bDROP\s+SCHEMA\b/i,
    label: "DROP SCHEMA",
    description: "Removes an entire schema and everything inside it.",
  },
  {
    id: "DROP_DATABASE",
    pattern: /\bDROP\s+DATABASE\b/i,
    label: "DROP DATABASE",
    description: "Removes an entire database.",
  },
  {
    id: "DELETE_FROM",
    pattern: /\bDELETE\s+FROM\b/i,
    label: "DELETE FROM",
    description:
      "Deletes rows from a table. Schema migrations must never delete user data.",
  },
  {
    id: "ALTER_COLUMN_TYPE",
    // Match ALTER COLUMN <name> TYPE or ALTER COLUMN <name> SET DATA TYPE
    pattern: /\bALTER\s+COLUMN\b[^;]*\b(?:SET\s+DATA\s+)?TYPE\b/i,
    label: "ALTER COLUMN … TYPE",
    description:
      "Changes a column's data type. This can silently truncate or reject existing values.",
  },
];

// ---------------------------------------------------------------------------
// Core logic (exported so it can be tested with Vitest)
// ---------------------------------------------------------------------------

/**
 * Remove SQL line comments (-- …) and block comments (/* … *\/) from a string.
 * Preserves line structure so line numbers remain meaningful.
 */
function stripComments(sql) {
  // Block comments first, then line comments
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "))
    .replace(/--[^\n]*/g, (match) => " ".repeat(match.length));
}

/**
 * Split SQL source into individual statements (split on `;`).
 * Returns objects with { statement, lineStart } for precise reporting.
 */
function splitStatements(sql) {
  const statements = [];
  let current = "";
  let lineStart = 1;
  let currentLine = 1;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "\n") currentLine++;

    if (ch === ";") {
      const trimmed = current.trim();
      if (trimmed) statements.push({ statement: trimmed, lineStart });
      current = "";
      lineStart = currentLine + (ch === "\n" ? 0 : 1);
    } else {
      current += ch;
    }
  }

  const trimmed = current.trim();
  if (trimmed) statements.push({ statement: trimmed, lineStart });

  return statements;
}

/**
 * Check a single SQL file for destructive operations.
 * Returns an array of violation objects (empty = safe).
 *
 * Escape hatch: append  -- safe: <reason>  to any flagged line to suppress it.
 * This must be on the SAME LINE as the destructive statement, e.g.:
 *   DROP TABLE old_staging; -- safe: table only existed in dev, approved by: Alice
 */
function checkMigrationFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const lines = source.split("\n");
  const violations = [];

  lines.forEach((originalLine, idx) => {
    const lineNumber = idx + 1;

    // Remove inline block comments so patterns don't match inside /* … */
    const lineForCheck = originalLine.replace(/\/\*.*?\*\//g, " ");

    // Skip if this is purely a line comment
    const withoutLineComment = lineForCheck.replace(/--.*$/, "");
    if (!withoutLineComment.trim()) return;

    // If the original line carries an explicit approval, skip it
    if (/--\s*safe\s*:/i.test(originalLine)) return;

    for (const rule of DESTRUCTIVE_PATTERNS) {
      if (rule.pattern.test(withoutLineComment)) {
        violations.push({
          file: filePath,
          line: lineNumber,
          rule: rule.id,
          label: rule.label,
          description: rule.description,
          statement: originalLine.trim().slice(0, 120),
        });
        break; // one violation per line is enough
      }
    }
  });

  return violations;
}

/**
 * Check all .sql files in a directory and return all violations found.
 */
function checkMigrationsDir(dir) {
  if (!fs.existsSync(dir)) return [];

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join(dir, f));

  return files.flatMap((f) => checkMigrationFile(f));
}

// ---------------------------------------------------------------------------
// CLI entry-point
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const defaultDir = path.join(__dirname, "../src/db/migrations");

  let violations;

  if (args.length > 0) {
    // Specific file(s) passed on the command line
    violations = args.flatMap((f) => checkMigrationFile(path.resolve(f)));
  } else {
    violations = checkMigrationsDir(defaultDir);
  }

  if (violations.length === 0) {
    console.log(
      "✅ Migration safety check passed — no destructive operations found.\n",
    );
    process.exit(0);
  }

  console.error(
    `\n❌ Migration safety check FAILED — ${violations.length} destructive operation(s) found.\n`,
  );
  console.error(
    "   Migrations must never delete or destroy user-created content or user accounts.\n",
  );

  for (const v of violations) {
    console.error(
      `  📄 ${path.relative(process.cwd(), v.file)} (line ~${v.line})`,
    );
    console.error(`     Rule    : ${v.label}`);
    console.error(`     Reason  : ${v.description}`);
    console.error(`     SQL     : ${v.statement}\n`);
  }

  console.error(
    "  If this change is intentional and has been explicitly approved, add an\n" +
      "  inline comment to the migration file:\n\n" +
      "      -- safe: <reason why this is safe, approved by: <name>>\n\n" +
      "  and re-run this check. The comment must appear on the same line as the\n" +
      "  flagged statement to suppress it.\n",
  );

  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  checkMigrationFile,
  checkMigrationsDir,
  stripComments,
  splitStatements,
  DESTRUCTIVE_PATTERNS,
};
