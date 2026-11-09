import { env } from "../config/env";

// Re-checks the user's password with Supabase. Used before approving money actions.
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  if (!email || !password || password.length > 200) return false;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}