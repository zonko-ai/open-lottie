/**
 * @fileoverview File upload component for images and videos.
 * Provides drag-and-drop and click-to-browse functionality with preview.
 * @module components/FileUpload
 */

"use client";

import { useCallback, useState, useRef } from "react";
import { X, Image as ImageIcon, Film } from "lucide-react";
import { useTranslations } from 'next-intl';

/**
 * Props for the FileUpload component.
 */
interface FileUploadProps {
  /** Accepted file types (MIME types) */
  accept: string;
  /** Type of file being uploaded - affects preview rendering */
  type: "image" | "video";
  /** Currently selected file, or null if none */
  file: File | null;
  /** Callback when file selection changes */
  onFileChange: (file: File | null) => void;
}

/**
 * Component for uploading image or video files with drag-and-drop support.
 * Shows a preview of the selected file and allows clearing the selection.
 * 
 * @param props - The component props
 * @returns A React component for file upload with preview
 * 
 * @example
 * ```tsx
 * const [file, setFile] = useState<File | null>(null);
 * 
 * <FileUpload
 *   accept="image/png,image/jpeg"
 *   type="image"
 *   file={file}
 *   onFileChange={setFile}
 * />
 * ```
 */
export default function FileUpload({
  accept,
  type,
  file,
  onFileChange,
}: FileUploadProps) {
  const t = useTranslations(type === "image" ? "image" : "video");
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Processes a selected file and generates a preview.
   * @param f - The file to process
   */
  const handleFile = useCallback(
    (f: File) => {
      onFileChange(f);
      if (type === "image") {
        const reader = new FileReader();
        reader.onload = () => setPreview(reader.result as string);
        reader.readAsDataURL(f);
      } else {
        setPreview(URL.createObjectURL(f));
      }
    },
    [onFileChange, type]
  );

  /**
   * Handles file drop from drag-and-drop operation.
   * @param e - The drag event
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  /**
   * Clears the current file selection and preview.
   */
  const handleClear = () => {
    onFileChange(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const Icon = type === "image" ? ImageIcon : Film;

  return (
    <div
      className={`relative border border-dashed rounded-lg transition-colors ${
        isDragging ? "drag-active border-accent" : "border-border"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {file && preview ? (
        <div className="relative">
          {type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Upload preview"
              className="w-full h-32 object-cover rounded-lg"
            />
          ) : (
            <video
              src={preview}
              className="w-full h-32 object-cover rounded-lg"
              muted
              loop
              autoPlay
              playsInline
            />
          )}
          <button
            onClick={handleClear}
            className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-background text-muted hover:text-foreground transition-colors"
            aria-label="Clear"
          >
            <X size={14} />
          </button>
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-background/80 text-[10px] text-muted">
            {file.name}
          </div>
        </div>
      ) : (
        <label className="flex flex-col items-center gap-2 py-6 px-4 cursor-pointer">
          <div className="w-10 h-10 rounded-lg bg-surface-2 flex items-center justify-center">
            <Icon size={18} className="text-muted" />
          </div>
          <div className="text-center">
            <p className="text-xs text-foreground">
              {t('dragDrop')}{" "}
              <span className="text-accent">{t('clickBrowse')}</span>
            </p>
            <p className="text-[10px] text-muted mt-0.5">
              {type === "image" ? t('supportedFormats') : t('supportedFormatsVideo')}
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}
