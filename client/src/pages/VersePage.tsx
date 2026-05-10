import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { Link, useParams, useLocation, Redirect } from "wouter";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import { ImageModal } from "@/components/ImageModal";
import { useChapterVisibility } from "@/contexts/ChapterVisibilityContext";
import EditableImage from "@/components/EditableImage";
import { useImageUrl } from "@/hooks/useImages";
import gitaData from "@/data/gitaData.json";
import type { GitaData, Verse } from "@/types/gita";
import { SandhiText } from "@/components/SandhiText";
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Sparkles,
  BookMarked,
  Lightbulb,
  Baby,
  GraduationCap,
  MessageCircle,
  Library,
  FlameKindling,
  Volume2,
  VolumeX,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { getChapterDisplayNames } from "@/lib/chapterContent";
import { getChapterIntentTerms } from "@/lib/seoKeywords";
import {
  stripTransliterationVerseSuffix,
  splitVerseLines,
} from "@/lib/transliterationDisplay";
import { navigateWithViewTransition } from "@/lib/navigateWithViewTransition";
import { cn } from "@/lib/utils";

const data = gitaData as unknown as GitaData;

/**
 * Meaning tab only (when image + meaning_detail both exist):
 * `lg+`: image floats left; text wraps beside it, then continues full width below.
 * `false`: original stacked layout (full-width image, then full text in separate card).
 */
const MEANING_TAB_FLOAT_WRAP_LAYOUT = true;

/**
 * Story tab (when first story image + story body both exist):
 * `lg+`: first illustration floats left; narrative wraps beside it like Meaning tab.
 * Second story image (if any) stays full width below the card.
 */
const STORY_TAB_FLOAT_WRAP_LAYOUT = true;

/**
 * Impact on Life tab (when `modern_life` image + `real_life_example` both exist):
 * `lg+`: image floats left; text wraps beside it like Meaning / Story.
 */
const IMPACT_TAB_FLOAT_WRAP_LAYOUT = true;

/**
 * Detailed Meaning tab (when `detailed_meaning` image + step/sentence body both exist):
 * `lg+`: image floats left; text wraps beside it like Meaning / Story / Impact.
 */
const DETAILED_TAB_FLOAT_WRAP_LAYOUT = true;

/**
 * Kids Corner — explanation + kids illustration, and kids story + illustration:
 * `lg+`: image floats left; text wraps beside it when the matching image exists.
 */
const KIDS_TAB_FLOAT_WRAP_LAYOUT = true;

/**
 * More Stories tab — each numbered story: when `more_stories[i]` image + body exist,
 * `lg+`: image floats left; narrative wraps beside it like other illustration tabs.
 */
const MORE_STORIES_TAB_FLOAT_WRAP_LAYOUT = true;
// Reversible experiment: set to false to disable shared-element verse transitions.
const ENABLE_VERSE_SHARED_TRANSITION_EXPERIMENT = true;

function verseTransitionName(chapterNum: number, verseNum: number, part: "thumb" | "chip") {
  if (!ENABLE_VERSE_SHARED_TRANSITION_EXPERIMENT) return undefined;
  return `verse-${part}-${chapterNum}-${verseNum}`;
}

type Tab =
  | "meaning"
  | "story"
  | "impact"
  | "reflection"
  | "detailed"
  | "kids"
  | "grammar"
  | "more_stories";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "meaning", label: "Meaning", icon: <Star size={16} /> },
  { id: "story", label: "Story", icon: <BookMarked size={16} /> },
  { id: "impact", label: "Impact on Life", icon: <Lightbulb size={16} /> },
  { id: "reflection", label: "Reflection", icon: <MessageCircle size={16} /> },
  { id: "detailed", label: "Detailed Meaning", icon: <Sparkles size={16} /> },
  { id: "kids", label: "Kids Corner", icon: <Baby size={16} /> },
  { id: "grammar", label: "Grammar", icon: <GraduationCap size={16} /> },
  { id: "more_stories", label: "More Stories", icon: <Library size={16} /> },
];

function isTab(value: string | null): value is Tab {
  return value != null && TABS.some(tab => tab.id === value);
}

/** Tabs that have content for this verse (same rules as the tab strip). */
function getAvailableTabsForVerse(verse: Verse) {
  return TABS.filter(tab => {
    if (tab.id === "story") return !!verse.story;
    if (tab.id === "impact") return !!verse.real_life_example;
    if (tab.id === "reflection") return !!verse.reflection;
    if (tab.id === "detailed")
      return !!(verse.detailed_meaning || verse.full_journey_text);
    if (tab.id === "grammar")
      return !!(verse.grammar_notes || verse.rich_grammar);
    if (tab.id === "more_stories") return !!verse.more_stories;
    return true;
  });
}

function formatText(text: string) {
  if (!text) return null;
  return text.split("\n").map((line, i) => {
    if (!line.trim()) return <br key={i} />;
    if (/^Step \d+/.test(line)) {
      return (
        <h5
          key={i}
          className="font-semibold text-red-800 mt-4 mb-2 text-lg border-l-2 border-orange-400 pl-3"
        >
          {line}
        </h5>
      );
    }
    if (/^\d+\.\s/.test(line) && line.length < 80) {
      return (
        <h5 key={i} className="font-semibold text-red-800 mt-4 mb-2 text-lg">
          {line}
        </h5>
      );
    }
    if (/^Phrase:/.test(line.trim())) {
      return (
        <p key={i} className="my-2 text-lg leading-relaxed font-bold text-foreground">
          {line}
        </p>
      );
    }
    return (
      <p key={i} className="my-2 text-lg leading-relaxed">
        {line}
      </p>
    );
  });
}

/**
 * Split narrative vs. closing takeaway (backlog #100).
 * Prefer `\n\n` blocks; most `gitaData` story/more_stories bodies use only `\n` between paragraphs, so fall back to last line.
 */
function splitLeadingAndTakeawayParagraphs(text: string): {
  lead: string;
  takeaway: string | null;
} {
  const normalized = text.trim();
  if (!normalized) {
    return { lead: "", takeaway: null };
  }

  const doubleBreakParts = normalized
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(Boolean);
  if (doubleBreakParts.length >= 2) {
    const takeaway = doubleBreakParts[doubleBreakParts.length - 1]!;
    const lead = doubleBreakParts.slice(0, -1).join("\n\n");
    return { lead, takeaway };
  }

  const lines = normalized
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);
  if (lines.length >= 2) {
    const takeaway = lines[lines.length - 1]!;
    const lead = lines.slice(0, -1).join("\n");
    return { lead, takeaway };
  }

  return { lead: normalized, takeaway: null };
}

function StoryTakeawayCallout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-6 clear-left flex gap-3 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-yellow-50/90 to-orange-50/80 p-4 lg:p-5 shadow-md ring-1 ring-amber-200/70"
      role="note"
      aria-label="Connection to this shloka"
    >
      <span
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-amber-400/30 text-amber-800 shadow-inner"
        aria-hidden
      >
        <Lightbulb size={22} strokeWidth={2.25} />
      </span>
      <div className="min-w-0 flex-1 text-amber-950 text-lg leading-relaxed [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
        {children}
      </div>
    </div>
  );
}

/** Renders story body with the final paragraph/line highlighted as the shloka takeaway. */
function formatStoryWithTakeaway(text: string) {
  const { lead, takeaway } = splitLeadingAndTakeawayParagraphs(text);
  return (
    <>
      {formatText(lead)}
      {takeaway != null ? (
        <StoryTakeawayCallout>{formatText(takeaway)}</StoryTakeawayCallout>
      ) : null}
    </>
  );
}

function VerseImage({
  imageKey,
  url,
  caption,
  layout = "default",
}: {
  imageKey: string;
  url: string;
  caption?: string;
  /**
   * `meaning_float`: taller `object-contain` preview inside a float-left wrapper (Meaning tab).
   * `contain_preview`: full-width block; shows whole image (`object-contain`) with a taller cap on large screens (e.g. second Story tab image).
   */
  layout?: "default" | "meaning_float" | "contain_preview";
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const resolvedUrl = useImageUrl(imageKey, url);
  const openModal = useCallback(() => setModalOpen(true), []);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    openModal();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    e.preventDefault();
    openModal();
  };

  const floatPreview = layout === "meaning_float";
  const containPreview = layout === "contain_preview";

  return (
    <>
      <div
        className={cn(
          "cursor-pointer group/verse-img rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2",
          floatPreview && "w-full"
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={
          caption
            ? `Open full illustration. ${caption}`
            : "Open full illustration — tap or click the preview to see the uncropped image."
        }
      >
        <EditableImage
          imageKey={imageKey}
          fallbackUrl={url}
          alt={caption || "Verse illustration"}
          caption={caption}
          className={cn(
            "rounded-2xl overflow-hidden border border-border shadow-md",
            floatPreview ? "my-0" : "my-4 mb-0"
          )}
          imgClassName={
            floatPreview
              ? "w-full max-h-64 object-contain bg-muted/40 lg:max-h-[min(58vh,520px)]"
              : containPreview
                ? "w-full max-h-80 object-contain bg-muted/40 sm:max-h-96 lg:max-h-[min(62vh,640px)]"
                : "w-full object-cover max-h-72"
          }
        />
        <p className="text-center text-[11px] sm:text-xs text-muted-foreground px-3 pb-3 pt-1 leading-snug group-hover/verse-img:text-foreground/75 transition-colors">
          Tap or click the image to view the full illustration.
        </p>
      </div>
      {modalOpen && (
        <ImageModal
          src={resolvedUrl}
          alt={caption || "Verse illustration"}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

function parseMoreStories(text: string): { title: string; body: string }[] {
  const stories: { title: string; body: string }[] = [];
  const lines = text.split("\n");
  let current: { title: string; body: string } | null = null;
  for (const line of lines) {
    if (/^\d+\.\s/.test(line) && line.length < 120) {
      if (current) stories.push(current);
      current = { title: line.replace(/^\d+\.\s*/, "").trim(), body: "" };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    }
  }
  if (current) stories.push(current);
  return stories;
}

export default function VersePage() {
  const params = useParams<{ chapterNum: string; verseNum: string }>();
  const chapterNum = parseInt(params.chapterNum || "1");
  const verseNum = parseInt(params.verseNum || "1");
  const [activeTab, setActiveTab] = useState<Tab>("meaning");
  const [kidsMode, setKidsMode] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioMuted, setAudioMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [verseHeaderImageModalOpen, setVerseHeaderImageModalOpen] =
    useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tabNavRef = useRef<HTMLDivElement | null>(null);

  const [, setLocation] = useLocation();

  const applyTabFromLocation = useCallback((): Tab => {
    const chapter = data.chapters.find(c => c.chapter === chapterNum);
    const verses: Verse[] =
      chapterNum === 6 ? data.chapter6_full : chapter?.key_verses || [];
    const verse = verses.find(v => v.verse === verseNum);
    const requestedRaw = new URLSearchParams(window.location.search).get("tab");
    let nextTab: Tab = isTab(requestedRaw) ? requestedRaw : "meaning";
    if (verse) {
      const availIds = new Set(getAvailableTabsForVerse(verse).map(t => t.id));
      if (!availIds.has(nextTab)) nextTab = "meaning";
    }
    setActiveTab(nextTab);
    const desiredUrl =
      `/chapter/${chapterNum}/verse/${verseNum}` +
      (nextTab === "meaning" ? "" : `?tab=${encodeURIComponent(nextTab)}`);
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== desiredUrl) {
      window.history.replaceState(null, "", desiredUrl);
    }
    return nextTab;
  }, [chapterNum, verseNum]);

  const selectTab = useCallback(
    (tabId: Tab) => {
      setActiveTab(tabId);
      const path = `/chapter/${chapterNum}/verse/${verseNum}`;
      const search =
        tabId === "meaning" ? "" : `?tab=${encodeURIComponent(tabId)}`;
      window.history.replaceState(null, "", `${path}${search}`);
    },
    [chapterNum, verseNum],
  );

  /** Prev/next / dropdowns: same tab in URL; `applyTabFromLocation` corrects if the target verse lacks that tab. */
  const verseLocationWithCurrentTab = useCallback(
    (targetChapter: number, targetVerseNum: number) => {
      const base = `/chapter/${targetChapter}/verse/${targetVerseNum}`;
      if (activeTab === "meaning") return base;
      return `${base}?tab=${encodeURIComponent(activeTab)}`;
    },
    [activeTab],
  );

  useEffect(() => {
    applyTabFromLocation();
    // Keep the top of the shloka (title/header) in view; do not auto-scroll to the tab strip on prev/next or reload.
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
      audioRef.current = null;
    }
    setAudioPlaying(false);
    setAudioDuration(0);
    setAudioCurrentTime(0);
    setAudioMuted(false);
    setPlaybackSpeed(1);
    setShowSpeedMenu(false);
    setVerseHeaderImageModalOpen(false);
  }, [chapterNum, verseNum, applyTabFromLocation]);

  useEffect(() => {
    const onPopState = () => {
      applyTabFromLocation();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyTabFromLocation]);

  useEffect(() => {
    const chapter = data.chapters.find(c => c.chapter === chapterNum);
    const verses: Verse[] =
      chapterNum === 6 ? data.chapter6_full : chapter?.key_verses || [];
    const v = verses.find(x => x.verse === verseNum);
    const url = v?.audio_url;
    if (!url) return;

    const a = new Audio();
    a.crossOrigin = "anonymous";
    a.preload = "metadata";

    const applyDuration = () => {
      const d = a.duration;
      if (Number.isFinite(d) && d > 0 && d !== Number.POSITIVE_INFINITY) {
        setAudioDuration(d);
      }
    };

    a.addEventListener("loadedmetadata", applyDuration);
    a.addEventListener("durationchange", applyDuration);
    a.src = url;
    a.load();

    return () => {
      a.removeEventListener("loadedmetadata", applyDuration);
      a.removeEventListener("durationchange", applyDuration);
      a.pause();
      a.removeAttribute("src");
      a.load();
    };
  }, [chapterNum, verseNum]);

  const initAudio = useCallback((url: string) => {
    if (audioRef.current) return audioRef.current;
    const a = new Audio();
    a.crossOrigin = "anonymous";
    a.preload = "metadata";
    a.addEventListener("loadedmetadata", () => {
      const d = a.duration;
      if (Number.isFinite(d) && d > 0 && d !== Number.POSITIVE_INFINITY) {
        setAudioDuration(d);
      }
    });
    a.addEventListener("timeupdate", () => setAudioCurrentTime(a.currentTime));
    a.addEventListener("ended", () => {
      setAudioPlaying(false);
      setAudioCurrentTime(0);
    });
    a.addEventListener("error", () => {
      setAudioPlaying(false);
    });
    a.src = url;
    audioRef.current = a;
    return a;
  }, []);

  function toggleAudio(url: string) {
    const a = initAudio(url);
    if (audioPlaying) {
      a.pause();
      setAudioPlaying(false);
    } else {
      a.play().catch(() => setAudioPlaying(false));
      setAudioPlaying(true);
    }
  }

  function seekAudio(time: number) {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setAudioCurrentTime(time);
    }
  }

  function skipAudio(delta: number) {
    if (audioRef.current) {
      const t = Math.max(
        0,
        Math.min(
          audioRef.current.duration || 0,
          audioRef.current.currentTime + delta
        )
      );
      audioRef.current.currentTime = t;
      setAudioCurrentTime(t);
    }
  }

  function toggleMute() {
    if (audioRef.current) {
      audioRef.current.muted = !audioRef.current.muted;
      setAudioMuted(!audioMuted);
    }
  }

  function changeSpeed(speed: number) {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
  }

  const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const { isChapterVisible, loading: visibilityLoading } = useChapterVisibility();
  const chapter = data.chapters.find(c => c.chapter === chapterNum);
  const verses: Verse[] =
    chapterNum === 6 ? data.chapter6_full : chapter?.key_verses || [];
  const verse = verses.find(v => v.verse === verseNum);
  const verseIndex = verses.findIndex(v => v.verse === verseNum);

  const verseHeaderImageMeta = useMemo(() => {
    if (!verse) return null;
    const cn = chapterNum;
    const vn = verseNum;
    const imgs = verse.images;
    if (imgs?.meaning?.url) {
      return { key: `ch${cn}_v${vn}_meaning`, url: imgs.meaning.url };
    }
    if (imgs?.detailed_meaning?.url) {
      return {
        key: `ch${cn}_v${vn}_detailed_meaning`,
        url: imgs.detailed_meaning.url,
      };
    }
    const storyImgs = imgs?.story;
    const story0 = Array.isArray(storyImgs)
      ? storyImgs[0]?.url
      : (storyImgs as { url?: string } | undefined)?.url;
    if (story0) {
      return { key: `ch${cn}_v${vn}_story_0`, url: story0 };
    }
    if (imgs?.modern_life?.url) {
      return { key: `ch${cn}_v${vn}_modern_life`, url: imgs.modern_life.url };
    }
    if (imgs?.kids_explain?.url) {
      return { key: `ch${cn}_v${vn}_kids_explain`, url: imgs.kids_explain.url };
    }
    if (imgs?.kids_story?.url) {
      return { key: `ch${cn}_v${vn}_kids_story`, url: imgs.kids_story.url };
    }
    return null;
  }, [verse, chapterNum, verseNum]);

  const resolvedVerseHeaderImage = useImageUrl(
    verseHeaderImageMeta?.key ?? "",
    verseHeaderImageMeta?.url ?? ""
  );

  if (visibilityLoading) return <Layout><div className="p-8 text-center text-muted-foreground">Loading…</div></Layout>;
  if (!isChapterVisible(chapterNum)) return <Redirect to="/" />;

  if (!chapter || !verse) {
    return (
      <Layout>
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Verse not found.</p>
          <Link
            href={`/chapter/${chapterNum}`}
            className="text-orange-600 hover:underline mt-2 inline-block touch-manipulation"
            onClick={e => {
              e.preventDefault();
              navigateWithViewTransition(() =>
                setLocation(`/chapter/${chapterNum}`)
              );
            }}
          >
            ← Back to Chapter {chapterNum}
          </Link>
        </div>
      </Layout>
    );
  }

  const prevVerse = verseIndex > 0 ? verses[verseIndex - 1] : null;
  const nextVerse =
    verseIndex < verses.length - 1 ? verses[verseIndex + 1] : null;
  const { iastName } = getChapterDisplayNames(chapter);

  const availableTabs = getAvailableTabsForVerse(verse);

  const moreStoriesParsed = verse.more_stories
    ? parseMoreStories(verse.more_stories)
    : [];
  const intentTerms = getChapterIntentTerms(chapterNum);

  const verseTitle = `Bhagavad Gita ${chapterNum}.${verseNum} — ${iastName}${verse.title ? ` — ${verse.title}` : ""}`;
  const verseDescription =
    verse.one_line_meaning ||
    verse.concise_journey ||
    `Bhagavad Gita Chapter ${chapterNum} Verse ${verseNum} — Sanskrit shloka with transliteration, meaning, stories, and grammar analysis for ${intentTerms.slice(0, 3).join(", ")}.`;

  return (
    <Layout
      kidsMode={kidsMode}
      onToggleKids={() => setKidsMode(!kidsMode)}
      stickyHeader={false}
    >
      <SEO
        title={verseTitle}
        description={verseDescription}
        path={`/chapter/${chapterNum}/verse/${verseNum}`}
        image={resolvedVerseHeaderImage || undefined}
        type="article"
        structuredData={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Article",
              name: verseTitle,
              headline: `Bhagavad Gita ${chapterNum}.${verseNum}${verse.title ? ` — ${verse.title}` : ""}`,
              description: verseDescription,
              url: `https://gita.gurukula.com/chapter/${chapterNum}/verse/${verseNum}`,
              keywords: intentTerms.join(", "),
              isPartOf: {
                "@type": "WebSite",
                name: "Bhagavad Gita - Gurukula.com",
                url: "https://gita.gurukula.com",
              },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Home",
                  item: "https://gita.gurukula.com/",
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: `Chapter ${chapterNum}`,
                  item: `https://gita.gurukula.com/chapter/${chapterNum}`,
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: `Shloka ${verseNum}`,
                  item: `https://gita.gurukula.com/chapter/${chapterNum}/verse/${verseNum}`,
                },
              ],
            },
          ],
        }}
      />
      {/* Verse Header — compact (#26) */}
      <div className="bg-gradient-to-b from-orange-50 to-amber-50 border-b border-orange-200 px-4 py-4 lg:py-6">
        {/* Breadcrumb — "Shloka" instead of "Verse" (#26.2) */}
        <div className="flex items-center gap-1.5 text-orange-700 text-sm mb-3 flex-wrap">
          <Link
            href="/"
            className="hover:text-orange-900 transition-colors touch-manipulation"
            onClick={e => {
              e.preventDefault();
              navigateWithViewTransition(() => setLocation("/"));
            }}
          >
            Home
          </Link>
          <ChevronRight size={12} />
          <Link
            href={`/chapter/${chapterNum}`}
            className="hover:text-orange-900 transition-colors touch-manipulation"
            onClick={e => {
              e.preventDefault();
              navigateWithViewTransition(() =>
                setLocation(`/chapter/${chapterNum}`)
              );
            }}
          >
            Chapter {chapterNum}
          </Link>
          <ChevronRight size={12} />
          <span className="text-orange-900 font-semibold">
            Shloka {verseNum}
          </span>
        </div>

        <div>
          {/* Title: iastName · chapter.verse */}
          <div className="flex gap-3 mb-3 items-stretch">
            {resolvedVerseHeaderImage && (
              <>
                <div
                  role="button"
                  tabIndex={0}
                  className="w-[5.25rem] sm:w-32 flex-shrink-0 self-stretch min-h-[5.5rem] cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 group/verse-header-img"
                  onClick={() => setVerseHeaderImageModalOpen(true)}
                  onKeyDown={(e: KeyboardEvent) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    setVerseHeaderImageModalOpen(true);
                  }}
                  aria-label="Open shloka illustration full screen"
                >
                  <img
                    src={resolvedVerseHeaderImage}
                    alt=""
                    className="h-full w-full min-h-[5.5rem] rounded-xl object-cover border border-orange-200 shadow-sm transition-opacity [@media(hover:hover)]:group-hover/verse-header-img:opacity-90"
                    style={
                      ENABLE_VERSE_SHARED_TRANSITION_EXPERIMENT
                        ? ({
                            viewTransitionName: verseTransitionName(
                              chapterNum,
                              verseNum,
                              "thumb"
                            ),
                          } as CSSProperties)
                        : undefined
                    }
                  />
                </div>
                {verseHeaderImageModalOpen && (
                  <ImageModal
                    src={resolvedVerseHeaderImage}
                    alt={`Bhagavad Gita ${chapterNum}.${verseNum} illustration`}
                    onClose={() => setVerseHeaderImageModalOpen(false)}
                  />
                )}
              </>
            )}
            <div className="min-w-0 flex-1 flex flex-col justify-center items-start gap-1">
              <p
                className="bg-red-900 text-orange-100 text-lg sm:text-xl md:text-2xl font-bold tracking-wide px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg w-fit max-w-full"
                style={
                  ENABLE_VERSE_SHARED_TRANSITION_EXPERIMENT
                    ? ({
                        viewTransitionName: verseTransitionName(
                          chapterNum,
                          verseNum,
                          "chip"
                        ),
                      } as CSSProperties)
                    : undefined
                }
              >
                {iastName} · {chapterNum}.{verseNum}
              </p>
              {verse.title && (
                <p className="text-orange-900 text-lg font-display font-bold w-fit max-w-full">
                  {verse.title}
                </p>
              )}
            </div>
          </div>

          {/* Prev / Dropdowns / Next Shloka navigation */}
          <div className="flex items-center justify-between gap-2 mb-3">
            {prevVerse ? (
              <Link
                href={verseLocationWithCurrentTab(chapterNum, prevVerse.verse)}
                onClick={e => {
                  e.preventDefault();
                  navigateWithViewTransition(() =>
                    setLocation(
                      verseLocationWithCurrentTab(chapterNum, prevVerse.verse)
                    )
                  );
                }}
              >
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 border border-orange-300 transition-all touch-manipulation"
                >
                  <ChevronLeft size={16} />
                  <span className="hidden sm:inline">Prev Shloka</span>
                  <span className="sm:hidden">Prev</span>
                </button>
              </Link>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <select
                value={chapterNum}
                onChange={e => {
                  const ch = parseInt(e.target.value);
                  navigateWithViewTransition(() =>
                    setLocation(verseLocationWithCurrentTab(ch, 1))
                  );
                }}
                className="px-2 py-1.5 rounded-lg text-sm font-semibold text-orange-800 bg-orange-100 border border-orange-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {data.chapters
                  .filter(c => isChapterVisible(c.chapter))
                  .map(c => (
                    <option key={c.chapter} value={c.chapter}>
                      Ch. {c.chapter}
                    </option>
                  ))}
              </select>
              <select
                value={verseNum}
                onChange={e => {
                  const v = parseInt(e.target.value);
                  navigateWithViewTransition(() =>
                    setLocation(verseLocationWithCurrentTab(chapterNum, v))
                  );
                }}
                className="px-2 py-1.5 rounded-lg text-sm font-semibold text-orange-800 bg-orange-100 border border-orange-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {verses.map(v => (
                  <option key={v.verse} value={v.verse}>
                    Shloka {v.verse}
                  </option>
                ))}
              </select>
            </div>

            {nextVerse ? (
              <Link
                href={verseLocationWithCurrentTab(chapterNum, nextVerse.verse)}
                onClick={e => {
                  e.preventDefault();
                  navigateWithViewTransition(() =>
                    setLocation(
                      verseLocationWithCurrentTab(chapterNum, nextVerse.verse)
                    )
                  );
                }}
              >
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 border border-orange-300 transition-all touch-manipulation"
                >
                  <span className="hidden sm:inline">Next Shloka</span>
                  <span className="sm:hidden">Next</span>
                  <ChevronRight size={16} />
                </button>
              </Link>
            ) : (
              <div />
            )}
          </div>

          {/* Shloka + IAST side-by-side on md+, stacked on mobile */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch">
            {/* Devanagari Shloka — reduced padding (#26.4), smaller mobile font (#26.1) */}
            <div className="bg-gradient-to-br from-red-900 to-red-800 rounded-2xl p-3 lg:p-5 shadow-md w-full md:flex-1 flex flex-col">
              <div className="font-devanagari text-orange-100 text-xl lg:text-3xl flex-1">
                {splitVerseLines(verse.sanskrit).map((line, i) => (
                  <p key={i} className="leading-loose">
                    <SandhiText text={line} sandhiClass="text-orange-400/95" />
                  </p>
                ))}
              </div>
              {verse.audio_url && (
                <div className="mt-3 bg-orange-100 rounded-xl p-2.5">
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <button
                      onClick={() => skipAudio(-5)}
                      className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-orange-700 hover:bg-orange-200 transition-all"
                      title="Rewind 5s"
                    >
                      <RotateCcw size={20} strokeWidth={2.25} />
                    </button>
                    <button
                      onClick={() => toggleAudio(verse.audio_url!)}
                      className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                        audioPlaying
                          ? "bg-orange-600 text-white shadow-lg"
                          : "bg-orange-500 text-white hover:bg-orange-600"
                      }`}
                    >
                      {audioPlaying ? (
                        <Pause size={24} />
                      ) : (
                        <Play size={24} className="ml-0.5" />
                      )}
                    </button>
                    <button
                      onClick={() => skipAudio(5)}
                      className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-orange-700 hover:bg-orange-200 transition-all"
                      title="Forward 5s"
                    >
                      <RotateCw size={20} strokeWidth={2.25} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <input
                        type="range"
                        min={0}
                        max={audioDuration || 0}
                        step={0.1}
                        value={audioCurrentTime}
                        onChange={e => seekAudio(parseFloat(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-orange-200
                          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-600 [&::-webkit-slider-thumb]:shadow-md
                          [&::-webkit-slider-thumb]:hover:bg-orange-500 [&::-webkit-slider-thumb]:transition-colors
                          [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full
                          [&::-moz-range-thumb]:bg-orange-600 [&::-moz-range-thumb]:border-0"
                        style={{
                          background: audioDuration
                            ? `linear-gradient(to right, rgb(234 88 12) ${(audioCurrentTime / audioDuration) * 100}%, rgb(254 215 170) ${(audioCurrentTime / audioDuration) * 100}%)`
                            : "rgb(254 215 170)",
                        }}
                      />
                      <div className="flex justify-between text-xs text-orange-600 mt-0.5 px-0.5 tabular-nums">
                        <span>{formatTime(audioCurrentTime)}</span>
                        <span>
                          {audioDuration ? formatTime(audioDuration) : "—:——"}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={toggleMute}
                      className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-orange-700 hover:bg-orange-200 transition-all"
                      title={audioMuted ? "Unmute" : "Mute"}
                    >
                      {audioMuted ? (
                        <VolumeX size={18} strokeWidth={2.25} />
                      ) : (
                        <Volume2 size={18} strokeWidth={2.25} />
                      )}
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                        className="flex-shrink-0 min-w-[2.75rem] px-2 py-1 rounded-lg text-sm font-bold text-orange-700 bg-orange-200 hover:bg-orange-300 transition-all"
                        title="Playback speed"
                      >
                        {playbackSpeed}x
                      </button>
                      {showSpeedMenu && (
                        <div className="absolute bottom-full right-0 mb-2 bg-white border border-orange-200 rounded-lg shadow-lg py-1 z-50 min-w-[70px]">
                          {SPEED_OPTIONS.map(speed => (
                            <button
                              key={speed}
                              onClick={() => changeSpeed(speed)}
                              className={`w-full text-left px-3 py-1 text-sm transition-colors ${
                                playbackSpeed === speed
                                  ? "bg-orange-100 text-orange-800 font-bold"
                                  : "text-gray-700 hover:bg-orange-50"
                              }`}
                            >
                              {speed}x
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* IAST (distinct panel) + one-line meaning */}
            {verse.transliteration && (
              <div className="w-full md:flex-1 flex flex-col rounded-2xl border border-orange-200 overflow-hidden shadow-sm">
                <div className="bg-white px-4 py-4 flex-1">
                  <div className="transliteration-text text-orange-900 text-lg lg:text-xl italic">
                    {splitVerseLines(verse.transliteration).map((line, i) => (
                      <p key={i} className="leading-relaxed md:leading-loose">
                        <SandhiText
                          text={stripTransliterationVerseSuffix(line)}
                        />
                      </p>
                    ))}
                  </div>
                </div>
                <div className="bg-orange-50/95 px-4 py-3 border-t border-orange-200">
                  <p className="text-orange-900 text-base lg:text-lg leading-relaxed font-medium">
                    "{verse.one_line_meaning}"
                  </p>
                </div>
              </div>
            )}
          </div>

          {!verse.transliteration && (
            <p className="mt-3 text-orange-900 text-base lg:text-lg leading-relaxed font-medium">
              "{verse.one_line_meaning}"
            </p>
          )}
        </div>
      </div>

      {/* Tab Navigation — sticky at viewport top on mobile (document scroll), at top in desktop scroll container (#56) */}
      <div
        ref={tabNavRef}
        className="sticky top-0 z-30 bg-white border-b border-border shadow-sm"
      >
        <div className="px-2 py-0.5">
          <div
            className="grid gap-0.5"
            style={{
              gridTemplateColumns: `repeat(${Math.ceil(availableTabs.length / 2)}, 1fr)`,
            }}
          >
            {availableTabs
              .slice(0, Math.ceil(availableTabs.length / 2))
              .map(tab => (
                <button
                  key={tab.id}
                  onClick={() => selectTab(tab.id)}
                  className={`
                  flex flex-col items-center gap-0.5 px-1 py-2 text-xs font-semibold rounded-lg transition-all
                  ${
                    activeTab === tab.id
                      ? "bg-orange-50 text-orange-700 border border-orange-300"
                      : "text-muted-foreground hover:text-foreground hover:bg-gray-50"
                  }
                `}
                >
                  <span
                    className={
                      activeTab === tab.id ? "text-orange-600" : "text-gray-400"
                    }
                  >
                    {tab.icon}
                  </span>
                  <span className="leading-tight text-center">{tab.label}</span>
                </button>
              ))}
          </div>
          <div
            className="grid gap-0.5 mt-0.5"
            style={{
              gridTemplateColumns: `repeat(${availableTabs.length - Math.ceil(availableTabs.length / 2)}, 1fr)`,
            }}
          >
            {availableTabs
              .slice(Math.ceil(availableTabs.length / 2))
              .map(tab => (
                <button
                  key={tab.id}
                  onClick={() => selectTab(tab.id)}
                  className={`
                  flex flex-col items-center gap-0.5 px-1 py-2 text-xs font-semibold rounded-lg transition-all
                  ${
                    activeTab === tab.id
                      ? "bg-orange-50 text-orange-700 border border-orange-300"
                      : "text-muted-foreground hover:text-foreground hover:bg-gray-50"
                  }
                `}
                >
                  <span
                    className={
                      activeTab === tab.id ? "text-orange-600" : "text-gray-400"
                    }
                  >
                    {tab.icon}
                  </span>
                  <span className="leading-tight text-center">{tab.label}</span>
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Tab Content — full width (#27) */}
      <div className="px-4 py-5 lg:py-8">
        {/* MEANING TAB */}
        {activeTab === "meaning" && (
          <div className="verse-section space-y-5">
            {MEANING_TAB_FLOAT_WRAP_LAYOUT &&
            verse.images?.meaning &&
            verse.meaning_detail ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 lg:p-6 flow-root">
                <div className="w-full lg:w-[min(42%,22rem)] lg:max-w-md lg:float-left lg:mr-5 lg:mb-3">
                  <VerseImage
                    layout="meaning_float"
                    imageKey={`ch${chapterNum}_v${verseNum}_meaning`}
                    url={verse.images.meaning.url}
                    caption={verse.images.meaning.caption}
                  />
                </div>
                <div className="text-red-900 text-lg leading-relaxed [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
                  {formatText(verse.meaning_detail)}
                </div>
              </div>
            ) : (
              <>
                {verse.images?.meaning && (
                  <VerseImage
                    imageKey={`ch${chapterNum}_v${verseNum}_meaning`}
                    url={verse.images.meaning.url}
                    caption={verse.images.meaning.caption}
                  />
                )}
                {verse.meaning_detail && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-5 lg:p-6">
                    <div className="text-red-900 text-lg leading-relaxed">
                      {formatText(verse.meaning_detail)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* STORY TAB */}
        {activeTab === "story" && verse.story && (
          <div className="verse-section space-y-5">
            {STORY_TAB_FLOAT_WRAP_LAYOUT &&
            verse.images?.story &&
            verse.images.story.length >= 1 ? (
              <>
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-5 lg:p-6 flow-root">
                  <div className="w-full lg:w-[min(42%,22rem)] lg:max-w-md lg:float-left lg:mr-5 lg:mb-3">
                    <VerseImage
                      layout="meaning_float"
                      imageKey={`ch${chapterNum}_v${verseNum}_story_0`}
                      url={verse.images.story[0].url}
                      caption={verse.images.story[0].caption}
                    />
                  </div>
                  <div className="text-orange-900 text-lg leading-relaxed [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
                    {formatStoryWithTakeaway(verse.story)}
                  </div>
                </div>
                {verse.images.story.length >= 2 && (
                  <VerseImage
                    layout="contain_preview"
                    imageKey={`ch${chapterNum}_v${verseNum}_story_1`}
                    url={verse.images.story[1].url}
                    caption={verse.images.story[1].caption}
                  />
                )}
              </>
            ) : (
              <>
                {verse.images?.story && verse.images.story.length >= 1 && (
                  <VerseImage
                    imageKey={`ch${chapterNum}_v${verseNum}_story_0`}
                    url={verse.images.story[0].url}
                    caption={verse.images.story[0].caption}
                  />
                )}
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-5 lg:p-6">
                  <div className="text-orange-900 text-lg leading-relaxed">
                    {formatStoryWithTakeaway(verse.story)}
                  </div>
                </div>
                {verse.images?.story && verse.images.story.length >= 2 && (
                  <VerseImage
                    layout="contain_preview"
                    imageKey={`ch${chapterNum}_v${verseNum}_story_1`}
                    url={verse.images.story[1].url}
                    caption={verse.images.story[1].caption}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* IMPACT ON LIFE TAB */}
        {activeTab === "impact" && verse.real_life_example && (
          <div className="verse-section space-y-5">
            {IMPACT_TAB_FLOAT_WRAP_LAYOUT && verse.images?.modern_life ? (
              <div className="bg-gradient-to-br from-green-50 to-teal-50 border border-green-200 rounded-2xl p-5 lg:p-6">
                <p className="text-green-700 text-sm font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Lightbulb size={14} />
                  Impact on Current Life
                </p>
                <div className="flow-root">
                  <div className="w-full lg:w-[min(42%,22rem)] lg:max-w-md lg:float-left lg:mr-5 lg:mb-3">
                    <VerseImage
                      layout="meaning_float"
                      imageKey={`ch${chapterNum}_v${verseNum}_modern_life`}
                      url={verse.images.modern_life.url}
                      caption={verse.images.modern_life.caption}
                    />
                  </div>
                  <div className="text-green-900 text-lg leading-relaxed [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
                    {formatText(verse.real_life_example)}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {verse.images?.modern_life && (
                  <VerseImage
                    imageKey={`ch${chapterNum}_v${verseNum}_modern_life`}
                    url={verse.images.modern_life.url}
                    caption={verse.images.modern_life.caption}
                  />
                )}
                <div className="bg-gradient-to-br from-green-50 to-teal-50 border border-green-200 rounded-2xl p-5 lg:p-6">
                  <p className="text-green-700 text-sm font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Lightbulb size={14} />
                    Impact on Current Life
                  </p>
                  <div className="text-green-900 text-lg leading-relaxed">
                    {formatText(verse.real_life_example)}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* REFLECTION TAB */}
        {activeTab === "reflection" && verse.reflection && (
          <div className="verse-section space-y-5">
            <div className="bg-gradient-to-br from-violet-50 to-red-50 border border-violet-200 rounded-2xl p-5 lg:p-6">
              <p className="text-violet-700 text-sm font-semibold uppercase tracking-widest mb-5 flex items-center gap-2">
                <MessageCircle size={14} />
                Reflection — Questions for Contemplation
              </p>
              <div className="space-y-4">
                {verse.reflection
                  .split("\n")
                  .filter(l => l.trim())
                  .map((line, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 bg-white/60 rounded-xl p-4 border border-violet-100"
                    >
                      <span className="text-violet-400 mt-0.5 flex-shrink-0 text-lg">
                        ◈
                      </span>
                      <p className="text-violet-900 text-lg leading-relaxed font-display font-medium">
                        {line}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* DETAILED MEANING TAB */}
        {activeTab === "detailed" && (
          <div className="verse-section space-y-5">
            {verse.detailed_meaning ? (
              DETAILED_TAB_FLOAT_WRAP_LAYOUT && verse.images?.detailed_meaning ? (
                <div className="bg-card border border-border rounded-2xl p-5 lg:p-6">
                  <p className="text-teal-600 text-sm font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Sparkles size={14} />
                    Detailed Gita Journey — Step by Step
                  </p>
                  <div className="flow-root">
                    <div className="w-full lg:w-[min(42%,22rem)] lg:max-w-md lg:float-left lg:mr-5 lg:mb-3">
                      <VerseImage
                        layout="meaning_float"
                        imageKey={`ch${chapterNum}_v${verseNum}_detailed_meaning`}
                        url={verse.images.detailed_meaning.url}
                        caption={verse.images.detailed_meaning.caption}
                      />
                    </div>
                    <div className="text-foreground/80 text-lg leading-relaxed [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
                      {formatText(verse.detailed_meaning)}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {verse.images?.detailed_meaning && (
                    <VerseImage
                      imageKey={`ch${chapterNum}_v${verseNum}_detailed_meaning`}
                      url={verse.images.detailed_meaning.url}
                      caption={verse.images.detailed_meaning.caption}
                    />
                  )}
                  <div className="bg-card border border-border rounded-2xl p-5 lg:p-6">
                    <p className="text-teal-600 text-sm font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Sparkles size={14} />
                      Detailed Gita Journey — Step by Step
                    </p>
                    <div className="text-foreground/80 text-lg leading-relaxed">
                      {formatText(verse.detailed_meaning)}
                    </div>
                  </div>
                </>
              )
            ) : verse.full_journey_text ? (
              DETAILED_TAB_FLOAT_WRAP_LAYOUT && verse.images?.detailed_meaning ? (
                <div className="bg-card border border-border rounded-2xl p-5 lg:p-6">
                  <p className="text-teal-600 text-sm font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Sparkles size={14} />
                    Full Gita Journey — Word by Word
                  </p>
                  <div className="flow-root">
                    <div className="w-full lg:w-[min(42%,22rem)] lg:max-w-md lg:float-left lg:mr-5 lg:mb-3">
                      <VerseImage
                        layout="meaning_float"
                        imageKey={`ch${chapterNum}_v${verseNum}_detailed_meaning`}
                        url={verse.images.detailed_meaning.url}
                        caption={verse.images.detailed_meaning.caption}
                      />
                    </div>
                    <div className="text-foreground/80 text-lg leading-relaxed [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
                      {formatText(verse.full_journey_text)}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {verse.images?.detailed_meaning && (
                    <VerseImage
                      imageKey={`ch${chapterNum}_v${verseNum}_detailed_meaning`}
                      url={verse.images.detailed_meaning.url}
                      caption={verse.images.detailed_meaning.caption}
                    />
                  )}
                  <div className="bg-card border border-border rounded-2xl p-5 lg:p-6">
                    <p className="text-teal-600 text-sm font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Sparkles size={14} />
                      Full Gita Journey — Word by Word
                    </p>
                    <div className="text-foreground/80 text-lg leading-relaxed space-y-1">
                      {formatText(verse.full_journey_text)}
                    </div>
                  </div>
                </>
              )
            ) : null}
          </div>
        )}

        {/* KIDS CORNER TAB */}
        {activeTab === "kids" && (
          <div className="verse-section kids-mode space-y-5">
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-2xl p-5">
              <p className="text-yellow-700 font-kids font-bold text-base mb-3 flex items-center gap-2">
                <Baby size={18} />
                🌟 The Sacred Words
              </p>
              <p className="font-devanagari text-red-900 text-lg leading-loose mb-3">
                {splitVerseLines(verse.sanskrit)[0]}
              </p>
              <p className="text-orange-800 font-kids text-lg font-semibold">
                "{verse.one_line_meaning}"
              </p>
            </div>

            {verse.kids_content?.explanation_script ? (
              KIDS_TAB_FLOAT_WRAP_LAYOUT && verse.images?.kids_explain ? (
                <div className="bg-gradient-to-br from-blue-50 to-red-50 border-2 border-blue-200 rounded-2xl p-5">
                  <p className="text-blue-700 font-kids font-bold text-base mb-3 flex items-center gap-2">
                    <MessageCircle size={16} />
                    💡 How to Understand This
                  </p>
                  <div className="flow-root">
                    <div className="w-full lg:w-[min(42%,22rem)] lg:max-w-md lg:float-left lg:mr-5 lg:mb-3">
                      <VerseImage
                        layout="meaning_float"
                        imageKey={`ch${chapterNum}_v${verseNum}_kids_explain`}
                        url={verse.images.kids_explain.url}
                        caption={verse.images.kids_explain.caption}
                      />
                    </div>
                    <div className="text-blue-900 font-kids text-lg leading-relaxed">
                      {verse.kids_content.explanation_script
                        .split("\n")
                        .filter(l => l.trim())
                        .map((line, i) => (
                          <p key={i} className="mb-2">
                            {line}
                          </p>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-blue-50 to-red-50 border-2 border-blue-200 rounded-2xl p-5">
                  <p className="text-blue-700 font-kids font-bold text-base mb-3 flex items-center gap-2">
                    <MessageCircle size={16} />
                    💡 How to Understand This
                  </p>
                  <div className="text-blue-900 font-kids text-lg leading-relaxed">
                    {verse.kids_content.explanation_script
                      .split("\n")
                      .filter(l => l.trim())
                      .map((line, i) => (
                        <p key={i} className="mb-2">
                          {line}
                        </p>
                      ))}
                  </div>
                  {verse.images?.kids_explain && (
                    <VerseImage
                      imageKey={`ch${chapterNum}_v${verseNum}_kids_explain`}
                      url={verse.images.kids_explain.url}
                      caption={verse.images.kids_explain.caption}
                    />
                  )}
                </div>
              )
            ) : verse.concise_journey ? (
              <div className="bg-gradient-to-br from-blue-50 to-red-50 border-2 border-blue-200 rounded-2xl p-5">
                <p className="text-blue-700 font-kids font-bold text-base mb-3">
                  💡 What does this mean?
                </p>
                <p className="text-blue-900 font-kids text-lg leading-relaxed">
                  {verse.concise_journey}
                </p>
              </div>
            ) : null}

            {verse.kids_content?.story ? (
              KIDS_TAB_FLOAT_WRAP_LAYOUT && verse.images?.kids_story ? (
                <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-2xl p-5">
                  <p className="text-orange-700 font-kids font-bold text-base mb-3">
                    📖 A Story to Remember
                  </p>
                  <div className="flow-root">
                    <div className="w-full lg:w-[min(42%,22rem)] lg:max-w-md lg:float-left lg:mr-5 lg:mb-3">
                      <VerseImage
                        layout="meaning_float"
                        imageKey={`ch${chapterNum}_v${verseNum}_kids_story`}
                        url={verse.images.kids_story.url}
                        caption={verse.images.kids_story.caption}
                      />
                    </div>
                    <div className="text-orange-900 font-kids text-base leading-relaxed">
                      {verse.kids_content.story
                        .split("\n")
                        .filter(l => l.trim())
                        .map((line, i) => (
                          <p key={i} className="mb-2">
                            {line}
                          </p>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-2xl p-5">
                  <p className="text-orange-700 font-kids font-bold text-base mb-3">
                    📖 A Story to Remember
                  </p>
                  <div className="text-orange-900 font-kids text-base leading-relaxed">
                    {verse.kids_content.story
                      .split("\n")
                      .filter(l => l.trim())
                      .map((line, i) => (
                        <p key={i} className="mb-2">
                          {line}
                        </p>
                      ))}
                  </div>
                  {verse.images?.kids_story && (
                    <VerseImage
                      imageKey={`ch${chapterNum}_v${verseNum}_kids_story`}
                      url={verse.images.kids_story.url}
                      caption={verse.images.kids_story.caption}
                    />
                  )}
                </div>
              )
            ) : verse.story ? (
              <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-2xl p-5">
                <p className="text-orange-700 font-kids font-bold text-base mb-3">
                  📖 A Story to Remember
                </p>
                <div className="text-orange-900 font-kids text-base leading-relaxed">
                  {verse.story
                    .split("\n")
                    .slice(0, 8)
                    .map((line, i) =>
                      line.trim() ? (
                        <p key={i} className="mb-2">
                          {line}
                        </p>
                      ) : null
                    )}
                </div>
              </div>
            ) : null}

            {(verse.kids_content?.reflection || verse.reflection) && (
              <div className="bg-gradient-to-br from-purple-50 to-violet-50 border-2 border-purple-200 rounded-2xl p-5">
                <p className="text-purple-700 font-kids font-bold text-base mb-3">
                  🤔 Think About It!
                </p>
                <div className="text-purple-900 font-kids text-base leading-relaxed space-y-2">
                  {(verse.kids_content?.reflection || verse.reflection || "")
                    .split("\n")
                    .filter(l => l.trim())
                    .map((line, i) => (
                      <p key={i} className="flex items-start gap-2">
                        <span className="text-purple-400 flex-shrink-0">◈</span>
                        <span>{line}</span>
                      </p>
                    ))}
                </div>
              </div>
            )}

            {verse.final_takeaway && (
              <div className="bg-gradient-to-br from-pink-50 to-rose-50 border-2 border-pink-200 rounded-2xl p-5">
                <p className="text-pink-700 font-kids font-bold text-base mb-3">
                  ⭐ Remember This!
                </p>
                <div className="text-pink-900 font-kids text-lg font-semibold leading-relaxed">
                  {verse.final_takeaway
                    .split("\n")
                    .slice(0, 4)
                    .map((line, i) =>
                      line.trim() ? (
                        <p key={i} className="mb-1">
                          {line}
                        </p>
                      ) : null
                    )}
                </div>
              </div>
            )}

            <div className="bg-red-900 rounded-2xl p-5 text-center">
              <p className="text-orange-300 font-kids font-bold text-base mb-2">
                🎯 Challenge!
              </p>
              <p className="text-red-100 font-kids text-base">
                Can you explain this verse to a friend in your own words? Try
                telling the story to someone in your family!
              </p>
            </div>
          </div>
        )}

        {/* GRAMMAR TAB */}
        {activeTab === "grammar" && (
          <div className="verse-section space-y-5">
            {verse.rich_grammar ? (
              <>
                {verse.rich_grammar.padacchedah && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h5 className="font-devanagari font-bold text-violet-800 text-base mb-3 flex items-center gap-2">
                      <GraduationCap size={14} className="text-violet-600" />
                      पदच्छेदः (Padacchedaḥ — Word Separation)
                    </h5>
                    <p className="font-devanagari text-base leading-relaxed text-gray-700">
                      {verse.rich_grammar.padacchedah}
                    </p>
                  </div>
                )}

                {verse.rich_grammar.pratipadarthah && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h5 className="font-devanagari font-bold text-violet-800 text-lg mb-4">
                      पदार्थः (Pratipadārthaḥ — Word Meanings)
                    </h5>
                    <div className="text-base leading-relaxed text-gray-700">
                      {verse.rich_grammar.pratipadarthah
                        .split("|")
                        .map((item, i) => {
                          const [word, meaning] = item
                            .split("=")
                            .map(s => s.trim());
                          if (!word || !meaning) return null;
                          return (
                            <div
                              key={i}
                              className="flex items-baseline gap-2 py-1.5 border-b border-border last:border-0"
                            >
                              <span className="font-devanagari font-semibold text-red-800 min-w-[130px]">
                                {word}
                              </span>
                              <span className="text-gray-600">= {meaning}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {verse.rich_grammar.padaparicayah &&
                  verse.rich_grammar.padaparicayah.length > 0 && (
                    <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5 overflow-x-auto">
                      <h5 className="font-devanagari font-bold text-violet-800 text-base mb-4">
                        पदपरिचयः (Padaparicayaḥ — Word Analysis Table)
                      </h5>
                      <table className="w-full text-sm border-collapse min-w-[500px]">
                        <thead>
                          <tr className="bg-violet-100">
                            <th className="font-devanagari text-left p-2 border border-violet-200 text-violet-800">
                              Word
                            </th>
                            <th className="text-left p-2 border border-violet-200 text-violet-800">
                              Anta
                            </th>
                            <th className="text-left p-2 border border-violet-200 text-violet-800">
                              Liṅga
                            </th>
                            <th className="text-left p-2 border border-violet-200 text-violet-800">
                              Vibhakti
                            </th>
                            <th className="text-left p-2 border border-violet-200 text-violet-800">
                              Vacanam
                            </th>
                            <th className="text-left p-2 border border-violet-200 text-violet-800">
                              Type
                            </th>
                            <th className="text-left p-2 border border-violet-200 text-violet-800">
                              Dhātu
                            </th>
                            <th className="text-left p-2 border border-violet-200 text-violet-800">
                              Lakāra
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {verse.rich_grammar.padaparicayah.map((row, i) => (
                            <tr
                              key={i}
                              className={
                                i % 2 === 0 ? "bg-white" : "bg-violet-50/50"
                              }
                            >
                              <td className="font-devanagari font-semibold text-red-800 p-2 border border-violet-200">
                                {row.word}
                              </td>
                              <td className="p-2 border border-violet-200 text-gray-600">
                                {row.anta || "—"}
                              </td>
                              <td className="font-devanagari p-2 border border-violet-200 text-gray-600">
                                {row.linga || "—"}
                              </td>
                              <td className="font-devanagari p-2 border border-violet-200 text-gray-600">
                                {row.vibhakti || "—"}
                              </td>
                              <td className="font-devanagari p-2 border border-violet-200 text-gray-600">
                                {row.vacanam || "—"}
                              </td>
                              <td className="p-2 border border-violet-200 text-gray-600">
                                {row.type || "—"}
                              </td>
                              <td className="font-devanagari p-2 border border-violet-200 text-gray-600">
                                {row.dhatu || "—"}
                              </td>
                              <td className="p-2 border border-violet-200 text-gray-600">
                                {row.lakara || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                {verse.rich_grammar.anvayah && (
                  <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5">
                    <h5 className="font-devanagari font-bold text-violet-800 text-base mb-3">
                      अन्वयः (Anvayaḥ — Prose Order)
                    </h5>
                    <p className="font-devanagari text-base leading-relaxed text-violet-900">
                      {verse.rich_grammar.anvayah}
                    </p>
                  </div>
                )}

                {verse.rich_grammar.sandhi && (
                  <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
                    <h5 className="font-devanagari font-bold text-orange-800 text-base mb-3">
                      सन्धि (Sandhi — Phonetic Combinations)
                    </h5>
                    <div className="text-base leading-relaxed text-orange-900">
                      {verse.rich_grammar.sandhi.split("|").map((item, i) => (
                        <p key={i} className="font-devanagari py-1.5">
                          {item.trim()}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {verse.rich_grammar.samasa && (
                  <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5">
                    <h5 className="font-devanagari font-bold text-teal-800 text-base mb-3">
                      समासः (Samāsa — Compound Words)
                    </h5>
                    <div className="text-base leading-relaxed text-teal-900">
                      {verse.rich_grammar.samasa.split("|").map((item, i) => (
                        <p key={i} className="font-devanagari py-1.5">
                          {item.trim()}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {verse.rich_grammar.other && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h5 className="font-devanagari font-bold text-violet-800 text-base mb-3">
                      अन्य व्याकरण (Other Grammatical Aspects)
                    </h5>
                    <div className="text-base leading-relaxed text-gray-700">
                      {verse.rich_grammar.other.split("|").map((item, i) => (
                        <p key={i} className="font-devanagari py-1.5">
                          {item.trim()}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : verse.grammar_notes ? (
              <div className="bg-card border border-border rounded-2xl p-5 lg:p-6">
                <p className="text-violet-600 text-sm font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
                  <GraduationCap size={14} />
                  Sanskrit Grammar (Samskritam)
                </p>
                <div className="text-foreground/80 text-base leading-relaxed">
                  {verse.grammar_notes.split("\n").map((line, i) => {
                    if (!line.trim()) return <br key={i} />;
                    if (
                      line.includes("पदच्छेदः") ||
                      line.includes("अन्वयः") ||
                      line.includes("पदार्थः") ||
                      line.includes("समासः") ||
                      line.includes("सन्धि")
                    ) {
                      return (
                        <h5
                          key={i}
                          className="font-devanagari font-bold text-violet-800 text-base mt-4 mb-2"
                        >
                          {line}
                        </h5>
                      );
                    }
                    return (
                      <p
                        key={i}
                        className="my-1.5 font-devanagari text-base leading-relaxed text-gray-700"
                      >
                        {line}
                      </p>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* MORE STORIES TAB */}
        {activeTab === "more_stories" && verse.more_stories && (
          <div className="verse-section space-y-6">
            <p className="text-rose-700 text-sm font-semibold uppercase tracking-widest flex items-center gap-2">
              <Library size={14} />
              More Stories &amp; Insights
            </p>

            {moreStoriesParsed.map((story, i) => {
              const moreImg = verse.images?.more_stories?.[i];
              return (
                <div
                  key={i}
                  className="bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200 rounded-2xl overflow-hidden"
                >
                  <div className="px-5 pt-5 pb-3">
                    <h4 className="font-display font-bold text-rose-800 text-xl flex items-center gap-2">
                      <FlameKindling
                        size={15}
                        className="text-rose-500 flex-shrink-0"
                      />
                      {story.title}
                    </h4>
                  </div>

                  {MORE_STORIES_TAB_FLOAT_WRAP_LAYOUT && moreImg ? (
                    <div className="px-5 pb-5">
                      <div className="flow-root">
                        <div className="w-full lg:w-[min(42%,22rem)] lg:max-w-md lg:float-left lg:mr-5 lg:mb-3">
                          <VerseImage
                            layout="meaning_float"
                            imageKey={`ch${chapterNum}_v${verseNum}_more_stories_${i}`}
                            url={moreImg.url}
                            caption={moreImg.caption}
                          />
                        </div>
                        <div className="text-rose-900 text-lg leading-relaxed [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
                          {formatStoryWithTakeaway(story.body)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {moreImg && (
                        <div className="px-5">
                          <VerseImage
                            imageKey={`ch${chapterNum}_v${verseNum}_more_stories_${i}`}
                            url={moreImg.url}
                            caption={moreImg.caption}
                          />
                        </div>
                      )}
                      <div className="px-5 pb-5">
                        <div className="text-rose-900 text-lg leading-relaxed">
                          {formatStoryWithTakeaway(story.body)}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Verse Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          {prevVerse ? (
            <Link
              href={verseLocationWithCurrentTab(chapterNum, prevVerse.verse)}
              onClick={e => {
                e.preventDefault();
                navigateWithViewTransition(() =>
                  setLocation(
                    verseLocationWithCurrentTab(chapterNum, prevVerse.verse)
                  )
                );
              }}
            >
              <button
                type="button"
                className="flex items-center gap-2 bg-card border border-border hover:border-orange-300 rounded-xl px-4 py-3 text-base font-semibold text-foreground transition-all group touch-manipulation"
              >
                <ChevronLeft
                  size={18}
                  className="group-hover:text-orange-500"
                />
                <div className="text-left hidden sm:block">
                  <div className="text-sm text-muted-foreground">Previous</div>
                  <div>Shloka {prevVerse.verse}</div>
                </div>
                <span className="sm:hidden">Prev</span>
              </button>
            </Link>
          ) : (
            <Link
              href={`/chapter/${chapterNum}`}
              onClick={e => {
                e.preventDefault();
                navigateWithViewTransition(() =>
                  setLocation(`/chapter/${chapterNum}`)
                );
              }}
            >
              <button
                type="button"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
              >
                <ChevronLeft size={16} />
                Chapter
              </button>
            </Link>
          )}

          <Link
            href={`/chapter/${chapterNum}`}
            onClick={e => {
              e.preventDefault();
              navigateWithViewTransition(() =>
                setLocation(`/chapter/${chapterNum}`)
              );
            }}
          >
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-orange-600 transition-colors px-3 py-2 touch-manipulation"
            >
              {chapter.name}
            </button>
          </Link>

          {nextVerse ? (
            <Link
              href={verseLocationWithCurrentTab(chapterNum, nextVerse.verse)}
              onClick={e => {
                e.preventDefault();
                navigateWithViewTransition(() =>
                  setLocation(
                    verseLocationWithCurrentTab(chapterNum, nextVerse.verse)
                  )
                );
              }}
            >
              <button
                type="button"
                className="flex items-center gap-2 bg-card border border-border hover:border-orange-300 rounded-xl px-4 py-3 text-base font-semibold text-foreground transition-all group touch-manipulation"
              >
                <div className="text-right hidden sm:block">
                  <div className="text-sm text-muted-foreground">Next</div>
                  <div>Shloka {nextVerse.verse}</div>
                </div>
                <span className="sm:hidden">Next</span>
                <ChevronRight
                  size={16}
                  className="group-hover:text-orange-500"
                />
              </button>
            </Link>
          ) : (
            <Link
              href={`/chapter/${chapterNum}`}
              onClick={e => {
                e.preventDefault();
                navigateWithViewTransition(() =>
                  setLocation(`/chapter/${chapterNum}`)
                );
              }}
            >
              <button
                type="button"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
              >
                Chapter
                <ChevronRight size={16} />
              </button>
            </Link>
          )}
        </div>
      </div>
    </Layout>
  );
}
