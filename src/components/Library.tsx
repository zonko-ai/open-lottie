"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, Trash2, ChevronDown, ChevronUp, Clock, DollarSign } from "lucide-react";
import dynamic from "next/dynamic";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

interface LibraryItem {
  url: string;
  pathname: string;
  createdAt: string;
  size: number;
}

interface StoredData {
  lottie_json: Record<string, unknown>;
  metadata: {
    prompt: string;
    mode: string;
    duration_sec: number;
    gpu_cost_usd: number;
    layers: number;
    width: number;
    height: number;
  };
}

export default function Library() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadedData, setLoadedData] = useState<Record<string, StoredData>>({});

  const fetchLibrary = useCallback(async () => {
    try {
      const res = await fetch("/api/library");
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  const loadItem = useCallback(async (url: string) => {
    if (loadedData[url]) return loadedData[url];
    try {
      const res = await fetch(url);
      const data: StoredData = await res.json();
      setLoadedData((prev) => ({ ...prev, [url]: data }));
      return data;
    } catch {
      return null;
    }
  }, [loadedData]);

  // Load all items on mount
  useEffect(() => {
    items.forEach((item) => loadItem(item.url));
  }, [items, loadItem]);

  const handleDelete = async (url: string) => {
    try {
      await fetch(`/api/library?url=${encodeURIComponent(url)}`, {
        method: "DELETE",
      });
      setItems((prev) => prev.filter((i) => i.url !== url));
      setLoadedData((prev) => {
        const next = { ...prev };
        delete next[url];
        return next;
      });
    } catch {
      // silently fail
    }
  };

  const handleDownload = (data: StoredData, prompt: string) => {
    const blob = new Blob([JSON.stringify(data.lottie_json, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${prompt.slice(0, 30).replace(/[^a-z0-9]/gi, "_") || "animation"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <div className="mt-8 bg-surface rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">作品库</span>
          <span className="text-[10px] text-muted bg-surface-2 px-1.5 py-0.5 rounded-full">
            {items.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-muted" />
        ) : (
          <ChevronDown size={16} className="text-muted" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4">
            {items.map((item) => {
              const data = loadedData[item.url];
              const meta = data?.metadata;

              return (
                <div
                  key={item.url}
                  className="group bg-background rounded-lg border border-border overflow-hidden hover:border-accent/30 transition-colors"
                >
                  {/* Preview */}
                  <div className="aspect-square bg-surface-2 flex items-center justify-center p-2">
                    {data ? (
                      <Lottie
                        animationData={data.lottie_json}
                        loop
                        autoplay
                        style={{ width: "100%", height: "100%" }}
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-muted/30 border-t-muted animate-spin" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2">
                    <p className="text-[10px] text-foreground truncate" title={meta?.prompt}>
                      {meta?.prompt || "未命名"}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[9px] text-muted/60">
                      {meta?.duration_sec ? (
                        <span className="flex items-center gap-0.5">
                          <Clock size={8} />
                          {meta.duration_sec}s
                        </span>
                      ) : null}
                      {meta?.gpu_cost_usd ? (
                        <span className="flex items-center gap-0.5">
                          <DollarSign size={8} />
                          ${meta.gpu_cost_usd.toFixed(4)}
                        </span>
                      ) : null}
                      <span>{meta?.layers || 0}L</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {data && (
                        <button
                          onClick={() =>
                            handleDownload(data, meta?.prompt || "animation")
                          }
                          className="flex-1 flex items-center justify-center gap-1 py-1 text-[9px] rounded bg-surface-2 hover:bg-border text-muted hover:text-foreground transition-colors"
                        >
                          <Download size={10} />
                          JSON
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(item.url)}
                        className="flex items-center justify-center px-1.5 py-1 rounded bg-surface-2 hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
