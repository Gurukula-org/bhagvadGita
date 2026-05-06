import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link, useParams, useLocation, Redirect } from "wouter";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import { useChapterVisibility } from "@/contexts/ChapterVisibilityContext";
import EditableImage from "@/components/EditableImage";
import { useImageUrl } from "@/hooks/useImages";
import gitaData from "@/data/gitaData.json";
import type { GitaData, Verse } from "@/types/gita";
import { SandhiText } from "@/components/SandhiText";
import {
  ChevronLeft, ChevronRight, Star, Sparkles,
  BookMarked, Lightbulb, Baby, GraduationCap,
  MessageCircle, Library, FlameKindling,
  Volume2, VolumeX, Pause, Play, RotateCcw, RotateCw, X
} from "lucide-react";
import { getChapterDisplayNames } from "@/lib/chapterContent";
import { getChapterIntentTerms, getTopicHubsForChapter } from "@/lib/seoKeywords";
import { stripTransliterationVerseSuffix } from "@/lib/transliterationDisplay";
import { navigateWithViewTransition } from "@/lib/navigateWithViewTransition";

const data = gitaData as unknown as GitaData;

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
  { id: "meaning",     label: "Meaning",          icon: <Star size={16} /> },
  { id: "story",       label: "Story",            icon: <BookMarked size={16} /> },
  { id: "impact",      label: "Impact on Life",   icon: <Lightbulb size={16} /> },
  { id: "reflection",  label: "Reflection",       icon: <MessageCircle size={16} /> },
  { id: "detailed",    label: "Detailed Meaning", icon: <Sparkles size={16} /> },
  { id: "kids",        label: "Kids Corner",      icon: <Baby size={16} /> },
  { id: "grammar",     label: "Grammar",          icon: <GraduationCap size={16} /> },
  { id: "more_stories",label: "More Stories",     icon: <Library size={16} /> },
];

function isTab(value: string | null): value is Tab {
  return value != null && TABS.some((tab) => tab.id === value);
}

function formatText(text: string) {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <br key={i} />;
    if (/^Step \d+/.test(line)) {
      return (
        <h5 key={i} className="font-semibold text-red-800 mt-4 mb-2 text-lg border-l-2 border-orange-400 pl-3">
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
    return <p key={i} className="my-2 text-lg leading-relaxed">{line}</p>;
  });
}

/**
 * Split narrative vs. closing takeaway (backlog #100).
 * Prefer `\n\n` blocks; most `gitaData` story/more_stories bodies use only `\n` between paragraphs, so fall back to last line.
 */
function splitLeadingAndTakeawayParagraphs(text: string): { lead: string; takeaway: string | null } {
  const normalized = text.trim();
  if (!normalized) {
    return { lead: "", takeaway: null };
  }

  const doubleBreakParts = normalized
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (doubleBreakParts.length >= 2) {
    const takeaway = doubleBreakParts[doubleBreakParts.length - 1]!;
    const lead = doubleBreakParts.slice(0, -1).join("\n\n");
    return { lead, takeaway };
  }

  const lines = normalized.split("\n").map((l) => l.trim()).filter(Boolean);
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
      className="mt-6 flex gap-3 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-yellow-50/90 to-orange-50/80 p-4 lg:p-5 shadow-md ring-1 ring-amber-200/70"
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
      {takeaway != null ? <StoryTakeawayCallout>{formatText(takeaway)}</StoryTakeawayCallout> : null}
    </>
  );
}

function ImageModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    const preventScroll = (e: TouchEvent) => { e.preventDefault(); };
    document.addEventListener('keydown', handler);
    const scrollY = window.scrollY;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflow = 'hidden';
    const overlay = overlayRef.current;
    overlay?.addEventListener('touchmove', preventScroll, { passive: false });
    return () => {
      document.removeEventListener('keydown', handler);
      overlay?.removeEventListener('touchmove', preventScroll);
      document.documentElement.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
      style={{ touchAction: 'none' }}
      onClick={() => onCloseRef.current()}
    >
      <button
        className="absolute top-3 right-3 text-white/90 hover:text-white z-[10000] bg-black/60 rounded-full p-2"
        onClick={() => onCloseRef.current()}
      >
        <X size={24} />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-[92vw] max-h-[85vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}

function VerseImage({ imageKey, url, caption }: { imageKey: string; url: string; caption?: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  const resolvedUrl = useImageUrl(imageKey, url);
  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    setModalOpen(true);
  };
  return (
    <>
      <div className="cursor-pointer" onClick={handleClick}>
        <EditableImage
          imageKey={imageKey}
          fallbackUrl={url}
          alt={caption || "Verse illustration"}
          caption={caption}
          className="my-4 rounded-2xl overflow-hidden border border-border shadow-md"
          imgClassName="w-full object-cover max-h-72"
        />
      </div>
      {modalOpen && <ImageModal src={resolvedUrl} alt={caption || "Verse illustration"} onClose={() => setModalOpen(false)} />}
    </>
  );
}

function parseMoreStories(text: string): { title: string; body: string }[] {
  const stories: { title: string; body: string }[] = [];
  const lines = text.split('\n');
  let current: { title: string; body: string } | null = null;
  for (const line of lines) {
    if (/^\d+\.\s/.test(line) && line.length < 120) {
      if (current) stories.push(current);
      current = { title: line.replace(/^\d+\.\s*/, '').trim(), body: '' };
    } else if (current) {
      current.body += (current.body ? '\n' : '') + line;
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tabNavRef = useRef<HTMLDivElement | null>(null);

  const [, setLocation] = useLocation();

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    setActiveTab(isTab(requestedTab) ? requestedTab : "meaning");
    if (isTab(requestedTab)) {
      requestAnimationFrame(() => {
        const tabTop = (tabNavRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
        const targetTop = Math.max(0, tabTop - 110);
        window.scrollTo({ top: targetTop, behavior: "smooth" });
      });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
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
  }, [chapterNum, verseNum]);

  useEffect(() => {
    const chapter = data.chapters.find((c) => c.chapter === chapterNum);
    const verses: Verse[] = chapterNum === 6 ? data.chapter6_full : chapter?.key_verses || [];
    const v = verses.find((x) => x.verse === verseNum);
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
    a.addEventListener("ended", () => { setAudioPlaying(false); setAudioCurrentTime(0); });
    a.addEventListener("error", () => { setAudioPlaying(false); });
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
      const t = Math.max(0, Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + delta));
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

  const { isChapterVisible } = useChapterVisibility();
  const chapter = data.chapters.find((c) => c.chapter === chapterNum);
  if (!isChapterVisible(chapterNum)) return <Redirect to="/" />;
  const verses: Verse[] = chapterNum === 6
    ? data.chapter6_full
    : chapter?.key_verses || [];

  const verse = verses.find((v) => v.verse === verseNum);
  const verseIndex = verses.findIndex((v) => v.verse === verseNum);

  if (!chapter || !verse) {
    return (
      <Layout>
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Verse not found.</p>
          <Link
            href={`/chapter/${chapterNum}`}
            className="text-orange-600 hover:underline mt-2 inline-block touch-manipulation"
            onClick={(e) => {
              e.preventDefault();
              navigateWithViewTransition(() => setLocation(`/chapter/${chapterNum}`));
            }}
          >
            ← Back to Chapter {chapterNum}
          </Link>
        </div>
      </Layout>
    );
  }

  const prevVerse = verseIndex > 0 ? verses[verseIndex - 1] : null;
  const nextVerse = verseIndex < verses.length - 1 ? verses[verseIndex + 1] : null;
  const { iastName } = getChapterDisplayNames(chapter);
  const storyImgs = verse.images?.story;
  const storyImageUrl = Array.isArray(storyImgs)
    ? storyImgs[0]?.url
    : (storyImgs as { url?: string } | undefined)?.url;
  const meaningImageUrl = verse.images?.meaning?.url
    || verse.images?.detailed_meaning?.url
    || storyImageUrl
    || verse.images?.modern_life?.url
    || verse.images?.kids_explain?.url
    || verse.images?.kids_story?.url
    || null;

  const availableTabs = TABS.filter((tab) => {
    if (tab.id === "story")       return !!(verse.story);
    if (tab.id === "impact")      return !!(verse.real_life_example);
    if (tab.id === "reflection")  return !!(verse.reflection);
    if (tab.id === "detailed")    return !!(verse.detailed_meaning || verse.full_journey_text);
    if (tab.id === "grammar")     return !!(verse.grammar_notes || verse.rich_grammar);
    if (tab.id === "more_stories") return !!verse.more_stories;
    return true;
  });

  const moreStoriesParsed = verse.more_stories ? parseMoreStories(verse.more_stories) : [];
  const intentTerms = getChapterIntentTerms(chapterNum);
  const topicHubs = getTopicHubsForChapter(chapterNum).slice(0, 2);

  const verseTitle = `Bhagavad Gita ${chapterNum}.${verseNum} — ${iastName}${verse.title ? ` — ${verse.title}` : ""}`;
  const verseDescription = verse.one_line_meaning ||
    verse.concise_journey ||
    `Bhagavad Gita Chapter ${chapterNum} Verse ${verseNum} — Sanskrit shloka with transliteration, meaning, stories, and grammar analysis for ${intentTerms.slice(0, 3).join(", ")}.`;

  return (
    <Layout kidsMode={kidsMode} onToggleKids={() => setKidsMode(!kidsMode)} stickyHeader={false}>
      <SEO
        title={verseTitle}
        description={verseDescription}
        path={`/chapter/${chapterNum}/verse/${verseNum}`}
        image={meaningImageUrl || undefined}
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
            onClick={(e) => {
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
            onClick={(e) => {
              e.preventDefault();
              navigateWithViewTransition(() => setLocation(`/chapter/${chapterNum}`));
            }}
          >
            Chapter {chapterNum}
          </Link>
          <ChevronRight size={12} />
          <span className="text-orange-900 font-semibold">Shloka {verseNum}</span>
        </div>

        <div>
          {/* Title: iastName · chapter.verse */}
          <div className="flex gap-3 mb-3 items-stretch">
            {meaningImageUrl && (
              <div className="w-[5.25rem] sm:w-32 flex-shrink-0 self-stretch min-h-[5.5rem]">
                <img
                  src={meaningImageUrl}
                  alt=""
                  className="h-full w-full min-h-[5.5rem] rounded-xl object-cover border border-orange-200 shadow-sm"
                />
              </div>
            )}
            <div className="min-w-0 flex-1 flex flex-col justify-center">
              <p className="bg-red-900 text-orange-100 text-lg sm:text-xl md:text-2xl font-bold tracking-wide px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg inline-block">
                {iastName} · {chapterNum}.{verseNum}
              </p>
              {verse.title && (
                <p className="text-orange-900 text-lg font-display font-bold mt-1">{verse.title}</p>
              )}
              {topicHubs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {topicHubs.map((hub) => (
                    <Link
                      key={hub.slug}
                      href={`/topics/${hub.slug}`}
                      className="inline-flex items-center rounded-md bg-orange-100 border border-orange-200 px-2 py-0.5 text-[11px] font-semibold text-orange-700 hover:bg-orange-200 transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        navigateWithViewTransition(() => setLocation(`/topics/${hub.slug}`));
                      }}
                    >
                      {hub.title.replace("Gita for ", "")}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Prev / Dropdowns / Next Shloka navigation */}
          <div className="flex items-center justify-between gap-2 mb-3">
            {prevVerse ? (
              <Link
                href={`/chapter/${chapterNum}/verse/${prevVerse.verse}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigateWithViewTransition(() =>
                    setLocation(`/chapter/${chapterNum}/verse/${prevVerse.verse}`)
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
            ) : <div />}

            <div className="flex items-center gap-2">
              <select
                value={chapterNum}
                onChange={(e) => {
                  const ch = parseInt(e.target.value);
                  navigateWithViewTransition(() => setLocation(`/chapter/${ch}/verse/1`));
                }}
                className="px-2 py-1.5 rounded-lg text-sm font-semibold text-orange-800 bg-orange-100 border border-orange-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {data.chapters.filter((c) => isChapterVisible(c.chapter)).map((c) => (
                  <option key={c.chapter} value={c.chapter}>Ch. {c.chapter}</option>
                ))}
              </select>
              <select
                value={verseNum}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  navigateWithViewTransition(() => setLocation(`/chapter/${chapterNum}/verse/${v}`));
                }}
                className="px-2 py-1.5 rounded-lg text-sm font-semibold text-orange-800 bg-orange-100 border border-orange-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {verses.map((v) => (
                  <option key={v.verse} value={v.verse}>Shloka {v.verse}</option>
                ))}
              </select>
            </div>

            {nextVerse ? (
              <Link
                href={`/chapter/${chapterNum}/verse/${nextVerse.verse}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigateWithViewTransition(() =>
                    setLocation(`/chapter/${chapterNum}/verse/${nextVerse.verse}`)
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
            ) : <div />}
          </div>

          {/* Shloka + IAST side-by-side on md+, stacked on mobile */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch">
            {/* Devanagari Shloka — reduced padding (#26.4), smaller mobile font (#26.1) */}
            <div className="bg-gradient-to-br from-red-900 to-red-800 rounded-2xl p-3 lg:p-5 shadow-md w-full md:flex-1 flex flex-col">
              <div className="font-devanagari text-orange-100 text-xl lg:text-3xl flex-1">
                {verse.sanskrit.split('\n').map((line, i) => (
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
                      {audioPlaying ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
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
                        onChange={(e) => seekAudio(parseFloat(e.target.value))}
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
                        <span>{audioDuration ? formatTime(audioDuration) : "—:——"}</span>
                      </div>
                    </div>
                    <button
                      onClick={toggleMute}
                      className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-orange-700 hover:bg-orange-200 transition-all"
                      title={audioMuted ? "Unmute" : "Mute"}
                    >
                      {audioMuted ? <VolumeX size={18} strokeWidth={2.25} /> : <Volume2 size={18} strokeWidth={2.25} />}
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
                          {SPEED_OPTIONS.map((speed) => (
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
                    {verse.transliteration.split('\n').map((line, i) => (
                      <p key={i} className="leading-relaxed md:leading-loose">
                        <SandhiText text={stripTransliterationVerseSuffix(line)} />
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
      <div ref={tabNavRef} className="sticky top-0 z-30 bg-white border-b border-border shadow-sm">
        <div className="px-2 py-0.5">
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${Math.ceil(availableTabs.length / 2)}, 1fr)` }}>
            {availableTabs.slice(0, Math.ceil(availableTabs.length / 2)).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex flex-col items-center gap-0.5 px-1 py-2 text-xs font-semibold rounded-lg transition-all
                  ${activeTab === tab.id
                    ? "bg-orange-50 text-orange-700 border border-orange-300"
                    : "text-muted-foreground hover:text-foreground hover:bg-gray-50"
                  }
                `}
              >
                <span className={activeTab === tab.id ? "text-orange-600" : "text-gray-400"}>{tab.icon}</span>
                <span className="leading-tight text-center">{tab.label}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-0.5 mt-0.5" style={{ gridTemplateColumns: `repeat(${availableTabs.length - Math.ceil(availableTabs.length / 2)}, 1fr)` }}>
            {availableTabs.slice(Math.ceil(availableTabs.length / 2)).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex flex-col items-center gap-0.5 px-1 py-2 text-xs font-semibold rounded-lg transition-all
                  ${activeTab === tab.id
                    ? "bg-orange-50 text-orange-700 border border-orange-300"
                    : "text-muted-foreground hover:text-foreground hover:bg-gray-50"
                  }
                `}
              >
                <span className={activeTab === tab.id ? "text-orange-600" : "text-gray-400"}>{tab.icon}</span>
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
            {verse.images?.meaning && (
              <VerseImage imageKey={`ch${chapterNum}_v${verseNum}_meaning`} url={verse.images.meaning.url} caption={verse.images.meaning.caption} />
            )}

            {verse.meaning_detail && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 lg:p-6">
                <div className="text-red-900 text-lg leading-relaxed">
                  {formatText(verse.meaning_detail)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STORY TAB */}
        {activeTab === "story" && verse.story && (
          <div className="verse-section space-y-5">
            {verse.images?.story && verse.images.story.length >= 1 && (
              <VerseImage imageKey={`ch${chapterNum}_v${verseNum}_story_0`} url={verse.images.story[0].url} caption={verse.images.story[0].caption} />
            )}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-5 lg:p-6">
              <div className="text-orange-900 text-lg leading-relaxed">
                {formatStoryWithTakeaway(verse.story)}
              </div>
            </div>
            {verse.images?.story && verse.images.story.length >= 2 && (
              <VerseImage imageKey={`ch${chapterNum}_v${verseNum}_story_1`} url={verse.images.story[1].url} caption={verse.images.story[1].caption} />
            )}
          </div>
        )}

        {/* IMPACT ON LIFE TAB */}
        {activeTab === "impact" && verse.real_life_example && (
          <div className="verse-section space-y-5">
            {verse.images?.modern_life && (
              <VerseImage imageKey={`ch${chapterNum}_v${verseNum}_modern_life`} url={verse.images.modern_life.url} caption={verse.images.modern_life.caption} />
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
                {verse.reflection.split('\n').filter(l => l.trim()).map((line, i) => (
                  <div key={i} className="flex items-start gap-3 bg-white/60 rounded-xl p-4 border border-violet-100">
                    <span className="text-violet-400 mt-0.5 flex-shrink-0 text-lg">◈</span>
                    <p className="text-violet-900 text-lg leading-relaxed font-display font-medium">{line}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DETAILED MEANING TAB */}
        {activeTab === "detailed" && (
          <div className="verse-section space-y-5">
            {verse.images?.detailed_meaning && (
              <VerseImage imageKey={`ch${chapterNum}_v${verseNum}_detailed_meaning`} url={verse.images.detailed_meaning.url} caption={verse.images.detailed_meaning.caption} />
            )}
            {verse.detailed_meaning ? (
              <div className="bg-card border border-border rounded-2xl p-5 lg:p-6">
                <p className="text-teal-600 text-sm font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Sparkles size={14} />
                  Detailed Gita Journey — Step by Step
                </p>
                <div className="text-foreground/80 text-lg leading-relaxed">
                  {formatText(verse.detailed_meaning)}
                </div>
              </div>
            ) : verse.full_journey_text ? (
              <div className="bg-card border border-border rounded-2xl p-5 lg:p-6">
                <p className="text-teal-600 text-sm font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Sparkles size={14} />
                  Full Gita Journey — Word by Word
                </p>
                <div className="text-foreground/80 text-lg leading-relaxed space-y-1">
                  {formatText(verse.full_journey_text)}
                </div>
              </div>
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
                {verse.sanskrit.split('\n')[0]}
              </p>
              <p className="text-orange-800 font-kids text-lg font-semibold">
                "{verse.one_line_meaning}"
              </p>
            </div>

            {verse.kids_content?.explanation_script ? (
              <div className="bg-gradient-to-br from-blue-50 to-red-50 border-2 border-blue-200 rounded-2xl p-5">
                <p className="text-blue-700 font-kids font-bold text-base mb-3 flex items-center gap-2">
                  <MessageCircle size={16} />
                  💡 How to Understand This
                </p>
                <div className="text-blue-900 font-kids text-lg leading-relaxed">
                  {verse.kids_content.explanation_script.split('\n').filter(l => l.trim()).map((line, i) => (
                    <p key={i} className="mb-2">{line}</p>
                  ))}
                </div>
                {verse.images?.kids_explain && (
                  <VerseImage imageKey={`ch${chapterNum}_v${verseNum}_kids_explain`} url={verse.images.kids_explain.url} caption={verse.images.kids_explain.caption} />
                )}
              </div>
            ) : verse.concise_journey ? (
              <div className="bg-gradient-to-br from-blue-50 to-red-50 border-2 border-blue-200 rounded-2xl p-5">
                <p className="text-blue-700 font-kids font-bold text-base mb-3">💡 What does this mean?</p>
                <p className="text-blue-900 font-kids text-lg leading-relaxed">{verse.concise_journey}</p>
              </div>
            ) : null}

            {verse.kids_content?.story ? (
              <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-2xl p-5">
                <p className="text-orange-700 font-kids font-bold text-base mb-3">📖 A Story to Remember</p>
                <div className="text-orange-900 font-kids text-base leading-relaxed">
                  {verse.kids_content.story.split('\n').filter(l => l.trim()).map((line, i) => (
                    <p key={i} className="mb-2">{line}</p>
                  ))}
                </div>
                {verse.images?.kids_story && (
                  <VerseImage imageKey={`ch${chapterNum}_v${verseNum}_kids_story`} url={verse.images.kids_story.url} caption={verse.images.kids_story.caption} />
                )}
              </div>
            ) : verse.story ? (
              <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-2xl p-5">
                <p className="text-orange-700 font-kids font-bold text-base mb-3">📖 A Story to Remember</p>
                <div className="text-orange-900 font-kids text-base leading-relaxed">
                  {verse.story.split('\n').slice(0, 8).map((line, i) => (
                    line.trim() ? <p key={i} className="mb-2">{line}</p> : null
                  ))}
                </div>
              </div>
            ) : null}

            {(verse.kids_content?.reflection || verse.reflection) && (
              <div className="bg-gradient-to-br from-purple-50 to-violet-50 border-2 border-purple-200 rounded-2xl p-5">
                <p className="text-purple-700 font-kids font-bold text-base mb-3">🤔 Think About It!</p>
                <div className="text-purple-900 font-kids text-base leading-relaxed space-y-2">
                  {(verse.kids_content?.reflection || verse.reflection || '').split('\n').filter(l => l.trim()).map((line, i) => (
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
                <p className="text-pink-700 font-kids font-bold text-base mb-3">⭐ Remember This!</p>
                <div className="text-pink-900 font-kids text-lg font-semibold leading-relaxed">
                  {verse.final_takeaway.split('\n').slice(0, 4).map((line, i) => (
                    line.trim() ? <p key={i} className="mb-1">{line}</p> : null
                  ))}
                </div>
              </div>
            )}

            <div className="bg-red-900 rounded-2xl p-5 text-center">
              <p className="text-orange-300 font-kids font-bold text-base mb-2">🎯 Challenge!</p>
              <p className="text-red-100 font-kids text-base">
                Can you explain this verse to a friend in your own words?
                Try telling the story to someone in your family!
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
                    <p className="font-devanagari text-base leading-relaxed text-gray-700">{verse.rich_grammar.padacchedah}</p>
                  </div>
                )}

                {verse.rich_grammar.pratipadarthah && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h5 className="font-devanagari font-bold text-violet-800 text-lg mb-4">पदार्थः (Pratipadārthaḥ — Word Meanings)</h5>
                    <div className="text-base leading-relaxed text-gray-700">
                      {verse.rich_grammar.pratipadarthah.split('|').map((item, i) => {
                        const [word, meaning] = item.split('=').map(s => s.trim());
                        if (!word || !meaning) return null;
                        return (
                          <div key={i} className="flex items-baseline gap-2 py-1.5 border-b border-border last:border-0">
                            <span className="font-devanagari font-semibold text-red-800 min-w-[130px]">{word}</span>
                            <span className="text-gray-600">= {meaning}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {verse.rich_grammar.padaparicayah && verse.rich_grammar.padaparicayah.length > 0 && (
                  <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5 overflow-x-auto">
                    <h5 className="font-devanagari font-bold text-violet-800 text-base mb-4">पदपरिचयः (Padaparicayaḥ — Word Analysis Table)</h5>
                    <table className="w-full text-sm border-collapse min-w-[500px]">
                      <thead>
                        <tr className="bg-violet-100">
                          <th className="font-devanagari text-left p-2 border border-violet-200 text-violet-800">Word</th>
                          <th className="text-left p-2 border border-violet-200 text-violet-800">Anta</th>
                          <th className="text-left p-2 border border-violet-200 text-violet-800">Liṅga</th>
                          <th className="text-left p-2 border border-violet-200 text-violet-800">Vibhakti</th>
                          <th className="text-left p-2 border border-violet-200 text-violet-800">Vacanam</th>
                          <th className="text-left p-2 border border-violet-200 text-violet-800">Type</th>
                          <th className="text-left p-2 border border-violet-200 text-violet-800">Dhātu</th>
                          <th className="text-left p-2 border border-violet-200 text-violet-800">Lakāra</th>
                        </tr>
                      </thead>
                      <tbody>
                        {verse.rich_grammar.padaparicayah.map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-violet-50/50"}>
                            <td className="font-devanagari font-semibold text-red-800 p-2 border border-violet-200">{row.word}</td>
                            <td className="p-2 border border-violet-200 text-gray-600">{row.anta || "—"}</td>
                            <td className="font-devanagari p-2 border border-violet-200 text-gray-600">{row.linga || "—"}</td>
                            <td className="font-devanagari p-2 border border-violet-200 text-gray-600">{row.vibhakti || "—"}</td>
                            <td className="font-devanagari p-2 border border-violet-200 text-gray-600">{row.vacanam || "—"}</td>
                            <td className="p-2 border border-violet-200 text-gray-600">{row.type || "—"}</td>
                            <td className="font-devanagari p-2 border border-violet-200 text-gray-600">{row.dhatu || "—"}</td>
                            <td className="p-2 border border-violet-200 text-gray-600">{row.lakara || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {verse.rich_grammar.anvayah && (
                  <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5">
                    <h5 className="font-devanagari font-bold text-violet-800 text-base mb-3">अन्वयः (Anvayaḥ — Prose Order)</h5>
                    <p className="font-devanagari text-base leading-relaxed text-violet-900">{verse.rich_grammar.anvayah}</p>
                  </div>
                )}

                {verse.rich_grammar.sandhi && (
                  <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
                    <h5 className="font-devanagari font-bold text-orange-800 text-base mb-3">सन्धि (Sandhi — Phonetic Combinations)</h5>
                    <div className="text-base leading-relaxed text-orange-900">
                      {verse.rich_grammar.sandhi.split('|').map((item, i) => (
                        <p key={i} className="font-devanagari py-1.5">{item.trim()}</p>
                      ))}
                    </div>
                  </div>
                )}

                {verse.rich_grammar.samasa && (
                  <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5">
                    <h5 className="font-devanagari font-bold text-teal-800 text-base mb-3">समासः (Samāsa — Compound Words)</h5>
                    <div className="text-base leading-relaxed text-teal-900">
                      {verse.rich_grammar.samasa.split('|').map((item, i) => (
                        <p key={i} className="font-devanagari py-1.5">{item.trim()}</p>
                      ))}
                    </div>
                  </div>
                )}

                {verse.rich_grammar.other && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h5 className="font-devanagari font-bold text-violet-800 text-base mb-3">अन्य व्याकरण (Other Grammatical Aspects)</h5>
                    <div className="text-base leading-relaxed text-gray-700">
                      {verse.rich_grammar.other.split('|').map((item, i) => (
                        <p key={i} className="font-devanagari py-1.5">{item.trim()}</p>
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
                  {verse.grammar_notes.split('\n').map((line, i) => {
                    if (!line.trim()) return <br key={i} />;
                    if (line.includes('पदच्छेदः') || line.includes('अन्वयः') || line.includes('पदार्थः') || line.includes('समासः') || line.includes('सन्धि')) {
                      return <h5 key={i} className="font-devanagari font-bold text-violet-800 text-base mt-4 mb-2">{line}</h5>;
                    }
                    return <p key={i} className="my-1.5 font-devanagari text-base leading-relaxed text-gray-700">{line}</p>;
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

            {moreStoriesParsed.map((story, i) => (
              <div key={i} className="bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200 rounded-2xl overflow-hidden">
                <div className="px-5 pt-5 pb-3">
                  <h4 className="font-display font-bold text-rose-800 text-xl flex items-center gap-2">
                    <FlameKindling size={15} className="text-rose-500 flex-shrink-0" />
                    {story.title}
                  </h4>
                </div>

                {verse.images?.more_stories?.[i] && (
                  <div className="px-5">
                    <VerseImage
                      imageKey={`ch${chapterNum}_v${verseNum}_more_stories_${i}`}
                      url={verse.images.more_stories[i].url}
                      caption={verse.images.more_stories[i].caption}
                    />
                  </div>
                )}

                <div className="px-5 pb-5">
                  <div className="text-rose-900 text-lg leading-relaxed">
                    {formatStoryWithTakeaway(story.body)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Verse Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          {prevVerse ? (
            <Link
              href={`/chapter/${chapterNum}/verse/${prevVerse.verse}`}
              onClick={(e) => {
                e.preventDefault();
                navigateWithViewTransition(() =>
                  setLocation(`/chapter/${chapterNum}/verse/${prevVerse.verse}`)
                );
              }}
            >
              <button
                type="button"
                className="flex items-center gap-2 bg-card border border-border hover:border-orange-300 rounded-xl px-4 py-3 text-base font-semibold text-foreground transition-all group touch-manipulation"
              >
                <ChevronLeft size={18} className="group-hover:text-orange-500" />
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
              onClick={(e) => {
                e.preventDefault();
                navigateWithViewTransition(() => setLocation(`/chapter/${chapterNum}`));
              }}
            >
              <button type="button" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors touch-manipulation">
                <ChevronLeft size={16} />
                Chapter
              </button>
            </Link>
          )}

          <Link
            href={`/chapter/${chapterNum}`}
            onClick={(e) => {
              e.preventDefault();
              navigateWithViewTransition(() => setLocation(`/chapter/${chapterNum}`));
            }}
          >
            <button type="button" className="text-xs text-muted-foreground hover:text-orange-600 transition-colors px-3 py-2 touch-manipulation">
              {chapter.name}
            </button>
          </Link>

          {nextVerse ? (
            <Link
              href={`/chapter/${chapterNum}/verse/${nextVerse.verse}`}
              onClick={(e) => {
                e.preventDefault();
                navigateWithViewTransition(() =>
                  setLocation(`/chapter/${chapterNum}/verse/${nextVerse.verse}`)
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
                <ChevronRight size={16} className="group-hover:text-orange-500" />
              </button>
            </Link>
          ) : (
            <Link
              href={`/chapter/${chapterNum}`}
              onClick={(e) => {
                e.preventDefault();
                navigateWithViewTransition(() => setLocation(`/chapter/${chapterNum}`));
              }}
            >
              <button type="button" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors touch-manipulation">
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
