#!/usr/bin/env node

const path = require("path");
const { readMigrationTracker } = require("./migration-tracker");

const trackerFile = path.join(__dirname, "../.migrations-applied.json");

try {
  const { recovered } = readMigrationTracker(trackerFile);
  console.log(
    recovered
      ? "⚠️ Migration tracker was recoverable but malformed."
      : "✅ Migration tracker is valid.",
  );
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
