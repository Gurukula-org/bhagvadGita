import { useState, useRef, useCallback, useMemo, useEffect, type MouseEvent, type ReactNode } from "react";
import { Link, useParams, Redirect, useLocation } from "wouter";
import { navigateWithViewTransition } from "@/lib/navigateWithViewTransition";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import gitaData from "@/data/gitaData.json";
import type { GitaData, Verse } from "@/types/gita";
import { useChapterVisibility } from "@/contexts/ChapterVisibilityContext";
import { useImageUrl } from "@/hooks/useImages";
import { ChevronLeft, ChevronRight, BookOpen, Sparkles, Gamepad2, Play, Pause, RotateCcw, RotateCw } from "lucide-react";
import { chapterIAST, chapterDevanagari } from "@/lib/chapterMeta";
import { stripTransliterationVerseSuffix } from "@/lib/transliterationDisplay";
import { SandhiText } from "@/components/SandhiText";

const data = gitaData as unknown as GitaData;

function MeaningThumbnail({ chapterNum, verseNum, verse }: { chapterNum: number; verseNum: number; verse: Verse }) {
  const fallback = verse.images?.meaning?.url || "";
  const url = useImageUrl(`ch${chapterNum}_v${verseNum}_meaning`, fallback);
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      className="w-20 h-20 rounded-lg object-cover flex-shrink-0 border border-orange-200"
      loading="lazy"
    />
  );
}

const activeAudioRef: { current: HTMLAudioElement | null; verseNum: number | null; onEnd: (() => void) | null } = {
  current: null, verseNum: null, onEnd: null,
};

function VerseAudioButton({ audioUrl, verseNum, onEnded }: { audioUrl: string; verseNum: number; onEnded?: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (activeAudioRef.current === audioRef.current) {
        activeAudioRef.current = null;
        activeAudioRef.verseNum = null;
        activeAudioRef.onEnd = null;
      }
    };
  }, []);

  useEffect(() => {
    if (activeAudioRef.verseNum !== verseNum && playing) {
      setPlaying(false);
      setProgress(0);
      cancelAnimationFrame(rafRef.current);
    }
  });

  const updateProgress = useCallback(() => {
    const a = audioRef.current;
    if (a && !a.paused) {
      if (a.duration && !isNaN(a.duration)) {
        setProgress(a.currentTime / a.duration);
      }
      rafRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  const attachAudioListeners = useCallback(
    (a: HTMLAudioElement) => {
      a.addEventListener("ended", () => {
        setPlaying(false);
        setProgress(0);
        cancelAnimationFrame(rafRef.current);
        activeAudioRef.onEnd?.();
      });
      a.addEventListener("error", () => {
        setPlaying(false);
        setProgress(0);
        cancelAnimationFrame(rafRef.current);
      });
    },
    []
  );

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const a = new Audio();
      a.crossOrigin = "anonymous";
      a.src = audioUrl;
      attachAudioListeners(a);
      audioRef.current = a;
    }
    return audioRef.current;
  }, [audioUrl, attachAudioListeners]);

  const applySkip = useCallback(
    (delta: number) => {
      const a = ensureAudio();
      const adjust = () => {
        const d = a.duration;
        if (!d || isNaN(d)) return;
        a.currentTime = Math.max(0, Math.min(d, a.currentTime + delta));
        if (playing && d) setProgress(a.currentTime / d);
      };
      if (a.readyState >= HTMLMediaElement.HAVE_METADATA) adjust();
      else a.addEventListener("loadedmetadata", adjust, { once: true });
    },
    [ensureAudio, playing]
  );

  const skip = useCallback(
    (delta: number) => (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      applySkip(delta);
    },
    [applySkip]
  );

  const toggle = useCallback(() => {
    const a = ensureAudio();
    if (playing) {
      a.pause();
      setPlaying(false);
      cancelAnimationFrame(rafRef.current);
      if (activeAudioRef.current === a) {
        activeAudioRef.current = null;
        activeAudioRef.verseNum = null;
      }
    } else {
      if (activeAudioRef.current && activeAudioRef.current !== a) {
        activeAudioRef.current.pause();
      }
      activeAudioRef.current = a;
      activeAudioRef.verseNum = verseNum;
      activeAudioRef.onEnd = onEnded || null;
      a.currentTime = 0;
      a.play().catch(() => setPlaying(false));
      setPlaying(true);
      rafRef.current = requestAnimationFrame(updateProgress);
    }
  }, [ensureAudio, playing, verseNum, onEnded, updateProgress]);

  const SIZE = 44;
  const STROKE = 4;
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={skip(-5)}
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-red-800/90 hover:bg-orange-100/80 transition-colors"
        title="Rewind 5 seconds"
        aria-label="Rewind 5 seconds"
      >
        <RotateCcw size={14} />
      </button>
      <button
        type="button"
        data-verse-play
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }}
        className="flex-shrink-0 relative"
        style={{ width: SIZE, height: SIZE }}
        title={playing ? "Pause" : "Play shloka"}
      >
        <svg width={SIZE} height={SIZE} className="absolute inset-0 -rotate-90 pointer-events-none">
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            fill="none" stroke="currentColor" strokeWidth={STROKE}
            className="text-red-200"
          />
          {playing && (
            <circle
              cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
              fill="none" stroke="currentColor" strokeWidth={STROKE}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="text-orange-500 transition-[stroke-dashoffset] duration-200"
            />
          )}
        </svg>
        <span className={`absolute inset-[4px] rounded-full flex items-center justify-center transition-all ${
          playing ? "bg-red-900 text-white" : "bg-red-950 text-orange-300 [@media(hover:hover)]:hover:bg-red-800"
        }`}>
          {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </span>
      </button>
      <button
        type="button"
        onClick={skip(5)}
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-red-800/90 hover:bg-orange-100/80 transition-colors"
        title="Forward 5 seconds"
        aria-label="Forward 5 seconds"
      >
        <RotateCw size={14} />
      </button>
    </div>
  );
}

function buildSynopsis(verses: Verse[]): string {
  if (verses.length === 0) return "";
  const meanings = verses.map((v) => v.one_line_meaning).filter(Boolean);
  if (meanings.length <= 4) return meanings.join(" ");
  const step = Math.floor(meanings.length / 4);
  return [meanings[0], meanings[step], meanings[step * 2], meanings[meanings.length - 1]].join(" ");
}

function renderSynopsisWithHighlights(text: string): ReactNode[] {
  const highlightTerms = [
    "imperishable unmanifest brahman",
    "dedicate all actions",
    "primary goal",
    "best yogis",
    "meditate",
    "devotees",
    "Bhagavān",
    "Bhagavan",
    "Kṛṣṇa",
    "Krishna",
    "Arjuna",
  ];
  const escapedTerms = highlightTerms
    .sort((a, b) => b.length - a.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escapedTerms.join("|")})`, "gi");
  const parts = text.split(pattern);

  return parts.map((part, index) => {
    if (part && highlightTerms.some((term) => term.toLowerCase() === part.toLowerCase())) {
      return (
        <strong key={`${part}-${index}`} className="font-semibold text-orange-100">
          {part}
        </strong>
      );
    }
    return <span key={`plain-${index}`}>{part}</span>;
  });
}

const CARD_TAB_LINKS = [
  { label: "Meaning", tab: "meaning" },
  { label: "Story", tab: "story" },
  { label: "Life Impact", tab: "impact" },
  { label: "Grammar", tab: "grammar" },
] as const;

/** First N shlokas shown as quick chips; larger chapters use the dropdown for the rest. */
const QUICK_SHLOKA_CHIP_COUNT = 8;

export default function ChapterPage() {
  const params = useParams<{ chapterNum: string }>();
  const chapterNum = parseInt(params.chapterNum || "1");
  const [, setLocation] = useLocation();
  const [kidsMode, setKidsMode] = useState(false);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [jumpSelectKey, setJumpSelectKey] = useState(0);

  useEffect(() => {
    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
        activeAudioRef.verseNum = null;
        activeAudioRef.onEnd = null;
      }
    };
  }, []);

  const { isChapterVisible } = useChapterVisibility();
  const chapter = data.chapters.find((c) => c.chapter === chapterNum);

  const verses: Verse[] = chapter
    ? (chapterNum === 6 ? data.chapter6_full : chapter.key_verses)
    : [];

  const synopsis = useMemo(() => buildSynopsis(verses), [verses]);
  const versesSorted = useMemo(
    () => [...verses].sort((a, b) => a.verse - b.verse),
    [verses]
  );
  const quickVerses = useMemo(
    () => versesSorted.slice(0, QUICK_SHLOKA_CHIP_COUNT),
    [versesSorted]
  );
  const scrollToVerseCard = useCallback((verseNum: number) => {
    const el = document.getElementById(`verse-card-${verseNum}`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const headerH = 64;
    const y = window.scrollY + rect.top - headerH - 12;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }, []);

  if (!chapter) return <div className="p-8 text-center">Chapter not found</div>;
  if (!isChapterVisible(chapterNum)) return <Redirect to="/" />;

  const prevChapter = chapterNum > 1 ? chapterNum - 1 : null;
  const nextChapter = chapterNum < 18 ? chapterNum + 1 : null;

  const devanagariName = chapterDevanagari[chapterNum] || chapter.name_hindi;
  const iastName = chapterIAST[chapterNum] || "";
  const headerImage = (() => {
    if (chapterNum === 12) {
      const v2 = verses.find(v => v.verse === 2);
      if (v2?.images?.meaning?.url) return v2.images.meaning.url;
    }
    return verses[0]?.images?.meaning?.url || null;
  })();

  const chapterTitle = `Chapter ${chapterNum} — ${iastName || chapter.name} (${devanagariName})`;
  const chapterDescription = chapter.summary ||
    `${chapter.subtitle} — Explore ${chapter.verses_count} verses of Chapter ${chapterNum} (${chapter.name}) of the Bhagavad Gita with Sanskrit, transliteration, meanings, stories, and kid-friendly explanations.`;

  return (
    <Layout kidsMode={kidsMode} onToggleKids={() => setKidsMode(!kidsMode)}>
      <SEO
        title={chapterTitle}
        description={chapterDescription}
        path={`/chapter/${chapterNum}`}
        image={headerImage || undefined}
        type="article"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "Article",
          name: chapterTitle,
          headline: `Bhagavad Gita Chapter ${chapterNum} — ${chapter.name}`,
          description: chapterDescription,
          url: `https://gita.gurukula.com/chapter/${chapterNum}`,
          isPartOf: {
            "@type": "WebSite",
            name: "Bhagavad Gita - Gurukula.com",
            url: "https://gita.gurukula.com",
          },
        }}
      />
      {/* Chapter Header (#24, #44) */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/60 to-red-900/90 z-[1]" />
        {headerImage && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{ backgroundImage: `url(${headerImage})` }}
          />
        )}
        {/* Translucent chapter number — top right (#44, #67) */}
        <div className="absolute top-0 right-0 z-[2] pointer-events-none select-none pr-4 pt-2 sm:pr-6 sm:pt-3">
          <span className="font-display font-bold text-white/25 text-[8rem] sm:text-[10rem] lg:text-[12rem] leading-none block">
            {chapterNum}
          </span>
        </div>
        <div className="relative z-10 px-4 lg:px-6 py-8 lg:py-12">
          <div className="flex items-center gap-2 text-red-300 text-sm mb-5">
            <Link
              href="/"
              className="hover:text-orange-300 transition-colors touch-manipulation"
              onClick={(e) => {
                e.preventDefault();
                navigateWithViewTransition(() => setLocation("/"));
              }}
            >
              Home
            </Link>
            <ChevronRight size={14} />
            <span className="text-orange-300">Chapter {chapterNum}</span>
          </div>

          <div className="flex gap-5 items-start w-full">
            {/* Chapter image icon on left (#24) */}
            {headerImage && (
              <img
                src={headerImage}
                alt=""
                className="w-20 h-20 lg:w-28 lg:h-28 rounded-xl object-cover flex-shrink-0 border-2 border-white/20 shadow-lg hidden sm:block"
              />
            )}

            <div className="flex-1 min-w-0">
              <p className="text-orange-400 text-xs font-semibold uppercase tracking-widest mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span
                  className="inline-flex items-center rounded-lg bg-white/20 border border-white/35 px-2.5 py-1 text-white shadow-md backdrop-blur-sm normal-case tracking-normal font-bold text-[11px] sm:text-xs whitespace-nowrap"
                  title={`Chapter ${chapterNum} of 18 in the Bhagavad Gita`}
                >
                  Chapter {chapterNum} of 18
                </span>
                <span
                  className="inline-flex items-center rounded-lg bg-white/20 border border-white/35 px-2.5 py-1 text-white shadow-md backdrop-blur-sm normal-case tracking-normal font-bold text-[11px] sm:text-xs whitespace-nowrap"
                  title={`This chapter has ${chapter.verses_count} verses in the Bhagavad Gita`}
                >
                  {chapter.verses_count} {chapter.verses_count === 1 ? "Shloka" : "Shlokas"}
                </span>
                {chapterNum === 6 && (
                  <span className="inline-flex items-center gap-1 bg-orange-400 text-red-950 text-xs font-bold px-2 py-0.5 rounded-full">
                    <Sparkles size={10} />
                    Full Journey Content
                  </span>
                )}
              </p>

              {/* IAST as main title (#24) */}
              <h1 className="text-white font-display text-3xl lg:text-5xl font-bold leading-tight mb-1">
                {iastName || chapter.name}
              </h1>
              <p className="text-orange-300 font-devanagari text-xl lg:text-2xl mb-0">{devanagariName}</p>
            </div>
          </div>

          {/* Synopsis — below image level, full width (#68) */}
          {synopsis && (
            <div className="mt-3">
              <p className={`text-red-100 text-base lg:text-lg leading-relaxed w-full ${!synopsisExpanded ? 'line-clamp-2' : ''}`}>
                {renderSynopsisWithHighlights(synopsis)}
              </p>
              <button
                type="button"
                onClick={() => setSynopsisExpanded(!synopsisExpanded)}
                className="text-orange-300 text-xs font-semibold mt-1 hover:underline"
              >
                {synopsisExpanded ? 'less' : 'more'}
              </button>
            </div>
          )}

          {versesSorted.length > 0 && (
            <nav
              className="mt-3 w-full min-w-0"
              aria-label={`Jump to a shloka in chapter ${chapterNum}`}
            >
              <div className="flex flex-col gap-2.5 sm:gap-3">
                <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center">
                  {quickVerses.map((v) => (
                    <button
                      key={v.verse}
                      type="button"
                      onClick={() => scrollToVerseCard(v.verse)}
                      className="flex-shrink-0 inline-flex items-center justify-center min-w-[2.25rem] h-9 px-2 rounded-lg border-2 border-orange-300/60 bg-white/15 text-orange-50 text-sm font-bold tabular-nums shadow-sm transition-all [@media(hover:hover)]:hover:bg-orange-400/30 [@media(hover:hover)]:hover:border-orange-200 [@media(hover:hover)]:hover:text-white [@media(hover:hover)]:hover:shadow-md [@media(hover:hover)]:hover:-translate-y-px active:scale-[0.97] cursor-pointer underline-offset-2 [@media(hover:hover)]:hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 focus-visible:ring-offset-2 focus-visible:ring-offset-red-950/90"
                      aria-label={`Scroll to shloka ${chapterNum}.${v.verse}`}
                    >
                      {v.verse}
                    </button>
                  ))}
                </div>
                {versesSorted.length > QUICK_SHLOKA_CHIP_COUNT && (
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <label
                      htmlFor={`jump-shloka-${chapterNum}`}
                      className="text-orange-200/95 text-[11px] sm:text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                    >
                      Jump to shloka
                    </label>
                    <select
                      id={`jump-shloka-${chapterNum}`}
                      key={jumpSelectKey}
                      defaultValue=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        scrollToVerseCard(Number(v));
                        setJumpSelectKey((k) => k + 1);
                      }}
                      className="min-w-[8.5rem] max-w-full rounded-lg border-2 border-orange-300/60 bg-red-950/80 text-orange-50 text-sm font-bold tabular-nums px-3 py-2 shadow-sm cursor-pointer transition-colors [@media(hover:hover)]:hover:border-orange-200 [@media(hover:hover)]:hover:bg-red-900/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 focus-visible:ring-offset-2 focus-visible:ring-offset-red-950/90"
                      aria-label={`Choose a shloka number to scroll to in chapter ${chapterNum}`}
                    >
                      <option value="" disabled>
                        Choose number…
                      </option>
                      {versesSorted.map((v) => (
                        <option key={v.verse} value={String(v.verse)}>
                          {v.verse}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </nav>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-5">
            <Link
              href={`/chapter/${chapterNum}/summary`}
              aria-label={`Open chapter ${chapterNum} summary — full synopsis and illustrations`}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-300 via-orange-300 to-orange-400 px-5 py-2.5 text-sm font-bold text-red-950 shadow-lg shadow-black/25 ring-2 ring-white/70 hover:from-amber-200 hover:via-orange-200 hover:to-orange-300 hover:ring-white hover:shadow-xl active:scale-[0.98] transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-red-950/80"
              onClick={(e) => {
                e.preventDefault();
                navigateWithViewTransition(() => setLocation(`/chapter/${chapterNum}/summary`));
              }}
            >
              <BookOpen size={18} strokeWidth={2.25} className="shrink-0" aria-hidden />
              <span>View Chapter Summary</span>
              <ChevronRight
                size={18}
                strokeWidth={2.25}
                className="shrink-0 opacity-90 group-hover:translate-x-1 transition-transform"
                aria-hidden
              />
            </Link>
            {chapterNum === 6 && (
              <>
                <div className="flex items-center gap-2 bg-orange-400/20 border border-orange-400/40 rounded-full px-3 py-1.5">
                  <Sparkles size={13} className="text-orange-400" />
                  <span className="text-orange-300 text-sm font-semibold">{verses.length} full explanations</span>
                </div>
                <Link
                  href={`/chapter/${chapterNum}/games`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateWithViewTransition(() => setLocation(`/chapter/${chapterNum}/games`));
                  }}
                >
                  <div className="flex items-center gap-2 bg-pink-400/20 border border-pink-400/40 hover:bg-pink-400/30 rounded-full px-3 py-1.5 transition-all cursor-pointer touch-manipulation">
                    <Gamepad2 size={13} className="text-pink-300" />
                    <span className="text-pink-200 text-sm font-semibold">5 Interactive Games</span>
                  </div>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Verse Grid — full width (#27) */}
      <div className="px-4 py-8 w-full">
        {chapterNum !== 6 && verses.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg font-display">Key verses coming soon</p>
            <p className="text-sm mt-1">Chapter {chapterNum} content is being prepared</p>
          </div>
        )}

        {chapterNum === 6 && (
          <div className="mb-6">
            <Link
              href={`/chapter/${chapterNum}/games`}
              onClick={(e) => {
                e.preventDefault();
                navigateWithViewTransition(() => setLocation(`/chapter/${chapterNum}/games`));
              }}
            >
              <div className="bg-gradient-to-r from-pink-500 to-violet-600 rounded-2xl p-5 flex items-center justify-between shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 cursor-pointer touch-manipulation">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">🎮</span>
                    <span className="text-white font-kids font-bold text-lg">Play Learning Games!</span>
                  </div>
                  <p className="text-pink-100 font-kids text-sm">5 fun games: Match, Quiz, Fill-in-Blank, Scramble & Speed Round</p>
                </div>
                <div className="bg-white/20 rounded-full p-3 flex-shrink-0">
                  <Gamepad2 size={24} className="text-white" />
                </div>
              </div>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {verses.map((verse, idx) => (
            <Link
              key={verse.verse}
              href={`/chapter/${chapterNum}/verse/${verse.verse}`}
              id={`verse-card-${verse.verse}`}
              onClick={(e) => {
                e.preventDefault();
                navigateWithViewTransition(() =>
                  setLocation(`/chapter/${chapterNum}/verse/${verse.verse}`)
                );
              }}
            >
              <div className="group bg-card border-2 border-orange-200/70 [@media(hover:hover)]:hover:border-orange-400 rounded-xl p-3 sm:p-4 transition-all [@media(hover:hover)]:hover:shadow-xl active:scale-[0.995] cursor-pointer h-full flex flex-col relative touch-manipulation">
                <div
                  className="mb-2 border-b border-violet-200 pb-1.5"
                  onPointerDownCapture={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1">
                      {CARD_TAB_LINKS.map(({ label, tab }, idx) => (
                        <span key={label} className="inline-flex items-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigateWithViewTransition(() =>
                                setLocation(`/chapter/${chapterNum}/verse/${verse.verse}?tab=${tab}`)
                              );
                            }}
                            className="inline-flex items-center border-b border-transparent px-1 py-0 text-[11px] sm:text-xs font-semibold text-violet-800 hover:text-violet-900 hover:border-violet-300 transition-colors"
                          >
                            {label}
                          </button>
                          {idx < CARD_TAB_LINKS.length - 1 && (
                            <span className="text-violet-300 text-[10px] sm:text-xs select-none px-0.5">|</span>
                          )}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigateWithViewTransition(() =>
                          setLocation(`/chapter/${chapterNum}/verse/${verse.verse}`)
                        );
                      }}
                      className="inline-flex items-center gap-0.5 rounded-full border border-violet-300 bg-white px-1.5 py-0.5 text-[11px] sm:text-xs font-bold text-violet-800 hover:bg-violet-100 transition-colors whitespace-nowrap"
                    >
                      More
                      <ChevronRight size={11} />
                    </button>
                  </div>
                </div>
                {/* Header: thumbnail + verse label + optional Listen (titles on verse page only) */}
                <div className="flex items-start gap-3 mb-2">
                  <MeaningThumbnail chapterNum={chapterNum} verseNum={verse.verse} verse={verse} />
                  <div className="flex-1 min-w-0 flex items-start justify-between gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-xl sm:text-2xl font-bold text-red-950 block tabular-nums tracking-tight">
                        {chapterNum}.{verse.verse}
                      </span>
                    </div>
                    {verse.audio_url && (
                      <div
                        className="shrink-0 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 rounded-lg border border-orange-200/90 bg-gradient-to-br from-orange-50/95 to-amber-50/70 px-2 py-1.5 shadow-sm max-w-[calc(100%-0.5rem)] sm:max-w-none"
                        onPointerDownCapture={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wide text-orange-950">
                          Listen
                        </span>
                        <VerseAudioButton
                          audioUrl={verse.audio_url}
                          verseNum={verse.verse}
                          onEnded={idx < verses.length - 1 && verses[idx + 1].audio_url ? () => {
                            const nextCard = document.getElementById(`verse-card-${verses[idx + 1].verse}`);
                            if (!nextCard) return;
                            const rect = nextCard.getBoundingClientRect();
                            const headerH = 64;
                            const cardVisible = rect.top >= headerH && rect.top < window.innerHeight - 100;
                            if (!cardVisible) {
                              const y = window.scrollY + rect.top - headerH - 12;
                              window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
                            }
                            setTimeout(() => {
                              nextCard.querySelector<HTMLButtonElement>("button[data-verse-play]")?.click();
                            }, 600);
                          } : undefined}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Sanskrit — no negative margin (avoids overlap with thumbnail) */}
                <div className="font-devanagari text-red-900 text-lg leading-relaxed mb-1.5">
                  {verse.sanskrit.split('\n').map((line, i) => (
                    <p key={i}><SandhiText text={line} /></p>
                  ))}
                </div>

                {/* IAST transliteration */}
                {verse.transliteration && (
                  <div className="text-orange-700 text-base italic leading-relaxed mb-2">
                    {verse.transliteration.split('\n').map((line, i) => (
                      <p key={i}><SandhiText text={stripTransliterationVerseSuffix(line)} /></p>
                    ))}
                  </div>
                )}

                {/* One-line meaning */}
                <p className="text-foreground/80 text-base leading-relaxed mb-2 flex-1">
                  {verse.one_line_meaning}
                </p>

                {/* Word-by-word meaning inline (#39.5, #54) */}
                {verse.rich_grammar?.pratipadarthah && (
                  <div className="border-t border-border pt-2 mb-2">
                    <p className="text-base leading-relaxed">
                      {verse.rich_grammar.pratipadarthah.split('|').map((item, i, arr) => {
                        const [word, meaning] = item.split('=').map(s => s.trim());
                        if (!word || !meaning) return null;
                        return (
                          <span key={i}>
                            <span className="font-devanagari text-red-800 font-semibold">{word}</span>
                            <span className="text-foreground/70"> = {meaning}</span>
                            {i < arr.length - 1 && <span className="text-muted-foreground">, </span>}
                          </span>
                        );
                      })}
                    </p>
                  </div>
                )}

                {/* Reflection questions */}
                {verse.reflection && (
                  <div className="border-t border-border pt-2 mt-auto">
                    <p className="text-sm font-semibold text-violet-600 mb-1">Reflection</p>
                    <div className="space-y-1">
                      {verse.reflection.split('\n').filter(l => l.trim()).slice(0, 2).map((q, i) => (
                        <p key={i} className="text-sm text-muted-foreground leading-relaxed flex gap-1.5">
                          <span className="text-violet-400 flex-shrink-0">◈</span>
                          <span className="line-clamp-2">{q}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* View details button — always visible, not overlapping (#52) */}
                <div className="mt-3 pt-2 border-t border-orange-200">
                  <span className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-600 text-sm font-semibold px-3 py-1.5 rounded-lg border border-orange-200 [@media(hover:hover)]:group-hover:bg-orange-100 [@media(hover:hover)]:group-hover:border-orange-300 transition-all">
                    View details
                    <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Chapter Navigation */}
        <div className="flex items-center justify-between mt-10 pt-6 border-t border-border">
          {prevChapter ? (
            <Link
              href={`/chapter/${prevChapter}`}
              onClick={(e) => {
                e.preventDefault();
                navigateWithViewTransition(() => setLocation(`/chapter/${prevChapter}`));
              }}
            >
              <button type="button" className="flex items-center gap-2 text-sm text-red-800 hover:text-orange-600 transition-colors font-semibold touch-manipulation">
                <ChevronLeft size={16} />
                Chapter {prevChapter}
              </button>
            </Link>
          ) : <div />}

          <Link
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigateWithViewTransition(() => setLocation("/"));
            }}
          >
            <button type="button" className="text-sm text-muted-foreground hover:text-foreground transition-colors touch-manipulation">
              All Chapters
            </button>
          </Link>

          {nextChapter ? (
            <Link
              href={`/chapter/${nextChapter}`}
              onClick={(e) => {
                e.preventDefault();
                navigateWithViewTransition(() => setLocation(`/chapter/${nextChapter}`));
              }}
            >
              <button type="button" className="flex items-center gap-2 text-sm text-red-800 hover:text-orange-600 transition-colors font-semibold touch-manipulation">
                Chapter {nextChapter}
                <ChevronRight size={16} />
              </button>
            </Link>
          ) : <div />}
        </div>
      </div>
    </Layout>
  );
}
