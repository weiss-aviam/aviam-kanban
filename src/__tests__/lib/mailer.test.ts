import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock("fs", () => ({
  default: {
    readFileSync: vi.fn(() =>
      [
        "<html>",
        "<p>{{USER_NAME}} ({{USER_EMAIL}}) registered at {{REGISTERED_AT}}</p>",
        "<a href='{{APPROVAL_URL}}'>Approve</a>",
        "<p>{{SITE_URL}}</p>",
        "</html>",
      ].join("\n"),
    ),
  },
}));

vi.mock("path", () => ({
  default: {
    join: (...args: string[]) => args.join("/"),
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ─── import after mocks ──────────────────────────────────────────────────────

const { sendNewUserPendingNotification } = await import("@/lib/mailer");

// ─── helpers ─────────────────────────────────────────────────────────────────

const defaultEnv = {
  RESEND_API_KEY: "re_test_key",
  SUPERADMIN_EMAIL: "admin@example.com",
  NEXT_PUBLIC_SITE_URL: "https://app.example.com",
};

function setEnv(overrides: Partial<typeof defaultEnv> = {}) {
  const merged = { ...defaultEnv, ...overrides };
  Object.assign(process.env, merged);
}

function clearEnv() {
  delete process.env.RESEND_API_KEY;
  delete process.env.SUPERADMIN_EMAIL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
}

const defaultParams = {
  userEmail: "newuser@example.com",
  userName: "New User",
  registeredAt: "23. März 2026, 14:30",
};

// ─── tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  clearEnv();
  setEnv();
  mockFetch.mockResolvedValue({ ok: true, text: async () => "" });
});

describe("sendNewUserPendingNotification", () => {
  describe("skips sending", () => {
    it("returns early without calling fetch when SUPERADMIN_EMAIL is not set", async () => {
      delete process.env.SUPERADMIN_EMAIL;

      await sendNewUserPendingNotification(defaultParams);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("Resend API call", () => {
    it("POSTs to the Resend API with the correct URL", async () => {
      await sendNewUserPendingNotification(defaultParams);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.resend.com/emails",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("sends the Authorization header with the API key", async () => {
      await sendNewUserPendingNotification(defaultParams);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer re_test_key");
    });

    it("sends to the SUPERADMIN_EMAIL address", async () => {
      await sendNewUserPendingNotification(defaultParams);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.to).toContain("admin@example.com");
    });

    it("includes the user name in the subject line", async () => {
      await sendNewUserPendingNotification(defaultParams);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.subject).toContain("New User");
    });

    it("throws when the Resend API returns a non-OK response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 422,
        text: async () => "Unprocessable",
      });

      await expect(
        sendNewUserPendingNotification(defaultParams),
      ).rejects.toThrow("422");
    });

    it("throws when RESEND_API_KEY is not set", async () => {
      delete process.env.RESEND_API_KEY;

      await expect(
        sendNewUserPendingNotification(defaultParams),
      ).rejects.toThrow("RESEND_API_KEY");
    });
  });

  describe("template substitution", () => {
    it("replaces {{USER_EMAIL}} in the HTML body", async () => {
      await sendNewUserPendingNotification(defaultParams);
      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body.html).toContain("newuser@example.com");
    });

    it("replaces {{USER_NAME}} in the HTML body", async () => {
      await sendNewUserPendingNotification(defaultParams);
      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body.html).toContain("New User");
    });

    it("replaces {{APPROVAL_URL}} with the super-admin approval path", async () => {
      await sendNewUserPendingNotification(defaultParams);
      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body.html).toContain("/dashboard/super-admin/users");
    });

    it("uses email as display name when userName is null", async () => {
      await sendNewUserPendingNotification({
        ...defaultParams,
        userName: null,
      });
      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body.html).toContain("newuser@example.com");
    });
  });

  describe("HTML escaping", () => {
    it("escapes < and > in the user name to prevent HTML injection", async () => {
      await sendNewUserPendingNotification({
        ...defaultParams,
        userName: "<script>alert(1)</script>",
      });
      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body.html).not.toContain("<script>");
      expect(body.html).toContain("&lt;script&gt;");
    });

    it("escapes & in the user email", async () => {
      await sendNewUserPendingNotification({
        ...defaultParams,
        userEmail: "user&admin@example.com",
      });
      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body.html).toContain("&amp;");
    });

    it("escapes quotes in the user name", async () => {
      await sendNewUserPendingNotification({
        ...defaultParams,
        userName: 'He said "hello"',
      });
      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body.html).toContain("&quot;");
    });
  });
});
