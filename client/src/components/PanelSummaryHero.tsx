import { useEffect, useState, type KeyboardEvent } from "react";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { ImageModal } from "@/components/ImageModal";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useImageUrl } from "@/hooks/useImages";
import { cn } from "@/lib/utils";

type PanelSummaryHeroProps = {
  chapterNum: number;
  verseNum: number;
  url: string;
  caption?: string;
  title?: string;
  className?: string;
};

/**
 * Collapsible hero for the 12-panel shloka journey composite (above verse tabs).
 * Default: wide button with title + subtitle. Tap/click expands to show the panel.
 */
export function PanelSummaryHero({
  chapterNum,
  verseNum,
  url,
  caption,
  title,
  className,
}: PanelSummaryHeroProps) {
  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const imageKey = `ch${chapterNum}_v${verseNum}_panel_summary`;
  const resolvedUrl = useImageUrl(imageKey, url);
  const displayCaption =
    caption?.trim() ||
    "Twelve-panel visual summary of this shloka journey";
  const heading =
    title?.trim() || `Bhagavad Gita ${chapterNum}.${verseNum} — journey at a glance`;
  const headingId = `panel-summary-heading-${chapterNum}-${verseNum}`;

  useEffect(() => {
    setExpanded(false);
    setModalOpen(false);
  }, [chapterNum, verseNum, resolvedUrl]);

  if (!resolvedUrl?.trim()) return null;

  return (
    <section
      className={cn(
        "border-b border-orange-200/80 bg-gradient-to-b from-amber-50/90 to-orange-50/40",
        className,
      )}
      aria-label="Panel journey summary"
    >
      <div className="mx-auto w-full max-w-5xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger
            type="button"
            className={cn(
              "group/panel-trigger flex w-full items-center gap-3 sm:gap-4",
              "rounded-xl border-2 border-orange-300/90",
              "bg-gradient-to-r from-orange-100 via-amber-50 to-orange-50",
              "px-3.5 py-3.5 sm:px-5 sm:py-4",
              "text-left shadow-sm touch-manipulation",
              "transition-all duration-200",
              "hover:border-orange-400 hover:from-orange-200/90 hover:to-amber-100/90",
              "active:scale-[0.99] active:shadow-inner",
              "outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2",
              expanded && "rounded-b-none border-b-orange-200/70 shadow-md",
            )}
            aria-controls={`panel-summary-content-${chapterNum}-${verseNum}`}
          >
            <span
              className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg bg-orange-200/80 text-orange-800 shadow-inner"
              aria-hidden
            >
              <LayoutGrid
                className="h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]"
                strokeWidth={2.25}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span
                id={headingId}
                className="block text-sm sm:text-base font-bold text-orange-950 leading-snug"
              >
                {heading}
              </span>
              <span className="mt-0.5 block text-xs sm:text-sm font-medium text-orange-800/95 leading-snug">
                {displayCaption}
              </span>
              <span className="mt-1.5 block text-[11px] sm:text-xs text-orange-700/80">
                {expanded ? "Tap to hide panel" : "Tap to view twelve-panel summary"}
              </span>
            </span>
            <ChevronDown
              className={cn(
                "h-5 w-5 sm:h-6 sm:w-6 shrink-0 text-orange-700 transition-transform duration-200",
                expanded && "rotate-180",
              )}
              aria-hidden
            />
          </CollapsibleTrigger>

          <CollapsibleContent
            id={`panel-summary-content-${chapterNum}-${verseNum}`}
            className={cn(
              "overflow-hidden border-2 border-t-0 border-orange-300/90 rounded-b-xl",
              "bg-white/95 shadow-sm",
              "data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
            )}
          >
            <div className="px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
              <button
                type="button"
                className={cn(
                  "group/panel-summary relative w-full rounded-xl border border-orange-200/80",
                  "bg-gradient-to-br from-orange-50/50 to-amber-50/30",
                  "overflow-hidden touch-manipulation",
                  "outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2",
                )}
                onClick={e => {
                  e.stopPropagation();
                  setModalOpen(true);
                }}
                onKeyDown={(e: KeyboardEvent) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  e.stopPropagation();
                  setModalOpen(true);
                }}
                aria-label={`Open full-screen panel summary for shloka ${chapterNum}.${verseNum}`}
              >
                <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] lg:aspect-[2/1] max-h-[min(72vh,520px)] sm:max-h-[min(68vh,560px)]">
                  <img
                    src={resolvedUrl}
                    alt={`${chapterNum}.${verseNum} twelve-panel journey summary`}
                    className="absolute inset-0 h-full w-full object-contain object-center p-1 sm:p-1.5 transition-opacity [@media(hover:hover)]:group-hover/panel-summary:opacity-[0.92]"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <span className="absolute bottom-2 right-2 rounded-lg bg-black/55 px-2 py-1 text-[10px] sm:text-xs font-medium text-white backdrop-blur-sm">
                  Tap to enlarge
                </span>
              </button>
              <p className="text-center text-[11px] sm:text-xs text-muted-foreground px-2 pt-2 leading-snug">
                Tap the image again for full-screen view on mobile.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {modalOpen && (
        <ImageModal
          src={resolvedUrl}
          alt={`Bhagavad Gita ${chapterNum}.${verseNum} panel summary`}
          onClose={() => setModalOpen(false)}
        />
      )}
    </section>
  );
}
