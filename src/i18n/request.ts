import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { locales, defaultLocale, type Locale } from './config';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('locale');
  const locale = (localeCookie?.value as Locale) || defaultLocale;
  
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});

export { locales, defaultLocale, type Locale } from './config';
