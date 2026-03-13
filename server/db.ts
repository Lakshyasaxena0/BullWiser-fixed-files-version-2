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
// Catches Neon "endpoint disabled" errors and retries with increasing delays.
// ─────────────────────────────────────────────────────────────────────────────
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 5,
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
// Pings Neon every 4 minutes to prevent auto-suspension.
// Neon free tier suspends after 5 minutes of inactivity — this keeps it awake.
// ─────────────────────────────────────────────────────────────────────────────
const HEARTBEAT_INTERVAL = 4 * 60 * 1000; // 4 minutes

async function pingDatabase() {
  try {
    await pool.query('SELECT 1');
    console.log('[DB] Heartbeat OK — Neon is awake');
  } catch (err) {
    console.warn('[DB] Heartbeat failed — Neon may be suspended:', (err as Error).message);
  }
}

// Start heartbeat only in production (not during local dev)
if (process.env.NODE_ENV === 'production') {
  // Initial ping on startup to wake Neon immediately
  setTimeout(pingDatabase, 5000);
  // Then ping every 4 minutes
  setInterval(pingDatabase, HEARTBEAT_INTERVAL);
  console.log('[DB] Neon heartbeat started (every 4 minutes)');
}
