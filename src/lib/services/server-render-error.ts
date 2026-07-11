import { getMissingProductionSecrets } from "@/lib/env/runtime";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type PostgrestLikeError = {
  code: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

function isPostgrestLikeError(value: unknown): value is PostgrestLikeError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    typeof (value as PostgrestLikeError).code === "string" &&
    typeof (value as PostgrestLikeError).message === "string"
  );
}

function extractSupabaseError(error: unknown): PostgrestLikeError | null {
  if (isPostgrestLikeError(error)) return error;
  if (error instanceof Error && isPostgrestLikeError(error.cause)) return error.cause;
  return null;
}

function collectMissingEnvVars(): string[] {
  const missing = new Set<string>(getMissingProductionSecrets());
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    missing.add("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    missing.add("SUPABASE_SERVICE_ROLE_KEY");
  }
  return [...missing];
}

/** Log server-component render failures with full context for Railway logs. */
export function logServerRenderError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const missingEnvVars = collectMissingEnvVars();
  const supabaseError = extractSupabaseError(error);

  console.error(`[ExecutiveDashboard] ${context} failed: ${message}`);
  if (stack) {
    console.error(stack);
  }
  if (missingEnvVars.length > 0) {
    console.error(
      `[ExecutiveDashboard] Missing environment variables: ${missingEnvVars.join(", ")}`,
    );
  }
  if (!isSupabaseConfigured()) {
    console.error(
      "[ExecutiveDashboard] Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY)",
    );
  }
  if (supabaseError) {
    console.error(
      "[ExecutiveDashboard] Supabase error:",
      JSON.stringify({
        code: supabaseError.code,
        message: supabaseError.message,
        details: supabaseError.details ?? null,
        hint: supabaseError.hint ?? null,
      }),
    );
  }
}
