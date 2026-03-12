import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Must be registered BEFORE all other middleware and routes.
//
// Why this is needed:
//   On Replit, frontend and backend share the same origin → no CORS needed.
//   On Render + Netlify, the frontend (bullwiser.netlify.app) is a different
//   origin from the backend (*.onrender.com). Browsers block cross-origin
//   requests unless the server explicitly allows them via these headers.
//
// credentials: true is required because we use session cookies.
// Without it the browser refuses to send cookies on cross-origin requests
// and every API call returns 401 even after a successful login.
// ─────────────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  // Netlify production domain
  "https://bullwiser.netlify.app",
  // Allow any Netlify deploy-preview URL for this site
  /^https:\/\/[a-z0-9-]+--bullwiser\.netlify\.app$/,
  // Replit dev URLs (for local development)
  /^https?:\/\/.*\.replit\.dev$/,
  /^https?:\/\/.*\.repl\.co$/,
  // Render URLs
  /^https?:\/\/.*\.onrender\.com$/,
  // Local development
  "http://localhost:3000",
  "http://localhost:5000",
];

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.some((allowed) =>
      typeof allowed === "string"
        ? allowed === origin
        : allowed.test(origin),
    );

    if (isAllowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, Cookie",
      );
    }
  }

  // Handle preflight OPTIONS requests immediately — must return before
  // any other middleware runs, otherwise cookies/auth breaks.
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});
// ─────────────────────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ─── Request logger ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
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

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    // Development: use Vite dev server for HMR
    await setupVite(app, server);
  } else {
    // Production: serve compiled frontend from dist/public IF it exists.
    //
    // On Render (backend-only deployment) dist/public does NOT exist because
    // the frontend is compiled and served by Netlify. Calling serveStatic()
    // when the directory is missing crashes the server immediately.
    // We detect this and run in API-only mode instead.
    const distPublicPath = resolve(__dirname, "public");
    if (existsSync(distPublicPath)) {
      log("📁 Serving static frontend from dist/public");
      serveStatic(app);
    } else {
      log("ℹ️  dist/public not found — running in API-only mode (frontend served from Netlify)");
      // Catch-all for non-API routes in API-only mode
      app.use((_req: Request, res: Response) => {
        res.status(404).json({
          message:
            "This server runs in API-only mode. The frontend is served from Netlify.",
        });
      });
    }
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`🚀 Server successfully started on http://0.0.0.0:${port}`);
      log(`📡 API available at http://0.0.0.0:${port}/api`);
    },
  );
})();
