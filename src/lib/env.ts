import { z } from "zod";

const ServerEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_JWT_SECRET: z.string().min(20),
  RESEND_API_KEY: z.string().min(1).optional(),
  SUPERADMIN_EMAIL: z.string().email().optional(),
  UPLOAD_MAX_SIZE_MB: z.coerce.number().int().positive().optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_BASE_PATH: z.string().default(""),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

function format(prefix: string, error: z.ZodError): string {
  const lines = error.issues.map(
    (i) => `  - ${i.path.join(".")}: ${i.message}`,
  );
  return `${prefix}\n${lines.join("\n")}\n`;
}

const publicResult = PublicEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!publicResult.success) {
  throw new Error(
    format("Invalid public environment variables:", publicResult.error),
  );
}

export const publicEnv = publicResult.data;

const isServer = typeof window === "undefined";

const serverResult = isServer ? ServerEnvSchema.safeParse(process.env) : null;

if (isServer && serverResult && !serverResult.success) {
  throw new Error(
    format("Invalid server environment variables:", serverResult.error),
  );
}

const validatedServer = serverResult?.success ? serverResult.data : null;

/**
 * Validated server-only env vars. Reading any field on the client throws,
 * which prevents accidental imports of secrets into client bundles.
 */
export const serverEnv = new Proxy({} as z.infer<typeof ServerEnvSchema>, {
  get(_target, prop) {
    if (!isServer || !validatedServer) {
      throw new Error(
        `serverEnv.${String(prop)} accessed in a client bundle. ` +
          "Use publicEnv (NEXT_PUBLIC_*) or move the call to a server module.",
      );
    }
    return validatedServer[prop as keyof typeof validatedServer];
  },
});
