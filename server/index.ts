import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Must be the VERY FIRST middleware — before everything including express.json()
// Using manual headers because we need credentials + dynamic origin support.
//
// Key requirements for cross-origin cookies (Netlify → Render):
//   1. Access-Control-Allow-Origin must be the EXACT request origin (not "*")
//   2. Access-Control-Allow-Credentials must be "true"
//   3. OPTIONS preflight must return 204 immediately
// ─────────────────────────────────────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  // Always set CORS headers for ANY origin during development/debugging.
  // In production you can tighten this to specific domains.
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie"
    );
    res.setHeader("Access-Control-Expose-Headers", "Set-Cookie");
  }

  // Respond to preflight immediately — do NOT call next()
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});
// ─────────────────────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ─── Request logger ───────────────────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });

  next();
});

// ─── Routes + server ──────────────────────────────────────────────────────────
(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    const distPublicPath = resolve(__dirname, "public");
    if (existsSync(distPublicPath)) {
      log("📁 Serving static frontend from dist/public");
      serveStatic(app);
    } else {
      log("ℹ️  dist/public not found — running in API-only mode (frontend on Netlify)");
      app.use((_req: Request, res: Response) => {
        res.status(404).json({
          message: "API-only mode. Frontend is on Netlify.",
        });
      });
    }
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`🚀 Server started on http://0.0.0.0:${port}`);
    log(`📡 API available at http://0.0.0.0:${port}/api`);
  });
})();
