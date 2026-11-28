import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Layers, Map as MapIcon, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useFlag } from "@/lib/flags";
import { sharedCoords, startSharing, useSharedLocation } from "@/lib/geo/sharedLocation";
import { nextYouCamera, setYouCamera, useYouCamera } from "@/lib/geo/youCamera";
import { onMapInstance } from "@/lib/map/mapInstance";
import { setOpenMenu, useOpenMenu } from "@/lib/store/openMenu";
import { setFollowMode, stopFollowing, useFollowMode, useFollowed, usePreviewing, type FollowMode } from "@/lib/transit/follow";
import { useSelectedLine } from "@/lib/transit/selectedLine";
import { useMenuT } from "@/lib/i18n/menuText";
import { usePanel } from "@/lib/store/PanelContext";
import { APP_LANGS, LANG_LABELS, setLangPref, useLangPref, type AppLang } from "@/lib/voice/langPref";
import type { ViewName } from "@/lib/map/viewChange";
import { pickView, useCurrentView } from "./MapViewSwitch";
import { LiveLayerRows } from "./LiveLayerRows";
import { PullSheet } from "./PullSheet";

/**
 * Agent-first map chrome (#370, #372), copied from Apple Maps (owner, 2026-11-27): at the top right one
 * stacked pair, the map style (a view of the one sheet: Map, 3D, Street, the live layers and More
 * layers) over Center on my location, and the compass under it only while the map is turned. From
 * 640 px, + and − at the bottom right; a phone pinches.
 */

const ROUND = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0 shadow-[0_6px_18px_rgba(0,0,0,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]";
const DARK = "border border-[#263449] bg-[rgba(15,23,42,0.92)] text-[#f1f5f9]";
const RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]";
/** Apple Maps' stacked pair: two square buttons in one rounded glass slab. */
const PAIR = "pointer-events-auto flex w-11 flex-col overflow-hidden rounded-[14px] border border-[#263449] bg-[rgba(15,23,42,0.92)] shadow-[0_6px_18px_rgba(0,0,0,0.35)] backdrop-blur-[14px]";
const PAIR_BTN = "flex h-11 w-11 items-center justify-center text-[#60a5fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#60a5fa]";

const svg = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
// The "my location" crosshair people know from Google Maps (Material Icons, Apache-2.0).
const LocateIcon = () => <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.99 8.99 0 0 0 13 3.06V1h-2v2.06A8.99 8.99 0 0 0 3.06 11H1v2h2.06A8.99 8.99 0 0 0 11 20.94V23h2v-2.06A8.99 8.99 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" /></svg>;
/** Map, 3D and Street, the map style sheet's three tiles. */
const VIEWS: Array<{ id: ViewName; label: string; note: string; icon: ReactNode }> = [
  { id: "map", label: "Map", note: "Flat, from above", icon: <svg {...svg}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 12h16M12 4v16" /></svg> },
  { id: "3d", label: "3D", note: "Tilted, with buildings", icon: <svg {...svg}><path d="M3 20h18M6 20V10l6-5 6 5v10" /></svg> },
  { id: "street", label: "Street", note: "Walk at street level", icon: <svg {...svg}><circle cx="12" cy="5" r="2" /><path d="M12 7v7M9 21l3-7 3 7M8 11h8" /></svg> },
];

const LIVE_URL = "https://nyc.design-bakery.com";
const QrIcon = () => <svg {...svg} width={18} height={18}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" /></svg>;

/** A small QR button: opens a code for the live app, so someone nearby can scan it any time. */
export function QrButton({ wide }: { wide?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  return <>
    {wide
      ? <button type="button" data-testid="qr-button" onClick={() => setOpen(true)} className="task-action task-secondary gap-2"><QrIcon />Show the app's QR code</button>
      : <button type="button" aria-label="QR code for this app" data-testid="qr-button" onClick={() => setOpen(true)}
        className={`${ROUND} ${DARK} pointer-events-auto !h-9 !w-9`}><QrIcon /></button>}
    {open ? (
      <div className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center p-4" data-testid="qr-sheet">
        {/* A tap anywhere around the code closes it. */}
        <button type="button" aria-label="Close QR code" tabIndex={-1} className="absolute inset-0 bg-black/45" onClick={() => setOpen(false)} />
        <div role="dialog" aria-modal="true" aria-label="Scan to open the app"
          className="relative flex w-[min(300px,100%)] flex-col items-center gap-3 rounded-[24px] bg-white p-5 text-center text-[#0f172a] shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
          <button type="button" aria-label="Close QR code" onClick={() => setOpen(false)}
            className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#0b1220] text-xl leading-none text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]">×</button>
          <p className="pr-10 text-left text-[15px] font-semibold">Scan to open the app</p>
          <img src="/qr-live.svg" alt={`QR code for ${LIVE_URL}`} width={220} height={220} className="h-[220px] w-[220px] [image-rendering:pixelated]" />
          <p className="text-[13px] font-medium text-[#334155]">nyc.design-bakery.com</p>
          {/* More than a code: what the project is, in one tap (owner, 2026-11-18). */}
          <Link to="/present" data-testid="qr-more-presenter" onClick={() => setOpen(false)}
            className="flex min-h-11 w-full items-center justify-center rounded-full bg-[#0b1220] px-4 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]">Meet Design Baker →</Link>
          <Link to="/record" data-testid="qr-more-record" onClick={() => setOpen(false)}
            className="flex min-h-11 w-full items-center justify-center rounded-full border border-[#0b1220]/25 px-4 text-[14px] font-semibold text-[#0b1220] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]">Record a station walk →</Link>
          {/* Where the product is going: a short animated page of the full loop. */}
          <a href="/coming-soon.html" data-testid="coming-soon-link"
            className="flex min-h-11 w-full items-center justify-center rounded-full bg-[#0b1220] px-4 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]">See what is coming →</a>
        </div>
      </div>
    ) : null}
  </>;
}

/**
 * The language, as a small chip in the rail at every size. Someone who does not read English must
 * be able to switch from the home screen (owner, 2026-10-25, phones, #54; 2026-11-12, laptops too,
 * #124: the choice in Settings was too hard to find). Settings keeps its own Language choice.
 * A native select sits over the chip, so a phone opens its own picker.
 */
/** Round red Record button: opens the station-walk recorder. Same size and shape as the QR button. */
function RecordButton() {
  const navigate = useNavigate();
  return (
    <button type="button" aria-label="Record a station walk" title="Record a station walk" data-testid="open-recorder"
      onClick={() => navigate("/record")}
      className={`${ROUND} border border-red-700 !bg-red-600 text-white hover:!bg-red-500 pointer-events-auto !h-9 !w-9`}>
      <span aria-hidden className="block h-3 w-3 rounded-full bg-white" />
    </button>
  );
}

function LangChip() {
  const lang = useLangPref();
  const t = useMenuT();
  return (
    <label data-testid="lang-chip" className={`${ROUND} ${DARK} pointer-events-auto relative text-[13px] font-bold uppercase`}>
      {lang ?? <svg {...svg} width={20} height={20}><path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6" /></svg>}
      <select value={lang ?? ""} aria-label={t("language")} onChange={(e) => setLangPref((e.target.value || null) as AppLang | null)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0">
        <option value="">{t("thisPhone")}</option>
        {APP_LANGS.map((code) => <option key={code} value={code}>{LANG_LABELS[code]}</option>)}
      </select>
    </label>
  );
}

/** The live map and its bearing and pitch, outside the react-map-gl tree. */
function useCamera(): { map: MapLibreMap | null; bearing: number; pitch: number } {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [cam, setCam] = useState({ bearing: 0, pitch: 0 });
  useEffect(() => onMapInstance(setMap), []);
  useEffect(() => {
    if (!map) return;
    const sync = () => setCam({ bearing: map.getBearing(), pitch: map.getPitch() });
    sync();
    map.on("rotate", sync);
    map.on("pitch", sync);
    return () => { map.off("rotate", sync); map.off("pitch", sync); };
  }, [map]);
  return { map, ...cam };
}


/** Map, 3D and Street as three tiles; each keeps the spot and the heading. */
function ViewTiles({ onPick }: { onPick: () => void }) {
  const street = useFlag("streetLevel");
  const { map, current: level, walking, spot } = useCurrentView();
  return (
    <div role="radiogroup" aria-label="View" data-testid="map-view-switch" className="grid grid-cols-3 gap-2">
      {VIEWS.filter((v) => street || v.id !== "street").map((v) => {
        const on = level === v.id;
        return (
          <button key={v.id} type="button" role="radio" aria-checked={on} onClick={() => { if (!on) pickView(map, v.id, walking, spot); onPick(); }}
            className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[14px] border text-[14px] font-semibold ${RING}`}
            style={{ background: on ? "rgba(37,99,235,0.22)" : "rgba(15,23,42,0.45)", borderColor: on ? "rgba(96,165,250,0.7)" : "rgba(148,163,184,0.16)" }}>
            {v.icon}
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

/** While following, the map style picks the follow camera; Street rides along at street level (trains and buses). */
const FOLLOW_VIEWS: Array<{ id: FollowMode; label: string }> = [
  { id: "map", label: "Map" },
  { id: "chase", label: "Chase" },
  { id: "side", label: "Side" },
  { id: "overhead", label: "Overhead" },
  { id: "cab", label: "Street" },
];

function FollowTiles({ preview, onPick }: { preview?: boolean; onPick: () => void }) {
  const mode = useFollowMode();
  return (
    <div role="radiogroup" aria-label="Camera" data-testid="follow-view-menu" className="flex flex-wrap gap-2">
      {FOLLOW_VIEWS.map((v) => {
        const on = mode === v.id;
        return (
          <button key={v.id} type="button" role="radio" aria-checked={on} onClick={() => { setFollowMode(v.id); onPick(); }}
            className={`h-11 rounded-full border px-4 text-[14px] font-semibold ${RING}`}
            style={{ background: on ? "#f8fafc" : "transparent", color: on ? "#0f172a" : undefined, borderColor: on ? "transparent" : "rgba(148,163,184,0.3)" }}>
            {preview && v.id === "map" ? "Walkthrough" : v.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The map style button's view of the one sheet, as Apple Maps' map picker: Map, 3D and Street (the follow
 * cameras while following), the Live trains, Live buses and Restrooms switches, then More layers.
 */
function MapStyleSheet({ onClose, follow, preview }: { onClose: () => void; follow: boolean; preview: boolean }) {
  const { setDrawerOpen } = usePanel();
  return (
    <PullSheet testId="map-style-sheet" label="Map" level={2} onLevel={(l) => { if (l < 2) onClose(); }} onClose={onClose}
      header={<div className="flex min-h-11 items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-[17px] font-bold">Map</h2>
        <button type="button" aria-label="Close map style" onClick={onClose} className="task-action task-close"><X className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden /></button>
      </div>}>
      <div className="pull-sheet-body mt-1 flex flex-col gap-3 text-[#f1f5f9]">
        {/* A pick puts the sheet away, so the map (and the follow mini map) shows the new view. */}
        {follow || preview ? <FollowTiles preview={!follow} onPick={onClose} /> : <ViewTiles onPick={onClose} />}
        {follow ? <button type="button" onClick={() => { stopFollowing(); onClose(); }} className={`min-h-11 rounded-full border border-[rgba(148,163,184,0.3)] text-[14px] font-semibold text-[#fca5a5] ${RING}`}>Stop following</button> : null}
        <div data-testid="map-style-layers" className="flex flex-col rounded-[16px] bg-[rgba(15,23,42,0.45)] py-1">
          <LiveLayerRows />
          <button type="button" data-testid="more-layers" onClick={() => setDrawerOpen(true)} className={`flex min-h-12 items-center gap-3 px-2 text-left text-[14px] font-medium ${RING}`}>
            <Layers className="h-[22px] w-[22px] shrink-0" aria-hidden />
            <span className="flex-1">More layers</span>
            <ChevronRight className="h-5 w-5 shrink-0 text-[#a5b4cb]" aria-hidden />
          </button>
        </div>
      </div>
    </PullSheet>
  );
}

/** + and − at the bottom right, from 640 px only: a phone pinches (Apple Maps shows none there). */
const ZOOM_MIN = 9;
const ZOOM_MAX = 20;
function ZoomPair({ map }: { map: MapLibreMap | null }) {
  const step = (d: number) => { if (map) map.easeTo({ zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, map.getZoom() + d)), duration: 250 }); };
  return (
    <div data-testid="zoom-buttons" className={`${PAIR} absolute bottom-[44px] right-4 z-40 max-sm:hidden`}>
      <button type="button" aria-label="Zoom in" className={`${PAIR_BTN} text-[22px] font-semibold text-[#f1f5f9]`} onClick={() => step(1)}>+</button>
      <span className="h-px bg-[#263449]" aria-hidden />
      <button type="button" aria-label="Zoom out" className={`${PAIR_BTN} text-[22px] font-semibold text-[#f1f5f9]`} onClick={() => step(-1)}>−</button>
    </div>
  );
}

/** The arrow Center on my location shows while the map turns with you. */
const TurnIcon = () => <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2 4.5 20.3l.7.7L12 18l6.8 3 .7-.7z" /></svg>;

/**
 * Center on my location, cycled like Google and Apple Maps: the first tap
 * shares your location and follows you; the next turns the map with the way you
 * face (when the phone knows it); the next goes back to north up. Dragging the
 * map stops following (see youCamera).
 */
function LocateButton() {
  const [asking, setAsking] = useState(false);
  const camera = useYouCamera();
  const shared = useSharedLocation();
  const canTurn = shared.course != null || typeof DeviceOrientationEvent !== "undefined";
  const locate = () => {
    if (sharedCoords()) { setYouCamera(nextYouCamera(camera, canTurn)); return; }
    setAsking(true);
    setYouCamera("follow");
    void startSharing().then((c) => {
      setAsking(false);
      if (!c) setYouCamera("off");
    });
  };
  const label = camera === "follow" && canTurn ? "Turn the map with me" : camera === "turn" ? "Keep north up" : "Center on my location";
  return (
    <button type="button" aria-label={label} aria-pressed={camera !== "off"} aria-busy={asking} onClick={locate} data-testid="locate-button" data-camera={camera}
      className={`${PAIR_BTN} ${camera === "off" ? "" : "bg-[#2563eb] !text-white"} ${asking ? "animate-pulse motion-reduce:animate-none" : ""}`}>
      {camera === "turn" ? <TurnIcon /> : <LocateIcon />}
    </button>
  );
}

function Compass({ map, bearing, style }: { map: MapLibreMap; bearing: number; style?: React.CSSProperties }) {
  return (
    <button type="button" aria-label={`Compass, bearing ${Math.round(bearing)} degrees. Reset north and flat`} data-testid="compass"
      onClick={() => map.easeTo({ bearing: 0, pitch: 0 })} className={`${ROUND} ${DARK} pointer-events-auto`} style={style}>
      <span className="flex flex-col items-center leading-none" style={{ transform: `rotate(${-bearing}deg)` }}>
        <span className="block h-0 w-0 border-x-[5px] border-b-[8px] border-x-transparent border-b-[#ef4444]" aria-hidden />
        <span className="text-[11px] font-bold">N</span>
      </span>
    </button>
  );
}

export function MapChrome() {
  const { map, bearing, pitch } = useCamera();
  const line = useSelectedLine();
  const followed = useFollowed();
  // A trip preview rides its marker with the same follow cameras, so the map style offers them too.
  const previewing = usePreviewing();
  // One dropdown at a time: the map style sheet is "view".
  const menu = useOpenMenu();
  const styleOpen = menu === "view";
  const stack = useRef<HTMLDivElement>(null);
  const rotated = Math.abs(bearing) > 0.5 || pitch > 0.5;

  // Escape, or a tap on the map itself, puts the map style sheet away.
  useEffect(() => {
    if (!styleOpen) return;
    const down = (e: PointerEvent) => { if ((e.target as Element | null)?.closest?.(".maplibregl-canvas")) setOpenMenu(null); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenMenu(null); };
    document.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); window.removeEventListener("keydown", key); };
  }, [styleOpen]);
  // A newly picked line closes the sheet; while following, the followed train's line is always
  // selected, so only a change of line counts.
  const lastLine = useRef(line);
  useEffect(() => {
    const changed = lastLine.current !== line;
    lastLine.current = line;
    if (changed && line && !followed) setOpenMenu(null);
  }, [line, followed]);

  // Publish where the button stack ends, so a phone's pull sheet stops short of it.
  useLayoutEffect(() => {
    const el = stack.current;
    const root = document.documentElement;
    if (!el) return;
    const publish = () => root.style.setProperty("--map-chrome-bottom", `${Math.ceil(el.getBoundingClientRect().bottom)}px`);
    publish();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(publish);
    ro?.observe(el);
    window.addEventListener("resize", publish);
    return () => { ro?.disconnect(); window.removeEventListener("resize", publish); };
  });

  const top = "calc(env(safe-area-inset-top) + 16px)";
  const busy = Boolean(followed || previewing || line);
  return (
    <>
      {/* Apple Maps' stacked pair at the top right: the map style, then Center on my location; the compass under them only when the map is turned. */}
      <div ref={stack} data-testid="map-chrome" className="pointer-events-none absolute right-4 z-40 flex flex-col items-end gap-2.5" style={{ top }}>
        <div className={PAIR}>
          <button type="button" aria-label="Map style and layers" aria-haspopup="dialog" aria-expanded={styleOpen} data-testid="map-style-button"
            onClick={() => setOpenMenu(styleOpen ? null : "view")} className={`${PAIR_BTN} ${styleOpen ? "bg-[#f8fafc] !text-[#0f172a]" : ""}`}>
            <MapIcon className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden />
          </button>
          <span className="h-px bg-[#263449]" aria-hidden />
          <LocateButton />
        </div>
        {rotated && map ? <Compass map={map} bearing={bearing} /> : null}
        {busy ? null : <>
          {/* Language stays in sight at every size (#54, #124). */}
          <LangChip />
          <div className="hidden sm:flex"><QrButton /></div>
          <RecordButton />
        </>}
      </div>
      <ZoomPair map={map} />
      {styleOpen ? <MapStyleSheet onClose={() => setOpenMenu(null)} follow={Boolean(followed)} preview={!followed && previewing} /> : null}
    </>
  );
}
