// Generic/consumer email providers that are not allowed for registration.
// Business/company email addresses are required.
const BLOCKED_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.de",
  "yahoo.co.uk",
  "yahoo.fr",
  "ymail.com",
  "hotmail.com",
  "hotmail.de",
  "hotmail.co.uk",
  "hotmail.fr",
  "outlook.com",
  "outlook.de",
  "live.com",
  "live.de",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "pm.me",
  "web.de",
  "gmx.de",
  "gmx.net",
  "gmx.com",
  "gmx.at",
  "t-online.de",
  "freenet.de",
  "mailbox.org",
  "posteo.de",
  "posteo.net",
  "tutanota.com",
  "tutamail.com",
  "tuta.io",
  "zoho.com",
  "mail.com",
  "email.com",
  "usa.com",
  "myself.com",
  "contractor.net",
]);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAllowedEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex < 1) return false;
  const domain = normalized.slice(atIndex + 1);
  if (!domain || !domain.includes(".")) return false;
  return !BLOCKED_DOMAINS.has(domain);
}

export function getEmailError(): string {
  return "Bitte verwenden Sie eine geschäftliche E-Mail-Adresse. Kostenlose E-Mail-Anbieter (z.B. Gmail, Yahoo, Hotmail) sind nicht zulässig.";
}
