import { defineConfig } from "drizzle-kit";

// Database URL should be provided via environment variable
// The deployment script loads .env or .env.local before running drizzle-kit
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL environment variable is not set. " +
      "Make sure to run this with the deployment script or load .env/.env.local first.",
  );
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
  // Enable introspection for better migration generation
  introspect: {
    casing: "camel",
  },
});
