"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileInputProps {
  accept?: string;
  onChange?: (file: File | null) => void;
  className?: string;
  placeholder?: string;
  compact?: boolean;
}

export function FileInput({
  accept,
  onChange,
  className,
  placeholder = "Belum ada file dipilih",
  compact = false,
}: FileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setFileName(file?.name ?? null);
    onChange?.(file);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setFileName(null);
    onChange?.(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 transition-colors",
        compact ? "h-7" : "h-9",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-md bg-slate-100 font-medium text-slate-600 transition-colors hover:bg-slate-200",
          compact ? "h-5 px-1.5 text-[10px]" : "h-6 px-2 text-xs",
        )}
      >
        <Upload className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        Pilih
      </button>

      <span
        className={cn(
          "flex-1 truncate",
          compact ? "text-[10px]" : "text-xs",
          fileName ? "text-slate-700" : "text-slate-400",
        )}
      >
        {fileName ?? placeholder}
      </span>

      {fileName && (
        <button
          type="button"
          onClick={handleClear}
          className="shrink-0 text-slate-400 transition-colors hover:text-slate-600"
        >
          <X className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleChange}
      />
    </div>
  );
}
