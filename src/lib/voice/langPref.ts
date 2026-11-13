import { APP_LANGS, LANG_KEY, LANG_LABELS, parseLang, readLang, sendLanguage, useLanguage, type AppLang } from "@/lib/i18n/language";

/**
 * The language picked in the menu (#370), stored on this phone as `nma.lang`; null means the
 * browser's. It lives in the language machine (src/lib/i18n/language.ts, #145) with the asked and
 * browser languages; these are the menu's readers and writer.
 */
export { APP_LANGS, LANG_KEY, LANG_LABELS, parseLang, readLang, type AppLang };

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function setLangPref(next: AppLang | null, storage?: Store): void {
  sendLanguage({ type: "PICK", lang: next, storage });
}

export function useLangPref(): AppLang | null {
  return useLanguage((v) => v.picked);
}
