import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import gitaData from "@/data/gitaData.json";
import heroFeatureData from "@/data/heroFeatureLabels.json";
import type { GitaData, Verse } from "@/types/gita";
import { useChapterVisibility } from "@/contexts/ChapterVisibilityContext";
import { ChevronRight } from "lucide-react";
import { chapterIAST, chapterDevanagari } from "@/lib/chapterMeta";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { navigateWithViewTransition } from "@/lib/navigateWithViewTransition";

type HeroFeature = (typeof heroFeatureData.features)[number];

const data = gitaData as unknown as GitaData;

const HERO_IMG = "/gita-banner.png";

const chapterColorMap: Record<number, string> = {
  1: "from-red-800 to-red-700",
  2: "from-red-900 to-rose-700",
  3: "from-orange-800 to-orange-700",
  4: "from-yellow-800 to-orange-700",
  5: "from-green-800 to-teal-700",
  6: "from-teal-800 to-cyan-700",
  7: "from-violet-800 to-purple-700",
  8: "from-slate-800 to-red-800",
  9: "from-orange-800 to-yellow-700",
  10: "from-rose-800 to-pink-700",
  11: "from-purple-900 to-red-800",
  12: "from-pink-800 to-rose-700",
  13: "from-emerald-800 to-green-700",
  14: "from-cyan-800 to-teal-700",
  15: "from-lime-800 to-green-700",
  16: "from-red-900 to-orange-800",
  17: "from-orange-900 to-red-800",
  18: "from-yellow-900 to-orange-800",
};

function getChapterImage(ch: { chapter: number; key_verses: Verse[] }): string | null {
  const verses: Verse[] = ch.chapter === 6 ? data.chapter6_full : ch.key_verses;
  if (ch.chapter === 12) {
    const v2 = verses.find(v => v.verse === 2);
    if (v2?.images?.meaning?.url) return v2.images.meaning.url;
  }
  for (const v of verses) {
    if (v.images?.meaning?.url) return v.images.meaning.url;
  }
  return null;
}

function buildSynopsis(verses: Verse[]): string {
  if (verses.length === 0) return "";
  const meanings = verses.map((v) => v.one_line_meaning).filter(Boolean);
  if (meanings.length <= 4) return meanings.join(" ");
  const step = Math.floor(meanings.length / 4);
  return [meanings[0], meanings[step], meanings[step * 2], meanings[meanings.length - 1]].join(" ");
}

function ChapterSynopsis({ ch }: { ch: { chapter: number; key_verses: Verse[] } }) {
  const [expanded, setExpanded] = useState(false);
  const verses: Verse[] = ch.chapter === 6 ? data.chapter6_full : ch.key_verses;
  const synopsis = buildSynopsis(verses);
  if (!synopsis) return <p className="text-foreground/70 text-sm leading-relaxed line-clamp-2 flex-1">{(ch as any).summary}</p>;

  return (
    <div className="flex-1">
      <p className={`text-foreground/70 text-sm leading-relaxed ${!expanded ? 'line-clamp-2' : ''}`}>
        {synopsis}
      </p>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded(!expanded); }}
        className="text-orange-600 text-xs font-semibold mt-1 hover:underline"
      >
        {expanded ? 'less' : 'more'}
      </button>
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [kidsMode, setKidsMode] = useState(false);
  const [heroDialogOpen, setHeroDialogOpen] = useState(false);
  const [heroFeature, setHeroFeature] = useState<HeroFeature | null>(null);
  const closeClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isChapterVisible } = useChapterVisibility();

  useEffect(() => () => {
    if (closeClearTimer.current) clearTimeout(closeClearTimer.current);
  }, []);
  const visibleChapters = data.chapters.filter((ch) => isChapterVisible(ch.chapter));

  return (
    <Layout kidsMode={kidsMode} onToggleKids={() => setKidsMode(!kidsMode)}>
      <SEO
        path="/"
        description="Bhagavad Gita with authentic pronunciation, detailed meaning, stories and practical application tips for kids and adults."
        structuredData={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Bhagavad Gita - Gurukula.com",
          url: "https://gita.gurukula.com",
          description:
            "Bhagavad Gita with authentic pronunciation, detailed meaning, stories and practical application tips for kids and adults.",
          publisher: {
            "@type": "Organization",
            name: "Gurukula.com",
            url: "https://gurukula.com",
          },
        }}
      />
      {/*
        Mobile: title flows from top with pt-2 (tight to header) + in-flow height → text cannot grow under sticky header.
        Desktop: original short image + bottom overlay (unchanged).
      */}
      <section className="relative isolate overflow-hidden bg-red-950">
        <img
          src={HERO_IMG}
          alt=""
          className="absolute inset-0 z-0 h-full w-full object-cover opacity-50 md:hidden"
          aria-hidden
        />
        <div
          className="absolute inset-0 z-[1] bg-gradient-to-t from-red-950 via-red-950/60 to-red-950/20 pointer-events-none md:hidden"
          aria-hidden
        />

        <img
          src={HERO_IMG}
          alt="Bhagavad Gita — Krishna and Arjuna"
          className="relative z-0 hidden w-full object-cover opacity-50 md:block md:max-h-[260px]"
        />
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 z-[1] hidden h-[260px] bg-gradient-to-t from-red-950 via-red-950/60 to-red-950/20 md:block"
          aria-hidden
        />

        <div className="relative z-10 px-4 pt-2 pb-5 text-center sm:px-6 md:absolute md:inset-x-0 md:bottom-0 md:left-0 md:right-0 md:px-6 md:pb-8 md:pt-0 lg:pb-8">
          <h1 className="mb-1 text-white font-display text-3xl font-bold leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] max-md:text-[1.7rem] max-md:leading-snug sm:text-4xl lg:text-6xl">
            श्रीमद्भगवद्गीता
          </h1>
          <p className="mb-1 text-orange-100 text-base italic drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] sm:mb-2 sm:text-lg lg:text-xl font-semibold">
            śrīmadbhagavadgītā
          </p>
          <p className="mb-2 mt-1 text-white/95 text-sm font-medium tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] max-w-2xl mx-auto sm:mb-3 sm:text-base">
            The only Gita portal you will ever need
          </p>
          <div className="flex flex-wrap justify-center gap-1.5 max-md:max-w-[100%] sm:gap-2.5 max-w-4xl mx-auto">
            {heroFeatureData.features.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => {
                  if (closeClearTimer.current) clearTimeout(closeClearTimer.current);
                  setHeroFeature(chip);
                  setHeroDialogOpen(true);
                }}
                className={`inline-flex items-center rounded-lg border font-bold px-3 py-1.5 text-sm sm:text-[0.9375rem] leading-snug shadow-md drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)] cursor-pointer transition-transform duration-200 ease-out hover:scale-[1.03] hover:brightness-[1.06] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/90 ${chip.chipClass}`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <Dialog
        open={heroDialogOpen}
        onOpenChange={(open) => {
          setHeroDialogOpen(open);
          if (!open) {
            if (closeClearTimer.current) clearTimeout(closeClearTimer.current);
            closeClearTimer.current = setTimeout(() => setHeroFeature(null), 280);
          }
        }}
      >
        <DialogContent
          className="max-w-md gap-0 border-0 bg-transparent p-0 shadow-none duration-300 sm:max-w-md"
          showCloseButton
        >
          {heroFeature && (
            <div className="overflow-hidden rounded-2xl border border-orange-200/90 bg-gradient-to-br from-amber-50 via-orange-50/98 to-rose-50/95 shadow-2xl ring-1 ring-orange-900/10">
              <div
                className="h-1.5 w-full bg-gradient-to-r from-orange-600 via-amber-500 to-rose-600 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-500"
                aria-hidden
              />
              <DialogHeader className="space-y-4 px-6 pb-6 pt-5 text-left sm:text-left">
                <DialogTitle className="font-display text-xl text-red-950 sm:text-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 motion-safe:delay-75">
                  {heroFeature.label}
                </DialogTitle>
                <DialogDescription asChild>
                  <p className="text-base leading-relaxed text-foreground/90 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:delay-150">
                    {heroFeature.description}
                  </p>
                </DialogDescription>
              </DialogHeader>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Chapter Cards — full width (#27) */}
      <section className="px-4 py-8 lg:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleChapters.map((ch) => {
            const img = getChapterImage(ch as any);
            const chapterHref = `/chapter/${ch.chapter}`;
            return (
              <Link
                key={ch.chapter}
                href={chapterHref}
                onClick={(e) => {
                  e.preventDefault();
                  navigateWithViewTransition(() => setLocation(chapterHref));
                }}
              >
                <div className="chapter-card bg-card rounded-xl overflow-hidden shadow-sm border border-border [@media(hover:hover)]:hover:border-orange-300 [@media(hover:hover)]:hover:shadow-md transition-all group cursor-pointer h-full flex flex-col touch-manipulation">
                  {/* Colored header with image icon + translucent chapter number (#42) */}
                  <div className={`bg-gradient-to-r ${chapterColorMap[ch.chapter]} relative overflow-hidden flex`}>
                    {img && (
                      <img
                        src={img}
                        alt=""
                        className="w-28 h-auto object-cover flex-shrink-0"
                        loading="lazy"
                      />
                    )}
                    <div className="p-4 relative z-10 flex-1 min-w-0">
                      <span className="inline-block bg-white/20 text-white text-sm font-bold px-2 py-0.5 rounded mb-1">
                        Chapter {ch.chapter}
                      </span>
                      <p className="font-devanagari text-white text-2xl leading-tight mt-1">
                        {chapterDevanagari[ch.chapter] || ch.name_hindi}
                      </p>
                      <h3 className="text-white font-display font-bold text-xl leading-tight mt-0.5 truncate">
                        {chapterIAST[ch.chapter] || ""}
                      </h3>
                    </div>
                    {/* Chapter number watermark — visible but behind title (#82: stronger than /10) */}
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 font-display font-bold text-white/35 drop-shadow-[0_2px_6px_rgba(0,0,0,0.25)] text-7xl leading-none pointer-events-none select-none">
                      {ch.chapter}
                    </span>
                  </div>

                  {/* Body: synopsis + meta */}
                  <div className="p-4 flex-1 flex flex-col">
                    <ChapterSynopsis ch={ch as any} />
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        {ch.verses_count} {ch.verses_count === 1 ? "shloka" : "shlokas"}
                      </span>
                      <span className="text-xs text-orange-600 font-semibold flex items-center gap-1 [@media(hover:hover)]:group-hover:gap-2 transition-all">
                        Explore
                        <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-red-950 text-red-300 py-8 px-6 text-center">
        <p className="font-devanagari text-lg text-orange-300 mb-1">
          सर्वे भवन्तु सुखिनः
        </p>
        <p className="text-sm italic mb-3">May all beings be happy</p>
        <p className="text-xs text-red-400">
          Bhagavad Gita Gurukula.com
        </p>
      </footer>
    </Layout>
  );
}
