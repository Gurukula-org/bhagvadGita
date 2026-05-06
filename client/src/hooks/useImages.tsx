import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db, isConfigured } from "@/lib/firebase";

export interface ImageEntry {
  url: string;
  caption?: string;
}

type ImageMap = Record<string, ImageEntry>;

interface ImagesContextValue {
  images: ImageMap;
  loading: boolean;
}

const ImagesContext = createContext<ImagesContextValue>({
  images: {},
  loading: true,
});

export function useImages() {
  return useContext(ImagesContext);
}

export function useImageUrl(imageKey: string, fallbackUrl: string): string {
  const { images } = useImages();
  return images[imageKey]?.url || fallbackUrl;
}

export function useImageEntry(
  imageKey: string,
  fallbackUrl: string,
  fallbackCaption?: string,
): ImageEntry {
  const { images } = useImages();
  if (images[imageKey]) return images[imageKey];
  return { url: fallbackUrl, caption: fallbackCaption };
}

export function ImagesProvider({ children }: { children: ReactNode }) {
  const [images, setImages] = useState<ImageMap>({});
  const [loading, setLoading] = useState(typeof window !== "undefined");

  useEffect(() => {
    if (!isConfigured || !db) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, "gita_images"),
      (snapshot) => {
        const map: ImageMap = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          map[doc.id] = { url: data.url, caption: data.caption };
        });
        setImages(map);
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  return (
    <ImagesContext.Provider value={{ images, loading }}>
      {children}
    </ImagesContext.Provider>
  );
}
