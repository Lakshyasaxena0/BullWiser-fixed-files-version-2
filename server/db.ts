import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;
neonConfig.fetchConnectionCache = true;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  // Increased to 30s to give Neon time to wake up from suspension
  connectionTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

export const db = drizzle({ client: pool, schema });

// ─── Retry wrapper ────────────────────────────────────────────────────────────
// Neon free tier suspends after 5 minutes of inactivity. The first query after
// suspension fails with "endpoint has been disabled". This wrapper retries the
// query up to 5 times with a delay, giving Neon time to wake up (~5-10 seconds).
// ─────────────────────────────────────────────────────────────────────────────
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 5,
  delayMs = 2000,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      const isNeonSuspended =
        err?.message?.includes("endpoint has been disabled") ||
        err?.message?.includes("Control plane request failed") ||
        err?.code === "XX000";

      if (isNeonSuspended && attempt < maxRetries) {
        console.log(
          `Neon database is waking up (attempt ${attempt}/${maxRetries}). ` +
          `Retrying in ${delayMs / 1000}s...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        // Increase delay on each retry: 2s, 3s, 4s, 5s, 6s
        delayMs += 1000;
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}
