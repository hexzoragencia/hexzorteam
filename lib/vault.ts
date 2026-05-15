import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export const VAULT_COOKIE = (espacioId: string) => `vault_unlock_${espacioId}`;
export const VAULT_COOKIE_MAX_AGE = 60 * 30; // 30 min
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384; // N
const SCRYPT_BLOCKSIZE = 8; // r
const SCRYPT_PARALLEL = 1; // p

export function hashVaultCode(code: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(code.normalize("NFKC"), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCKSIZE,
    p: SCRYPT_PARALLEL,
  });
  return { hash: derived.toString("hex"), salt };
}

export function verifyVaultCode(code: string, hash: string, salt: string): boolean {
  if (!hash || !salt) return false;
  try {
    const derived = scryptSync(code.normalize("NFKC"), salt, SCRYPT_KEYLEN, {
      N: SCRYPT_COST,
      r: SCRYPT_BLOCKSIZE,
      p: SCRYPT_PARALLEL,
    });
    const stored = Buffer.from(hash, "hex");
    if (derived.length !== stored.length) return false;
    return timingSafeEqual(derived, stored);
  } catch {
    return false;
  }
}

export function isValidCode(code: string): { ok: boolean; error?: string } {
  if (typeof code !== "string") return { ok: false, error: "Código inválido" };
  const c = code.trim();
  if (c.length < 4) return { ok: false, error: "El código debe tener al menos 4 caracteres" };
  if (c.length > 64) return { ok: false, error: "El código es demasiado largo" };
  return { ok: true };
}
