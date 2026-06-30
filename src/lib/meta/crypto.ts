import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { resolveEncryptionKey } from "@/lib/crypto/encryption-key";

const ALGO = "aes-256-gcm";

function getEncryptionKey() {
  return resolveEncryptionKey("META_TOKEN_ENCRYPTION_KEY", ["SHOPIFY_TOKEN_ENCRYPTION_KEY"]);
}

export function encryptMetaToken(plaintext: string): string {
  const iv = randomBytes(12);
  const key = getEncryptionKey();
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptMetaToken(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid encrypted token format");
  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
