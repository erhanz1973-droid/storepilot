import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { resolveEncryptionKey } from "@/lib/crypto/encryption-key";

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
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid encrypted token format");
  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return decipher.update(dataB64, "base64", "utf8") + decipher.final("utf8");
}
