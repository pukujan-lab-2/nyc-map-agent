import { useState, type ReactNode } from "react";
import {
  Accessibility, AudioLines, Box, BusFront, Building2, ChevronRight, CircleDot, CloudSun, Cpu, Database, Ear, Gauge, History, House, Info,
  Leaf, Lightbulb, LocateFixed, MessageSquare, Palette, Shield, Signpost, Sun, TrainFront, Trash2, Volume2, type LucideIcon,
} from "lucide-react";
import { SwitchRow } from "@/components/LiveLayerRows";
import { setAmbient, useAmbient, type LightingMode, type WeatherMode } from "@/lib/ambient";
import { useAdvancedMode, useFlags } from "@/lib/flags";
import { startSharing, stopSharing, useSharedLocation } from "@/lib/geo/sharedLocation";
import { useMenuT } from "@/lib/i18n/menuText";
import { setOptions, useMapOptions } from "@/lib/map/mapOptions";
import {
  MEMORY_KINDS, forgetEverything, listStored, rememberedCount, setRemembering, useMemoryPrefs, type MemoryKind, type StoredItem,
} from "@/lib/memory/memory";
import { healthLine, setProfilePref, useProfilePref, useSmartHealth } from "@/lib/modelProfile";
import { useMapState } from "@/lib/store/MapStateContext";
import { setStepFreePref, useStepFreePref } from "@/lib/stepFreePref";
import { CHOICES, THEMES, setTheme, useTheme } from "@/lib/theme";
import { APP_LANGS, LANG_LABELS, setLangPref, useLangPref, type AppLang } from "@/lib/voice/langPref";
import { parseVoiceChoice, setVoiceChoice, useVoiceChoice, type VoiceChoice } from "@/lib/voice/voiceChoice";
import { setVoicePrefs, useVoicePrefs } from "@/lib/voice/voicePrefs";

const RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]";
const ROW = `flex min-h-12 w-full items-center gap-3 rounded-[12px] px-2 text-left text-[14px] font-medium hover:bg-white/5 disabled:opacity-50 ${RING}`;
const ICON = "h-5 w-5 shrink-0";

function Divider() {
  return <div className="mx-2 my-1 h-px bg-[#263449]" />;
}

function Choice<T extends string>({ icon, label, value, options, onChange }: { icon: ReactNode; label: string; value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <label className="flex min-h-12 items-center gap-3 px-2 text-[14px] font-medium">
      {icon}
      <span className="flex-1">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} aria-label={label}
        className={`h-9 rounded-full border border-[#263449] bg-[rgba(15,23,42,0.9)] px-3 text-[13px] text-[#f1f5f9] ${RING}`}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

/** The app's language: "This phone" follows the browser, so a phone set to Spanish opens in Spanish. */
export function LanguageSelect({ className }: { className?: string }) {
  const t = useMenuT();
  const lang = useLangPref();
  return (
    <select value={lang ?? ""} aria-label={t("language")} data-testid="language-select" onChange={(e) => setLangPref((e.target.value || null) as AppLang | null)}
      className={className ?? `h-9 rounded-full border border-[#263449] bg-[rgba(15,23,42,0.9)] px-3 text-[13px] text-[#f1f5f9] ${RING}`}>
      <option value="">{t("thisPhone")}</option>
      {APP_LANGS.map((code) => <option key={code} value={code}>{LANG_LABELS[code]}</option>)}
    </select>
  );
}

/** Language, Voice (the app's or the phone's), Elevators only (#133) and the model (#35): the follow sheet's Settings tab. */
export function SettingsBody() {
  const t = useMenuT();
  const voice = useVoiceChoice();
  const profile = useProfilePref();
  const line = healthLine(useSmartHealth());
  const stepFree = useStepFreePref();
  return (
    <>
      <label className="flex min-h-11 items-center justify-between gap-3 px-1 text-sm font-semibold">
        {t("language")}
        <LanguageSelect className="min-h-11 rounded-full border border-slate-400/30 bg-slate-900 px-3 text-sm font-medium text-slate-100" />
      </label>
      <label className="flex min-h-11 items-center justify-between gap-3 px-1 text-sm font-semibold">
        {t("voice")}
        <select value={voice} aria-label={t("voice")} onChange={(e) => setVoiceChoice(parseVoiceChoice(e.target.value))}
          className="min-h-11 rounded-full border border-slate-400/30 bg-slate-900 px-3 text-sm font-medium text-slate-100">
          <option value="app">{t("appVoice")}</option>
          <option value="phone">{t("phoneVoice")}</option>
        </select>
      </label>
      <div className="flex min-h-11 items-center justify-between gap-3 px-1 text-sm font-semibold">
        <span id="elevators-only-label">{t("elevatorsOnly")}</span>
        <button type="button" role="switch" aria-checked={stepFree} aria-labelledby="elevators-only-label" data-testid="elevators-only" onClick={() => setStepFreePref(!stepFree)}
          className={`relative h-7 w-12 shrink-0 rounded-full border border-slate-400/30 transition-colors ${stepFree ? "bg-sky-500" : "bg-slate-700"}`}>
          <span aria-hidden className={`absolute top-0.5 h-5.5 w-5.5 rounded-full bg-white shadow transition-[left] ${stepFree ? "left-[1.4rem]" : "left-0.5"}`} style={{ height: 22, width: 22 }} />
        </button>
      </div>
      <label className="flex min-h-11 items-center justify-between gap-3 px-1 text-sm font-semibold">
        {t("model")}
        <select value={profile ?? ""} aria-label={t("model")} onChange={(e) => setProfilePref(e.target.value === "smart" || e.target.value === "dev" ? e.target.value : null)}
          className="min-h-11 rounded-full border border-slate-400/30 bg-slate-900 px-3 text-sm font-medium text-slate-100">
          <option value="">{t("auto")}</option>
          <option value="smart">Smart</option>
          <option value="dev">Dev</option>
        </select>
      </label>
      {line && profile !== "dev" ? <p data-testid="model-health" className="px-1 text-[12px] text-slate-300">{line}</p> : null}
    </>
  );
}

/** Smart (large hosted models) or Dev (the small model in training), with the smart chain's health. */
function ModelChoice() {
  const t = useMenuT();
  const profile = useProfilePref();
  const line = healthLine(useSmartHealth());
  return (
    <>
      <Choice icon={<Cpu className={ICON} aria-hidden />} label={t("model")} value={profile ?? ""}
        onChange={(v) => setProfilePref(v === "" ? null : v)}
        options={[["", t("auto")], ["smart", "Smart"], ["dev", "Dev"]]} />
      {line && profile !== "dev" ? <p data-testid="model-health" className="px-2 pb-2 pl-11 text-[12px] text-[#a5b4cb]">{line}</p> : null}
    </>
  );
}

/** The You card's Settings: voice, the map's look and what it draws, step-free, the model. */
export function AppSettings() {
  const [advanced, setAdvanced] = useAdvancedMode();
  const voice = useVoicePrefs();
  const voiceChoice = useVoiceChoice();
  const flags = useFlags();
  const ambient = useAmbient();
  const theme = useTheme();
  const opts = useMapOptions();
  const { eco, setEco, city3d, setCity3d } = useMapState();
  const stepFree = useStepFreePref();
  const t = useMenuT();
  return (
    <div data-testid="settings-panel">
      <SwitchRow icon={<Volume2 className={ICON} aria-hidden />} label={t("speakAnswers")} on={voice.speak} onChange={(v) => setVoicePrefs({ speak: v })} />
      <Choice icon={<AudioLines className={ICON} aria-hidden />} label={t("voice")} value={voiceChoice} onChange={setVoiceChoice}
        options={[["app", t("appVoice")], ["phone", t("phoneVoice")]] as Array<[VoiceChoice, string]>} />
      <SwitchRow icon={<Ear className={ICON} aria-hidden />} label={t("listenHeyMap")} on={voice.wake} onChange={(v) => setVoicePrefs({ wake: v })} />
      <Divider />
      <Choice icon={<Palette className={ICON} aria-hidden />} label={t("theme")} value={theme} onChange={setTheme}
        options={CHOICES.map((c) => [c, c === "auto" ? t("auto") : THEMES[c].label])} />
      {flags.daylight ? <Choice icon={<Sun className={ICON} aria-hidden />} label={t("lighting")} value={ambient.lighting} onChange={(v: LightingMode) => setAmbient({ lighting: v })} options={[["auto", t("auto")], ["day", t("day")], ["night", t("night")]]} /> : null}
      {flags.weather ? <Choice icon={<CloudSun className={ICON} aria-hidden />} label={t("weather")} value={ambient.weatherMode} onChange={(v: WeatherMode) => setAmbient({ weatherMode: v })} options={[["live", t("live")], ["clear", t("clear")], ["off", t("off")]]} /> : null}
      <Divider />
      <SwitchRow icon={<CircleDot className={ICON} aria-hidden />} label={t("stationsOnly")} on={opts.stationsOnly} onChange={(v) => setOptions({ stationsOnly: v })} />
      <SwitchRow icon={<BusFront className={ICON} aria-hidden />} label={t("busStops")} on={opts.busStops} onChange={(v) => setOptions({ busStops: v })} />
      <SwitchRow icon={<Signpost className={ICON} aria-hidden />} label={t("streetNames")} on={opts.streetNames} onChange={(v) => setOptions({ streetNames: v })} />
      <SwitchRow icon={<Building2 className={ICON} aria-hidden />} label={t("buildings3d")} on={opts.buildings === "3d"} onChange={(v) => setOptions({ buildings: v ? "3d" : "flat" })} />
      {flags.city3d ? <SwitchRow icon={<Box className={ICON} aria-hidden />} label={t("city3d")} on={city3d} onChange={setCity3d} /> : null}
      <Divider />
      <SwitchRow icon={<Leaf className={ICON} aria-hidden />} label={t("eco")} on={eco} onChange={setEco} />
      <SwitchRow icon={<Accessibility className={ICON} aria-hidden />} label={t("elevatorsOnly")} on={stepFree} onChange={setStepFreePref} testId="elevators-only-menu" />
      <SwitchRow icon={<Gauge className={ICON} aria-hidden />} label={t("advanced")} on={advanced} onChange={setAdvanced} />
      <ModelChoice />
    </div>
  );
}

const KIND_ICON: Record<MemoryKind, LucideIcon> = { rides: TrainFront, homeWork: House, chats: MessageSquare, trips: History, exactLocation: LocateFixed };

type DataSection = "kept" | "yours";

/** What we remember: see, pause or delete each kind of memory, or everything (docs/DESIGN_RULES.md). */
export function MemoryControls() {
  const prefs = useMemoryPrefs();
  const t = useMenuT();
  // Exact location is the app's one shared location (the locate button, "Use my
  // location", the agent): the switch shows it live and turns sharing on or off.
  const shared = useSharedLocation();
  const sharing = shared.status === "on" || shared.status === "asking";
  const setExact = (on: boolean) => {
    setRemembering("exactLocation", on);
    if (on) void startSharing().then((c) => { if (!c) setRemembering("exactLocation", false); });
    else stopSharing();
  };
  const [section, setSection] = useState<DataSection | null>("kept");
  const [seeAll, setSeeAll] = useState<StoredItem[] | null>(null);
  const [policy, setPolicy] = useState(false);
  const [confirm, setConfirm] = useState<"ask" | "done" | null>(null);
  const toggle = (id: DataSection) => setSection(section === id ? null : id);
  const refresh = () => { if (seeAll) setSeeAll(listStored()); };
  const head = (id: DataSection, icon: ReactNode, label: string, extra?: ReactNode) => (
    <button type="button" aria-expanded={section === id} onClick={() => toggle(id)}
      className={`flex min-h-12 w-full items-center gap-2.5 px-2.5 text-left text-[15px] font-semibold ${RING}`}>
      {icon}
      <span className="flex-1">{label}</span>
      {extra}
      <span aria-hidden className="text-[#a5b4cb]">{section === id ? "▴" : "▾"}</span>
    </button>
  );
  return (
    <div data-testid="data-panel">
      {head("kept", <Lightbulb className="h-5 w-5 text-[#93c5fd]" aria-hidden />, t("remembered"),
        <span className="text-[13px] font-medium text-[#a5b4cb]">{t("countOf", { n: rememberedCount(prefs), m: MEMORY_KINDS.length })}</span>)}
      {section === "kept" ? (
        <div className="pb-1">
          {MEMORY_KINDS.map((k) => {
            const Icon = KIND_ICON[k];
            if (k === "exactLocation") return <SwitchRow key={k} testId={`memory-${k}`} icon={<Icon className={ICON} aria-hidden />} label={t(k)} on={sharing} onChange={(v) => { setExact(v); refresh(); }} />;
            return <SwitchRow key={k} testId={`memory-${k}`} icon={<Icon className={ICON} aria-hidden />} label={t(k)} on={prefs[k]} onChange={(v) => { setRemembering(k, v); refresh(); }} />;
          })}
        </div>
      ) : null}
      <Divider />
      {head("yours", <Shield className="h-5 w-5 text-[#93c5fd]" aria-hidden />, t("yourData"))}
      {section === "yours" ? (
        <div className="flex flex-col gap-1 px-1 pb-1">
          <button type="button" className={ROW} aria-expanded={seeAll !== null} onClick={() => setSeeAll(seeAll ? null : listStored())}>
            <Database className={ICON} aria-hidden /><span className="flex-1">{t("seeAll")}</span><ChevronRight className={`h-4 w-4 text-[#a5b4cb] transition-transform ${seeAll ? "rotate-90" : ""}`} aria-hidden />
          </button>
          {seeAll ? (
            <ul className="mx-1 flex max-h-40 flex-col gap-1 overflow-y-auto rounded-[12px] bg-[rgba(15,23,42,0.55)] p-2 text-[13px] text-[#cbd5e1]" data-testid="memory-list">
              {seeAll.length ? seeAll.map((s, i) => <li key={i} className="truncate">{s.text}</li>) : <li>{t("nothingKept")}</li>}
            </ul>
          ) : null}
          <button type="button" className={ROW} aria-expanded={policy} onClick={() => setPolicy((v) => !v)}>
            <Info className={ICON} aria-hidden /><span className="flex-1">{t("dataPolicy")}</span><ChevronRight className={`h-4 w-4 text-[#a5b4cb] transition-transform ${policy ? "rotate-90" : ""}`} aria-hidden />
          </button>
          {policy ? <p className="m-0 px-2 text-[13px] leading-snug text-[#a5b4cb]">{t("policyText")}</p> : null}
          <button type="button" data-testid="forget-everything" className={`${ROW} bg-[rgba(127,29,29,0.3)] font-semibold text-[#fca5a5]`}
            onClick={() => {
              if (confirm !== "ask") { setConfirm("ask"); return; }
              forgetEverything();
              setConfirm("done");
              refresh();
            }}>
            <Trash2 className={ICON} aria-hidden />
            <span className="flex-1">{confirm === "ask" ? t("tapAgain") : confirm === "done" ? t("deleted") : t("deleteEverything")}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
