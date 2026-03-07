import Playground from "@/components/Playground";
import Library from "@/components/Library";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
            <span className="font-semibold text-sm tracking-tight">
              OpenLottie
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://arxiv.org/abs/2603.02138"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              论文
            </a>
            <a
              href="https://github.com/OpenVGLab/OmniLottie"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://huggingface.co/spaces/OmniLottie/OmniLottie"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              HuggingFace
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-8 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-[11px] font-medium mb-4">
          CVPR 2026
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          将任何内容转换为{" "}
          <span className="text-accent">矢量动画</span>
        </h1>
        <p className="text-muted text-sm max-w-lg mx-auto leading-relaxed">
          通过文字描述、参考图像或视频生成专业的Lottie动画。
          由OmniLottie驱动 — 首个多模态矢量动画生成器。
        </p>
      </div>

      {/* Playground */}
      <div className="px-4 sm:px-6 pb-16">
        <Playground />
        <div className="max-w-6xl mx-auto">
          <Library />
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted">
            基于{" "}
            <a
              href="https://arxiv.org/abs/2603.02138"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-hover"
            >
              OmniLottie
            </a>{" "}
            由OpenVGLab开发
          </p>
          <p className="text-xs text-muted/60">
            Lottie是LottieFiles的商标。这是一个独立项目。
          </p>
        </div>
      </footer>
    </div>
  );
}
