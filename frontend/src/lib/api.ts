import { supabase } from "./supabase";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public requestId?: string
  ) {
    super(message);
  }
}

type Options = { method?: string; body?: unknown; signal?: AbortSignal };


export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method ?? "GET",
      headers: {
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }

  const json = (await res.json().catch(() => null)) as
    | { error?: string; requestId?: string }
    | null;

  if (res.status === 401) {
    await supabase.auth.signOut();
    throw new ApiError(401, "Your session has expired. Please sign in again.");
  }
  if (!res.ok) {
    throw new ApiError(res.status, json?.error ?? "Something went wrong.", json?.requestId);
  }
  return json as T;
}