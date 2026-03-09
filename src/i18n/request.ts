import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { locales, defaultLocale, type Locale } from './config';

function isValidLocale(value: string | undefined): value is Locale {
  return value !== undefined && locales.includes(value as Locale);
}

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
