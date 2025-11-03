import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';
import { existsSync } from 'fs';

// Load environment variables
// Try .env first (production), then .env.local (development)
const envFile = existsSync('.env') ? '.env' : '.env.local';
config({ path: envFile });

// For Supabase, we use the pooler connection (port 6543)
// Direct connection (port 5432) has IPv6 issues
const databaseUrl = process.env.DATABASE_URL!;

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
  // Enable introspection for better migration generation
  introspect: {
    casing: 'camel',
  },
});
