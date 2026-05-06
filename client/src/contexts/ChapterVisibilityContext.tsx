import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";

interface ChapterVisibilityValue {
  visibleChapters: Set<number>;
  loading: boolean;
  isChapterVisible: (chapter: number) => boolean;
  toggleChapter: (chapter: number) => Promise<void>;
}

const ALL_CHAPTERS = Array.from({ length: 18 }, (_, i) => i + 1);
const DEFAULT_VISIBLE = new Set([12]);

const ChapterVisibilityContext = createContext<ChapterVisibilityValue>({
  visibleChapters: DEFAULT_VISIBLE,
  loading: true,
  isChapterVisible: (ch) => DEFAULT_VISIBLE.has(ch),
  toggleChapter: async () => {},
});

export function useChapterVisibility() {
  return useContext(ChapterVisibilityContext);
}

async function getAuthToken(user: { getIdToken: () => Promise<string> } | null) {
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

export function ChapterVisibilityProvider({ children }: { children: ReactNode }) {
  const [visibleChapters, setVisibleChapters] = useState<Set<number>>(DEFAULT_VISIBLE);
  const [loading, setLoading] = useState(typeof window !== "undefined");
  const { isAdmin, user } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch("/api/chapter-visibility");
        if (resp.ok) {
          const data = await resp.json();
          const chapters: number[] = data.visible ?? [];
          setVisibleChapters(new Set(chapters));
        }
      } catch {
        // API unavailable — keep defaults
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isChapterVisible = useCallback(
    (chapter: number) => {
      if (isAdmin) return true;
      return visibleChapters.has(chapter);
    },
    [visibleChapters, isAdmin],
  );

  const toggleChapter = useCallback(
    async (chapter: number) => {
      if (!isAdmin || !user) return;

      const next = new Set(visibleChapters);
      if (next.has(chapter)) {
        next.delete(chapter);
      } else {
        next.add(chapter);
      }
      setVisibleChapters(next);

      try {
        const token = await getAuthToken(user);
        if (!token) throw new Error("Not authenticated");

        const resp = await fetch("/api/chapter-visibility", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            visible: ALL_CHAPTERS.filter((c) => next.has(c)),
          }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(err.error || `HTTP ${resp.status}`);
        }

        toast.success(`Chapter ${chapter} ${next.has(chapter) ? "visible" : "hidden"}`);
      } catch (err) {
        console.error("Failed to save visibility:", err);
        toast.error("Failed to save — check server logs");
        setVisibleChapters(visibleChapters);
      }
    },
    [visibleChapters, isAdmin, user],
  );

  return (
    <ChapterVisibilityContext.Provider
      value={{ visibleChapters, loading, isChapterVisible, toggleChapter }}
    >
      {children}
    </ChapterVisibilityContext.Provider>
  );
}
