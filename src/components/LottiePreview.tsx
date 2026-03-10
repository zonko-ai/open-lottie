/**
 * @fileoverview Lottie animation preview component.
 * Renders Lottie animations with playback controls and export options.
 * @module components/LottiePreview
 */

"use client";

import { useRef } from "react";
import Lottie, { LottieRefCurrentProps } from "lottie-react";
import { Download, Play, RotateCcw, Code } from "lucide-react";
import { useTranslations } from 'next-intl';

/**
 * Props for the LottiePreview component.
 */
interface LottiePreviewProps {
  /** The Lottie animation data object, or null if no animation is loaded */
  animationData: Record<string, unknown> | null;
  /** Whether an animation is currently being generated */
  isGenerating: boolean;
}

/**
 * Component for previewing Lottie animations with interactive controls.
 * Provides play/pause, restart, copy JSON, and download functionality.
 * 
 * @param props - The component props
 * @returns A React component that displays the animation preview
 * 
 * @example
 * ```tsx
 * <LottiePreview
 *   animationData={lottieJson}
 *   isGenerating={false}
 * />
 * ```
 */
export default function LottiePreview({
  animationData,
  isGenerating,
}: LottiePreviewProps) {
  const t = useTranslations('preview');
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const isPlaying = useRef(true);

  /**
   * Toggles play/pause state of the animation.
   */
  const handlePlayPause = () => {
    if (!lottieRef.current) return;
    if (isPlaying.current) {
      lottieRef.current.pause();
    } else {
      lottieRef.current.play();
    }
    isPlaying.current = !isPlaying.current;
  };

  /**
   * Restarts the animation from the beginning.
   */
  const handleRestart = () => {
    if (!lottieRef.current) return;
    lottieRef.current.goToAndPlay(0);
    isPlaying.current = true;
  };

  /**
   * Downloads the animation as a JSON file.
   */
  const handleDownloadJSON = () => {
    if (!animationData) return;
    const blob = new Blob([JSON.stringify(animationData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "animation.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Copies the animation JSON to the clipboard.
   */
  const handleCopyJSON = async () => {
    if (!animationData) return;
    await navigator.clipboard.writeText(
      JSON.stringify(animationData, null, 2)
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-medium text-muted">{t('title')}</span>
        {animationData && (
          <div className="flex items-center gap-1">
            <button
              onClick={handlePlayPause}
              className="p-1.5 rounded-md hover:bg-surface-2 text-muted hover:text-foreground transition-colors"
              title={t('playPause')}
            >
              <Play size={14} />
            </button>
            <button
              onClick={handleRestart}
              className="p-1.5 rounded-md hover:bg-surface-2 text-muted hover:text-foreground transition-colors"
              title={t('restart')}
            >
              <RotateCcw size={14} />
            </button>
            <div className="w-px h-4 bg-border mx-1" />
            <button
              onClick={handleCopyJSON}
              className="p-1.5 rounded-md hover:bg-surface-2 text-muted hover:text-foreground transition-colors"
              title={t('copyJson')}
            >
              <Code size={14} />
            </button>
            <button
              onClick={handleDownloadJSON}
              className="p-1.5 rounded-md hover:bg-surface-2 text-muted hover:text-foreground transition-colors"
              title={t('downloadJson')}
            >
              <Download size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center p-6 min-h-[400px]">
        {isGenerating ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-border border-t-accent animate-spin" />
            <p className="text-sm text-muted">{t('generating')}</p>
          </div>
        ) : animationData ? (
          <div className="w-full max-w-[400px] aspect-square lottie-preview-container bg-surface rounded-lg overflow-hidden">
            <Lottie
              lottieRef={lottieRef}
              animationData={animationData}
              loop
              autoplay
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center">
              <Play size={24} className="text-muted ml-1" />
            </div>
            <div>
              <p className="text-sm text-muted">{t('noAnimation')}</p>
              <p className="text-xs text-muted/60 mt-1">
                {t('selectMode')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
