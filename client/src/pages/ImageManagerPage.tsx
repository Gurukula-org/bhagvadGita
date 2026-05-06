import { useState } from "react";
import { Link, useLocation } from "wouter";
import { navigateWithViewTransition } from "@/lib/navigateWithViewTransition";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import EditableImage from "@/components/EditableImage";
import { useAuth } from "@/contexts/AuthContext";
import { useChapterVisibility } from "@/contexts/ChapterVisibilityContext";
import gitaData from "@/data/gitaData.json";
import type { GitaData, Verse } from "@/types/gita";
import { ShieldAlert, ChevronRight, ImageIcon, ChevronDown } from "lucide-react";

const data = gitaData as unknown as GitaData;

function parseMoreStoryTitles(text: string): string[] {
  const titles: string[] = [];
  for (const line of text.split("\n")) {
    if (/^\d+\.\s/.test(line) && line.length < 120) {
      titles.push(line.replace(/^\d+\.\s*/, "").trim());
    }
  }
  return titles;
}

interface ImageSlot {
  key: string;
  label: string;
  fallbackUrl: string;
  caption?: string;
}

function getVerseImageSlots(ch: number, v: number, verse: Verse): ImageSlot[] {
  const slots: ImageSlot[] = [];
  const prefix = `ch${ch}_v${v}`;

  if (verse.images?.meaning) {
    slots.push({ key: `${prefix}_meaning`, label: "Meaning", fallbackUrl: verse.images.meaning.url, caption: verse.images.meaning.caption });
  }
  if (verse.images?.story) {
    verse.images.story.forEach((img, i) => {
      slots.push({ key: `${prefix}_story_${i}`, label: `Story Image ${i + 1}`, fallbackUrl: img.url, caption: img.caption });
    });
  }
  if (verse.images?.modern_life) {
    slots.push({ key: `${prefix}_modern_life`, label: "Impact / Modern Life", fallbackUrl: verse.images.modern_life.url, caption: verse.images.modern_life.caption });
  }
  if (verse.images?.kids_explain) {
    slots.push({ key: `${prefix}_kids_explain`, label: "Kids Explanation", fallbackUrl: verse.images.kids_explain.url, caption: verse.images.kids_explain.caption });
  }
  if (verse.images?.kids_story) {
    slots.push({ key: `${prefix}_kids_story`, label: "Kids Story", fallbackUrl: verse.images.kids_story.url, caption: verse.images.kids_story.caption });
  }
  if (verse.images?.detailed_meaning) {
    slots.push({ key: `${prefix}_detailed_meaning`, label: "Detailed Meaning", fallbackUrl: verse.images.detailed_meaning.url, caption: verse.images.detailed_meaning.caption });
  }
  if (verse.images?.more_stories) {
    const storyTitles = verse.more_stories ? parseMoreStoryTitles(verse.more_stories) : [];
    verse.images.more_stories.forEach((img, i) => {
      const storyName = storyTitles[i] || `Story ${i + 1}`;
      slots.push({ key: `${prefix}_more_stories_${i}`, label: `More Stories: ${storyName}`, fallbackUrl: img.url, caption: img.caption });
    });
  }
  if (verse.images?.grammar) {
    slots.push({ key: `${prefix}_grammar`, label: "Grammar", fallbackUrl: verse.images.grammar.url, caption: verse.images.grammar.caption });
  }

  return slots;
}

function VerseImageManager({ chapter, verse }: { chapter: number; verse: Verse }) {
  const [expanded, setExpanded] = useState(false);
  const slots = getVerseImageSlots(chapter, verse.verse, verse);

  if (slots.length === 0) return null;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-orange-50 transition-colors text-left"
      >
        <ImageIcon size={16} className="text-orange-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm text-foreground">
            Verse {verse.verse}
          </span>
          {verse.title && (
            <span className="text-muted-foreground text-sm ml-2">— {verse.title}</span>
          )}
          <span className="text-xs text-orange-600 ml-2">({slots.length} images)</span>
        </div>
        <ChevronDown size={16} className={`text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="p-4 border-t border-border bg-muted/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {slots.map((slot) => (
              <div key={slot.key} className="space-y-2">
                <p className="text-xs font-semibold text-orange-700 truncate" title={slot.label}>
                  {slot.label}
                </p>
                <EditableImage
                  imageKey={slot.key}
                  fallbackUrl={slot.fallbackUrl}
                  alt={slot.caption || slot.label}
                  caption={slot.caption}
                  className="rounded-lg overflow-hidden border border-border shadow-sm"
                  imgClassName="w-full h-40 object-cover"
                />
                <p className="text-xs text-muted-foreground truncate" title={slot.key}>
                  Key: {slot.key}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ImageManagerPage() {
  const [, setLocation] = useLocation();
  const { isAdmin, user, signIn } = useAuth();
  const { isChapterVisible } = useChapterVisibility();
  const [selectedChapter, setSelectedChapter] = useState<number>(12);

  if (!isAdmin) {
    return (
      <Layout>
        <SEO title="Image Manager" path="/settings/images" noindex />
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
          <ShieldAlert size={48} className="text-red-400 mb-4" />
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            Admin Access Required
          </h1>
          <p className="text-muted-foreground text-sm mb-6 text-center max-w-sm">
            Only authorized administrators can manage images.
          </p>
          {!user && (
            <button
              onClick={signIn}
              className="flex items-center gap-2 bg-red-900 hover:bg-red-800 text-white font-semibold px-6 py-3 rounded-full transition-all"
            >
              Sign in as Admin
            </button>
          )}
          <Link
            href="/"
            className="text-sm text-orange-600 hover:underline mt-4 touch-manipulation"
            onClick={(e) => {
              e.preventDefault();
              navigateWithViewTransition(() => setLocation("/"));
            }}
          >
            ← Back to Home
          </Link>
        </div>
      </Layout>
    );
  }

  const chapter = data.chapters.find((c) => c.chapter === selectedChapter);
  const verses: Verse[] = selectedChapter === 6
    ? data.chapter6_full
    : chapter?.key_verses || [];

  const versesWithImages = verses.filter((v) => v.images);

  return (
    <Layout>
      <SEO title="Image Manager" path="/settings/images" noindex />
      <div className="px-4 py-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link
            href="/"
            className="hover:text-orange-600 transition-colors touch-manipulation"
            onClick={(e) => {
              e.preventDefault();
              navigateWithViewTransition(() => setLocation("/"));
            }}
          >
            Home
          </Link>
          <ChevronRight size={14} />
          <Link
            href="/settings"
            className="hover:text-orange-600 transition-colors touch-manipulation"
            onClick={(e) => {
              e.preventDefault();
              navigateWithViewTransition(() => setLocation("/settings"));
            }}
          >
            Settings
          </Link>
          <ChevronRight size={14} />
          <span className="text-foreground font-medium">Image Manager</span>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <ImageIcon size={24} className="text-orange-600" />
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">
            Image Manager
          </h1>
        </div>
        <p className="text-muted-foreground text-sm mb-6">
          Review and replace images for each verse. Hover over any image and click the pencil icon to upload a replacement.
        </p>

        <div className="flex items-center gap-3 mb-6">
          <label className="text-sm font-semibold text-foreground">Chapter:</label>
          <select
            value={selectedChapter}
            onChange={(e) => setSelectedChapter(parseInt(e.target.value))}
            className="px-3 py-2 rounded-lg text-sm font-semibold text-orange-800 bg-orange-50 border border-orange-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            {data.chapters.filter((c) => isChapterVisible(c.chapter)).map((c) => (
              <option key={c.chapter} value={c.chapter}>
                Ch. {c.chapter} — {c.name}
              </option>
            ))}
          </select>
        </div>

        {versesWithImages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ImageIcon size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No verses with images in Chapter {selectedChapter}.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {versesWithImages.map((verse) => (
              <VerseImageManager key={verse.verse} chapter={selectedChapter} verse={verse} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
