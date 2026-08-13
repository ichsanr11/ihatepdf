"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  label?: string;
  hint?: string;
}

/** Drag-and-drop + click-to-browse file picker. Nothing here ever leaves the browser. */
export function FileDropzone({
  accept,
  multiple = false,
  onFiles,
  label = "Tarik & lepas file di sini",
  hint,
}: FileDropzoneProps) {
  const [isActive, setIsActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      onFiles(Array.from(fileList));
    },
    [onFiles]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setIsActive(true);
      }}
      onDragLeave={() => setIsActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsActive(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-secondary/40 px-6 py-16 text-center transition-colors hover:border-primary/60 hover:bg-primary/5",
        isActive && "dropzone-active"
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <UploadCloud className="h-7 w-7 text-primary" />
      </div>
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">
          atau klik untuk memilih file{multiple ? " (bisa lebih dari satu)" : ""}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
