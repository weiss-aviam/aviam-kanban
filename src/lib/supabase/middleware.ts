import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) =>
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

  // Protected routes
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const pathname = request.nextUrl.pathname;
  const pathNoBase =
    basePath && pathname.startsWith(basePath)
      ? pathname.slice(basePath.length)
      : pathname;

  const protectedPaths = ["/boards", "/dashboard", "/admin"];
  const isProtectedPath = protectedPaths.some((path) =>
    pathNoBase.startsWith(path),
  );

  const authPaths = ["/auth/login", "/auth/signup"];
  const isAuthPath = authPaths.some((path) => pathNoBase.startsWith(path));

  // Determine user status from app_metadata (set at the auth layer on every
  // status transition — no DB query needed). Legacy users who predate this
  // field are assumed active because banned users cannot pass getUser() above.
  const userStatus = user
    ? ((user.app_metadata?.status as string | undefined) ?? "active")
    : null;

  const isActive = userStatus === "active";

  if (isProtectedPath) {
    if (!user) {
      // Not authenticated — redirect to login
      const url = request.nextUrl.clone();
      url.pathname = `${basePath}/auth/login`;
      url.searchParams.set("redirectTo", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    if (!isActive) {
      // Authenticated but not yet approved (pending/unconfirmed) or deactivated.
      // Redirect to login with a reason so the page can show a helpful message.
      const reason = userStatus === "deactivated" ? "deactivated" : "pending";
      const url = request.nextUrl.clone();
      url.pathname = `${basePath}/auth/login`;
      url.search = `?reason=${reason}`;
      return NextResponse.redirect(url);
    }
  }

  // Redirect authenticated ACTIVE users away from auth pages
  if (isAuthPath && user && isActive) {
    const url = request.nextUrl.clone();
    url.pathname = `${basePath}/dashboard`;
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object instead of the supabaseResponse object

  return supabaseResponse;
}
