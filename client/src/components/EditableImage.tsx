import { useState, useRef, useCallback } from "react";
import { Pencil, Upload, Loader2, ImageIcon } from "lucide-react";
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
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (!selected) return;
      if (!selected.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      setFile(selected);
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(selected);
    },
    [],
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

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          Authorization: `Bearer ${token}`,
          "x-image-key": imageKey,
        },
        body: file,
      });

      const data = await res
        .json()
        .catch(() => ({ error: `Upload failed (${res.status})` }));

      if (!res.ok) {
        throw new Error(data.error || `Upload failed (${res.status})`);
      }

      if (typeof data?.url === "string" && data.url) {
        setLocalUrl(data.url);
      }

      toast.success("Image updated successfully");
      setDialogOpen(false);
      setFile(null);
      setPreview(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Upload failed";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }, [file, user, imageKey]);

  const resetDialog = useCallback(() => {
    setFile(null);
    setPreview(null);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Replace Image</DialogTitle>
          <DialogDescription>
            Select a new image to upload. It will replace the current one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Current</p>
            <img
              src={currentUrl}
              alt="Current"
              className="w-full max-h-40 object-cover rounded-lg border"
            />
          </div>

          {preview ? (
            <div>
              <p className="text-xs text-muted-foreground mb-1">New image</p>
              <img
                src={preview}
                alt="Preview"
                className="w-full max-h-40 object-cover rounded-lg border"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {file?.name}
              </p>
            </div>
          ) : (
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-orange-400 hover:text-orange-600 transition-colors"
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
              className="text-sm text-muted-foreground hover:text-foreground transition-colors mr-auto"
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
