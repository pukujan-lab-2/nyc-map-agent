import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Bus, Info, Play, Square, Volume2, VolumeX } from "lucide-react";
import { useSharedLocation } from "@/lib/geo/sharedLocation";
import { useAppLang } from "@/lib/i18n/appLang";
import { formatStationName } from "@/lib/streetName";
import { say } from "@/lib/voice/say";
import { alertDiagram, isGap, type AlertDiagram, type Corner, type StopState } from "./alertDiagram";
import { mtaWords, noticeWalk, type TripMode, type WalkStep } from "./noticeWalk";
import { setShuttleFocus, setWalkFocus } from "./alertFocus";
import { useNoticeLines } from "./noticeLang";
import type { TransitAlert } from "./hooks";
import type { StaticSystem } from "./model";

/** Notices read aloud on tap, unless muted here; the choice stays on this phone. */
const MUTE_KEY = "nma.notices.voice";
const readMuted = () => { try { return localStorage.getItem(MUTE_KEY) === "off"; } catch { return false; } };

/**
 * The walk (owner, 2026-11-07: "automated voice when i click on these notification that tells me in
 * voice and does graph walk for me"): each step is said aloud while its stations light up, then the
 * next. Muted, the steps still walk, paced for reading. Each step stays up at least a moment.
 */
function useNoticeWalk(steps: WalkStep[], auto: boolean, lang: string) {
  const [step, setStep] = useState<number | null>(null);
  const [muted, setMutedState] = useState(readMuted);
  const cancel = useRef<(() => void) | null>(null);
  const stop = useCallback(() => {
    cancel.current?.();
    cancel.current = null;
    setStep(null);
  }, []);
  const play = useCallback(() => {
    cancel.current?.();
    let alive = true;
    let hush: () => void = () => undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const go = (i: number) => {
      if (!alive) return;
      if (i >= steps.length) { cancel.current = null; setStep(null); return; }
      setStep(i);
      let spoke = muted, dwelt = false;
      const next = () => { if (spoke && dwelt) go(i + 1); };
      timer = setTimeout(() => { dwelt = true; next(); }, muted ? 1500 + steps[i].text.length * 45 : 900);
      if (!muted) hush = say(steps[i].text, lang, () => { spoke = true; next(); });
    };
    cancel.current = () => { alive = false; clearTimeout(timer); hush(); };
    go(0);
  }, [steps, muted, lang]);
  const setMuted = (m: boolean) => {
    try { localStorage.setItem(MUTE_KEY, m ? "off" : "on"); } catch { /* private window: this visit only */ }
    stop();
    setMutedState(m);
  };
  // Opened by a tap: start once the words are ready (in the rider's language). Closing the notice ends it.
  const started = useRef(false);
  useEffect(() => { if (auto && !started.current) { started.current = true; play(); } }, [auto, play]);
  useEffect(() => () => cancel.current?.(), []);
  return { step, playing: step !== null, play, stop, muted, setMuted };
}

const TAG_KEYS = ["skip", "closed", "shuttle", "local"] as const;
const TAG: Record<StopState, { label: string; bg: string; fg: string } | null> = {
  skip: { label: "Skipped", bg: "#dc2626", fg: "#ffffff" },
  closed: { label: "No trains", bg: "#475569", fg: "#f1f5f9" },
  shuttle: { label: "Shuttle bus", bg: "#f59e0b", fg: "#111827" },
  local: { label: "Now stops", bg: "#16a34a", fg: "#ffffff" },
  transfer: { label: "Change here", bg: "#2563eb", fg: "#ffffff" },
  noted: { label: "Affected", bg: "#0ea5e9", fg: "#0b1220" },
  open: null,
};

function Diagram({ d, color, lit, labels }: { d: AlertDiagram; color: string; lit: Set<string> | null; labels: Record<StopState, string> & { heading: string } }) {
  const rail = d.rows.filter((r) => isGap(r) || !r.off);
  const off = d.rows.filter((r) => !isGap(r) && r.off);
  const directional = d.kind === "skip" || d.kind === "local" || (d.kind === "named" && /^(?:Uptown|Downtown|.*-bound) /.test(d.heading));
  return (
    <div data-testid="notice-diagram" className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#a5b4cb]">
        {labels.heading}
        {directional && !/both ways/.test(d.heading) ? <ArrowDown className="h-3.5 w-3.5" aria-label="this way down the list" /> : null}
      </div>
      <ol className="flex flex-col" aria-label={`${d.heading}, station by station`}>
        {rail.map((r, i) => {
          const first = i === 0, last = i === rail.length - 1;
          if (isGap(r)) {
            return (
              <li key={`gap${i}`} className="flex min-h-6 items-stretch gap-2.5 text-[12px] text-[#a5b4cb]">
                <span aria-hidden className="relative w-4 shrink-0"><span className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 opacity-70" style={{ background: color }} /></span>
                <span className="self-center">{r.gap === 1 ? "1 more stop" : `${r.gap} more stops`}</span>
              </li>
            );
          }
          const tag = TAG[r.state];
          const broken = r.state === "closed" || r.state === "shuttle";
          const on = lit?.has(r.id) ?? false;
          const seg = (pos: "top" | "bottom") => {
            const hidden = pos === "top" ? first : last;
            return <span className={`absolute left-1/2 w-[3px] -translate-x-1/2 ${pos === "top" ? "top-0 h-1/2" : "bottom-0 h-1/2"}`}
              style={hidden ? undefined : broken ? { backgroundImage: `repeating-linear-gradient(${r.state === "shuttle" ? "#f59e0b" : "#64748b"} 0 4px, transparent 4px 8px)` } : { background: color }} />;
          };
          return (
            <li key={r.id} data-stop={r.id} data-state={r.state} data-lit={on || undefined}
              className="flex min-h-7 items-stretch gap-2.5 rounded-lg pr-1 transition-[background-color,opacity] duration-300"
              style={{ background: on ? "rgba(96,165,250,0.2)" : undefined, opacity: lit && !on ? 0.5 : 1 }}>
              <span aria-hidden className="relative w-4 shrink-0">
                {seg("top")}{seg("bottom")}
                <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] bg-[#0f172a]"
                  style={{ borderColor: r.state === "skip" ? "#dc2626" : r.state === "transfer" ? "#60a5fa" : r.state === "noted" ? "#38bdf8" : broken ? "#94a3b8" : color, background: r.state === "local" || r.state === "open" ? color : "#0f172a" }} />
              </span>
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 py-1 text-[13px]">
                <span className={r.state === "skip" || broken ? "text-[#cbd5e1] line-through decoration-[#94a3b8]/70" : "font-medium"}>{formatStationName(r.name)}</span>
                {tag ? <Tag {...tag} label={labels[r.state]} shuttle={r.state === "shuttle"} /> : null}
                {r.corners ? <Corners list={r.corners} /> : null}
              </span>
            </li>
          );
        })}
      </ol>
      {off.length ? (
        <ul className="mt-1 flex flex-col gap-1" aria-label="Also change at">
          {off.map((r) => !isGap(r) && (
            <li key={r.id} data-stop={r.id} data-state="transfer" data-lit={lit?.has(r.id) || undefined}
              className="flex min-h-7 items-center gap-2.5 rounded-lg pr-1 transition-[background-color,opacity] duration-300"
              style={{ background: lit?.has(r.id) ? "rgba(96,165,250,0.2)" : undefined, opacity: lit && !lit.has(r.id) ? 0.5 : 1 }}>
              <span aria-hidden className="flex w-4 shrink-0 justify-center"><span className="h-3 w-3 rounded-full border-[2.5px] border-[#60a5fa]" /></span>
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
                <span className="font-medium">{formatStationName(r.name)}</span>
                <Tag label={`${labels.transfer}: ${r.off!.join(", ")}`} bg="#2563eb" fg="#ffffff" />
                {r.corners ? <Corners list={r.corners} /> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Where the shuttle bus stops for a station, in the MTA's words. */
function Corners({ list }: { list: Corner[] }) {
  return (
    <span className="flex basis-full items-start gap-1 text-[12px] leading-snug text-[#fcd34d]">
      <Bus className="mt-px h-3 w-3 shrink-0" aria-label="Shuttle bus stop" />
      <span>{list.map((c) => (c.note ? `${c.text} (${c.note})` : c.text)).join("; ")}</span>
    </span>
  );
}

function Tag({ label, bg, fg, shuttle }: { label: string; bg: string; fg: string; shuttle?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-px text-[11px] font-bold" style={{ background: bg, color: fg }}>
      {shuttle ? <Bus className="h-3 w-3" aria-hidden /> : null}{label}
    </span>
  );
}

const TRIP_WORDS = ["Your stop", "Your trip", "Getting off at {stop}", "Getting on at {stop}", "The MTA's words"] as const;

/** The stop picked first: the one the rider came from (a station's card), else the one nearest them, else the first. */
function firstStop(stops: string[], sys: StaticSystem | undefined, from: string | undefined, near: { lon: number; lat: number } | null): string | null {
  if (from && stops.includes(from)) return from;
  if (near && sys) {
    const at = (id: string) => sys.stations.features.find((f) => f.properties.id === id)?.geometry.coordinates as [number, number] | undefined;
    const d = (id: string) => { const p = at(id); return p ? Math.hypot((p[0] - near.lon) * 84_400, (p[1] - near.lat) * 111_320) : Infinity; };
    const best = [...stops].sort((a, b) => d(a) - d(b))[0];
    if (best && d(best) < 1500) return best;
  }
  return stops[0] ?? null;
}

/**
 * An open service notice (plan step 3, `docs/PLAN-notice-walks.md`): the rider says their stop and whether they
 * are getting off or getting on there, and the walk for that case alone is read aloud, one action a step, while
 * the map shows what each step names. The affected stretch is drawn as a line above. The MTA's own words sit
 * behind (i). `stop` picks the rider's stop when the walk opens from a station.
 */
export default function NoticeDiagram({ alert, sys, route, color, auto, stop }: { alert: TransitAlert; sys: StaticSystem | undefined; route: string; color: string; auto: boolean; stop?: string }) {
  // Start from the rider's nearest station when they share where they are; about 100 m is close enough.
  const here = useSharedLocation();
  const nearKey = here.status === "on" && here.coords ? `${here.coords.lon.toFixed(3)},${here.coords.lat.toFixed(3)}` : "";
  const near = useMemo(() => (nearKey ? { lon: Number(nearKey.split(",")[0]), lat: Number(nearKey.split(",")[1]) } : null), [nearKey]);
  const diagram = useMemo(() => alertDiagram(alert, sys, route), [alert, sys, route]);
  const mta = useMemo(() => mtaWords(alert), [alert]);
  const stops = useMemo(() => noticeWalk(alert, sys, route, null).stops, [alert, sys, route]);
  const [picked, setPicked] = useState<string | null>(null);
  const [mode, setMode] = useState<TripMode>("off");
  const you = picked && stops.includes(picked) ? picked : firstStop(stops, sys, stop, near);
  const plan = useMemo(() => noticeWalk(alert, sys, route, you ? { stop: you, mode } : null), [alert, sys, route, you, mode]);
  const english = plan.steps;
  const stopName = (id: string) => formatStationName(String(sys?.stations.features.find((f) => f.properties.id === id)?.properties.name ?? id));
  // One call translates the steps, the tags, the heading and the trip words together (owner, 2026-11-08: "in user preffered language").
  const lang = useAppLang();
  const words = useMemo(() => [...english.map((s) => s.text), ...TAG_KEYS.map((k) => TAG[k]!.label), "Change here", diagram?.heading ?? "", diagram?.tag ?? "", ...TRIP_WORDS], [english, diagram]);
  const said = useNoticeLines(words, lang);
  const steps = useMemo(() => english.map((s, i) => ({ ...s, text: said.lines[i] })), [english, said.lines]);
  const labels = useMemo(() => {
    const t = said.lines.slice(english.length);
    return { ...Object.fromEntries(TAG_KEYS.map((k, i) => [k, t[i]])), transfer: t[TAG_KEYS.length], heading: diagram?.heading ? t[TAG_KEYS.length + 1] : "", noted: t[TAG_KEYS.length + 2] } as Record<StopState, string> & { heading: string };
  }, [said.lines, english.length, diagram]);
  const trip = useMemo(() => {
    const t = said.lines.slice(english.length + TAG_KEYS.length + 3);
    return { stop: t[0], trip: t[1], off: t[2], on: t[3], mta: t[4] };
  }, [said.lines, english.length]);
  const walk = useNoticeWalk(steps, auto && said.ready, lang === "en" || said.failed ? "en-US" : lang);
  // Picking another stop or way plays that walk from the top.
  const replay = useRef(false);
  const choose = (next: { stop?: string; mode?: TripMode }) => {
    replay.current = true;
    if (next.stop) setPicked(next.stop);
    if (next.mode) setMode(next.mode);
  };
  useEffect(() => { if (replay.current && said.ready) { replay.current = false; walk.play(); } }, [plan, said.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const [info, setInfo] = useState(false);
  const current = walk.step === null ? null : english[walk.step];
  const lit = current?.map.stations.length ? new Set(current.map.stations) : null;
  // A shuttle notice: the bus's line and every stop stay on the map while the notice is open.
  const corners = useMemo(() => new Map((diagram?.rows ?? []).flatMap((r) => (!isGap(r) && r.corners ? [[r.id, r.corners] as const] : []))), [diagram]);
  useEffect(() => {
    if (!diagram?.bus) return;
    const closed = new Set(diagram.rows.flatMap((r) => (!isGap(r) && (r.state === "shuttle" || r.state === "closed") ? [r.id] : [])));
    setShuttleFocus({ stops: diagram.bus.map((id) => ({ id, change: !closed.has(id), corners: (corners.get(id) ?? []).map((c) => (c.note ? `${c.text} (${c.note})` : c.text)) })) });
    return () => setShuttleFocus(null);
  }, [diagram, corners]);
  // The map follows the walk: everything this step names (`StepMap`), and its stations framed.
  useEffect(() => {
    if (!current) { setWalkFocus(null); return; }
    const m = current.map;
    setWalkFocus({
      ids: m.stations,
      corners: (m.bus ?? []).flatMap((b) => b.stops.flatMap((x) => (x.corner ? [{ id: x.station, text: x.corner }] : []))),
      bus: (m.bus ?? []).filter((b) => !b.shuttle).map((b) => b.route),
      map: m,
    });
  }, [current]);
  useEffect(() => () => setWalkFocus(null), []);
  const btn = "flex h-9 items-center gap-1.5 rounded-[18px] border border-[rgba(148,163,184,0.3)] px-3 text-[13px] font-semibold text-[#f1f5f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]";
  const chip = "h-8 shrink-0 rounded-lg border px-2.5 text-[12.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]";
  const chipOn = (on: boolean) => (on ? "border-[#60a5fa] bg-[rgba(96,165,250,0.2)] text-white" : "border-[rgba(148,163,184,0.3)] bg-transparent text-[#e2e8f0]");
  return (
    <div data-testid="notice-walk" data-step={walk.step ?? undefined} className="relative flex flex-col gap-2.5 rounded-[14px] border border-[rgba(148,163,184,0.16)] bg-[rgba(15,23,42,0.35)] p-3 text-[#f1f5f9]">
      <button type="button" aria-label={trip.mta} aria-expanded={info} onClick={() => setInfo((v) => !v)}
        className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-[#cbd5e1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]">
        <Info className="h-4 w-4" aria-hidden />
      </button>
      {info ? <p data-testid="notice-mta" className="mr-8 whitespace-pre-line text-[13px] leading-[1.45] text-[#cbd5e1]">{mta}</p> : null}
      {diagram ? <div className="mr-8"><Diagram d={diagram} color={color} lit={lit} labels={labels} /></div> : null}
      {you ? (
        <div className="flex flex-col gap-1.5" data-testid="notice-trip">
          {stops.length > 1 ? (
            <div role="group" aria-label={trip.stop} className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
              <span className="shrink-0 text-[12px] text-[#a5b4cb]">{trip.stop}</span>
              {stops.map((id) => (
                <button key={id} type="button" aria-pressed={id === you} className={`${chip} ${chipOn(id === you)}`} onClick={() => choose({ stop: id })}>{stopName(id)}</button>
              ))}
            </div>
          ) : null}
          <div role="group" aria-label={trip.trip} className="flex flex-wrap items-center gap-1.5">
            {(["off", "on"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} className={`${chip} ${chipOn(mode === m)}`} onClick={() => choose({ mode: m })}>
                {(m === "off" ? trip.off : trip.on).replace("{stop}", stopName(you))}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {said.failed ? <p className="text-[12px] text-[#a5b4cb]">Could not translate this notice, so it is in English.</p> : null}
      <ol className="flex flex-col gap-1 text-[13px] leading-[1.4]" aria-label="What to do" aria-live="polite">
        {steps.map((s, i) => (
          <li key={i} data-testid="notice-step" className={walk.step === i ? "font-semibold text-white" : walk.playing ? "text-[#a5b4cb]" : "text-[#e2e8f0]"}>{s.text}</li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        {walk.playing ? (
          <button type="button" className={btn} onClick={walk.stop}><Square className="h-3.5 w-3.5" aria-hidden />Stop</button>
        ) : (
          <button type="button" className={btn} onClick={walk.play}><Play className="h-3.5 w-3.5" aria-hidden />{walk.muted ? "Walk through" : "Read it to me"}</button>
        )}
        <button type="button" className={btn} aria-pressed={walk.muted} aria-label={walk.muted ? "Voice off: turn on" : "Voice on: turn off"} onClick={() => walk.setMuted(!walk.muted)}>
          {walk.muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}
