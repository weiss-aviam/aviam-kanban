import { NextRequest, NextResponse } from "next/server";
import { validateAdminSecurity, SecurityContext } from "./admin-security";
import { z } from "zod";

export interface ApiHandlerContext {
  request: NextRequest;
  security: SecurityContext;
  params?: Record<string, string>;
}

export interface ApiHandlerOptions {
  requiredRole?: "owner" | "admin";
  operation?: string;
  requireBoardId?: boolean;
  rateLimitKey?: string;
  maxRequests?: number;
  windowSeconds?: number;
  validateSchema?: z.ZodSchema;
}

export type ApiHandler = (context: ApiHandlerContext) => Promise<NextResponse>;

/**
 * Secure API route wrapper with comprehensive security validation
 */
export function withAdminSecurity(
  handler: ApiHandler,
  options: ApiHandlerOptions = {},
) {
  return async function secureHandler(
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ): Promise<NextResponse> {
    try {
      // 1. Security validation
      const securityResult = await validateAdminSecurity(request, options);

      if (!securityResult.success) {
        return NextResponse.json(
          {
            error: securityResult.error,
            code: "SECURITY_VALIDATION_FAILED",
          },
          { status: securityResult.statusCode || 500 },
        );
      }

      // 2. Schema validation (if provided)
      if (
        options.validateSchema &&
        ["POST", "PATCH", "PUT"].includes(request.method)
      ) {
        try {
          const body = await request.json();
          const validationResult = options.validateSchema.safeParse(body);

          if (!validationResult.success) {
            return NextResponse.json(
              {
                error: "Invalid request data",
                code: "VALIDATION_ERROR",
                details: validationResult.error.issues,
              },
              { status: 400 },
            );
          }
        } catch (_error) {
          return NextResponse.json(
            {
              error: "Invalid JSON in request body",
              code: "INVALID_JSON",
            },
            { status: 400 },
          );
        }
      }

      // 3. Call the actual handler with security context
      const handlerContext: ApiHandlerContext = {
        request,
        security: securityResult.context!,
        params: (context?.params ?? {}) as Record<string, string>,
      };

      return await handler(handlerContext);
    } catch (error) {
      console.error("API handler error:", error);

      return NextResponse.json(
        {
          error: "Internal server error",
          code: "INTERNAL_ERROR",
        },
        { status: 500 },
      );
    }
  };
}

/**
 * Create standardized error responses
 */
export class ApiError extends Error {
  constructor(
    public override message: string,
    public statusCode: number = 500,
    public code: string = "UNKNOWN_ERROR",
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  toResponse(): NextResponse {
    return NextResponse.json(
      {
        error: this.message,
        code: this.code,
        details: this.details,
      },
      { status: this.statusCode },
    );
  }
}

/**
 * Common API error types
 */
export const ApiErrors = {
  UNAUTHORIZED: new ApiError("Unauthorized", 401, "UNAUTHORIZED"),
  FORBIDDEN: new ApiError("Forbidden", 403, "FORBIDDEN"),
  NOT_FOUND: new ApiError("Resource not found", 404, "NOT_FOUND"),
  VALIDATION_ERROR: new ApiError("Validation error", 400, "VALIDATION_ERROR"),
  RATE_LIMITED: new ApiError("Rate limit exceeded", 429, "RATE_LIMITED"),
  INTERNAL_ERROR: new ApiError("Internal server error", 500, "INTERNAL_ERROR"),

  // Admin-specific errors
  ADMIN_ACCESS_REQUIRED: new ApiError(
    "Admin access required",
    403,
    "ADMIN_ACCESS_REQUIRED",
  ),
  OWNER_ACCESS_REQUIRED: new ApiError(
    "Owner access required",
    403,
    "OWNER_ACCESS_REQUIRED",
  ),
  BOARD_ACCESS_DENIED: new ApiError(
    "Board access denied",
    403,
    "BOARD_ACCESS_DENIED",
  ),
  INVALID_BOARD_ID: new ApiError("Invalid board ID", 400, "INVALID_BOARD_ID"),
  USER_NOT_FOUND: new ApiError("User not found", 404, "USER_NOT_FOUND"),
  CANNOT_MODIFY_SELF: new ApiError(
    "Cannot modify your own role",
    400,
    "CANNOT_MODIFY_SELF",
  ),
  CANNOT_REMOVE_OWNER: new ApiError(
    "Cannot remove board owner",
    400,
    "CANNOT_REMOVE_OWNER",
  ),
  INVALID_ROLE_ASSIGNMENT: new ApiError(
    "Invalid role assignment",
    400,
    "INVALID_ROLE_ASSIGNMENT",
  ),
};

/**
 * Success response helper
 */
export function successResponse(
  data: unknown,
  status: number = 200,
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status },
  );
}

/**
 * Paginated response helper
 */
export function paginatedResponse(
  data: unknown[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  },
  meta?: unknown,
): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    pagination,
    meta,
  });
}

/**
 * Validation helpers
 */
export const ValidationSchemas = {
  // UUID validation
  uuid: z.string().uuid("Invalid UUID format"),

  // Email validation
  email: z.string().email("Invalid email format"),

  // Role validation
  role: z.enum(["admin", "member", "viewer"]),

  // Pagination validation
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    role: z.enum(["owner", "admin", "member", "viewer", "all"]).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  }),

  // User invitation validation
  inviteUser: z.object({
    email: z.string().email("Invalid email format"),
    role: z.enum(["admin", "member", "viewer"]),
    boardId: z.string().uuid("Invalid board ID"),
  }),

  // User update validation
  updateUser: z
    .object({
      name: z.string().min(1).max(100).optional(),
      role: z.enum(["admin", "member", "viewer"]).optional(),
    })
    .refine((data) => data.name !== undefined || data.role !== undefined, {
      message: "At least one field (name or role) must be provided",
    }),

  // Membership update validation
  updateMembership: z.object({
    userId: z.string().uuid("Invalid user ID"),
    role: z.enum(["admin", "member", "viewer"]),
  }),

  // Audit log filters validation
  auditLogFilters: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    action: z.string().optional(),
    targetUserId: z.string().uuid().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
};

/**
 * Request body parser with validation
 */
export async function parseAndValidate<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>,
): Promise<T> {
  try {
    const body = await request.json();
    const result = schema.parse(body);
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError(
        "Validation error",
        400,
        "VALIDATION_ERROR",
        error.issues,
      );
    }
    throw new ApiError("Invalid JSON in request body", 400, "INVALID_JSON");
  }
}

/**
 * Query parameters parser with validation
 */
export function parseQuery<T>(request: NextRequest, schema: z.ZodSchema<T>): T {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query: Record<string, string> = {};

    for (const [key, value] of searchParams.entries()) {
      query[key] = value;
    }

    return schema.parse(query);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError(
        "Invalid query parameters",
        400,
        "VALIDATION_ERROR",
        error.issues,
      );
    }
    throw new ApiError(
      "Query parameter validation failed",
      400,
      "VALIDATION_ERROR",
    );
  }
}

/**
 * Helper to extract user ID from security context
 */
export function getUserId(context: ApiHandlerContext): string {
  return context.security.userId;
}

/**
 * Helper to extract board ID from security context
 */
export function getBoardId(context: ApiHandlerContext): string {
  return context.security.boardId;
}

/**
 * Helper to check if user has specific permission
 */
export function hasPermission(
  context: ApiHandlerContext,
  permission: keyof SecurityContext["permissions"],
): boolean {
  return context.security.permissions[permission];
}

/**
 * Helper to check if user is owner
 */
export function isOwner(context: ApiHandlerContext): boolean {
  return context.security.userRole === "owner";
}

/**
 * Helper to check if user is admin (owner or admin)
 */
export function isAdmin(context: ApiHandlerContext): boolean {
  return context.security.isAdmin;
}
