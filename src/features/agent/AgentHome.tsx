import { AlertCircle, ArrowUp, AudioLines, Check, ChevronDown, Loader2, Mic, X } from "lucide-react";
import { formatStationName } from "@/lib/streetName";
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { nextLevel, swipeOf, type SheetLevel } from "@/components/sheetSwipe";
import { pullSheetMounted, raiseSheet, setLeftChips, setLeftSheet, setLeftSlot, useColumnWide, usePullSheetUp, useSheetPlace } from "@/lib/sheet/sheet";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/appLang";
import { removeShell, shellFocused, shellText } from "@/lib/shellDraft";
import { stepLabel, type AgentStep } from "./agentSteps";
import { plainText } from "./plainText";

/**
 * "Agents working" (#370): what the agent is doing right now, from the stream's
 * step lines, instead of a spinner. The first row is the agent reading the question.
 */
export function WorkingPanel({ steps }: { steps: AgentStep[] }) {
  const t = useT();
  // Something always spins while the agent works: once every step is done, the answer is being written.
  const writing = steps.length > 0 && !steps.some((s) => s.status === "start");
  const rows: AgentStep[] = [{ id: "planner", name: "", status: steps.length ? "done" : "start" }, ...steps, ...(writing ? [{ id: "writing", name: "", status: "start" as const }] : [])];
  const slow = useSlow(SLOW_MS);
  return (
    <div className="rounded-xl border bg-background/60 p-3" role="status" aria-live="polite" aria-label={t("agentsWorking")} data-testid="agents-working">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("agentsWorking")}</div>
      <ul className="space-y-1.5 text-sm">
        {rows.map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            {s.status === "start" ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
            ) : s.status === "done" ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            )}
            <span className={cn(s.status === "done" && "text-muted-foreground")}>{s.id === "planner" ? "Planner: reading your question" : s.id === "writing" ? "Writing the answer" : stepLabel(s.name)}</span>
            <span className="sr-only">{s.status === "start" ? "in progress" : s.status === "done" ? "done" : "failed"}</span>
          </li>
        ))}
      </ul>
      {slow ? <p className="mt-2 text-xs text-muted-foreground">Still working. This one is taking longer than usual.</p> : null}
    </div>
  );
}

/** After this long, say the answer is slow so a quiet panel never looks frozen (owner report, 2026-10-24). */
const SLOW_MS = 8000;

/** True once `ms` have passed since the panel appeared. */
function useSlow(ms: number): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), ms);
    return () => window.clearTimeout(t);
  }, [ms]);
  return slow;
}

const SECONDARY = "h-12 rounded-full border border-slate-700 bg-transparent text-sm font-semibold text-slate-100 hover:bg-slate-800 hover:text-white";

export interface AnswerCardProps {
  question: string | null;
  /** The answer text so far; empty while the agent is still working. */
  text: string;
  busy: boolean;
  /** Held until the gap between questions ends; sent on its own. */
  waiting?: boolean;
  working: ReactNode;
  /** The sources/age line (#375), behind "More". */
  sources: ReactNode;
  primary: { label: string; run: () => void } | null;
  /**
   * The reply asks where you are: Use my location takes the primary button's place, right under the text,
   * and More stays shut, since nothing else helps until it is tapped (owner, 2026-10-26).
   */
  location?: ReactNode;
  /** Follow-ups that fit this answer; with none and no sources, there is no More (owner, 2026-10-26). */
  followUps: Array<{ label: string; run: () => void }>;
  /** Anything under the buttons: a location note, the trip card. */
  extra: ReactNode;
  /**
   * The answer is on the map (a "which exit" answer): one or two lines in a small
   * card, with `hint` (the compass prompt) beside More; everything else waits behind More.
   */
  compact?: { hint: ReactNode };
}

/**
 * One answer (#370): the question bubble, the answer and one primary action. Sources and the
 * follow-ups wait behind "More", so someone just getting around never has to read them.
 */
export function AnswerCard(p: AnswerCardProps) {
  const t = useT();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [p.question]);
  // What More opens sits below the fold of the scrolling answer area: bring it into view.
  const moreEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (more) moreEnd.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [more]);
  // The location button can land below the fold of the scrolling answer area: bring it into view.
  const locationEl = useRef<HTMLDivElement>(null);
  const hasLocation = Boolean(p.location);
  useEffect(() => {
    if (hasLocation && !p.busy) locationEl.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [hasLocation, p.busy]);
  const done = !p.busy && !!p.text;
  const hasMore = !p.location && (Boolean(p.sources) || p.followUps.length > 0);
  if (p.compact && !more) {
    return (
      <div className="flex flex-col gap-2 pl-11" data-testid="answer-card" data-compact="">
        {p.text ? <p className="line-clamp-2 text-[15px] leading-snug text-slate-100" aria-live="polite">{formatStationName(p.text)}</p> : null}
        {p.busy ? <p className="text-sm text-slate-300" role="status">{t(p.waiting ? "sendingSoon" : "agentsWorking")}…</p> : null}
        {done ? (
          <div className="flex min-h-9 items-center gap-2">
            <div className="min-w-0 flex-1">{p.compact.hint}</div>
            <Button type="button" variant="ghost" aria-expanded={false} onClick={() => setMore(true)}
              className="h-9 shrink-0 rounded-full px-3 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white">
              {t("more")}
              <ChevronDown className="!h-4 !w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3.5" data-testid="answer-card">
      {p.question ? (
        <div className="max-w-[80%] self-end rounded-[18px] rounded-br-[4px] bg-blue-900 px-3.5 py-2.5 text-sm leading-snug text-slate-50">{p.question}</div>
      ) : null}
      {p.text ? (
        <div className="flex flex-col gap-3 rounded-[18px] border border-[#22314a] bg-[#111c2f]/90 p-3.5">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-100" aria-live="polite">{formatStationName(plainText(p.text))}</p>
          {done ? (
            <div className="flex flex-col gap-2">
              {p.location ? <div ref={locationEl} className="flex flex-col gap-2">{p.location}</div> : null}
              {/* Asking where you are never hides what the answer shows on the map (owner, 2026-10-27: the 7's weekend work). */}
              {p.primary ? (
                <Button type="button" variant={p.location ? "outline" : "default"} className={cn("h-[52px] rounded-full text-[15px] font-semibold", p.location ? "border-[#2c3d5a] bg-transparent text-slate-100 hover:bg-slate-800" : "bg-blue-600 text-white hover:bg-blue-500")} onClick={p.primary.run}>
                  {p.primary.label}
                </Button>
              ) : null}
              {hasMore ? (
                <Button type="button" variant="ghost" aria-expanded={more} onClick={() => setMore((v) => !v)}
                  className="h-11 self-center rounded-full px-4 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white">
                  {t("more")}
                  <ChevronDown className={cn("!h-4 !w-4 transition-transform motion-reduce:transition-none", more && "rotate-180")} aria-hidden="true" />
                </Button>
              ) : null}
              {hasMore && more ? (
                <>
                  {p.sources}
                  {p.followUps.length ? (
                    <div className={cn("grid gap-2", p.followUps.length > 1 && "grid-cols-2")}>
                      {p.followUps.map((f) => <Button key={f.label} type="button" variant="ghost" className={SECONDARY} onClick={f.run}>{f.label}</Button>)}
                    </div>
                  ) : null}
                  <div ref={moreEnd} aria-hidden="true" />
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {p.busy ? (p.waiting ? <p className="text-sm text-slate-300" role="status">{t("sendingSoon")}…</p> : p.working) : null}
      {p.extra}
    </div>
  );
}

function VoiceOrb({ listening, transcript, onStop }: { listening: boolean; transcript: string; onStop: () => void }) {
  const t = useT();
  const transcribing = transcript === "…";
  const active = listening && !transcribing;
  return (
    <section aria-label="Hands-free" data-testid="voice-listening" className="flex flex-col items-center gap-2 px-2 py-2 text-center">
      <button type="button" aria-label={t("stopListening")} onClick={onStop}
        className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-blue-300/50 bg-blue-950 text-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
        <span aria-hidden="true" className="flex h-6 items-center gap-[3px]">
          {[8, 15, 23, 15, 8].map((height, i) => (
            <span key={i} className={cn("w-[3px] rounded-full bg-current", active && "animate-voice-wave motion-reduce:animate-none")}
              style={{ height, animationDelay: `${i * -120}ms` }} />
          ))}
        </span>
      </button>
      <p role="status" className="m-0 text-sm font-semibold text-slate-50">
        {transcribing ? "Transcribing…" : listening ? t("listening") : "Opening microphone…"}
      </p>
      {transcript && !transcribing ? <p className="m-0 max-h-16 w-full overflow-y-auto break-words text-sm text-slate-200">“{transcript}”</p> : null}
    </section>
  );
}

interface AgentHomeProps {
  inputRef: RefObject<HTMLInputElement | null>;
  input: string;
  setInput: (v: string) => void;
  onSend: (text: string) => void;
  /** The box's hint when a focused helper takes what is typed (the where-am-I helper). */
  placeholder?: string;
  busy: boolean;
  /** What dictation has heard so far, shown in the text box until it lands there. */
  interim: string;
  dictation: { supported: boolean; on: boolean; toggle: () => void };
  handsFree: { on: boolean; toggle: () => void };
  /** The orb: hands-free is listening. */
  orb: { show: boolean; listening: boolean; transcript: string; stop: () => void };
  /** A message by the bar (voice unsupported, mic blocked). */
  notice: string | null;
  answerOpen: boolean;
  onCloseAnswer: () => void;
  answer: ReactNode;
  /** The idle home above the bar (Right now card, Home/Work pills, task buttons); null while anything else is open. */
  idle: ReactNode;
  /** Only full-screen modes (street level, the trip preview) take the bottom of the screen. */
  hidden: boolean;
  /** Extra space under the bar so the minimised place chip stays visible. */
  lift: boolean;
}

/** How much of the answer a phone shows at each pull: a line, the usual box, nearly the whole screen. */
const PHONE_ANSWER_H: Record<SheetLevel, string> = {
  0: "max-h-[3.25rem]",
  1: "max-h-[30dvh]",
  // Up to just under the map buttons at the top right; never shorter than the usual box.
  2: "max-h-[max(30dvh,calc(100dvh-30rem))]",
};

/**
 * The agent-first home (#370), as the owner's mockups draw it: a light chat bar
 * that is always there ([text box][dictate][hands-free]), the task buttons above
 * it when nothing is open, and the answer or the voice orb in a translucent
 * sheet that wraps the bar so the map shows through.
 *
 * From 640 px it is one left card that is always there (owner, 2026-11-14 and
 * 2026-11-27, #180): the top view of the one sheet (src/lib/sheet/sheetMachine.ts) or
 * the answer above, the ask box at its foot, so the middle of the map stays clear.
 * On a phone the answer pulls up and down, and other views rest on the bar.
 * The answer is a view of that sheet too: a card opened over it hides it until Back.
 */
export function AgentHome(p: AgentHomeProps) {
  const t = useT();
  const scroller = useRef<HTMLDivElement>(null);
  const { orb, answerOpen, onCloseAnswer, hidden } = p;
  const sheet = orb.show || answerOpen;
  const wide = useColumnWide();
  const column = !hidden && wide;
  useLayoutEffect(() => {
    setLeftSheet(column);
    return () => setLeftSheet(false);
  }, [column]);
  // The answer (or the orb) is a view of the one sheet: on top when it opens and when a new question is
  // sent; a line or a card it opens goes over it, and their Back brings it again.
  const closeAnswer = useRef(() => {});
  closeAnswer.current = orb.show ? orb.stop : onCloseAnswer;
  const [answerId, setAnswerId] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!sheet || hidden) return;
    const { id, release } = pullSheetMounted(() => closeAnswer.current());
    setAnswerId(id);
    return () => { release(); setAnswerId(null); };
  }, [sheet, hidden]);
  useLayoutEffect(() => { if (p.busy && answerId !== null) raiseSheet(answerId); }, [p.busy, answerId]);
  useLayoutEffect(() => { if (orb.show && answerId !== null) raiseSheet(answerId); }, [orb.show, answerId]);
  const answerTop = useSheetPlace(answerId).top;
  const shown = sheet && (answerId === null || answerTop);
  // Another view is on top: on a phone it rests on the bar, and the bar wears the sheet's glass under it.
  const viewUp = usePullSheetUp() && !shown;

  // A phone's answer box pulls up (more answer) and down (more map); each new question starts at the usual size.
  const [level, setLevel] = useState<SheetLevel>(1);
  const swiped = useRef(false);
  const pull = (e: ReactPointerEvent) => {
    swiped.current = false;
    const from = { x: e.clientX, y: e.clientY };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointerup", up);
      const swipe = swipeOf(ev.clientX - from.x, ev.clientY - from.y);
      if (swipe !== "up" && swipe !== "down") return;
      swiped.current = true;
      setLevel((l) => nextLevel(l, swipe));
    };
    window.addEventListener("pointerup", up);
  };

  // Keep the newest answer in view while it streams; once it is done, show it from the top,
  // since on a small phone the box is shorter than the answer and its start was cut off.
  const { busy } = p;
  useEffect(() => {
    const el = scroller.current;
    if (el && busy) el.scrollTop = el.scrollHeight;
  });
  useEffect(() => {
    const el = scroller.current;
    if (el && !busy) el.scrollTop = 0;
  }, [busy]);
  useEffect(() => {
    if (busy) setLevel(1);
  }, [busy]);
  // Pulled all the way up, Center on my location gives way, as it does for a full line sheet.
  const tall = !column && answerOpen && shown && level === 2;
  useLayoutEffect(() => {
    if (!tall) return;
    const root = document.documentElement;
    root.dataset.answerSheet = "full";
    return () => { delete root.dataset.answerSheet; };
  }, [tall]);

  // Escape stops the orb first, then closes the answer. Not while someone is
  // part-way through typing: the first Escape there is theirs, not the answer's.
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const field = e.target as HTMLInputElement | null;
      if (field && (field.tagName === "INPUT" || field.tagName === "TEXTAREA") && field.value) return;
      if (orb.show) orb.stop();
      else onCloseAnswer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [orb, shown, onCloseAnswer]);

  // Publish how much of the screen bottom the home takes as --chat-bar-h, so
  // map controls sit above it. 0px while hidden; unset on unmount. The left
  // column only takes the bar's height there: the rest sits beside the map.
  const stackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLFormElement>(null);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const el = column ? barRef.current : stackRef.current;
    if (hidden || !el) {
      root.style.setProperty("--chat-bar-h", "0px");
      return;
    }
    const publish = () => root.style.setProperty("--chat-bar-h", `${Math.max(0, Math.ceil(window.innerHeight - el.getBoundingClientRect().top))}px`);
    publish();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(publish);
    ro?.observe(el);
    window.addEventListener("resize", publish);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", publish);
    };
  }, [hidden, column]);
  // Also after every render: a ResizeObserver can lag (or not run in a background
  // tab), and a stale, taller value lifted More layers over the menus while the
  // idle cards were gone; a stale, shorter one let panels cover the bar.
  useLayoutEffect(() => {
    const el = column ? barRef.current : stackRef.current;
    if (!hidden && el) document.documentElement.style.setProperty("--chat-bar-h", `${Math.max(0, Math.ceil(window.innerHeight - el.getBoundingClientRect().top))}px`);
  });
  useEffect(() => () => { document.documentElement.style.removeProperty("--chat-bar-h"); }, []);
  // The static chat bar from index.html (#368) gives way once this one shows, keeping what was typed.
  // It hands over the cursor too: keys typed while the app was still loading are delivered after this
  // runs, and with the static bar gone and nothing focused they were dropped.
  const { setInput, inputRef } = p;
  useLayoutEffect(() => {
    if (hidden) return;
    const typed = shellText();
    const focused = shellFocused();
    if (typed) setInput(typed);
    removeShell();
    if (focused) inputRef.current?.focus();
  }, [hidden, setInput, inputRef]);

  if (p.hidden) return null;

  const typed = p.input.trim().length > 0;
  const boxText = p.dictation.on && p.interim ? `${p.input ? `${p.input} ` : ""}${p.interim}` : p.input;

  const bar = (
    <form
      ref={barRef}
      data-testid="agent-bar"
      className={cn("pointer-events-auto flex shrink-0 items-center gap-2 rounded-[30px] bg-slate-50 p-1.5", !sheet && !column && !viewUp && "shadow-[0_8px_24px_rgba(0,0,0,0.45)]")}
      onSubmit={(e) => { e.preventDefault(); p.onSend(p.input); }}
    >
      <input
        ref={p.inputRef}
        value={boxText}
        readOnly={p.dictation.on}
        onChange={(e) => p.setInput(e.target.value)}
        placeholder={p.placeholder ?? (answerOpen ? t("askFollowUp") : t("askAnything"))}
        aria-label={t("askLabel")}
        enterKeyHint="send"
        className="h-11 min-w-0 flex-1 rounded-full bg-transparent pl-3 text-base text-slate-900 outline-none placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-blue-500/60"
      />
      <Button
        type="button"
        variant="ghost"
        aria-label="Dictate"
        aria-pressed={p.dictation.on}
        aria-disabled={!p.dictation.supported}
        className={cn("h-11 w-11 shrink-0 rounded-full p-0 hover:bg-slate-200", p.dictation.on ? "bg-blue-100 text-blue-700 hover:text-blue-700" : "text-slate-600 hover:text-slate-900")}
        onClick={p.dictation.toggle}
      >
        <Mic className={cn("!h-[22px] !w-[22px]", p.dictation.on && "animate-pulse motion-reduce:animate-none")} aria-hidden="true" />
      </Button>
      {typed && !p.dictation.on ? (
        <Button type="submit" aria-label="Send" className={cn("shrink-0 rounded-full bg-blue-600 p-0 text-white hover:bg-blue-500", sheet ? "h-12 w-12" : "h-[52px] w-[52px]")}>
          <ArrowUp className="!h-6 !w-6" strokeWidth={2.4} aria-hidden="true" />
        </Button>
      ) : (
        <Button
          type="button"
          aria-label="Hands-free conversation"
          aria-pressed={p.handsFree.on}
          className={cn("shrink-0 rounded-full p-0 text-white", sheet ? "h-12 w-12" : "h-[52px] w-[52px]", p.handsFree.on ? "bg-violet-600 ring-4 ring-blue-400/40 hover:bg-violet-500" : "bg-blue-600 hover:bg-blue-500")}
          onClick={p.handsFree.toggle}
        >
          <AudioLines className="!h-6 !w-6" strokeWidth={2.4} aria-hidden="true" />
        </Button>
      )}
    </form>
  );

  const content = (
    <>
      {!shown ? (
        sheet ? null : p.idle
      ) : orb.show ? (
        <VoiceOrb listening={orb.listening} transcript={orb.transcript} onStop={orb.stop} />
      ) : answerOpen ? (
        <section aria-label="Assistant answer" data-testid="agent-answers" className="relative flex min-h-0 flex-col">
          {column ? null : (
            <button type="button" data-testid="answer-grip" aria-label={level === 2 ? "Show less" : "Show more"} aria-expanded={level > 0}
              onPointerDown={pull}
              onClick={() => { if (swiped.current) swiped.current = false; else setLevel((l) => (l === 2 ? 0 : ((l + 1) as SheetLevel))); }}
              className="-mt-3 mb-2 flex h-6 w-full touch-none items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 sm:hidden">
              <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-slate-500/70" />
            </button>
          )}
          {/* Its own row: laid over the answer, the X sat on the text once the question scrolled away (320px iPhone, 2026-10-25). */}
          <Button
            type="button"
            variant="ghost"
            aria-label={t("closeAnswer")}
            // Solid, like the task screens' close, so it never reads as part of the text behind it.
            className="-ml-2 -mt-2 h-11 w-11 self-start rounded-full border border-slate-400/45 bg-[#0b1220] p-0 text-slate-300 shadow-[0_4px_12px_rgba(0,0,0,.35)] hover:bg-slate-800 hover:text-white"
            onClick={onCloseAnswer}
          >
            <X className="!h-5 !w-5" aria-hidden="true" />
          </Button>
          {/* A phone keeps most of the map in view: the answer scrolls inside a shorter box, pulled taller or shorter by its grip. */}
          <div ref={scroller} className={cn("min-h-11 overflow-y-auto overscroll-contain", column ? "min-h-0" : `${PHONE_ANSWER_H[level]} sm:max-h-[min(44dvh,520px)]`)}>
            {p.answer}
          </div>
        </section>
      ) : (
        p.idle
      )}
      {p.notice ? (
        <p role="alert" data-testid="agent-notice" className="pointer-events-auto shrink-0 rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-slate-100 backdrop-blur-md">
          {p.notice}
        </p>
      ) : null}
    </>
  );

  // Status chips (live paused, back to street) print in one row at the top of the left side.
  const chips = column ? (
    <div ref={setLeftChips} data-testid="left-chips" data-map-cover
      className="pointer-events-none flex shrink-0 flex-wrap items-center gap-2 empty:hidden [&>*]:pointer-events-auto" />
  ) : null;

  // One tree for both shapes, so the ask box keeps its cursor when the screen changes size.
  return (
    <div
      data-testid="agent-home"
      data-layout={column ? "column" : undefined}
      className={cn(
        "pointer-events-none fixed z-[45] flex",
        column
          ? "bottom-4 left-[var(--edge)] top-[calc(var(--topbar-h,0px)+var(--task-top-h,0px)+var(--edge))] w-[min(400px,44vw)] flex-col gap-3"
          : "inset-x-0 bottom-0 justify-center",
      )}
    >
      {chips}
      <div
        ref={stackRef}
        data-testid="agent-card"
        // The card, an open answer and the views over the bar are map covers: the map keeps its focus beside them.
        data-map-cover={column || sheet || viewUp ? "" : undefined}
        className={cn(
          "dark pointer-events-none flex w-full flex-col",
          column
            ? "pointer-events-auto mt-auto min-h-0 gap-3 rounded-[24px] border border-[#263449] bg-[#0b1220]/80 p-3 shadow-2xl backdrop-blur-xl"
            : cn(
              "sm:mb-4 sm:max-w-[480px]",
              shown && sheet && "max-h-[calc(100dvh-5rem)] rounded-t-[24px] border-t px-4 pt-4",
              !(shown && sheet) && "px-4",
              viewUp && "pointer-events-auto bg-[rgba(11,18,32,.55)] pt-2 backdrop-blur-[14px]",
              p.lift ? "pb-[calc(env(safe-area-inset-bottom)+4.25rem)]" : "pb-[calc(env(safe-area-inset-bottom)+1.5rem)]",
              shown && sheet ? "pointer-events-auto gap-3.5 border-[#263449] bg-[#0b1220]/80 shadow-2xl backdrop-blur-xl" : "gap-3",
            ),
        )}
      >
        {/* The top view of the one sheet prints here (PullSheet), over the answer it hides. */}
        {column ? <div ref={setLeftSlot} data-testid="left-slot" className="flex min-h-0 shrink flex-col empty:hidden" /> : null}
        {content}
        {bar}
      </div>
    </div>
  );
}
