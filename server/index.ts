import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { log, serveStatic, setupVite } from "./vite";
import { createTables } from "./migrate.js";

const app = express();

// ✅ trust proxy for correct client IP when behind load balancer
app.set("trust proxy", true);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ================================
// 🔒 IP Redirect Middleware
// ================================
const redirectUrl = "https://www.fisherinvestments.com/";
const publicPaths = ["/api/files/"];
const allowedIPs = [
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
  "172.24.29.4",
  "72.3.174.64",
  "::ffff:72.3.174.64",
  "10.137.107.52",
  "::ffff:10.137.107.52"
];

app.use((req, res, next) => {
  try {
    // ✅ Express auto-normalizes IP with trust proxy
    const clientIP = req.ip || "";
    const cleanedIP = clientIP.replace("::ffff:", "").trim();

    // --- Debug logs ---
    console.log("===============");
    console.log("req.hostname:", req.hostname);
    console.log("req.path:", req.path);
    console.log("clientIP:", clientIP);
    console.log("cleanedIP:", cleanedIP);
    console.log("allowedIPs:", allowedIPs);
    console.log("===============");

    // ✅ Skip redirect for public API routes
    if (publicPaths.some(p => req.path.startsWith(p))) {
      return next();
    }

    // ✅ Skip redirect for static files (JS, CSS, images, etc.)
    const ext = req.path.split(".").pop();
    const staticExts = ["js", "css", "png", "jpg", "jpeg", "svg", "ico", "map", "txt", "json"];
    if (staticExts.includes(ext)) {
      return next();
    }

    // ✅ Allow if IP is whitelisted
    if (allowedIPs.includes(cleanedIP)) {
      console.log("✅ Allowed IP — proceeding...");
      return next();
    }

    // ✅ Redirect only once
    if (
      (req.hostname.toLowerCase().includes("content.fi.com") ||
        req.hostname.toLowerCase().includes("localhost")) &&
      !req.query._redirected
    ) {
      const redirectWithFlag = `${redirectUrl}?_redirected=1`;
      console.log(`🚫 Blocked IP ${cleanedIP}, redirecting once → ${redirectWithFlag}`);
      // return res.redirect(302, redirectWithFlag);
    }

    // ✅ Continue if already redirected or not matching
    next();
  } catch (err) {
    console.error("IP redirect middleware failed:", err);
    next();
  }
});

// ================================
// 🧩 Request Logging Middleware
// ================================
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

// ================================
// 🚀 Server Bootstrap
// ================================
(async () => {
  try {
    // 1️⃣ Create DB tables first
    await createTables();

    // 2️⃣ Register routes
    const server = await registerRoutes(app);

    // 3️⃣ Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      throw err;
    });

    // 4️⃣ Serve app (Vite in dev, static in prod)
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // 5️⃣ Start the HTTP server
    const port = parseInt(process.env.PORT || "9000", 10);
    server.listen(
      {
        port,
        host: "0.0.0.0",
        reusePort: true,
      },
      () => {
        log(`🚀 Server and migrations ready on port ${port}`);
      }
    );
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
})();
