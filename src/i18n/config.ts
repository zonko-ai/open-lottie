/**
 * @fileoverview Internationalization configuration for the application.
 * Defines supported locales, default locale, and locale display names.
 * @module i18n/config
 */

/**
 * Array of supported locale codes.
 * These are the only locales that the application will accept and process.
 */
export const locales = ['en', 'zh-CN', 'zh-TW'] as const;

/**
 * Type representing a valid locale code.
 * Derived from the locales array for type safety.
 */
export type Locale = (typeof locales)[number];

/**
 * The default locale to use when no locale preference is specified.
 * Falls back to English ('en') as the primary language.
 */
export const defaultLocale: Locale = 'en';

/**
 * Mapping of locale codes to their display names.
 * Used for rendering the language switcher UI.
 * @example
 * localeNames['en'] // 'English'
 * localeNames['zh-CN'] // '简体中文'
 */
export const localeNames: Record<Locale, string> = {
  'en': 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文'
};
