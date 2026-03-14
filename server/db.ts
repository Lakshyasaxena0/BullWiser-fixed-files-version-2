import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from "@shared/schema";

// Use HTTP driver instead of WebSocket Pool.
// HTTP driver handles Neon cold starts automatically — each query is a fresh
// HTTP request that wakes the endpoint if needed. No more "endpoint disabled" errors.
neonConfig.fetchEndpoint = (host) => {
  return `https://${host}/sql`;
};

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });

// Keep pool export for session store (connect-pg-simple needs it)
import { Pool } from '@neondatabase/serverless';
import ws from "ws";
neonConfig.webSocketConstructor = ws;

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 3,
  connectionTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Session pool error:', err);
});

// withRetry only needed for session store pool now
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

// Heartbeat to keep Neon warm
async function pingDatabase() {
  try {
    await sql`SELECT 1`;
    console.log('[DB] Heartbeat OK — Neon is awake');
  } catch (err) {
    console.warn('[DB] Heartbeat ping failed:', (err as Error).message);
  }
}

if (process.env.NODE_ENV === 'production') {
  console.log('[DB] Neon heartbeat started (every 4 minutes)');
  pingDatabase();
  setInterval(pingDatabase, 4 * 60 * 1000);
}
