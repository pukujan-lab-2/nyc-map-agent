import { recordTurn, serverSttAvailable, transcribeTurn } from "@/lib/voice/serverStt";
import type { Recording } from "@/lib/voice/serverStt";

/** Enable the microphone when the existing speech service is ready. The transcript remains editable. */
export function mountMicrophone(root: HTMLElement, signal: AbortSignal, pauseGuide: () => void, reply: (text: string) => void): void {
  const microphone = root.querySelector<HTMLButtonElement>("#dictate");
  const input = root.querySelector<HTMLInputElement>("#q");
  if (!microphone || !input || !serverSttAvailable()) return;
  let recording: Recording | undefined;
  const setIdle = () => {
    microphone.disabled = false;
    microphone.textContent = "Mic";
    microphone.setAttribute("aria-label", "Dictate a question");
  };
  signal.addEventListener("abort", () => { recording?.stop(); microphone.hidden = true; }, { once: true });
  void fetch("/api/presenter/status", { signal }).then(async (response) => {
    if (!response.ok) return;
    const status = await response.json() as { dictate?: boolean };
    if (!signal.aborted && status.dictate) microphone.hidden = false;
  }).catch(() => undefined);

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
      const result = await transcribeTurn(blob, "en");
      if (signal.aborted) return;
      if ("error" in result || !result.text) {
        reply("I couldn’t transcribe that. Type here or use keyboard dictation.");
        return;
      }
      input.value = [input.value, result.text].filter(Boolean).join(" ").slice(0, 500);
      // Speak-and-go: the transcribed question submits at once, so the guide answers uninterrupted.
      input.form?.requestSubmit();
    } catch {
      if (!signal.aborted) reply("The microphone is unavailable. Type here or use keyboard dictation.");
    } finally {
      recording = undefined;
      if (!signal.aborted) setIdle();
    }
  }
  microphone.addEventListener("click", () => void listen(), { signal });
}
