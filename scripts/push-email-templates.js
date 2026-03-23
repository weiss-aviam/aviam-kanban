#!/usr/bin/env node
/**
 * Push email templates to Supabase via the Management API.
 *
 * Requires:
 *   SUPABASE_ACCESS_TOKEN — personal access token from
 *                           https://supabase.com/dashboard/account/tokens
 *   NEXT_PUBLIC_SUPABASE_URL — already present in .env / .env.local
 *
 * Usage:
 *   node scripts/push-email-templates.js
 */

const fs = require("fs");
const path = require("path");

// Load .env / .env.local
const envFile = fs.existsSync(".env") ? ".env" : ".env.local";
require("dotenv").config({ path: envFile });

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!ACCESS_TOKEN) {
  console.error(
    "❌ SUPABASE_ACCESS_TOKEN is not set.\n" +
      "   Generate one at https://supabase.com/dashboard/account/tokens\n" +
      "   and add it to your .env.local file.",
  );
  process.exit(1);
}

if (!SUPABASE_URL) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL is not set.");
  process.exit(1);
}

// Extract project ref from URL: https://<ref>.supabase.co
const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
console.log(`📦 Project ref: ${projectRef}`);

const TEMPLATES_DIR = path.join(__dirname, "..", "supabase", "templates");

function readTemplate(filename) {
  const filePath = path.join(TEMPLATES_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Template not found: ${filePath}`);
    process.exit(1);
  }
  return fs.readFileSync(filePath, "utf8");
}

async function pushTemplates() {
  const confirmationHtml = readTemplate("confirmation.html");
  const recoveryHtml = readTemplate("recovery.html");

  const payload = {
    // Confirmation (signup email verification)
    mailer_subjects_confirmation: "Ihre E-Mail-Adresse bestätigen – Aviam",
    mailer_templates_confirmation_content: confirmationHtml,

    // Recovery (password reset)
    mailer_subjects_recovery: "Passwort zurücksetzen – Aviam",
    mailer_templates_recovery_content: recoveryHtml,
  };

  console.log("📤 Pushing email templates...");

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    console.error(`❌ API error ${res.status}: ${body}`);
    process.exit(1);
  }

  console.log("✅ Email templates pushed successfully.");
  console.log("   • Confirmation email — supabase/templates/confirmation.html");
  console.log("   • Recovery email     — supabase/templates/recovery.html");
  console.log("");
  console.log(
    "ℹ️  Note: supabase/templates/new-user-pending.html is sent by the app",
  );
  console.log(
    "   via Resend — not pushed to Supabase auth. Add RESEND_API_KEY and",
  );
  console.log("   SUPERADMIN_EMAIL to .env.local to enable notifications.");
}

pushTemplates().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
