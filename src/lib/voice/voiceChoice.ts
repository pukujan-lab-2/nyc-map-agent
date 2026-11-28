import { useSyncExternalStore } from "react";

/**
 * Which voice reads the app aloud (owner, 2026-11-27): "app", Kokoro through the speech gateway, which
 * falls back to the phone's voice for languages it lacks; or "phone", the phone's own voice first.
 * Stored on this phone as `nma.voice`; anything else stored reads as "app", today's default.
 */
export const VOICE_KEY = "nma.voice";
export type VoiceChoice = "app" | "phone";

export const parseVoiceChoice = (raw: string | null | undefined): VoiceChoice => (raw === "phone" ? "phone" : "app");

type Store = Pick<Storage, "getItem" | "setItem">;
const local = (): Store | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

export function readVoiceChoice(storage: Pick<Storage, "getItem"> | undefined = local()): VoiceChoice {
  try {
    return parseVoiceChoice(storage?.getItem(VOICE_KEY));
  } catch {
    return "app";
  }
}

let current: VoiceChoice = readVoiceChoice();
const subs = new Set<() => void>();

export const getVoiceChoice = (): VoiceChoice => current;

export function setVoiceChoice(next: VoiceChoice, storage: Store | undefined = local()): void {
  current = parseVoiceChoice(next);
  try {
    storage?.setItem(VOICE_KEY, current);
  } catch {
    /* private mode: this visit only */
  }
  subs.forEach((f) => f());
}

export function useVoiceChoice(): VoiceChoice {
  return useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => current, () => current);
}
