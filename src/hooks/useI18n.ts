import { useAtom, useAtomValue } from 'jotai';
import { localeAtom, tAtom } from '../store';
import type { SupportedLocale } from '../config/i18n';

export function useI18n() {
  const [locale, setLocale] = useAtom(localeAtom);
  const t = useAtomValue(tAtom);

  return {
    locale,
    setLocale: (newLocale: SupportedLocale) => setLocale(newLocale),
    t,
  };
}
