import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import { getLanguage, languageMachine, leavesAskedScript, sendLanguage, takeHeard, viewOf, voiceTag, type LangFacts } from "./language";

const start = (input: Partial<LangFacts> = {}) => {
  const a = createActor(languageMachine, { input: { picked: null, asked: null, browser: "en-US", ...input } });
  a.start();
  const view = () => viewOf(a.getSnapshot().context, a.getSnapshot().matches("asking"));
  return { a, view };
};

describe("language machine", () => {
  it("shows and listens in the picked language, then the asked one, then the browser's", () => {
    expect(start({ picked: "fr", asked: "zh" }).view().app).toBe("fr");
    expect(start({ asked: "zh" }).view().app).toBe("zh");
    expect(start({ browser: "es-US" }).view().app).toBe("es");
    expect(start({ browser: "de-DE" }).view().app).toBe("en");
  });

  it("listens in the asked language, not only the picked one (2026-11-12: Chinese heard as English)", () => {
    const { view } = start({ asked: "zh", browser: "en-US" });
    expect(view().listen).toBe("zh");
    expect(view().detect).toBe(true);
  });

  it("keeps the browser's region when the app's language is the browser's", () => {
    expect(start({ browser: "es-MX" }).view().listen).toBe("es-MX");
    expect(voiceTag("es", "es-MX")).toBe("es-MX");
    expect(voiceTag("zh", "en-US")).toBe("zh");
  });

  it("sends the agent the picked language, else the browser's tag", () => {
    expect(start({ picked: "ko" }).view().request).toBe("ko");
    expect(start({ asked: "zh", browser: "en-GB" }).view().request).toBe("en-GB");
    expect(start({ browser: null }).view().request).toBeNull();
  });

  it("takes the language of a question that makes it clear", () => {
    const { a, view } = start();
    a.send({ type: "QUESTION", text: "最近的厕所在哪里", lang: "zh" });
    expect(view().app).toBe("zh");
  });

  it("lets go of Chinese when the next question is plainly English", () => {
    const { a, view } = start({ asked: "zh" });
    a.send({ type: "QUESTION", text: "Where is the nearest restroom?", lang: null });
    expect(view().asked).toBeNull();
    expect(view().app).toBe("en");
  });

  it("keeps the asked language for a Latin question after a Latin language, or a mixed question", () => {
    expect(leavesAskedScript("es", "where is the restroom")).toBe(false);
    expect(leavesAskedScript("zh", "去 59 St 怎么走")).toBe(false);
    expect(leavesAskedScript("ru", "ok")).toBe(true);
    const { a, view } = start({ asked: "es" });
    a.send({ type: "QUESTION", text: "where is the restroom", lang: null });
    expect(view().asked).toBe("es");
  });

  it("runs the spoken language round: a sure answer ends it and ticks picks", () => {
    const { a, view } = start();
    a.send({ type: "ROUND_OPEN" });
    expect(view().asking).toBe(true);
    a.send({ type: "ROUND_ANSWER", lang: "bn", sure: true });
    expect(view()).toMatchObject({ asking: false, asked: "bn", picks: 1, app: "bn" });
  });

  it("takes a guess without ticking picks, and ignores answers when no round is open", () => {
    const { a, view } = start();
    a.send({ type: "ROUND_ANSWER", lang: "ko", sure: true });
    expect(view().asked).toBeNull();
    a.send({ type: "ROUND_OPEN" });
    a.send({ type: "ROUND_ANSWER", lang: "ko", sure: false });
    expect(view()).toMatchObject({ asking: false, asked: "ko", picks: 0 });
  });

  it("stores a pick and clears it back to the browser", () => {
    const m = new Map<string, string>();
    const storage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
    const { a, view } = start();
    a.send({ type: "PICK", lang: "ht", storage });
    expect(m.get("nma.lang")).toBe("ht");
    expect(view().picked).toBe("ht");
    a.send({ type: "PICK", lang: null, storage });
    expect(m.has("nma.lang")).toBe(false);
    expect(view().detect).toBe(true);
  });

  it("hands the heard language to one question only", () => {
    sendLanguage({ type: "HEARD", lang: "ru" });
    expect(getLanguage().heard).toBe("ru");
    expect(takeHeard()).toBe("ru");
    expect(takeHeard()).toBeNull();
  });
});
