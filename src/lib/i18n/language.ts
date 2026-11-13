import { useSyncExternalStore } from "react";
import { assign, createActor, setup } from "xstate";

/**
 * The app's language, in one place (#145). On 2026-11-12 the mic read only the language picked in
 * the menu, the spoken answer read the one the server heard, and the buttons read picked, then
 * asked, then browser: Chinese said after a Chinese question was heard as English, and an English
 * answer was read in a Chinese voice. Now everything that needs a language reads it from this machine:
 * the button text (`useT`), the mic (`useSpeech`), the spoken answer (`say`, Kokoro) and the agent request.
 *
 * It holds three facts and two short-lived ones:
 * - picked: chosen in the menu, kept on the phone as `nma.lang`; null means "follow me".
 * - asked: the language the person last asked in, kept as `nma.askedLang`.
 * - browser: the browser's own tag ("es-US"), updated when it changes.
 * - heard: the language the server heard on the latest voice turn, until that question is sent.
 * - the hands-free language round: the spoken "which language?" question, whose answer picks the
 *   asked language instead of going to the agent as a question (#42).
 */
export const LANG_KEY = "nma.lang";
export const ASKED_KEY = "nma.askedLang";
export const APP_LANGS = ["en", "es", "zh", "ru", "bn", "ht", "fr", "ko"] as const;
export type AppLang = (typeof APP_LANGS)[number];

export const LANG_LABELS: Record<AppLang, string> = {
  en: "English",
  es: "Español",
  zh: "中文",
  ru: "Русский",
  bn: "বাংলা",
  ht: "Kreyòl",
  fr: "Français",
  ko: "한국어",
};

const CODES = new Set<string>(APP_LANGS);

/** A stored tag we accept, or null (use the browser). Anything else is null. */
export function parseLang(raw: string | null | undefined): AppLang | null {
  return raw && CODES.has(raw) ? (raw as AppLang) : null;
}

/** Base language of a BCP 47 tag when the app has text for it ("es-US" → "es"), else null. */
export function appLangOf(tag: string | null | undefined): AppLang | null {
  const b = tag?.split("-")[0].toLowerCase();
  return b && CODES.has(b) ? (b as AppLang) : null;
}

/** Picked, else asked, else browser, else English. */
export function resolveAppLang(picked: AppLang | null, askedLang: AppLang | null, browserLang: AppLang | null): AppLang {
  return picked ?? askedLang ?? browserLang ?? "en";
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const local = (): Store | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

export function readLang(storage: Pick<Storage, "getItem"> | undefined = local()): AppLang | null {
  try {
    return parseLang(storage?.getItem(LANG_KEY));
  } catch {
    return null;
  }
}

function readAsked(storage: Pick<Storage, "getItem"> | undefined = local()): AppLang | null {
  try {
    return appLangOf(storage?.getItem(ASKED_KEY));
  } catch {
    return null;
  }
}

function keep(storage: Store | undefined, key: string, value: string | null): void {
  try {
    if (value) storage?.setItem(key, value);
    else storage?.removeItem(key);
  } catch {
    /* private mode */
  }
}

/** A tag the server accepts (the agent request's `lang`, see `langTag` in the agent schema). */
const TAG = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8}){0,3}$/;
const browserTag = (): string | null => {
  const l = typeof navigator === "undefined" ? undefined : navigator.language;
  return l && l.length <= 35 && TAG.test(l) ? l : null;
};

/**
 * The scripts that make an asked language sticky. A question plainly in the Latin alphabet after one
 * in these lets go of it, so the app goes back to the browser's (owner's partner, 2026-11-12: an
 * English question after a Chinese one was answered with Chinese buttons and a Chinese voice).
 */
const NON_LATIN = new Set<AppLang>(["zh", "ru", "bn", "ko"]);
/** Letters of the scripts that keep the asked language: Cyrillic, Bengali, kana, Chinese, Hangul. */
const NOT_LATIN = /[\u0400-\u04FF\u0980-\u09FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/;
export function leavesAskedScript(asked: AppLang | null, question: string): boolean {
  return !!asked && NON_LATIN.has(asked) && /[A-Za-z]{2,}/.test(question) && !NOT_LATIN.test(question);
}

export interface LangFacts {
  picked: AppLang | null;
  asked: AppLang | null;
  browser: string | null;
  heard: AppLang | null;
  /** Times the spoken language question was answered with a language; hands-free opens the mic once more on each. */
  picks: number;
}

export type LangEvent =
  | { type: "PICK"; lang: AppLang | null; storage?: Store }
  /** A question was sent: `lang` is its language when the text or the voice makes it clear, else null. */
  | { type: "QUESTION"; text: string; lang: AppLang | null }
  | { type: "BROWSER"; tag: string | null }
  | { type: "HEARD"; lang: AppLang | null }
  | { type: "ROUND_OPEN" | "ROUND_CLOSE" }
  /** The spoken answer to "which language?": `sure` when it named exactly one language. */
  | { type: "ROUND_ANSWER"; lang: AppLang; sure: boolean };

export const languageMachine = setup({
  types: { context: {} as LangFacts, events: {} as LangEvent, input: {} as Partial<LangFacts> },
  actions: {
    keepAsked: ({ context }) => keep(local(), ASKED_KEY, context.asked),
  },
}).createMachine({
  id: "language",
  context: ({ input }) => ({ picked: readLang(), asked: readAsked(), browser: browserTag(), heard: null, picks: 0, ...input }),
  initial: "idle",
  on: {
    PICK: {
      actions: [
        assign({ picked: ({ event }) => parseLang(event.lang) }),
        ({ context, event }) => keep(event.storage ?? local(), LANG_KEY, context.picked),
      ],
    },
    QUESTION: [
      { guard: ({ context, event }) => !!event.lang && event.lang !== context.asked, actions: [assign({ asked: ({ event }) => event.lang }), "keepAsked"] },
      { guard: ({ context, event }) => !event.lang && leavesAskedScript(context.asked, event.text), actions: [assign({ asked: null }), "keepAsked"] },
    ],
    BROWSER: { actions: assign({ browser: ({ event }) => (event.tag && TAG.test(event.tag) ? event.tag : null) }) },
    HEARD: { actions: assign({ heard: ({ event }) => event.lang }) },
  },
  states: {
    idle: { on: { ROUND_OPEN: "asking" } },
    asking: {
      on: {
        ROUND_CLOSE: "idle",
        ROUND_ANSWER: [
          { guard: ({ event }) => event.sure, target: "idle", actions: [assign({ asked: ({ event }) => event.lang, picks: ({ context }) => context.picks + 1 }), "keepAsked"] },
          { target: "idle", actions: [assign({ asked: ({ event }) => event.lang }), "keepAsked"] },
        ],
      },
    },
  },
});

/** What every reader needs, worked out from the machine's facts. Pure. */
export interface LangView extends LangFacts {
  /** The language the app shows its text in and listens in. */
  app: AppLang;
  /** The tag sent to the agent and used for the spoken status lines: picked, else the browser's. */
  request: string | null;
  /** The mic's tag: the app's language, with the browser's region when it is the same language. */
  listen: string;
  /** No language picked: the server detects the spoken language. */
  detect: boolean;
  /** The spoken language question is waiting for its answer. */
  asking: boolean;
}

/** A speech tag for `lang`: the request tag's own when it is the same language (keeps its region), else the base. */
export function voiceTag(lang: string, request: string | null): string {
  return request && appLangOf(request) === lang ? request : lang;
}

export function viewOf(context: LangFacts, asking = false): LangView {
  const app = resolveAppLang(context.picked, context.asked, appLangOf(context.browser));
  const request = context.picked ?? context.browser;
  return { ...context, app, request, listen: voiceTag(app, request), detect: context.picked === null, asking };
}

const actor = createActor(languageMachine, { input: {} });
actor.start();

let view: LangView = viewOf(actor.getSnapshot().context);
actor.subscribe((s) => {
  view = viewOf(s.context, s.matches("asking"));
});

export const sendLanguage = (event: LangEvent): void => actor.send(event);

/** The language facts right now, for code outside React (the trip layer, the player, the voice). */
export const getLanguage = (): LangView => view;

/** The language heard on the last voice turn, cleared as it is read: it belongs to that one question. */
export function takeHeard(): AppLang | null {
  const h = view.heard;
  if (h) actor.send({ type: "HEARD", lang: null });
  return h;
}

const subscribe = (f: () => void) => {
  const s = actor.subscribe(f);
  return () => s.unsubscribe();
};

/** One piece of the language, re-rendering when it changes. `pick` must return a primitive or a stable value. */
export function useLanguage<T>(pick: (v: LangView) => T): T {
  return useSyncExternalStore(subscribe, () => pick(view), () => pick(view));
}

if (typeof window !== "undefined") {
  window.addEventListener?.("languagechange", () => sendLanguage({ type: "BROWSER", tag: browserTag() }));
}
