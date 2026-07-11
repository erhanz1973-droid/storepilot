import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { resolveEncryptionKey } from "@/lib/crypto/encryption-key";
import { isTokenAuthenticationError, TokenDecryptionError } from "@/lib/crypto/decrypt-errors";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey() {
  return resolveEncryptionKey("GOOGLE_ADS_TOKEN_ENCRYPTION_KEY", [
    "META_TOKEN_ENCRYPTION_KEY",
    "SHOPIFY_TOKEN_ENCRYPTION_KEY",
  ]);
}

export function encryptGoogleToken(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptGoogleToken(payload: string): string {
  if (!payload.trim()) {
    throw new TokenDecryptionError("Token decryption failed: empty encrypted payload");
  }
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new TokenDecryptionError("Token decryption failed: invalid encrypted token format");
  }
  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      getEncryptionKey(),
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return decipher.update(dataB64, "base64", "utf8") + decipher.final("utf8");
  } catch (error) {
    if (isTokenAuthenticationError(error)) {
      throw new TokenDecryptionError(
        "Token decryption failed: invalid encryption key or corrupted token",
        error,
      );
    }
    throw error;
  }
}
