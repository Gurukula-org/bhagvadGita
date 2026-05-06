import fs from "fs";
import path from "path";
import { TOPIC_HUBS } from "../client/src/lib/seoKeywords";

const BASE_URL = "https://gita.gurukula.com";
const SITE_NAME = "Bhagavad Gita - Gurukula.com";
const DEFAULT_IMAGE = `${BASE_URL}/gita-og.jpg`;
const DEFAULT_DESCRIPTION =
  "Bhagavad Gita with authentic pronunciation, detailed meaning, stories and practical application tips for kids and adults.";

interface MetaTags {
  title: string;
  description: string;
  url: string;
  image: string;
  type: string;
  noindex?: boolean;
}

interface GitaChapter {
  chapter: number;
  name: string;
  name_hindi: string;
  devanagari_name?: string;
  iast_name?: string;
  subtitle: string;
  verses_count: number;
  summary: string;
  generated_description?: string;
  key_verses: GitaVerse[];
}

interface GitaVerse {
  verse: number;
  chapter?: number;
  title?: string;
  one_line_meaning?: string;
  concise_journey?: string;
  images?: {
    meaning?: { url?: string };
    detailed_meaning?: { url?: string };
    story?: { url?: string }[] | { url?: string };
    modern_life?: { url?: string };
    kids_explain?: { url?: string };
    kids_story?: { url?: string };
  };
}

function getVerseImage(verse: GitaVerse): string | null {
  const imgs = verse.images;
  if (!imgs) return null;
  if (imgs.meaning?.url) return imgs.meaning.url;
  if (imgs.detailed_meaning?.url) return imgs.detailed_meaning.url;
  if (imgs.modern_life?.url) return imgs.modern_life.url;
  if (imgs.kids_explain?.url) return imgs.kids_explain.url;
  if (imgs.kids_story?.url) return imgs.kids_story.url;
  if (Array.isArray(imgs.story) && imgs.story[0]?.url) return imgs.story[0].url;
  if (!Array.isArray(imgs.story) && imgs.story?.url) return imgs.story.url;
  return null;
}

interface GitaData {
  chapters: GitaChapter[];
  chapter6_full: GitaVerse[];
}

let cachedData: GitaData | null = null;
let cachedDataLastMod = new Date().toISOString().split("T")[0];

export function loadGitaData(...candidatePaths: string[]): GitaData {
  if (cachedData) return cachedData;
  for (const p of candidatePaths) {
    try {
      if (!fs.existsSync(p)) continue;
      const stat = fs.statSync(p);
      cachedDataLastMod = stat.mtime.toISOString().split("T")[0];
      const raw = fs.readFileSync(p, "utf-8");
      cachedData = JSON.parse(raw) as GitaData;
      return cachedData;
    } catch {
      continue;
    }
  }
  cachedData = { chapters: [], chapter6_full: [] };
  return cachedData;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function hasChapter(data: GitaData, chapterNum: number): boolean {
  return data.chapters.some((chapter) => chapter.chapter === chapterNum);
}

function hasVerse(data: GitaData, chapterNum: number, verseNum: number): boolean {
  const chapter = data.chapters.find((c) => c.chapter === chapterNum);
  if (!chapter) return false;
  const verses = chapterNum === 6 ? data.chapter6_full : chapter.key_verses;
  return verses.some((verse) => verse.verse === verseNum);
}

export function isKnownPublicRoute(urlPath: string, data: GitaData): boolean {
  if (urlPath === "/") return true;
  if (urlPath === "/login" || urlPath === "/settings" || urlPath === "/settings/images") return true;
  if (/^\/chapter\/\d+\/summary$/.test(urlPath)) {
    const match = urlPath.match(/^\/chapter\/(\d+)\/summary$/);
    return match ? hasChapter(data, parseInt(match[1], 10)) : false;
  }
  if (/^\/chapter\/\d+\/verse\/\d+$/.test(urlPath)) {
    const match = urlPath.match(/^\/chapter\/(\d+)\/verse\/(\d+)$/);
    if (!match) return false;
    return hasVerse(data, parseInt(match[1], 10), parseInt(match[2], 10));
  }
  if (/^\/chapter\/\d+\/games$/.test(urlPath)) {
    const match = urlPath.match(/^\/chapter\/(\d+)\/games$/);
    return match ? parseInt(match[1], 10) === 6 : false;
  }
  if (/^\/chapter\/\d+$/.test(urlPath)) {
    const match = urlPath.match(/^\/chapter\/(\d+)$/);
    return match ? hasChapter(data, parseInt(match[1], 10)) : false;
  }
  if (urlPath === "/topics") return true;
  if (/^\/topics\/[a-z0-9-]+$/.test(urlPath)) {
    const match = urlPath.match(/^\/topics\/([a-z0-9-]+)$/);
    const slug = match?.[1] || "";
    return TOPIC_HUBS.some((hub) => hub.slug === slug);
  }
  return false;
}

export function getMetaForUrl(urlPath: string, data: GitaData): MetaTags {
  const chapterMatch = urlPath.match(/^\/chapter\/(\d+)$/);
  const verseMatch = urlPath.match(/^\/chapter\/(\d+)\/verse\/(\d+)$/);
  const gamesMatch = urlPath.match(/^\/chapter\/(\d+)\/games$/);
  const summaryMatch = urlPath.match(/^\/chapter\/(\d+)\/summary$/);
  const topicsIndexMatch = urlPath === "/topics";
  const topicsHubMatch = urlPath.match(/^\/topics\/([a-z0-9-]+)$/);
  const loginMatch = urlPath === "/login";
  const settingsMatch = urlPath === "/settings";
  const imageManagerMatch = urlPath === "/settings/images";

  if (loginMatch || settingsMatch || imageManagerMatch) {
    const pathTitle = loginMatch
      ? "Admin Login"
      : settingsMatch
        ? "Admin Settings"
        : "Image Manager";
    return {
      title: `${pathTitle} | ${SITE_NAME}`,
      description: "Administrative interface for Gurukula Bhagavad Gita content management.",
      url: `${BASE_URL}${urlPath}`,
      image: DEFAULT_IMAGE,
      type: "website",
      noindex: true,
    };
  }

  if (summaryMatch) {
    const chNum = parseInt(summaryMatch[1]);
    const chapter = data.chapters.find((c) => c.chapter === chNum);
    const chapterName = chapter?.iast_name || chapter?.name || "";
    return {
      title: `Chapter ${chNum} Summary — ${chapterName} | ${SITE_NAME}`,
      description: `Summary of Bhagavad Gita Chapter ${chNum} (${chapterName}) — ${chapter?.subtitle || ""}`,
      url: `${BASE_URL}/chapter/${chNum}/summary`,
      image: getChapterImage(chNum, data) || DEFAULT_IMAGE,
      type: "article",
    };
  }

  if (verseMatch) {
    const chNum = parseInt(verseMatch[1]);
    const vNum = parseInt(verseMatch[2]);
    const chapter = data.chapters.find((c) => c.chapter === chNum);
    const verses = chNum === 6 ? data.chapter6_full : chapter?.key_verses || [];
    const verse = verses.find((v) => v.verse === vNum);
    const chapterName = chapter?.iast_name || chapter?.name || "";
    const verseTitle = `Bhagavad Gita Chapter ${chNum} Shloka ${vNum} — ${chapterName}`;

    return {
      title: `${verseTitle} | ${SITE_NAME}`,
      description:
        verse?.one_line_meaning ||
        verse?.concise_journey ||
        `Bhagavad Gita Chapter ${chNum} Verse ${vNum} — Sanskrit shloka with transliteration, meaning, stories, and grammar analysis.`,
      url: `${BASE_URL}/chapter/${chNum}/verse/${vNum}`,
      image: (verse ? getVerseImage(verse) : null) || DEFAULT_IMAGE,
      type: "article",
    };
  }

  if (gamesMatch) {
    const chNum = parseInt(gamesMatch[1]);
    return {
      title: `Chapter ${chNum} — Interactive Learning Games | ${SITE_NAME}`,
      description:
        "5 fun interactive games to learn the Bhagavad Gita: Verse Match, Quiz, Fill-in-the-Blank, Word Scramble, and Speed Round.",
      url: `${BASE_URL}/chapter/${chNum}/games`,
      image: DEFAULT_IMAGE,
      type: "website",
    };
  }

  if (topicsIndexMatch) {
    return {
      title: `Bhagavad Gita Topics for Daily Life | ${SITE_NAME}`,
      description: "Explore Bhagavad Gita teachings by life-intent topics: stress, focus, decision making, devotion, and spiritual growth.",
      url: `${BASE_URL}/topics`,
      image: DEFAULT_IMAGE,
      type: "website",
    };
  }

  if (topicsHubMatch) {
    const topic = TOPIC_HUBS.find((hub) => hub.slug === topicsHubMatch[1]);
    const slugLabel = topic?.title || topicsHubMatch[1].split("-").join(" ");
    return {
      title: `${slugLabel} — Bhagavad Gita Guidance | ${SITE_NAME}`,
      description: topic?.shortDescription || `Bhagavad Gita verses and chapter guidance for ${slugLabel}.`,
      url: `${BASE_URL}/topics/${topicsHubMatch[1]}`,
      image: DEFAULT_IMAGE,
      type: "article",
    };
  }

  if (chapterMatch) {
    const chNum = parseInt(chapterMatch[1]);
    const chapter = data.chapters.find((c) => c.chapter === chNum);
    const chapterName = chapter?.name || "";
    const devName = chapter?.devanagari_name || chapter?.name_hindi || "";
    const iastName = chapter?.iast_name || chapter?.name || "";
    const chapterTitle = `Bhagavad Gita Chapter ${chNum} — ${chapterName} (${devName}, ${iastName})`;

    return {
      title: `${chapterTitle} | ${SITE_NAME}`,
      description:
        chapter?.generated_description ||
        chapter?.summary ||
        `${chapter?.subtitle || ""} — Explore ${chapter?.verses_count || ""} verses of Chapter ${chNum} of the Bhagavad Gita.`,
      url: `${BASE_URL}/chapter/${chNum}`,
      image: getChapterImage(chNum, data) || DEFAULT_IMAGE,
      type: "article",
    };
  }

  if (urlPath !== "/") {
    return {
      title: `Page Not Found | ${SITE_NAME}`,
      description: "The requested Bhagavad Gita page was not found.",
      url: `${BASE_URL}${urlPath}`,
      image: DEFAULT_IMAGE,
      type: "website",
      noindex: true,
    };
  }

  // Home page
  return {
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    url: BASE_URL,
    image: DEFAULT_IMAGE,
    type: "website",
  };
}

function getChapterImage(chNum: number, data: GitaData): string | null {
  const chapter = data.chapters.find((c) => c.chapter === chNum);
  const verses = chNum === 6 ? data.chapter6_full : chapter?.key_verses || [];
  if (chNum === 12) {
    const v2 = verses.find(v => v.verse === 2);
    if (v2) { const img = getVerseImage(v2); if (img) return img; }
  }
  for (const v of verses) {
    const img = getVerseImage(v);
    if (img) return img;
  }
  return null;
}

export function injectMetaTags(html: string, meta: MetaTags): string {
  const safeTitle = escapeHtml(meta.title);
  const safeDesc = escapeHtml(meta.description);
  const safeUrl = escapeHtml(meta.url);
  const safeImage = escapeHtml(meta.image);

  let result = html;

  result = result.replace(
    /<title>[^<]*<\/title>/,
    `<title>${safeTitle}</title>`
  );

  result = result.replace(
    /<meta name="description" content="[^"]*"/,
    `<meta name="description" content="${safeDesc}"`
  );

  const robotsValue = meta.noindex ? "noindex, nofollow" : "index, follow";
  if (/<meta name="robots" content="[^"]*"/.test(result)) {
    result = result.replace(
      /<meta name="robots" content="[^"]*"/,
      `<meta name="robots" content="${robotsValue}"`
    );
  } else {
    result = result.replace(
      "</head>",
      `  <meta name="robots" content="${robotsValue}" />\n</head>`
    );
  }

  result = result.replace(
    /<link rel="canonical" href="[^"]*"/,
    `<link rel="canonical" href="${safeUrl}"`
  );

  // OG tags
  result = result.replace(
    /<meta property="og:title" content="[^"]*"/,
    `<meta property="og:title" content="${safeTitle}"`
  );
  result = result.replace(
    /<meta property="og:description" content="[^"]*"/,
    `<meta property="og:description" content="${safeDesc}"`
  );
  result = result.replace(
    /<meta property="og:url" content="[^"]*"/,
    `<meta property="og:url" content="${safeUrl}"`
  );
  result = result.replace(
    /<meta property="og:image" content="[^"]*"/,
    `<meta property="og:image" content="${safeImage}"`
  );
  result = result.replace(
    /<meta property="og:type" content="[^"]*"/,
    `<meta property="og:type" content="${escapeHtml(meta.type)}"`
  );

  // Twitter tags
  result = result.replace(
    /<meta name="twitter:title" content="[^"]*"/,
    `<meta name="twitter:title" content="${safeTitle}"`
  );
  result = result.replace(
    /<meta name="twitter:description" content="[^"]*"/,
    `<meta name="twitter:description" content="${safeDesc}"`
  );
  result = result.replace(
    /<meta name="twitter:image" content="[^"]*"/,
    `<meta name="twitter:image" content="${safeImage}"`
  );

  if (meta.image !== DEFAULT_IMAGE) {
    const imgType = meta.image.includes('.webp') ? 'image/webp'
      : meta.image.includes('.jpg') || meta.image.includes('.jpeg') ? 'image/jpeg'
      : 'image/png';
    result = result.replace(
      /<meta property="og:image:type" content="[^"]*"/,
      `<meta property="og:image:type" content="${imgType}"`
    );
    result = result.replace(
      /<meta property="og:image:width" content="[^"]*"/,
      `<meta property="og:image:width" content="1200"`
    );
    result = result.replace(
      /<meta property="og:image:height" content="[^"]*"/,
      `<meta property="og:image:height" content="630"`
    );
  }

  return result;
}

export function generateSitemap(data: GitaData): string {
  const urls: { loc: string; priority: string; changefreq: string }[] = [];

  urls.push({ loc: BASE_URL, priority: "1.0", changefreq: "weekly" });
  urls.push({ loc: `${BASE_URL}/topics`, priority: "0.7", changefreq: "weekly" });
  for (const topic of TOPIC_HUBS) {
    urls.push({ loc: `${BASE_URL}/topics/${topic.slug}`, priority: "0.7", changefreq: "monthly" });
  }

  for (const chapter of data.chapters) {
    urls.push({
      loc: `${BASE_URL}/chapter/${chapter.chapter}`,
      priority: "0.8",
      changefreq: "weekly",
    });

    const verses =
      chapter.chapter === 6 ? data.chapter6_full : chapter.key_verses;
    for (const verse of verses) {
      urls.push({
        loc: `${BASE_URL}/chapter/${chapter.chapter}/verse/${verse.verse}`,
        priority: "0.6",
        changefreq: "monthly",
      });
    }

    urls.push({
      loc: `${BASE_URL}/chapter/${chapter.chapter}/summary`,
      priority: "0.7",
      changefreq: "monthly",
    });

    if (chapter.chapter === 6) {
      urls.push({
        loc: `${BASE_URL}/chapter/6/games`,
        priority: "0.5",
        changefreq: "monthly",
      });
    }
  }

  const urlEntries = urls
    .map(
      (u) => `  <url>
    <loc>${escapeHtml(u.loc)}</loc>
    <lastmod>${cachedDataLastMod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

export function generateRobotsTxt(): string {
  return `User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`;
}
