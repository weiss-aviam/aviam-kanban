export const AVIAM_EMAIL_DOMAIN = "aviam.ag";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAviamEmail(email: string): boolean {
  const normalizedEmail = normalizeEmail(email);
  return normalizedEmail.endsWith(`@${AVIAM_EMAIL_DOMAIN}`);
}

export function getAviamEmailError(): string {
  return `Only @${AVIAM_EMAIL_DOMAIN} email addresses can register.`;
}
