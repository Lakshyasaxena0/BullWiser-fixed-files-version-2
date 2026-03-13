import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE = (import.meta.env.VITE_API_URL as string) ?? "";

function resolveUrl(path: string): string {
  if (API_BASE && path.startsWith("/api")) {
    return `${API_BASE}${path}`;
  }
  return path;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

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

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = resolveUrl(queryKey[0] as string);

    let res: Response;
    try {
      res = await fetch(url, {
        credentials: "include",
      });
    } catch (networkError) {
      if (unauthorizedBehavior === "returnNull") {
        return null as T;
      }
      throw new Error(
        `Network error reaching ${url}. Is the backend server running?`,
      );
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null as T;
    }

    if (!res.ok && unauthorizedBehavior === "returnNull") {
      return null as T;
    }

    await throwIfResNotOk(res);
    return await res.json() as T;
  };

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
