import { describe, expect, it } from "vitest";
import {
  AVIAM_EMAIL_DOMAIN,
  getAviamEmailError,
  isAviamEmail,
  normalizeEmail,
} from "@/lib/auth-email";

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
