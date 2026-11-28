import { toast } from "sonner";
import { getAppLang } from "@/lib/i18n/appLang";
import { LANG_LABELS, type AppLang } from "./langPref";

/**
 * When the phone has no voice for a language (Haitian Creole on most phones), the line stays on screen
 * unread and the app says so once a visit, per language, in the app's own language (owner, 2026-11-27).
 */
const NOTE: Record<AppLang, string> = {
  en: "This phone has no spoken voice for {name}.",
  es: "Este teléfono no tiene voz para {name}.",
  zh: "这部手机没有{name}语音。",
  ru: "На этом телефоне нет голоса для языка «{name}».",
  bn: "এই ফোনে {name} ভাষার কোনো কণ্ঠস্বর নেই।",
  ht: "Telefòn sa a pa gen vwa pou li {name}.",
  fr: "Ce téléphone n’a pas de voix en {name}.",
  ko: "이 휴대폰에는 {name} 음성이 없습니다.",
};

/** The note for a missing `lang` voice, written in `appLang`. The language is named as it names itself when the app has it. Pure. */
export function noVoiceNote(lang: string, appLang: AppLang): string {
  const base = lang.replace(/_/g, "-").split("-")[0].toLowerCase();
  let name = LANG_LABELS[base as AppLang] as string | undefined;
  if (!name) {
    try { name = new Intl.DisplayNames([appLang], { type: "language" }).of(base); } catch { /* old browser */ }
  }
  return NOTE[appLang].replace("{name}", name ?? base);
}

const told = new Set<string>();

/** Shows the note once per language this visit. Returns whether it showed. */
export function tellNoVoice(lang: string, show: (text: string) => void = (t) => void toast(t)): boolean {
  const base = lang.replace(/_/g, "-").split("-")[0].toLowerCase();
  if (told.has(base)) return false;
  told.add(base);
  show(noVoiceNote(lang, getAppLang()));
  return true;
}
