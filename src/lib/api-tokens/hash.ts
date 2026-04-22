import argon2 from "argon2";

const OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16, // 64 MiB
  timeCost: 3,
  parallelism: 1,
};

export async function hashToken(plain: string): Promise<string> {
  return await argon2.hash(plain, OPTIONS);
}

export async function verifyToken(
  plain: string,
  hash: string,
): Promise<boolean> {
  if (!plain) return false;
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
