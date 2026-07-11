/** AES-GCM auth-tag failure — wrong key, rotated key, or corrupted ciphertext. */
export function isTokenAuthenticationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Unsupported state or unable to authenticate data") ||
    error.message.includes("authentication tag") ||
    error.message.includes("auth tag")
  );
}

export class TokenDecryptionError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "TokenDecryptionError";
    this.cause = cause;
  }
}

export function logTokenDecryptionFailure(
  provider: string,
  error: unknown,
  context?: string,
): void {
  const prefix = `[${provider}]${context ? ` ${context}` : ""} token decryption failed`;
  if (error instanceof TokenDecryptionError) {
    console.error(prefix + ":", error.message);
    if (error.stack) console.error(error.stack);
    if (error.cause instanceof Error && error.cause.stack) {
      console.error(error.cause.stack);
    }
    return;
  }
  if (error instanceof Error) {
    console.error(prefix + ":", error.message);
    if (error.stack) console.error(error.stack);
    return;
  }
  console.error(prefix + ":", String(error));
}
