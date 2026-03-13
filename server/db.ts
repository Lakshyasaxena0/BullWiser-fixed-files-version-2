import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;
neonConfig.fetchConnectionCache = true;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

export const db = drizzle({ client: pool, schema });

// ─── Retry wrapper ────────────────────────────────────────────────────────────
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 8,
  delayMs = 2000,
): Promise<T> {
  let lastError: Error | null = null;
  let currentDelay = delayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      const isNeonSuspended =
        err?.message?.includes("endpoint has been disabled") ||
        err?.message?.includes("Control plane request failed") ||
        err?.message?.includes("project is in suspended state") ||
        err?.code === "XX000";

      if (isNeonSuspended && attempt < maxRetries) {
        console.log(`[DB] Neon waking up (attempt ${attempt}/${maxRetries}), retrying in ${currentDelay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, currentDelay));
        currentDelay += 1000;
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────
// Uses withRetry so it keeps trying until Neon actually wakes up on startup.
// ─────────────────────────────────────────────────────────────────────────────
async function pingDatabase() {
  try {
    await withRetry(() => pool.query('SELECT 1'), 10, 3000);
    console.log('[DB] Heartbeat OK — Neon is awake');
  } catch (err) {
    console.warn('[DB] Heartbeat failed after all retries:', (err as Error).message);
  }
}

if (process.env.NODE_ENV === 'production') {
  console.log('[DB] Neon heartbeat started (every 4 minutes)');
  // Wake Neon on startup — keeps retrying until it comes online
  pingDatabase();
  // Then keep it awake every 4 minutes
  setInterval(pingDatabase, 4 * 60 * 1000);
}
