import { describe, expect, it } from "vitest";
import {
  AVIAM_EMAIL_DOMAIN,
  getAviamEmailError,
  isAviamEmail,
  normalizeEmail,
} from "@/lib/auth-email";
import type { User } from "@supabase/supabase-js";

import { isSuperAdminUser } from "@/lib/auth";

describe("auth email restrictions", () => {
  it("normalizes registration emails before validation", () => {
    expect(normalizeEmail("  USER@AVIAM.AG ")).toBe("user@aviam.ag");
  });

  it("accepts aviam.ag addresses regardless of case", () => {
    expect(isAviamEmail("USER@AVIAM.AG")).toBe(true);
  });

  it("rejects non-aviam registration domains", () => {
    expect(isAviamEmail("user@example.com")).toBe(false);
  });

  it("returns the expected validation message", () => {
    expect(getAviamEmailError()).toBe(
      `Only @${AVIAM_EMAIL_DOMAIN} email addresses can register.`,
    );
  });
});

describe("isSuperAdminUser", () => {
  it("accepts a boolean super_admin flag from app metadata", () => {
    const user = {
      app_metadata: { super_admin: true },
      user_metadata: {},
    } as Pick<User, "app_metadata" | "user_metadata">;

    expect(isSuperAdminUser(user)).toBe(true);
  });

  it("accepts a super_admin role from app metadata", () => {
    const user = {
      app_metadata: { role: "super_admin" },
      user_metadata: {},
    } as Pick<User, "app_metadata" | "user_metadata">;

    expect(isSuperAdminUser(user)).toBe(true);
  });

  it("rejects user-controlled user_metadata flags", () => {
    const user = {
      app_metadata: {},
      user_metadata: { role: "super_admin", super_admin: true },
    } as Pick<User, "app_metadata" | "user_metadata">;

    expect(isSuperAdminUser(user)).toBe(false);
  });

  it("rejects users without a recognized Super Admin flag", () => {
    const user = {
      app_metadata: { role: "member" },
      user_metadata: {},
    } as Pick<User, "app_metadata" | "user_metadata">;

    expect(isSuperAdminUser(user)).toBe(false);
  });
});
