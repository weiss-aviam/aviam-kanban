import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options: _options }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Define protected routes
  const protectedRoutes = ["/dashboard", "/boards"];
  const adminRoutes = ["/admin"];
  const authRoutes = ["/auth/login", "/auth/signup"];
  const publicAuthRoutes = ["/auth/callback", "/auth/reset-password"];

  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route),
  );
  const isAdminRoute = adminRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route),
  );
  const isAuthRoute = authRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route),
  );
  const isPublicAuthRoute = publicAuthRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route),
  );

  // Allow public auth routes (callback, reset-password) without authentication
  if (isPublicAuthRoute) {
    return supabaseResponse;
  }

  // Admin route protection
  if (isAdminRoute) {
    if (!user) {
      // Redirect to login if not authenticated
      const redirectUrl = new URL("/auth/login", request.url);
      redirectUrl.searchParams.set(
        "redirectTo",
        request.nextUrl.pathname + request.nextUrl.search,
      );
      return NextResponse.redirect(redirectUrl);
    }

    // Check if user has admin access to the board
    const boardId = request.nextUrl.searchParams.get("boardId");

    if (boardId) {
      const { data: membership, error } = await supabase
        .from("board_members")
        .select("role")
        .eq("board_id", boardId)
        .eq("user_id", user.id)
        .single();

      if (
        error ||
        !membership ||
        !["owner", "admin"].includes(membership.role)
      ) {
        // Redirect to board if not admin
        return NextResponse.redirect(
          new URL(`/boards/${boardId}`, request.url),
        );
      }
    } else {
      // If no boardId, redirect to boards list
      return NextResponse.redirect(new URL("/boards", request.url));
    }
  }

  // If user is not logged in and trying to access protected route
  if (!user && isProtectedRoute) {
    const redirectUrl = new URL("/auth/login", request.url);
    redirectUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If user is logged in and trying to access auth routes, redirect to dashboard
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Clean up orphaned Supabase auth-token cookie chunks.
  //
  // @supabase/ssr splits large JWTs across multiple cookies:
  //   sb-<ref>-auth-token.0, sb-<ref>-auth-token.1, …
  // When a token refresh produces fewer chunks than the previous token,
  // the surplus old chunks are never deleted and stay in the browser.
  // Over many refreshes they accumulate, bloating the Cookie header until
  // nginx rejects the request with a 502 ("upstream sent too big header").
  //
  // If Supabase just wrote new auth-token cookies (i.e. a refresh happened),
  // any request cookie with the same base name that is NOT in the new
  // response set is an orphaned chunk — expire it immediately.
  const authCookiePattern = /^sb-[^-]+-auth-token/;
  const responseAuthCookies = supabaseResponse.cookies
    .getAll()
    .filter((c) => authCookiePattern.test(c.name));

  if (responseAuthCookies.length > 0) {
    const refreshedNames = new Set(responseAuthCookies.map((c) => c.name));
    for (const cookie of request.cookies.getAll()) {
      if (
        authCookiePattern.test(cookie.name) &&
        !refreshedNames.has(cookie.name)
      ) {
        supabaseResponse.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Run on page/auth routes only — exclude:
     * - /api/*               (API routes handle their own auth; skipping saves
     *                         one Supabase getUser() call per API request)
     * - /_next/*             (all Next.js internals: static, image, prefetch,
     *                         RSC payloads, etc.)
     * - /sw.js, /workbox-*   (PWA service worker files — SW installation
     *                         fetches these and would trigger getUser() in a
     *                         burst on every app install/update)
     * - /manifest.webmanifest, /offline.html, /icons/*
     * - favicon and image files
     */
    "/((?!api/|_next/|sw\\.js|workbox-.*\\.js|manifest\\.webmanifest|offline\\.html|icons/|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
