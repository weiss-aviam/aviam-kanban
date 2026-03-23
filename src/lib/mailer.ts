import fs from "fs";
import path from "path";

const FROM_ADDRESS = "kanban@aviam-projektentwicklung.de";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function readTemplate(filename: string): string {
  return fs.readFileSync(
    path.join(process.cwd(), "supabase", "templates", filename),
    "utf8",
  );
}

async function sendViaResend(params: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

/** Send a notification email to the superadmin when a new user is pending approval. */
export async function sendNewUserPendingNotification(params: {
  userEmail: string;
  userName: string | null;
  registeredAt: string;
}) {
  const to = process.env.SUPERADMIN_EMAIL;
  if (!to) {
    console.warn(
      "[mailer] SUPERADMIN_EMAIL is not set — skipping new-user notification.",
    );
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const approvalUrl = `${siteUrl}/dashboard/super-admin/users`;
  const displayName = params.userName ?? params.userEmail;

  let html = readTemplate("new-user-pending.html");
  html = html
    .replaceAll("{{SITE_URL}}", escapeHtml(siteUrl))
    .replaceAll("{{USER_EMAIL}}", escapeHtml(params.userEmail))
    .replaceAll("{{USER_NAME}}", escapeHtml(displayName))
    .replaceAll("{{REGISTERED_AT}}", escapeHtml(params.registeredAt))
    .replaceAll("{{APPROVAL_URL}}", escapeHtml(approvalUrl));

  await sendViaResend({
    to,
    subject: `Neue Registrierung – ${displayName} wartet auf Freigabe`,
    html,
  });
}
