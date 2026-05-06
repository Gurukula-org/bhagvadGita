import { useState } from "react";
import { Link, useLocation } from "wouter";
import { navigateWithViewTransition } from "@/lib/navigateWithViewTransition";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { useChapterVisibility } from "@/contexts/ChapterVisibilityContext";
import gitaData from "@/data/gitaData.json";
import type { GitaData } from "@/types/gita";
import { Settings, ChevronRight, Eye, EyeOff, ShieldAlert, ImageIcon } from "lucide-react";

const data = gitaData as unknown as GitaData;

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const [kidsMode, setKidsMode] = useState(false);
  const { user, isAdmin, signIn } = useAuth();
  const { visibleChapters, loading, toggleChapter } = useChapterVisibility();

  if (!isAdmin) {
    return (
      <Layout kidsMode={kidsMode} onToggleKids={() => setKidsMode(!kidsMode)}>
        <SEO title="Admin Settings" path="/settings" noindex />
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
          <ShieldAlert size={48} className="text-red-400 mb-4" />
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            Admin Access Required
          </h1>
          <p className="text-muted-foreground text-sm mb-6 text-center max-w-sm">
            Only authorized administrators (@gurukula.com) can access settings.
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

  return (
    <Layout kidsMode={kidsMode} onToggleKids={() => setKidsMode(!kidsMode)}>
      <SEO title="Admin Settings" path="/settings" noindex />
      <div className="px-4 py-8 max-w-3xl mx-auto">
        {/* Breadcrumb */}
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
          <span className="text-foreground font-medium">Settings</span>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <Settings size={24} className="text-orange-600" />
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">
            Chapter Visibility
          </h1>
        </div>

        <Link
          href="/settings/images"
          className="flex items-center gap-3 p-4 mb-6 bg-orange-50 border border-orange-200 rounded-xl hover:bg-orange-100 transition-colors group touch-manipulation"
          onClick={(e) => {
            e.preventDefault();
            navigateWithViewTransition(() => setLocation("/settings/images"));
          }}
        >
          <ImageIcon size={20} className="text-orange-600" />
          <div className="flex-1">
            <p className="font-semibold text-sm text-foreground">Image Manager</p>
            <p className="text-xs text-muted-foreground">Review and replace images for verses across all chapters</p>
          </div>
          <ChevronRight size={16} className="text-orange-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        <p className="text-muted-foreground text-sm mb-6">
          Toggle which chapters are visible to all users. Hidden chapters will not appear
          in the sidebar or home page. As an admin, you can still access all chapters.
        </p>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-2">
            {data.chapters.map((ch) => {
              const visible = visibleChapters.has(ch.chapter);
              return (
                <div
                  key={ch.chapter}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    visible
                      ? "bg-card border-orange-200"
                      : "bg-muted/40 border-border opacity-70"
                  }`}
                >
                  <span className="text-2xl w-8 text-center">{ch.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">
                      Ch. {ch.chapter} — {ch.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {ch.name_hindi} • {ch.subtitle}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleChapter(ch.chapter)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                      visible
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-red-100 text-red-600 hover:bg-red-200"
                    }`}
                  >
                    {visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    {visible ? "Visible" : "Hidden"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
