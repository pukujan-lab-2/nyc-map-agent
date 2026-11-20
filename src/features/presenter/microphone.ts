import { recordTurn, serverSttAvailable, transcribeTurn } from "@/lib/voice/serverStt";
import type { Recording } from "@/lib/voice/serverStt";

/** Enable the microphone when the existing speech service is ready. The transcript remains editable. */
export function mountMicrophone(root: HTMLElement, signal: AbortSignal, pauseGuide: () => void, reply: (text: string) => void): void {
  const microphone = root.querySelector<HTMLButtonElement>("#dictate");
  const input = root.querySelector<HTMLInputElement>("#q");
  if (!microphone || !input) return;
  let recording: Recording | undefined;
  const setIdle = () => {
    microphone.disabled = false;
    microphone.textContent = "Mic";
    microphone.setAttribute("aria-label", "Dictate a question");
    microphone.removeAttribute("title");
  };
  // A silently hidden mic reads as a broken button; show why dictation is off instead (#issue-log 2026-11-19).
  const setUnavailable = (why: string) => {
    microphone.hidden = false;
    microphone.disabled = true;
    microphone.textContent = "Mic off";
    microphone.setAttribute("aria-label", why);
    microphone.title = why;
  };
  if (!serverSttAvailable()) {
    setUnavailable("This browser can’t record audio — type your question instead.");
    return;
  }
  signal.addEventListener("abort", () => { recording?.stop(); microphone.hidden = true; }, { once: true });
  void fetch("/api/presenter/status", { signal }).then(async (response) => {
    if (signal.aborted) return;
    if (!response.ok) {
      setUnavailable("Dictation status unknown — type your question instead.");
      return;
    }
    const status = await response.json() as { dictate?: boolean };
    if (signal.aborted) return;
    if (status.dictate) microphone.hidden = false;
    else setUnavailable("Server dictation is off — type your question instead.");
  }).catch(() => {
    if (!signal.aborted) setUnavailable("Dictation status unknown — type your question instead.");
  });

  async function listen(): Promise<void> {
    if (!microphone || !input) return;
    if (recording) {
      recording.stop();
      return;
    }
    pauseGuide();
    microphone.disabled = true;
    try {
      recording = await recordTurn(2500, 8000, 45_000);
      if (signal.aborted) {
        recording.stop();
        void recording.done.catch(() => undefined);
        return;
      }
      microphone.disabled = false;
      microphone.textContent = "Stop";
      microphone.setAttribute("aria-label", "Stop dictation");
      const { blob } = await recording.done;
      recording = undefined;
      if (signal.aborted || !blob) return;
      microphone.disabled = true;
      microphone.textContent = "…";
      const lang = (document.documentElement.lang || "en").split("-")[0] || "en";
      const result = await transcribeTurn(blob, lang);
      if (signal.aborted) return;
      if ("error" in result || !result.text) {
        reply("I couldn’t transcribe that. Type here or use keyboard dictation.");
        return;
      }
      input.value = [input.value, result.text].filter(Boolean).join(" ").slice(0, 500);
      // Review-before-send: misheard station names must be editable before the guide answers (#issue-log 2026-11-19).
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      reply(`Heard: “${result.text}” — edit it if needed, then press Enter to ask.`);
    } catch {
      if (!signal.aborted) reply("The microphone is unavailable. Type here or use keyboard dictation.");
    } finally {
      recording = undefined;
      if (!signal.aborted) setIdle();
    }
  }
  microphone.addEventListener("click", () => void listen(), { signal });
}
