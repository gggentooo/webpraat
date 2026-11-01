import { en, type LocaleDictionary } from './locales/en';
import { ko } from './locales/ko';

export type SupportedLocale = 'en' | 'ko';

export const locales: Record<SupportedLocale, LocaleDictionary> = {
  en,
  ko,
};

export const defaultLocale: SupportedLocale = 'en';

export function getTranslation(locale: SupportedLocale = defaultLocale): LocaleDictionary {
  return locales[locale] || locales.en;
}

export type { LocaleDictionary };
