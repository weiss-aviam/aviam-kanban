import { describe, expect, it } from "vitest";
import { InputSanitizer, sanitizeObject } from "@/lib/security/input-sanitizer";

// ─── sanitizeString ──────────────────────────────────────────────────────────

describe("InputSanitizer.sanitizeString", () => {
  describe("whitespace", () => {
    it("trims leading and trailing whitespace by default", () => {
      const { sanitized } = InputSanitizer.sanitizeString("  hello  ");
      expect(sanitized).toBe("hello");
    });

    it("preserves whitespace when trimWhitespace is false", () => {
      const { sanitized } = InputSanitizer.sanitizeString("  hello  ", {
        trimWhitespace: false,
      });
      expect(sanitized).toBe("  hello  ");
    });
  });

  describe("length enforcement", () => {
    it("truncates input exceeding maxLength and adds an error + warning", () => {
      const long = "a".repeat(20);
      const { sanitized, errors, warnings } = InputSanitizer.sanitizeString(
        long,
        { maxLength: 10 },
      );
      expect(sanitized).toHaveLength(10);
      expect(errors.length).toBeGreaterThan(0);
      expect(warnings.length).toBeGreaterThan(0);
    });

    it("accepts input exactly at maxLength", () => {
      const { isValid } = InputSanitizer.sanitizeString("a".repeat(10), {
        maxLength: 10,
      });
      expect(isValid).toBe(true);
    });
  });

  describe("HTML stripping", () => {
    it("strips HTML tags when allowHtml is false (default)", () => {
      const { sanitized, warnings } =
        InputSanitizer.sanitizeString("<b>bold</b>");
      expect(sanitized).toBe("bold");
      expect(warnings.some((w) => w.includes("HTML"))).toBe(true);
    });

    it("allows safe tags when allowHtml is true", () => {
      const { sanitized } = InputSanitizer.sanitizeString("<b>bold</b>", {
        allowHtml: true,
      });
      expect(sanitized).toContain("bold");
    });
  });

  describe("XSS detection", () => {
    // The sanitizer strips HTML tags BEFORE running the XSS check, so payloads
    // that survive stripping (no enclosing tags) are what get flagged.
    it.each([
      ["javascript:alert(1)"],
      ["expression(alert(1))"],
      ["url(javascript:x)"],
    ])("flags XSS payload that survives HTML stripping: %s", (payload) => {
      const result = InputSanitizer.sanitizeString(payload);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("XSS"))).toBe(true);
    });

    it("strips <script> tags and adds a warning but not an XSS error", () => {
      // After stripping, the remaining text has no XSS patterns
      const result = InputSanitizer.sanitizeString("<script>alert(1)</script>");
      expect(result.sanitized).toBe("alert(1)");
      expect(result.warnings.some((w) => w.includes("HTML"))).toBe(true);
    });

    it("strips event-handler attributes inside tags and warns", () => {
      // <img onerror=alert(1)> → entire tag stripped → empty string
      const result = InputSanitizer.sanitizeString("<img onerror=alert(1)>");
      expect(result.sanitized).toBe("");
      expect(result.warnings.some((w) => w.includes("HTML"))).toBe(true);
    });

    it("accepts a plain string with no threats", () => {
      const { isValid } = InputSanitizer.sanitizeString("Hello, world!");
      expect(isValid).toBe(true);
    });
  });

  describe("SQL injection detection", () => {
    it.each([
      ["SELECT * FROM users"],
      ["1 OR 1=1"],
      ["1; DROP TABLE users"],
      ["UNION SELECT password FROM users"],
      ["DELETE FROM users WHERE 1=1"],
      ["/* comment */"],
    ])("flags SQL pattern: %s", (payload) => {
      const result = InputSanitizer.sanitizeString(payload);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("SQL"))).toBe(true);
    });
  });

  describe("command injection detection", () => {
    it.each([
      ["ls -la"],
      ["cat /etc/passwd"],
      ["/bin/bash"],
      ["cmd.exe /c dir"],
      ["powershell Get-Process"],
      ["test; rm -rf /"],
    ])("flags command injection: %s", (payload) => {
      const result = InputSanitizer.sanitizeString(payload);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("command injection"))).toBe(
        true,
      );
    });
  });

  describe("path traversal detection", () => {
    it.each([["../../etc/passwd"], ["%2e%2e%2f"], ["..%2f"], ["%2e%2e%5c"]])(
      "flags path traversal: %s",
      (payload) => {
        const result = InputSanitizer.sanitizeString(payload);
        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.includes("path traversal"))).toBe(
          true,
        );
      },
    );
  });
});

// ─── sanitizeEmail ───────────────────────────────────────────────────────────

describe("InputSanitizer.sanitizeEmail", () => {
  it("lowercases and trims the email", () => {
    const { sanitized } = InputSanitizer.sanitizeEmail("  USER@Example.COM  ");
    expect(sanitized).toBe("user@example.com");
  });

  it("returns isValid=false for a malformed email", () => {
    const { isValid, errors } = InputSanitizer.sanitizeEmail("not-an-email");
    expect(isValid).toBe(false);
    expect(errors.some((e) => e.includes("Invalid email"))).toBe(true);
  });

  it("strips Gmail dots and plus-aliases", () => {
    const { sanitized } = InputSanitizer.sanitizeEmail(
      "first.last+work@gmail.com",
    );
    expect(sanitized).toBe("firstlast@gmail.com");
  });

  it("does not normalise non-Gmail addresses", () => {
    const { sanitized } = InputSanitizer.sanitizeEmail(
      "first.last+tag@company.de",
    );
    expect(sanitized).toBe("first.last+tag@company.de");
  });

  it("flags suspicious email patterns (+admin, double-dots, angle brackets)", () => {
    const cases = [
      "user+admin@example.com",
      "user+script@example.com",
      "user..double@example.com",
      "<user>@example.com",
    ];
    for (const email of cases) {
      const { isValid } = InputSanitizer.sanitizeEmail(email);
      expect(isValid).toBe(false);
    }
  });
});

// ─── sanitizeName ────────────────────────────────────────────────────────────

describe("InputSanitizer.sanitizeName", () => {
  it("accepts a normal name", () => {
    const { isValid, sanitized } = InputSanitizer.sanitizeName("Ada Lovelace");
    expect(isValid).toBe(true);
    expect(sanitized).toBe("Ada Lovelace");
  });

  it("rejects names longer than 100 characters", () => {
    const { errors } = InputSanitizer.sanitizeName("A".repeat(101));
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ─── sanitizeSearchQuery ─────────────────────────────────────────────────────

describe("InputSanitizer.sanitizeSearchQuery", () => {
  it("accepts a normal search term", () => {
    const { isValid } = InputSanitizer.sanitizeSearchQuery("kanban board");
    expect(isValid).toBe(true);
  });

  it("rejects SQL in search queries", () => {
    const { isValid, errors } =
      InputSanitizer.sanitizeSearchQuery("1 UNION SELECT *");
    expect(isValid).toBe(false);
    expect(errors.some((e) => e.includes("SQL"))).toBe(true);
  });

  it("caps search queries at 200 characters", () => {
    const { sanitized } = InputSanitizer.sanitizeSearchQuery("q".repeat(300));
    expect(sanitized.length).toBeLessThanOrEqual(200);
  });
});

// ─── sanitizeObject ──────────────────────────────────────────────────────────

describe("sanitizeObject", () => {
  it("sanitizes all string fields and passes non-string values through", () => {
    const result = sanitizeObject({ name: "  Ada  ", count: 42 });
    expect(result.sanitized.name).toBe("Ada");
    expect(result.sanitized.count).toBe(42);
  });

  it("returns isValid=false when any field has an error", () => {
    // Use a payload that survives HTML stripping and triggers a threat check
    const result = sanitizeObject({ name: "javascript:alert(1)" });
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it("collects warnings per field", () => {
    const result = sanitizeObject({ bio: "<b>bold</b>" });
    expect(result.warnings.bio).toBeDefined();
  });

  it("applies per-field options", () => {
    const result = sanitizeObject(
      { title: "a".repeat(20) },
      { title: { maxLength: 10 } },
    );
    expect((result.sanitized.title as string).length).toBe(10);
  });
});
