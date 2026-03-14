import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Retries on 502/504 (Neon waking up) up to 4 times with 5s delay
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const maxRetries = 4;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: data ? { "Content-Type": "application/json" } : {},
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });

      // Retry on gateway errors (Neon/Render waking up)
      if ((res.status === 502 || res.status === 504) && attempt < maxRetries) {
        console.log(`[API] Got ${res.status}, retrying (${attempt}/${maxRetries}) in 5s...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      await throwIfResNotOk(res);
      return res;
    } catch (err: any) {
      lastError = err;
      // Only retry on network/timeout errors
      if (attempt < maxRetries && (
        err.message?.includes("504") ||
        err.message?.includes("502") ||
        err.message?.includes("Failed to fetch")
      )) {
        console.log(`[API] Request failed, retrying (${attempt}/${maxRetries}) in 5s...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;

    let res: Response;
    try {
      res = await fetch(url, { credentials: "include" });
    } catch (networkError) {
      if (unauthorizedBehavior === "returnNull") return null as T;
      throw new Error(`Network error reaching ${url}.`);
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) return null as T;
    if (!res.ok && unauthorizedBehavior === "returnNull") return null as T;

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
