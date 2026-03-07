"use client";

import { useCallback, useState, useRef } from "react";
import { Upload, X, Image as ImageIcon, Film } from "lucide-react";

interface FileUploadProps {
  accept: string;
  type: "image" | "video";
  file: File | null;
  onFileChange: (file: File | null) => void;
}

export default function FileUpload({
  accept,
  type,
  file,
  onFileChange,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

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
              拖放{type === "image" ? "图片" : "视频"}到此处或{" "}
              <span className="text-accent">点击浏览</span>
            </p>
            <p className="text-[10px] text-muted mt-0.5">
              {type === "image"
                ? "PNG、JPG、WebP，最大10MB"
                : "MP4、WebM，最大50MB"}
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
