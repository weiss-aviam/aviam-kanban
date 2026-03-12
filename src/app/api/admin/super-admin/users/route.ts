import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, validatePassword } from "@/lib/auth";
import {
  createAdminClient,
  getClientIP,
  getUserAgent,
  logAdminAction,
} from "@/lib/supabase/admin";
import {
  superAdminCreateUserSchema,
  superAdminUserListQuerySchema,
} from "@/lib/validations/admin";

const SORT_FIELD_MAP = {
  name: "name",
  email: "email",
  createdAt: "created_at",
} as const;

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  status: string;
};

function getAuthErrorResponse(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error.message === "Super Admin access required") {
      return NextResponse.json(
        { error: "Super Admin access required" },
        { status: 403 },
      );
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const queryValidation = superAdminUserListQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );

    if (!queryValidation.success) {
      return NextResponse.json(
        { error: "Invalid query", details: queryValidation.error.issues },
        { status: 400 },
      );
    }

    const { page, limit, search, sortBy, sortOrder, status } =
      queryValidation.data;
    const offset = (page - 1) * limit;
    const adminClient = createAdminClient();

    let query = adminClient
      .from("users")
      .select("id, email, name, created_at, status", { count: "exact" });

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (status) {
      // Include 'unconfirmed' users alongside 'pending' — both are awaiting
      // admin review and should be visible in the pending tab.
      if (status === "pending") {
        query = query.in("status", ["pending", "unconfirmed"]);
      } else {
        query = query.eq("status", status);
      }
    }

    const { data, error, count } = await query
      .order(SORT_FIELD_MAP[sortBy], { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching Super Admin users:", error);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 },
      );
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const users = ((data ?? []) as UserRow[]).map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.created_at,
      status: user.status ?? "active",
    }));

    return NextResponse.json({
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    const authError = getAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("Error in GET /api/admin/super-admin/users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireSuperAdmin();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const validation = superAdminCreateUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 },
      );
    }

    const { email, name, password } = validation.data;
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: passwordValidation.errors.map((message) => ({ message })),
        },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();
    const createUserPayload = {
      email,
      password,
      email_confirm: true,
      app_metadata: { admin_created: true, status: "active" },
      ...(name ? { user_metadata: { name } } : {}),
    };

    const { data, error } =
      await adminClient.auth.admin.createUser(createUserPayload);

    // Explicitly lift any ban that may have been applied by a trigger or prior
    // code path — admin-created users must be able to log in immediately.
    if (data?.user && !error) {
      await adminClient.auth.admin.updateUserById(data.user.id, {
        ban_duration: "none",
        app_metadata: { admin_created: true, status: "active" },
      });
    }

    if (error || !data.user) {
      console.error("Error creating Super Admin managed user:", error);
      return NextResponse.json(
        { error: error?.message || "Failed to create user" },
        { status: 400 },
      );
    }

    const createdUser = data.user;
    // Admin-created users are immediately active (no approval needed)
    const { error: syncError } = await adminClient.from("users").upsert({
      id: createdUser.id,
      email: createdUser.email ?? email,
      name: name ?? null,
      status: "active",
    });

    if (syncError) {
      console.error("Error syncing created user profile:", syncError);
      return NextResponse.json(
        { error: "User created but profile sync failed" },
        { status: 500 },
      );
    }

    const clientIP = getClientIP(request);
    const userAgent = getUserAgent(request);

    await logAdminAction({
      adminUserId: currentUser.id,
      targetUserId: createdUser.id,
      action: "create_global_user",
      details: {
        email: createdUser.email ?? email,
        name: name ?? null,
      },
      ...(clientIP ? { ipAddress: clientIP } : {}),
      ...(userAgent ? { userAgent } : {}),
      category: "system",
    });

    return NextResponse.json(
      {
        message: "User created successfully",
        user: {
          id: createdUser.id,
          email: createdUser.email ?? email,
          name: name ?? null,
          createdAt: createdUser.created_at,
          status: "active",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const authError = getAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("Error in POST /api/admin/super-admin/users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
