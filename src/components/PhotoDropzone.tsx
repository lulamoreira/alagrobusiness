import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PhotoItem {
  /** Local preview URL (object URL) or signed URL from storage */
  previewUrl: string;
  /** New file to upload, if any */
  file?: File;
  /** Existing storage path, if already uploaded */
  storagePath?: string;
}

interface PhotoDropzoneProps {
  items: PhotoItem[];
  onChange: (items: PhotoItem[]) => void;
  max?: number;
  error?: string;
}

export function PhotoDropzone({ items, onChange, max = 8, error }: PhotoDropzoneProps) {
  const { t } = useTranslation();
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const room = Math.max(0, max - items.length);
    const next = list.slice(0, room).map((file) => ({
      previewUrl: URL.createObjectURL(file),
      file,
    }));
    if (next.length > 0) onChange([...items, ...next]);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  };

  const remove = (idx: number) => {
    const next = items.slice();
    const removed = next.splice(idx, 1)[0];
    if (removed?.file) URL.revokeObjectURL(removed.previewUrl);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card/40 px-4 py-8 text-center transition-all hover:border-primary/50 hover:bg-card/60",
          dragOver && "border-primary bg-primary/5",
          error && "border-destructive",
        )}
      >
        <ImagePlus className="h-7 w-7 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">{t("form.photosDrop")}</p>
        <p className="text-xs text-muted-foreground">{t("form.photosHint")}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onInput}
        />
      </div>
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {items.map((it, idx) => (
            <div
              key={idx}
              className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-card"
            >
              <img
                src={it.previewUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(idx);
                }}
                aria-label={t("common.remove")}
                className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-foreground opacity-0 transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
