import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

// For Supabase, we need to use the direct connection (port 5432) for migrations
// The pooler (port 6543) doesn't support all features needed for schema changes
const directDatabaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL!;

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: directDatabaseUrl,
  },
  verbose: true,
  strict: true,
  // Enable introspection for better migration generation
  introspect: {
    casing: 'camel',
  },
});
