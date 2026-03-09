"use client";

import { useTransition, useState, useRef, useEffect } from "react";
import { Globe, Loader2 } from "lucide-react";
import { locales, localeNames, type Locale } from "@/i18n/config";

interface LanguageSwitcherProps {
  currentLocale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

export default function LanguageSwitcher({ currentLocale, onLocaleChange }: LanguageSwitcherProps) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleChange = (locale: Locale) => {
    startTransition(() => {
      onLocaleChange(locale);
    });
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsOpen(!isOpen);
    } else if (event.key === "ArrowDown" && isOpen) {
      event.preventDefault();
      const buttons = dropdownRef.current?.querySelectorAll("[role='menuitem']");
      const firstButton = buttons?.[0] as HTMLElement;
      firstButton?.focus();
    }
  };

  const handleItemKeyDown = (event: React.KeyboardEvent, locale: Locale, index: number) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleChange(locale);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      const buttons = dropdownRef.current?.querySelectorAll("[role='menuitem']");
      const nextButton = buttons?.[index + 1] as HTMLElement;
      nextButton?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const buttons = dropdownRef.current?.querySelectorAll("[role='menuitem']");
      const prevButton = (index === 0 ? buttonRef.current : buttons?.[index - 1]) as HTMLElement;
      prevButton?.focus();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground bg-background border border-border rounded-lg hover:border-accent transition-colors disabled:opacity-50"
        disabled={isPending}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Select language"
      >
        {isPending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Globe size={14} />
        )}
        <span>{localeNames[currentLocale]}</span>
      </button>
      
      {isOpen && (
        <div 
          className="absolute right-0 top-full mt-1 py-1 bg-background border border-border rounded-lg shadow-lg z-50 min-w-[120px]"
          role="menu"
          aria-label="Language options"
        >
          {locales.map((locale, index) => (
            <button
              key={locale}
              role="menuitem"
              tabIndex={0}
              onClick={() => handleChange(locale)}
              onKeyDown={(e) => handleItemKeyDown(e, locale, index)}
              className={`w-full px-3 py-1.5 text-xs text-left hover:bg-accent/10 transition-colors focus:bg-accent/10 focus:outline-none ${
                currentLocale === locale ? "text-accent font-medium" : "text-muted"
              }`}
              disabled={isPending}
            >
              {localeNames[locale]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
