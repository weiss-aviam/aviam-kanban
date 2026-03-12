import { describe, expect, it } from "vitest";
import {
  isAllowedEmail,
  getEmailError,
  normalizeEmail,
} from "@/lib/auth-email";
import type { User } from "@supabase/supabase-js";

import { isSuperAdminUser } from "@/lib/auth";

describe("auth email restrictions", () => {
  it("normalizes registration emails", () => {
    expect(normalizeEmail("  USER@COMPANY.COM ")).toBe("user@company.com");
  });

  it("accepts business email addresses", () => {
    expect(isAllowedEmail("user@company.com")).toBe(true);
    expect(isAllowedEmail("user@aviam.ag")).toBe(true);
    expect(isAllowedEmail("user@startup.io")).toBe(true);
  });

  it("rejects generic consumer email providers", () => {
    expect(isAllowedEmail("user@gmail.com")).toBe(false);
    expect(isAllowedEmail("user@yahoo.com")).toBe(false);
    expect(isAllowedEmail("user@hotmail.com")).toBe(false);
    expect(isAllowedEmail("user@outlook.com")).toBe(false);
    expect(isAllowedEmail("user@icloud.com")).toBe(false);
    expect(isAllowedEmail("user@web.de")).toBe(false);
    expect(isAllowedEmail("user@gmx.de")).toBe(false);
  });

  it("returns the expected validation message", () => {
    expect(getEmailError()).toContain("geschäftliche E-Mail");
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
