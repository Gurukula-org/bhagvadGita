import express from "express";
import fs from "fs";
import { createServer } from "http";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import {
  loadGitaData,
  getMetaForUrl,
  isKnownPublicRoute,
  injectMetaTags,
  generateSitemap,
  generateRobotsTxt,
} from "./seo.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADMIN_DOMAINS = ["gurukula.com"];
const BUCKET_NAME = "sample-f6f12.appspot.com";

function initFirebaseAdmin() {
  if (getApps().length > 0) return;
  initializeApp({
    storageBucket: BUCKET_NAME,
  });
}

async function verifyAdmin(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.slice(7);
    const decoded = await getAuth().verifyIdToken(token);
    const email = decoded.email;
    if (!email) return null;
    const domain = email.split("@")[1];
    if (ADMIN_DOMAINS.includes(domain)) return email;
    const snap = await getFirestore().collection("gita_config").doc("admin_emails").get();
    if (snap.exists) {
      const data = snap.data()!;
      if ((data.emails ?? []).includes(email)) return email;
      if ((data.allowed_domains ?? []).includes(domain)) return email;
    }
    return null;
  } catch {
    return null;
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  initFirebaseAdmin();

  app.get("/api/chapter-visibility", async (_req, res) => {
    try {
      const snap = await getFirestore().collection("gita_config").doc("chapter_visibility").get();
      if (snap.exists) {
        res.json(snap.data());
      } else {
        res.json({ visible: [12] });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to read";
      res.status(500).json({ error: message });
    }
  });

  app.put("/api/chapter-visibility", express.json(), async (req, res) => {
    const email = await verifyAdmin(req.headers.authorization);
    if (!email) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    const { visible } = req.body;
    if (!Array.isArray(visible) || !visible.every((v: unknown) => typeof v === "number")) {
      res.status(400).json({ error: "visible must be an array of numbers" });
      return;
    }

    try {
      await getFirestore().collection("gita_config").doc("chapter_visibility").set({ visible });
      res.json({ visible });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/upload", express.raw({ type: "image/*", limit: "10mb" }), async (req, res) => {
    const email = await verifyAdmin(req.headers.authorization);
    if (!email) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    const imageKey = req.headers["x-image-key"] as string;
    const contentType = req.headers["content-type"] || "image/webp";
    // Normalize extension (handles cases like "image/svg+xml")
    const ext = (contentType.split("/")[1] || "webp").split(/[+;]/)[0] || "webp";

    if (!imageKey) {
      res.status(400).json({ error: "Missing x-image-key header" });
      return;
    }

    if (!req.body || !(req.body instanceof Buffer) || req.body.length === 0) {
      res.status(400).json({ error: "Empty upload body" });
      return;
    }

    try {
      const bucket = getStorage().bucket();
      const storagePath = `bhagvad-gita/images/${imageKey}/${Date.now()}.${ext}`;
      const file = bucket.file(storagePath);

      // Embed a Firebase download token so the URL is publicly readable
      // without depending on per-object ACLs (which break on buckets with
      // uniform bucket-level access).
      const downloadToken = randomUUID();

      await file.save(req.body, {
        metadata: {
          contentType,
          cacheControl: "public, max-age=31536000",
          metadata: {
            firebaseStorageDownloadTokens: downloadToken,
          },
        },
      });

      // Best-effort: also try makePublic for buckets that allow ACLs.
      // Ignore failures (e.g. uniform bucket-level access) — the token URL
      // below works either way.
      try {
        await file.makePublic();
      } catch (aclErr) {
        console.warn(
          "makePublic skipped (likely uniform bucket-level access):",
          aclErr instanceof Error ? aclErr.message : aclErr,
        );
      }

      const publicUrl =
        `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}` +
        `/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;

      await getFirestore().collection("gita_images").doc(imageKey).set({
        url: publicUrl,
        updatedAt: new Date(),
        updatedBy: email,
      }, { merge: true });

      res.json({ url: publicUrl });
    } catch (err: unknown) {
      console.error("Upload error:", err);
      const message = err instanceof Error ? err.message : "Upload failed";
      res.status(500).json({ error: message });
    }
  });

  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  const gitaData = loadGitaData(
    path.resolve(__dirname, "..", "client", "src", "data", "gitaData.json"),
    path.resolve(__dirname, "gitaData.json"),
    path.resolve(__dirname, "data", "gitaData.json"),
  );

  let htmlTemplate = "";
  try {
    htmlTemplate = fs.readFileSync(path.join(staticPath, "index.html"), "utf-8");
  } catch {
    // Template loaded lazily on first request if not available at startup
  }

  let ssrRender: ((url: string) => { html: string }) | null = null;
  try {
    const ssrPath = path.resolve(__dirname, "ssr", "entry-server.js");
    if (fs.existsSync(ssrPath)) {
      const ssrModule = await import(ssrPath);
      ssrRender = ssrModule.render;
      console.log("SSR module loaded successfully");
    } else {
      console.warn("SSR bundle not found at", ssrPath, "— falling back to client-only rendering");
    }
  } catch (err) {
    console.warn("Failed to load SSR module — falling back to client-only rendering:", err);
  }

  app.get("/sitemap.xml", (_req, res) => {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(generateSitemap(gitaData));
  });

  app.get("/robots.txt", (_req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(generateRobotsTxt());
  });

  app.use(
    "/assets",
    express.static(path.join(staticPath, "assets"), {
      maxAge: "1y",
      immutable: true,
    })
  );

  // Fallback for missing hashed assets (stale HTML referencing old builds).
  // Returns a tiny JS snippet that forces a clean page reload instead of a 404.
  app.use("/assets", (req, res) => {
    if (req.path.endsWith(".js")) {
      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.status(200).send(
        "sessionStorage.setItem('__asset_reload','1');" +
        "var u=location.href.split('?')[0];" +
        "location.replace(u+(u.indexOf('?')>-1?'&':'?')+'_v='+Date.now());"
      );
      return;
    }
    if (req.path.endsWith(".css")) {
      res.setHeader("Content-Type", "text/css");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.status(200).send("/* asset expired */");
      return;
    }
    res.status(404).end();
  });

  app.use(express.static(staticPath, {
    maxAge: 0,
    setHeaders: (res, filePath) => {
      if (/\.(jpg|jpeg|png|webp|gif|svg|ico)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
    },
  }));

  app.get("*", (req, res) => {
    if (req.path.length > 1 && req.path.endsWith("/")) {
      const normalizedPath = req.path.slice(0, -1);
      const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      res.redirect(301, `${normalizedPath}${query}`);
      return;
    }

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    if (!htmlTemplate) {
      try {
        htmlTemplate = fs.readFileSync(path.join(staticPath, "index.html"), "utf-8");
      } catch {
        res.sendFile(path.join(staticPath, "index.html"));
        return;
      }
    }
    if (!isKnownPublicRoute(req.path, gitaData)) {
      res.status(404);
    }

    const meta = getMetaForUrl(req.path, gitaData);
    let html = injectMetaTags(htmlTemplate, meta);

    if (ssrRender) {
      try {
        const { html: appHtml } = ssrRender(req.path);
        html = html.replace("<!--ssr-outlet-->", appHtml);
      } catch (err) {
        console.error("SSR render error for", req.path, err);
      }
    }

    res.send(html);
  });

  const port = process.env.PORT || (process.env.NODE_ENV === "production" ? 3000 : 3001);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
