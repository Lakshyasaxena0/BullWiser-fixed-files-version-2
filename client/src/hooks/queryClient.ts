import { QueryClient, QueryFunction } from "@tanstack/react-query";

// ─── API base URL ────────────────────────────────────────────────────────────
// On Replit:  VITE_API_URL is not set → API_BASE = "" → calls go to same origin
// On Netlify: VITE_API_URL = your Replit backend URL (set in Netlify env vars)
//             e.g. https://c11e30bd-...-35s9rrjvyrhfh.worf.replit.dev
//
// HOW TO SET IT IN NETLIFY:
//   Site configuration → Environment variables → Add variable:
//   Key:   VITE_API_URL
//   Value: https://YOUR-REPLIT-URL.replit.dev   (no trailing slash)
//   Then: Trigger a new deploy so the new env var is baked into the bundle.
// ─────────────────────────────────────────────────────────────────────────────
const API_BASE = (import.meta.env.VITE_API_URL as string) ?? "";

/**
 * Prepend API_BASE to any path that starts with "/api".
 * Non-API paths (assets, pages) are left unchanged.
 */
function resolveUrl(path: string): string {
  if (API_BASE && path.startsWith("/api")) {
    return `${API_BASE}${path}`;
  }
  return path;
}

// ─── Error helper ────────────────────────────────────────────────────────────
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// ─── Generic API request (used by mutations / explicit fetches) ──────────────
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const res = await fetch(resolveUrl(url), {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  await throwIfResNotOk(res);
  return res;
}

// ─── Query function factory ───────────────────────────────────────────────────
type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // queryKey[0] is always the URL path, e.g. "/api/auth/user"
    const url = resolveUrl(queryKey[0] as string);

    let res: Response;
    try {
      res = await fetch(url, {
        credentials: "include",
      });
    } catch (networkError) {
      // Network failure (server offline, CORS blocked, DNS failure, etc.)
      // For auth checks: treat as "not logged in" rather than crashing the app.
      if (unauthorizedBehavior === "returnNull") {
        return null as T;
      }
      throw new Error(
        `Network error reaching ${url}. Is the backend server running?`,
      );
    }

    // 401 Unauthorised → user is not logged in
    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null as T;
    }

    // Any other non-2xx (404, 500, etc.)
    // For auth checks: treat as "not logged in" instead of infinite spinner
    if (!res.ok && unauthorizedBehavior === "returnNull") {
      return null as T;
    }

    await throwIfResNotOk(res);
    return await res.json() as T;
  };

// ─── Shared QueryClient instance ─────────────────────────────────────────────
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
