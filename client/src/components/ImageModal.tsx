import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Full-screen image overlay (tap outside, Escape, or close button). Same behavior as verse tab illustrations. */
export function ImageModal({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    const preventScroll = (e: TouchEvent) => {
      e.preventDefault();
    };
    document.addEventListener("keydown", handler);
    const scrollY = window.scrollY;
    document.documentElement.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.overflow = "hidden";
    const overlay = overlayRef.current;
    overlay?.addEventListener("touchmove", preventScroll, { passive: false });
    return () => {
      document.removeEventListener("keydown", handler);
      overlay?.removeEventListener("touchmove", preventScroll);
      document.documentElement.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
      style={{ touchAction: "none" }}
      onClick={() => onCloseRef.current()}
    >
      <button
        type="button"
        className="absolute top-3 right-3 text-white/90 hover:text-white z-[10000] bg-black/60 rounded-full p-2"
        onClick={() => onCloseRef.current()}
        aria-label="Close full image"
      >
        <X size={24} />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-[92vw] max-h-[85vh] object-contain rounded-lg"
        onClick={e => e.stopPropagation()}
      />
      <p className="absolute bottom-4 left-3 right-3 text-center text-white/65 text-[11px] sm:text-xs pointer-events-none">
        Tap outside the image or press Escape to close.
      </p>
    </div>,
    document.body
  );
}
