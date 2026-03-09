/**
 * @fileoverview Request configuration for next-intl internationalization.
 * Handles locale detection from cookies and loads appropriate message bundles.
 * @module i18n/request
 */

import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { locales, defaultLocale, type Locale } from './config';

/**
 * Type guard to validate if a string is a valid locale.
 * @param value - The value to check
 * @returns True if the value is a valid locale, false otherwise
 * @example
 * isValidLocale('en') // true
 * isValidLocale('invalid') // false
 */
function isValidLocale(value: string | undefined): value is Locale {
  return value !== undefined && locales.includes(value as Locale);
}

/**
 * Default export for next-intl request configuration.
 * This function is called by next-intl on each request to determine:
 * - The current locale (from cookie or default)
 * - The message bundle to load for that locale
 * 
 * @returns Configuration object with locale and messages
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('locale');
  const locale = isValidLocale(localeCookie?.value) ? localeCookie.value : defaultLocale;
  
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});

export { locales, defaultLocale, type Locale } from './config';
