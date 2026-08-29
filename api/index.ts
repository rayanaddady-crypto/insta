import app, { ensureDbReady } from "../server.ts";

export default async function handler(req: any, res: any) {
  try {
    if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("/uploads") && !req.url.startsWith("/socket.io")) {
      req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
    }
    await ensureDbReady();
    return app(req, res);
  } catch (err: any) {
    console.error("Vercel Serverless Function Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  }
}

