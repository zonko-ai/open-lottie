"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export interface GenerationParams {
  temperature: number;
  top_p: number;
  top_k: number;
  repetition_penalty: number;
  num_candidates: number;
  maxlen: number;
}

interface ParameterControlsProps {
  params: GenerationParams;
  onChange: (params: GenerationParams) => void;
}

export const DEFAULT_PARAMS: GenerationParams = {
  temperature: 0.9,
  top_p: 0.25,
  top_k: 5,
  repetition_penalty: 1.0,
  num_candidates: 1,
  maxlen: 5556,
};

export default function ParameterControls({
  params,
  onChange,
}: ParameterControlsProps) {
  const [expanded, setExpanded] = useState(false);

  const update = (key: keyof GenerationParams, value: number) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-surface-2 transition-colors"
      >
        <span className="text-xs font-medium text-muted">
          生成参数
        </span>
        {expanded ? (
          <ChevronUp size={14} className="text-muted" />
        ) : (
          <ChevronDown size={14} className="text-muted" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
          {/* Temperature */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted">温度</label>
              <span className="text-xs font-mono text-foreground">
                {params.temperature.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={params.temperature}
              onChange={(e) =>
                update("temperature", parseFloat(e.target.value))
              }
              className="w-full"
            />
            <p className="text-[10px] text-muted/60 mt-0.5">
              控制随机性。值越高越有创意，值越低越确定。
            </p>
          </div>

          {/* Top-p */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted">Top-p</label>
              <span className="text-xs font-mono text-foreground">
                {params.top_p.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={params.top_p}
              onChange={(e) => update("top_p", parseFloat(e.target.value))}
              className="w-full"
            />
            <p className="text-[10px] text-muted/60 mt-0.5">
              核采样阈值。
            </p>
          </div>

          {/* Top-k */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted">Top-k</label>
              <span className="text-xs font-mono text-foreground">
                {params.top_k}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={params.top_k}
              onChange={(e) => update("top_k", parseInt(e.target.value))}
              className="w-full"
            />
            <p className="text-[10px] text-muted/60 mt-0.5">
              限制令牌选择为概率最高的前k个。
            </p>
          </div>

          {/* Repetition Penalty */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted">重复惩罚</label>
              <span className="text-xs font-mono text-foreground">
                {params.repetition_penalty.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="2"
              step="0.05"
              value={params.repetition_penalty}
              onChange={(e) =>
                update("repetition_penalty", parseFloat(e.target.value))
              }
              className="w-full"
            />
            <p className="text-[10px] text-muted/60 mt-0.5">
              惩罚重复的令牌。1.0表示无惩罚。
            </p>
          </div>

          {/* Num Candidates (Best-of-N) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted">
                候选数量 (Best-of-N)
              </label>
              <span className="text-xs font-mono text-foreground">
                {params.num_candidates}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={params.num_candidates}
              onChange={(e) =>
                update("num_candidates", parseInt(e.target.value))
              }
              className="w-full"
            />
            <p className="text-[10px] text-muted/60 mt-0.5">
              生成N个候选并选择最佳。值越高质量越好但速度越慢。
            </p>
          </div>

          {/* Max Token Length */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted">最大令牌长度</label>
              <span className="text-xs font-mono text-foreground">
                {params.maxlen}
              </span>
            </div>
            <input
              type="range"
              min="1024"
              max="8192"
              step="256"
              value={params.maxlen}
              onChange={(e) => update("maxlen", parseInt(e.target.value))}
              className="w-full"
            />
            <p className="text-[10px] text-muted/60 mt-0.5">
              生成Lottie令牌的最大序列长度。
            </p>
          </div>

          {/* Reset button */}
          <button
            onClick={() => onChange(DEFAULT_PARAMS)}
            className="text-xs text-accent hover:text-accent-hover transition-colors"
          >
            重置为默认值
          </button>
        </div>
      )}
    </div>
  );
}
