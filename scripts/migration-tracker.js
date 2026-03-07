const fs = require("fs");

function normalizeTracker(tracker) {
  if (!tracker || typeof tracker !== "object" || Array.isArray(tracker)) {
    throw new Error("Migration tracker must be a JSON object.");
  }

  if (!Array.isArray(tracker.migrations)) {
    throw new Error("Migration tracker must contain a migrations array.");
  }

  const migrations = tracker.migrations.map((migration) => {
    if (typeof migration !== "string" || !migration.endsWith(".sql")) {
      throw new Error("Migration tracker contains an invalid migration entry.");
    }

    return migration;
  });

  const normalized = { migrations: Array.from(new Set(migrations)) };

  if (typeof tracker.lastApplied === "string") {
    normalized.lastApplied = tracker.lastApplied;
  }

  return normalized;
}

function createMigrationTracker(
  migrations,
  lastApplied = new Date().toISOString(),
) {
  return normalizeTracker({ migrations, lastApplied });
}

function parseMigrationTracker(rawContent) {
  const content = rawContent.trim();

  if (!content) {
    throw new Error("Migration tracker file is empty.");
  }

  try {
    return {
      tracker: normalizeTracker(JSON.parse(content)),
      recovered: false,
    };
  } catch (parseError) {
    const migrations = Array.from(
      new Set(
        [...content.matchAll(/"([^"\n]+\.sql)"/g)].map((match) => match[1]),
      ),
    );
    const lastAppliedMatch = content.match(/"lastApplied"\s*:\s*"([^"]+)"/);

    if (migrations.length > 0) {
      return {
        tracker: normalizeTracker({
          migrations,
          lastApplied: lastAppliedMatch?.[1],
        }),
        recovered: true,
      };
    }

    throw new Error(
      `Migration tracker is invalid JSON and could not be recovered. Reinitialize it with \`bash scripts/init-migrations.sh\`. Original error: ${parseError.message}`,
    );
  }
}

function listMigrationFiles(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

function readMigrationTracker(trackerFile) {
  if (!fs.existsSync(trackerFile)) {
    return {
      tracker: { migrations: [] },
      recovered: false,
      exists: false,
    };
  }

  const rawContent = fs.readFileSync(trackerFile, "utf8");
  const parsed = parseMigrationTracker(rawContent);

  return {
    ...parsed,
    exists: true,
  };
}

function writeMigrationTracker(trackerFile, tracker) {
  const normalized = normalizeTracker(tracker);
  fs.writeFileSync(trackerFile, `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

function initializeMigrationTracker(trackerFile, migrationsDir) {
  const tracker = createMigrationTracker(listMigrationFiles(migrationsDir));
  writeMigrationTracker(trackerFile, tracker);
  return tracker;
}

module.exports = {
  createMigrationTracker,
  initializeMigrationTracker,
  listMigrationFiles,
  parseMigrationTracker,
  readMigrationTracker,
  writeMigrationTracker,
};
