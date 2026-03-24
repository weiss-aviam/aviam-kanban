import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
