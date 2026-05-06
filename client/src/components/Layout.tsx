// Layout: Modern Vedic Learning Platform
// Deep maroon sidebar, warm cream content area, saffron orange accents
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { navigateWithViewTransition } from "@/lib/navigateWithViewTransition";
import gitaData from "@/data/gitaData.json";
import type { GitaData } from "@/types/gita";
import { BookOpen, Home, Menu, X, Star, ChevronRight, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useChapterVisibility } from "@/contexts/ChapterVisibilityContext";

const data = gitaData as unknown as GitaData;

const SIDEBAR_COLLAPSED_KEY = "gita-sidebar-collapsed";
const LG_MIN_PX = 1024;

/** Matches Tailwind `lg:` — sidebar collapse vs mobile drawer */
function useIsLgViewport() {
  const [isLg, setIsLg] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(min-width: ${LG_MIN_PX}px)`).matches;
  });
  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${LG_MIN_PX}px)`);
    const sync = () => setIsLg(mql.matches);
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);
  return isLg;
}

interface LayoutProps {
  children: React.ReactNode;
  kidsMode?: boolean;
  onToggleKids?: () => void;
  stickyHeader?: boolean;
}

function readNavCollapsedFromStorage(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export default function Layout({ children, kidsMode = false, onToggleKids, stickyHeader = true }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(readNavCollapsedFromStorage);
  const isLgViewport = useIsLgViewport();
  const [location, setLocation] = useLocation();

  const isHome = location === "/" || location === "";

  useEffect(() => {
    if (isHome) {
      setSidebarOpen(false);
    }
  }, [isHome]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, navCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [navCollapsed]);
  const { user, isAdmin, signOut, loading: authLoading } = useAuth();
  const { isChapterVisible } = useChapterVisibility();

  const chapterGroups = [
    { label: "Karma Kanda", range: [1, 6], color: "text-orange-700" },
    { label: "Upasana Kanda", range: [7, 12], color: "text-teal-700" },
    { label: "Jnana Kanda", range: [13, 18], color: "text-rose-700" },
  ];

  return (
    <div className={`min-h-screen flex flex-col ${kidsMode ? "kids-mode" : ""}`}>
      {/* Top Navigation Bar */}
      <header className={`${stickyHeader ? 'sticky top-0' : ''} z-50 bg-vedic-hero border-b border-white/10 shadow-lg`}>
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-3">
            {!isHome && (
              <button
                type="button"
                onClick={() => {
                  if (isLgViewport) {
                    setNavCollapsed((c) => !c);
                  } else {
                    setSidebarOpen((o) => !o);
                  }
                }}
                className="text-white hover:text-orange-100 transition-colors p-1"
                aria-label={
                  isLgViewport
                    ? navCollapsed
                      ? "Expand chapter navigation"
                      : "Collapse chapter navigation"
                    : sidebarOpen
                      ? "Close menu"
                      : "Open menu"
                }
                title={
                  isLgViewport ? (navCollapsed ? "Expand sidebar" : "Collapse sidebar") : undefined
                }
              >
                {!isLgViewport && sidebarOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            )}
            <Link
              href="/"
              className="flex items-center gap-2 group touch-manipulation"
              onClick={(e) => {
                e.preventDefault();
                navigateWithViewTransition(() => setLocation("/"));
              }}
            >
              <img src="/gurukula-g-logo.png" alt="Gurukula" className="w-8 h-8 rounded-full shadow-md" />
              <span className="font-display text-white font-semibold text-lg lg:text-xl tracking-wide group-hover:text-orange-100 transition-colors">
                Bhagavad Gita Gurukula.com
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {onToggleKids && user && !authLoading && (
              <button
                onClick={onToggleKids}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold transition-all ${
                  kidsMode
                    ? "bg-white text-orange-700 font-bold"
                    : "bg-white/20 text-white hover:bg-white/30"
                }`}
              >
                <Star size={14} />
                {kidsMode ? "Kids Mode ON" : "Kids Mode"}
              </button>
            )}
            {!isHome && (
              <Link
                href="/"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full text-sm text-white hover:text-orange-100 hover:bg-white/20 transition-all touch-manipulation"
                onClick={(e) => {
                  e.preventDefault();
                  navigateWithViewTransition(() => setLocation("/"));
                }}
              >
                <Home size={15} />
                Home
              </Link>
            )}
            {isAdmin && user && (
              <>
                <Link
                  href="/settings"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all touch-manipulation"
                  title="Settings"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateWithViewTransition(() => setLocation("/settings"));
                  }}
                >
                  <Settings size={12} />
                </Link>
                <button
                  onClick={signOut}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-orange-400/20 border border-orange-400/40 text-orange-200 hover:bg-orange-400/30 transition-all"
                  title="Sign out admin"
                >
                  <img
                    src={user.photoURL || ""}
                    alt=""
                    className="w-5 h-5 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                  <LogOut size={12} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 lg:overflow-hidden">
        {/* Sidebar Overlay (mobile) — hidden on home */}
        {!isHome && sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar — hidden on home (/) */}
        {!isHome && (
        <aside
          className={`
            fixed top-16 h-[calc(100vh-4rem)] lg:sticky ${stickyHeader ? 'lg:top-16 lg:h-[calc(100vh-4rem)]' : 'lg:top-0 lg:h-screen'} left-0 z-40
            w-[min(15rem,85vw)] lg:transition-[width] lg:duration-300 lg:ease-in-out
            ${navCollapsed ? "lg:w-14" : "lg:w-56"}
            bg-sidebar overflow-y-auto overflow-x-hidden
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            flex-shrink-0 border-r border-sidebar-border
          `}
        >
          <div className={`${navCollapsed ? "lg:p-2 p-4" : "p-4"}`}>
            {!(navCollapsed && isLgViewport) && (
              <div className="flex items-center gap-2 mb-5 px-2">
                <BookOpen size={17} className="text-orange-600 flex-shrink-0" />
                <span className="text-orange-700 text-sm font-semibold uppercase tracking-widest truncate min-w-0">
                  18 Chapters
                </span>
              </div>
            )}

            {chapterGroups.map((group) => (
              <div key={group.label} className={`mb-5 ${navCollapsed ? "lg:mb-3" : ""}`}>
                <p
                  className={`text-sm font-semibold uppercase tracking-widest px-2 mb-2 ${group.color} ${
                    navCollapsed ? "lg:hidden" : ""
                  }`}
                >
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {data.chapters
                    .filter((ch) => ch.chapter >= group.range[0] && ch.chapter <= group.range[1] && isChapterVisible(ch.chapter))
                    .map((ch) => {
                      const isActive = location === `/chapter/${ch.chapter}` || location.startsWith(`/chapter/${ch.chapter}/`);
                      return (
                        <Link
                          key={ch.chapter}
                          href={`/chapter/${ch.chapter}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigateWithViewTransition(() => {
                              setSidebarOpen(false);
                              setLocation(`/chapter/${ch.chapter}`);
                            });
                          }}
                          title={`Chapter ${ch.chapter}: ${ch.name}`}
                          className={`
                            relative flex items-center gap-2 rounded-lg text-base transition-all group
                            ${navCollapsed && isLgViewport ? "lg:justify-center lg:px-1.5 lg:py-2" : "px-3 py-2.5"}
                            ${isActive
                              ? `bg-orange-100 text-orange-900 font-semibold border-l-2 border-orange-500 ${
                                  navCollapsed && isLgViewport ? "lg:border-l-0 lg:ring-1 lg:ring-orange-400/70" : ""
                                }`
                              : "text-gray-700 hover:bg-orange-50 hover:text-gray-900"
                            }
                          `}
                        >
                          {navCollapsed && isLgViewport ? (
                            <span className="text-sm font-bold tabular-nums w-full text-center">
                              {ch.chapter}
                            </span>
                          ) : (
                            <>
                              <span className="flex-1 min-w-0">
                                <span className="text-sm opacity-60 mr-1">Ch.{ch.chapter}</span>
                                <span className="truncate">{ch.name}</span>
                              </span>
                              {isActive && (
                                <ChevronRight size={12} className="opacity-60 flex-shrink-0" />
                              )}
                            </>
                          )}
                        </Link>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </aside>
        )}

        {/* Main Content — no overflow on mobile so sticky works with document scroll (#56) */}
        <main className="flex-1 min-w-0 lg:overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
