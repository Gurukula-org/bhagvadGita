import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Pencil, Upload, Loader2, ImageIcon, ImageOff } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useImageUrl } from "@/hooks/useImages";
import { auth } from "@/lib/firebase";
import { cn } from "@/lib/utils";

interface EditableImageProps {
  imageKey: string;
  fallbackUrl: string;
  alt?: string;
  caption?: string;
  className?: string;
  imgClassName?: string;
  asBg?: boolean;
}

export default function EditableImage({
  imageKey,
  fallbackUrl,
  alt = "",
  caption,
  className,
  imgClassName,
  asBg,
}: EditableImageProps) {
  const { isAdmin, user } = useAuth();
  const resolvedUrl = useImageUrl(imageKey, fallbackUrl);
  // Optimistically override the URL right after a successful upload so the
  // image refreshes immediately, before the Firestore listener fires.
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const url = localUrl ?? resolvedUrl;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // keep in sync with server limit
  const ACCEPTED_MIME = useMemo(
    () => new Set(["image/jpeg", "image/png", "image/webp"]),
    [],
  );

  // Derive the preview URL from `file`. Doing this in useMemo (not inside a
  // setState updater) keeps state updaters pure — important under React 19's
  // strict-mode double-invocation, where impure updaters can create orphaned
  // blob URLs that render as broken images.
  const preview = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  // Revoke the object URL when `file` changes or the component unmounts. The
  // dependency is `preview` so we always revoke the exact URL that was created
  // for the file we just stopped using.
  useEffect(() => {
    if (!preview) return;
    return () => {
      URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (!selected) return;
      if (!selected.type.startsWith("image/")) {
        toast.error("Please select an image file (JPG, PNG, or WebP)");
        return;
      }
      if (!ACCEPTED_MIME.has(selected.type)) {
        toast.error(`Unsupported image type: ${selected.type || "unknown"}`);
        return;
      }
      if (selected.size > MAX_UPLOAD_BYTES) {
        const mb = (selected.size / (1024 * 1024)).toFixed(1);
        toast.error(`Image is ${mb} MB. Max upload size is 10 MB.`);
        return;
      }
      setFile(selected);
    },
    [ACCEPTED_MIME, MAX_UPLOAD_BYTES],
  );

  const handleUpload = useCallback(async () => {
    if (!file) {
      toast.error("Please choose an image first");
      return;
    }
    if (!auth) {
      toast.error("Firebase is not configured");
      return;
    }
    if (!auth.currentUser || !user?.email) {
      toast.error("Please sign in as an admin to upload images");
      return;
    }
    setUploading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const headers: Record<string, string> = {
        "Content-Type": file.type,
        Authorization: `Bearer ${token}`,
        "x-image-key": imageKey,
      };
      // Tell the server which storage object to overwrite. Prefer the live
      // Firestore-resolved URL when it's a real CDN URL; fall back to the
      // baked-in fallbackUrl from gitaData.json. The server validates this
      // is under the project bucket before using it.
      const referenceUrl =
        (resolvedUrl && /^https?:\/\//.test(resolvedUrl) && resolvedUrl) ||
        (fallbackUrl && /^https?:\/\//.test(fallbackUrl) && fallbackUrl) ||
        "";
      if (referenceUrl) headers["x-image-path"] = referenceUrl;

      const res = await fetch("/api/upload", {
        method: "POST",
        headers,
        body: file,
      });

      const data = await res
        .json()
        .catch(() => ({ error: `Upload failed (${res.status})` }));

      if (!res.ok) {
        throw new Error(data.error || `Upload failed (${res.status})`);
      }

      if (typeof data?.url === "string" && data.url) {
        // Bust the browser cache so the freshly-overwritten object is fetched
        // again (the canonical URL is unchanged and was cached for a year).
        const cacheBuster = `v=${Date.now()}`;
        const separator = data.url.includes("?") ? "&" : "?";
        setLocalUrl(`${data.url}${separator}${cacheBuster}`);
      }

      toast.success("Image updated successfully");
      setDialogOpen(false);
      setFile(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Upload failed";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }, [file, user, imageKey, resolvedUrl, fallbackUrl]);

  const resetDialog = useCallback(() => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const editButton = isAdmin && (
    <button
      onClick={() => setDialogOpen(true)}
      className="absolute top-2 right-2 z-20 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
      title="Replace image"
    >
      <Pencil size={14} />
    </button>
  );

  const uploadDialog = (
    <UploadDialog
      open={dialogOpen}
      onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetDialog();
      }}
      preview={preview}
      uploading={uploading}
      file={file}
      inputRef={inputRef}
      onFileChange={handleFileChange}
      onUpload={handleUpload}
      currentUrl={url}
    />
  );

  if (asBg) {
    return (
      <>
        <img
          src={url}
          alt={alt}
          className={cn(imgClassName)}
          loading="lazy"
        />
        {editButton}
        {uploadDialog}
      </>
    );
  }

  return (
    <figure className={cn("relative group", className)}>
      <img
        src={url}
        alt={alt || caption || "Illustration"}
        className={cn("w-full object-cover", imgClassName)}
        loading="lazy"
      />
      {caption && (
        <figcaption className="text-xs text-muted-foreground italic px-4 py-2 bg-muted/50 text-center">
          {caption}
        </figcaption>
      )}
      {editButton}
      {uploadDialog}
    </figure>
  );
}

function UploadDialog({
  open,
  onOpenChange,
  preview,
  uploading,
  file,
  inputRef,
  onFileChange,
  onUpload,
  currentUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: string | null;
  uploading: boolean;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  currentUrl: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Force an opaque card so the page can never bleed through, regardless
        // of whether the `--background` CSS variable resolves on this build.
        // `!bg-white` (with `!` important) wins over the base `bg-background`.
        className="sm:max-w-md !bg-white !text-neutral-900 !border-neutral-200 shadow-2xl z-[60]"
      >
        <DialogHeader>
          <DialogTitle className="text-neutral-900">Replace Image</DialogTitle>
          <DialogDescription className="text-neutral-600">
            Select a new image to upload. It will replace the current one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-xs text-neutral-500 mb-1">Current</p>
            <DialogPreviewImage
              src={currentUrl}
              alt="Current"
              fallbackMessage="Current image failed to load — uploading a new one will replace it."
            />
          </div>

          {preview ? (
            <div>
              <p className="text-xs text-neutral-500 mb-1">New image</p>
              <DialogPreviewImage
                src={preview}
                alt="Preview"
                fallbackMessage="Couldn't render preview — the file may be corrupt or in an unsupported format."
              />
              <p className="text-xs text-neutral-500 mt-1">
                {file?.name}
                {file && (
                  <span className="ml-1 opacity-70">
                    ({(file.size / 1024).toFixed(0)} KB)
                  </span>
                )}
              </p>
            </div>
          ) : (
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed border-neutral-300 bg-neutral-50 rounded-lg p-6 flex flex-col items-center gap-2 text-neutral-500 hover:border-orange-400 hover:text-orange-600 transition-colors"
            >
              <ImageIcon size={24} />
              <span className="text-sm font-medium">
                Click to select an image
              </span>
              <span className="text-xs">JPG, PNG, or WebP</span>
            </button>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onFileChange}
            className="hidden"
          />
        </div>

        <DialogFooter>
          {preview && (
            <button
              onClick={() => {
                if (inputRef.current) inputRef.current.value = "";
                inputRef.current?.click();
              }}
              className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors mr-auto"
              disabled={uploading}
            >
              Choose different
            </button>
          )}
          <button
            onClick={onUpload}
            disabled={!file || uploading}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-red-950 font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
          >
            {uploading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={14} />
                Upload & Replace
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogPreviewImage({
  src,
  alt,
  fallbackMessage,
}: {
  src: string;
  alt: string;
  fallbackMessage: string;
}) {
  const [errored, setErrored] = useState(false);

  // Reset error state whenever the src changes (e.g. after a successful upload)
  useEffect(() => {
    setErrored(false);
  }, [src]);

  if (!src || errored) {
    return (
      <div className="w-full h-32 flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 text-neutral-500 text-xs px-3 text-center">
        <ImageOff size={20} />
        <span>{fallbackMessage}</span>
      </div>
    );
  }

  return (
    <div className="w-full h-40 rounded-lg border border-neutral-200 bg-neutral-50 overflow-hidden flex items-center justify-center">
      <img
        src={src}
        alt={alt}
        onError={() => setErrored(true)}
        className="w-full h-full object-contain"
      />
    </div>
  );
}
