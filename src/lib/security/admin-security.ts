import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { rateLimit } from "./rate-limiter";
import { InputSanitizer } from "./input-sanitizer";
import { logAdminAction } from "../supabase/admin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface SecurityContext {
  userId: string;
  userRole: "owner" | "admin" | "member" | "viewer";
  boardId: string;
  ipAddress: string;
  userAgent: string;
  isAdmin: boolean;
  permissions: {
    canInviteUsers: boolean;
    canUpdateUsers: boolean;
    canRemoveUsers: boolean;
    canResetPasswords: boolean;
    canViewAuditLogs: boolean;
    canManageMemberships: boolean;
  };
}

export interface SecurityValidationResult {
  success: boolean;
  context?: SecurityContext;
  error?: string;
  statusCode?: number;
}

/**
 * Comprehensive security validation for admin operations
 */
export async function validateAdminSecurity(
  request: NextRequest,
  options: {
    requiredRole?: "owner" | "admin";
    operation?: string;
    requireBoardId?: boolean;
    rateLimitKey?: string;
    maxRequests?: number;
    windowSeconds?: number;
  } = {},
): Promise<SecurityValidationResult> {
  const {
    requiredRole = "admin",
    operation = "general",
    requireBoardId = true,
    rateLimitKey,
    maxRequests = 100,
    windowSeconds = 3600,
  } = options;

  try {
    // 1. Extract request metadata
    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get("user-agent") || "Unknown";

    // 2. Rate limiting
    const rateLimitIdentifier =
      rateLimitKey || `admin_${operation}_${ipAddress}`;
    const isRateLimited = !(await rateLimit(
      rateLimitIdentifier,
      maxRequests,
      windowSeconds,
    ));

    if (isRateLimited) {
      await logSecurityEvent({
        action: "rate_limit_exceeded",
        ipAddress,
        userAgent,
        operation,
        severity: "medium",
      });

      return {
        success: false,
        error: "Rate limit exceeded. Please try again later.",
        statusCode: 429,
      };
    }

    // 3. Authentication validation
    const authResult = await validateAuthentication(request);
    if (!authResult.success) {
      await logSecurityEvent({
        action: "authentication_failed",
        ipAddress,
        userAgent,
        operation,
        severity: "high",
      });

      return authResult;
    }

    const userId = authResult.userId!;

    // 4. Board access validation (if required)
    let boardId = "";
    let userRole: "owner" | "admin" | "member" | "viewer" = "viewer";

    if (requireBoardId) {
      const boardAccessResult = await validateBoardAccess(request, userId);
      if (!boardAccessResult.success) {
        await logSecurityEvent({
          action: "board_access_denied",
          userId,
          ipAddress,
          userAgent,
          operation,
          severity: "high",
        });

        return boardAccessResult;
      }

      boardId = boardAccessResult.boardId!;
      userRole = boardAccessResult.userRole!;
    }

    // 5. Role permission validation
    const hasPermission = validateRolePermissions(userRole, requiredRole);
    if (!hasPermission) {
      await logSecurityEvent({
        action: "insufficient_permissions",
        userId,
        boardId,
        ipAddress,
        userAgent,
        operation,
        details: { requiredRole, userRole },
        severity: "high",
      });

      return {
        success: false,
        error: `Access denied: ${requiredRole} role required`,
        statusCode: 403,
      };
    }

    // 6. Input validation (for POST/PATCH/PUT requests)
    if (["POST", "PATCH", "PUT"].includes(request.method)) {
      const inputValidationResult = await validateInput(request);
      if (!inputValidationResult.success) {
        await logSecurityEvent({
          action: "invalid_input_detected",
          userId,
          boardId,
          ipAddress,
          userAgent,
          operation,
          details: { errors: inputValidationResult.errors },
          severity: "medium",
        });

        return inputValidationResult;
      }
    }

    // 7. Build security context
    const context: SecurityContext = {
      userId,
      userRole,
      boardId,
      ipAddress,
      userAgent,
      isAdmin: userRole === "owner" || userRole === "admin",
      permissions: buildPermissions(userRole),
    };

    // 8. Log successful validation
    await logAdminAction({
      adminUserId: userId,
      ...(boardId ? { boardId } : {}),
      action: `security_validation_${operation}`,
      details: {
        operation,
        userRole,
        ipAddress,
        userAgent,
      },
      ipAddress,
      userAgent,
      severity: "low",
      category: "security",
    });

    return {
      success: true,
      context,
    };
  } catch (error) {
    console.error("Security validation error:", error);
    return {
      success: false,
      error: "Security validation failed",
      statusCode: 500,
    };
  }
}

/**
 * Validate user authentication
 */
async function validateAuthentication(request: NextRequest): Promise<{
  success: boolean;
  userId?: string;
  error?: string;
  statusCode?: number;
}> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return {
      success: false,
      error: "Missing or invalid authorization header",
      statusCode: 401,
    };
  }

  const token = authHeader.substring(7);

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return {
        success: false,
        error: "Invalid or expired authentication token",
        statusCode: 401,
      };
    }

    return {
      success: true,
      userId: user.id,
    };
  } catch (_error) {
    return {
      success: false,
      error: "Authentication validation failed",
      statusCode: 401,
    };
  }
}

/**
 * Validate board access and get user role
 */
async function validateBoardAccess(
  request: NextRequest,
  userId: string,
): Promise<{
  success: boolean;
  boardId?: string;
  userRole?: "owner" | "admin" | "member" | "viewer";
  error?: string;
  statusCode?: number;
}> {
  const boardId = extractBoardId(request);

  if (!boardId) {
    return {
      success: false,
      error: "Board ID is required",
      statusCode: 400,
    };
  }

  // Validate UUID format
  const uuidSchema = z.string().uuid();
  const validation = uuidSchema.safeParse(boardId);

  if (!validation.success) {
    return {
      success: false,
      error: "Invalid board ID format",
      statusCode: 400,
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: membership, error } = await supabase
      .from("board_memberships")
      .select("role")
      .eq("board_id", boardId)
      .eq("user_id", userId)
      .single();

    if (error || !membership) {
      return {
        success: false,
        error: "Access denied: You do not have access to this board",
        statusCode: 403,
      };
    }

    return {
      success: true,
      boardId,
      userRole: membership.role,
    };
  } catch (_error) {
    return {
      success: false,
      error: "Board access validation failed",
      statusCode: 500,
    };
  }
}

/**
 * Validate role permissions
 */
function validateRolePermissions(
  userRole: "owner" | "admin" | "member" | "viewer",
  requiredRole: "owner" | "admin",
): boolean {
  if (requiredRole === "owner") {
    return userRole === "owner";
  }

  if (requiredRole === "admin") {
    return userRole === "owner" || userRole === "admin";
  }

  return false;
}

/**
 * Validate input data
 */
async function validateInput(request: NextRequest): Promise<{
  success: boolean;
  errors?: string[];
  statusCode?: number;
}> {
  try {
    const body = await request.clone().json();
    const errors: string[] = [];

    // Sanitize all string fields
    const stringFields = extractStringFields(body);

    for (const field of stringFields) {
      const result = InputSanitizer.sanitizeString(field, {
        allowHtml: false,
        maxLength: 1000,
        trimWhitespace: true,
      });

      if (!result.isValid) {
        errors.push(...result.errors);
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        errors,
        statusCode: 400,
      };
    }

    return { success: true };
  } catch (_error) {
    return {
      success: false,
      errors: ["Invalid JSON in request body"],
      statusCode: 400,
    };
  }
}

/**
 * Build permissions object based on user role
 */
function buildPermissions(userRole: "owner" | "admin" | "member" | "viewer") {
  const isOwner = userRole === "owner";
  const isAdmin = userRole === "admin";
  const hasAdminAccess = isOwner || isAdmin;

  return {
    canInviteUsers: hasAdminAccess,
    canUpdateUsers: hasAdminAccess,
    canRemoveUsers: hasAdminAccess,
    canResetPasswords: hasAdminAccess,
    canViewAuditLogs: hasAdminAccess,
    canManageMemberships: hasAdminAccess,
  };
}

/**
 * Extract board ID from request
 */
function extractBoardId(request: NextRequest): string | null {
  // Try URL params first
  const boardId = request.nextUrl.searchParams.get("boardId");
  if (boardId) return boardId;

  // Try path parameters
  const pathMatch = request.nextUrl.pathname.match(/\/boards\/([^\/]+)/);
  if (pathMatch?.[1]) return pathMatch[1] ?? null;

  return null;
}

/**
 * Get client IP address
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");

  if (forwarded && forwarded.length > 0) {
    const first = forwarded.split(",")[0];
    return first ? first.trim() : "unknown";
  }

  if (realIP) {
    return realIP;
  }

  return "unknown";
}

/**
 * Extract string fields from object recursively
 */
function extractStringFields(obj: Record<string, unknown>): string[] {
  const strings: string[] = [];

  const extract = (value: unknown) => {
    if (typeof value === "string") {
      strings.push(value);
    } else if (Array.isArray(value)) {
      value.forEach(extract);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(extract);
    }
  };

  extract(obj);
  return strings;
}

/**
 * Log security event
 */
async function logSecurityEvent(params: {
  action: string;
  userId?: string;
  boardId?: string;
  ipAddress: string;
  userAgent: string;
  operation: string;
  details?: unknown;
  severity?: "low" | "medium" | "high" | "critical";
}): Promise<void> {
  await logAdminAction({
    adminUserId: params.userId || "system",
    ...(params.boardId ? { boardId: params.boardId } : {}),
    action: params.action,
    details: {
      operation: params.operation,
      ...((params.details as Record<string, unknown>) || {}),
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    severity: params.severity || "medium",
    category: "security",
  });
}
