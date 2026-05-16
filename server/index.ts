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

// Map the underscore-separated suffix used in imageKey (e.g. "more_stories_3")
// to the hyphenated filename suffix used in canonical storage paths
// (e.g. "more-stories-4"). 1-based indexing matches existing files like
// "ch3v42-story-1.png" and "ch3v42-more-stories-3.png".
function imageKeySuffixToFilename(suffix: string): string | null {
  const storyMatch = suffix.match(/^story_(\d+)$/);
  if (storyMatch) return `story-${parseInt(storyMatch[1], 10) + 1}`;

  const moreMatch = suffix.match(/^more_stories_(\d+)$/);
  if (moreMatch) return `more-stories-${parseInt(moreMatch[1], 10) + 1}`;

  const allowed = new Set([
    "meaning",
    "modern_life",
    "kids_explain",
    "kids_story",
    "detailed_meaning",
    "grammar",
  ]);
  if (allowed.has(suffix)) return suffix.replace(/_/g, "-");

  return null;
}

const STORAGE_PATH_PREFIX = "bhagvad-gita/images/";

// Pull the storage object path out of any URL that points at the project
// bucket (legacy storage.googleapis.com or Firebase token URLs). Returns null
// for anything not under bhagvad-gita/images/.
function extractStoragePathFromUrl(raw: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    let candidate: string | null = null;

    if (u.hostname === "storage.googleapis.com") {
      // /<bucket>/<object>
      const parts = u.pathname.replace(/^\/+/, "").split("/");
      if (parts[0] === BUCKET_NAME) {
        candidate = parts.slice(1).join("/");
      }
    } else if (u.hostname === "firebasestorage.googleapis.com") {
      // /v0/b/<bucket>/o/<encoded-object>
      const m = u.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
      if (m && m[1] === BUCKET_NAME) {
        candidate = decodeURIComponent(m[2]);
      }
    }

    if (!candidate) return null;
    if (!candidate.startsWith(STORAGE_PATH_PREFIX)) return null;
    return candidate;
  } catch {
    return null;
  }
}

// Resolve the canonical bucket object path for an upload. Priority:
//   1. Explicit x-image-path header (must be under bhagvad-gita/images/).
//   2. Existing URL in Firestore gita_images/<imageKey> (also restricted).
//   3. Derived from imageKey using the documented naming convention.
async function resolveStoragePath(
  imageKey: string,
  requestedPath: string,
  uploadedExt: string,
): Promise<string | null> {
  const fromHeader = extractStoragePathFromUrl(requestedPath) ||
    (requestedPath.startsWith(STORAGE_PATH_PREFIX) ? requestedPath : null);
  if (fromHeader) return fromHeader;

  try {
    const snap = await getFirestore()
      .collection("gita_images")
      .doc(imageKey)
      .get();
    if (snap.exists) {
      const data = snap.data() ?? {};
      const existingPath =
        (typeof data.storagePath === "string" && data.storagePath) ||
        (typeof data.url === "string" && extractStoragePathFromUrl(data.url)) ||
        null;
      if (existingPath && existingPath.startsWith(STORAGE_PATH_PREFIX)) {
        return existingPath;
      }
    }
  } catch (err) {
    console.warn(
      "Failed to read existing gita_images doc while resolving path:",
      err instanceof Error ? err.message : err,
    );
  }

  // Derive from imageKey: ch<N>_v<V>_<suffix>
  const m = imageKey.match(/^ch(\d+)_v(\d+)_(.+)$/);
  if (!m) return null;
  const [, chapter, verse, suffix] = m;
  const filenameSuffix = imageKeySuffixToFilename(suffix);
  if (!filenameSuffix) return null;
  return `${STORAGE_PATH_PREFIX}ch${chapter}/v${verse}/ch${chapter}v${verse}-${filenameSuffix}.${uploadedExt}`;
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
    const requestedPathHeader = (req.headers["x-image-path"] as string | undefined) || "";
    const contentType = req.headers["content-type"] || "image/webp";
    // Normalize extension (handles cases like "image/svg+xml")
    const uploadedExt = (contentType.split("/")[1] || "webp").split(/[+;]/)[0] || "webp";

    if (!imageKey) {
      res.status(400).json({ error: "Missing x-image-key header" });
      return;
    }

    if (!req.body || !(req.body instanceof Buffer) || req.body.length === 0) {
      res.status(400).json({ error: "Empty upload body" });
      return;
    }

    const storagePath = await resolveStoragePath(imageKey, requestedPathHeader, uploadedExt);
    if (!storagePath) {
      res.status(400).json({
        error: "Could not resolve a canonical storage path for this image key",
      });
      return;
    }

    try {
      const bucket = getStorage().bucket();
      const file = bucket.file(storagePath);

      // Embed a Firebase download token so the URL is publicly readable
      // without depending on per-object ACLs (which break on buckets with
      // uniform bucket-level access).
      const downloadToken = randomUUID();

      await file.save(req.body, {
        // Overwrite the existing object at the canonical path so that any
        // URL already referencing that path keeps working with the new bytes.
        resumable: false,
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

      const tokenUrl =
        `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}` +
        `/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
      // The legacy public URL (works once the object is publicly readable, which
      // we achieved via makePublic and/or the bucket-level allUsers grant).
      const legacyPublicUrl =
        `https://storage.googleapis.com/${BUCKET_NAME}/${storagePath}`;

      // Prefer the legacy public URL when available so existing references in
      // gitaData.json keep matching the served URL; fall back to the token URL
      // for buckets where makePublic failed.
      const publicUrl = legacyPublicUrl;

      await getFirestore().collection("gita_images").doc(imageKey).set({
        url: publicUrl,
        tokenUrl,
        storagePath,
        updatedAt: new Date(),
        updatedBy: email,
      }, { merge: true });

      res.json({ url: publicUrl, tokenUrl, storagePath });
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
