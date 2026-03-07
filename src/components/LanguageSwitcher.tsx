"use client";

import { useTransition } from "react";
import { Globe } from "lucide-react";
import { locales, localeNames, type Locale } from "@/i18n/config";

interface LanguageSwitcherProps {
  currentLocale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

export default function LanguageSwitcher({ currentLocale, onLocaleChange }: LanguageSwitcherProps) {
  const [isPending, startTransition] = useTransition();

  const handleChange = (locale: Locale) => {
    startTransition(() => {
      onLocaleChange(locale);
    });
  };

  return (
    <div className="relative group">
      <button
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground bg-background border border-border rounded-lg hover:border-accent transition-colors"
        disabled={isPending}
      >
        <Globe size={14} />
        <span>{localeNames[currentLocale]}</span>
      </button>
      
      <div className="absolute right-0 top-full mt-1 py-1 bg-background border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[120px]">
        {locales.map((locale) => (
          <button
            key={locale}
            onClick={() => handleChange(locale)}
            className={`w-full px-3 py-1.5 text-xs text-left hover:bg-accent/10 transition-colors ${
              currentLocale === locale ? "text-accent font-medium" : "text-muted"
            }`}
            disabled={isPending}
          >
            {localeNames[locale]}
          </button>
        ))}
      </div>
    </div>
  );
}
