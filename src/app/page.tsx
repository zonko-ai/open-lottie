import Playground from "@/components/Playground";
import Library from "@/components/Library";
import { useTranslations } from 'next-intl';

export default function Home() {
  const t = useTranslations();
  
  return (
    <div className="min-h-screen bg-background">
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
              {t('nav.paper')}
            </a>
            <a
              href="https://github.com/OpenVGLab/OmniLottie"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              {t('nav.github')}
            </a>
            <a
              href="https://huggingface.co/spaces/OmniLottie/OmniLottie"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              {t('nav.huggingface')}
            </a>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-8 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-[11px] font-medium mb-4">
          {t('hero.badge')}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          {t('hero.title')}
          <span className="text-accent">{t('hero.titleHighlight')}</span>
        </h1>
        <p className="text-muted text-sm max-w-lg mx-auto leading-relaxed">
          {t('hero.description')}
        </p>
      </div>

      <div className="px-4 sm:px-6 pb-16">
        <Playground />
        <div className="max-w-6xl mx-auto">
          <Library />
        </div>
      </div>

      <footer className="border-t border-border py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted">
            {t('footer.poweredBy')}{" "}
            <a
              href="https://arxiv.org/abs/2603.02138"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-hover"
            >
              OmniLottie
            </a>{" "}
            {t('footer.developedBy')}
          </p>
          <p className="text-xs text-muted/60">
            {t('footer.disclaimer')}
          </p>
        </div>
      </footer>
    </div>
  );
}
