import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// Reversible encryption for API keys we must send back out to a provider later —
// bcrypt/argon2 don't apply here since those are one-way and we need the plaintext
// back. AES-256-GCM with a per-value random IV; the key is derived from a server-only
// secret so only this backend can ever decrypt what's stored in Supabase.
const ALGO = "aes-256-gcm";

function deriveKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error("API_KEY_ENCRYPTION_SECRET is not set");
  }
  return scryptSync(secret, "startup-council-api-key", 32);
}

/** Encrypts to `iv:authTag:ciphertext`, all base64. */
export function encryptSecret(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((b) => b.toString("base64")).join(":");
}

export function decryptSecret(stored: string): string {
  const key = deriveKey();
  const [ivB64, authTagB64, ciphertextB64] = stored.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted value");
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}
