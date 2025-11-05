import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Validate environment variables
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Create the connection
const connectionString = process.env.DATABASE_URL;

// Create postgres client
const client = postgres(connectionString, {
  prepare: false, // Disable prepared statements for better compatibility with Supabase
  max: 10, // Maximum number of connections
});

// Create drizzle instance with schema
export const db = drizzle(client, { schema });

// Export schema for use in other files
export * from "./schema";

// Export types
export type Database = typeof db;
