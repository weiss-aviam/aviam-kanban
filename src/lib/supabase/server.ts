import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { cookies, headers } from "next/headers";
import { authenticateBearerToken } from "@/lib/api-tokens/verify";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
}

/**
 * Returns the current user from the session cookie without a network call.
 * Use in API routes where the proxy has already verified the JWT.
 * Only use getUser() when token revocation must be checked (e.g. proxy).
 */
export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { supabase, user: session?.user ?? null };
}

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function signSupabaseJwt(userId: string): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error(
      "SUPABASE_JWT_SECRET is not set. Bearer-token (avk_…) auth needs it to mint short-lived Supabase JWTs. Add it to .env.local — find it under Supabase Dashboard → Project Settings → API → JWT Secret.",
    );
  }
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      sub: userId,
      role: "authenticated",
      aud: "authenticated",
      iat: now,
      exp: now + 60,
    },
    secret,
  );
}

/**
 * Resolves the caller from either an `Authorization: Bearer avk_…` header
 * (Claude Code API tokens) or the existing cookie session. When a bearer
 * token authenticates, returns a Supabase client whose requests carry a
 * short-lived JWT for the token's user so existing RLS policies
 * (`auth.uid() = …`) keep working unchanged.
 */
export async function getAuthorizedUser() {
  const h = await headers();
  const authHeader = h.get("authorization") ?? h.get("Authorization");

  if (authHeader?.toLowerCase().startsWith("bearer avk_")) {
    const plain = authHeader.slice(7);
    const result = await authenticateBearerToken(plain, {
      adminClient: adminClient(),
    });
    if (!result) {
      return { supabase: await createClient(), user: null };
    }
    const accessToken = signSupabaseJwt(result.userId);
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      },
    );
    return {
      supabase,
      user: { id: result.userId, tokenId: result.tokenId } as never,
    };
  }

  return await getSessionUser();
}
