import { randomBytes } from "node:crypto";

export const BEARER_PREFIX = "avk_";
const BODY_LENGTH = 32;
const ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function generateToken(): string {
  // Pull more bytes than we need so rejection sampling stays uniform.
  const bytes = randomBytes(BODY_LENGTH * 2);
  let out = "";
  let i = 0;
  while (out.length < BODY_LENGTH && i < bytes.length) {
    const b = bytes[i++] as number;
    if (b < 248) out += ALPHABET[b % 62]; // 248 = 4 * 62; rest is uniform
  }
  if (out.length < BODY_LENGTH) {
    // Astronomically unlikely; recurse to be safe.
    return generateToken();
  }
  return BEARER_PREFIX + out;
}

export function parsePrefix(token: string): string | null {
  if (!token.startsWith(BEARER_PREFIX)) return null;
  if (token.length < 12) return null; // avk_ + at least 8 body chars
  return token.slice(0, 8);
}
