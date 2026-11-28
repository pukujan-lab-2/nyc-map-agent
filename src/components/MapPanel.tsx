import { ArrowLeft } from "lucide-react";
import { useFlag, useFlags } from "@/lib/flags";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useColumnWide, useLeftChips } from "@/lib/store/leftColumn";
import { peekChipLabel } from "@/lib/store/panelSlot";
import { PullSheet } from "./PullSheet";
import type { SheetLevel } from "./sheetSwipe";
import { Button } from "@/components/ui/button";
import type { NtaBoundary } from "@/lib/api/nta";
import { useMapState } from "@/lib/store/MapStateContext";
import { usePanel } from "@/lib/store/PanelContext";
import { cn } from "@/lib/utils";
import { PanelSearch, type PanelSearchHandle } from "./PanelSearch";
import { FEATURES } from "@/features";
import { LayersDrawer } from "./LayersDrawer";



/** Feature top-bar lines (hazard notice, weather) in one quiet row under the search bar. */
function FeatureTopBar() {
  const flags = useFlags();
  const bars = FEATURES.filter((f) => f.TopBar && flags[f.id]);
  if (!bars.length) return null;
  return (
    <div data-testid="feature-topbar" className="flex h-8 w-fit max-w-full items-center gap-3 rounded-full border border-border bg-card px-[var(--sp-3)] shadow-md empty:hidden">
      {bars.map((f) => {
        const Bar = f.TopBar!;
        return <Bar key={f.id} />;
      })}
    </div>
  );
}

/**
 * Layout A (#171) top bar: "Where to?" search with Ask, one labelled
 * "Layers & filters" button and a small Transit on / off pill. Everything else
 * is in the LayersDrawer.
 */
function TopBar({ boundaries, status, onLayers }: { boundaries: NtaBoundary[] | null; status?: ReactNode; onLayers: () => void }) {
  const searchRef = useRef<PanelSearchHandle>(null);
  const { chips } = usePanel();
  const transit = chips.find((c) => c.id === "transit");
  // The alert/weather row is a real slot: publish the bar's measured height as
  // --topbar-h so the sheet, the drawer and the status chip sit below it.
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => root.style.setProperty("--topbar-h", `${Math.ceil(el.getBoundingClientRect().height)}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--topbar-h");
    };
  }, []);
  return (
    <div ref={ref} data-testid="topbar" className="space-y-[var(--sp-2)]">
      <div className="flex items-center gap-[var(--sp-2)] rounded-full border border-border bg-card p-[var(--sp-1)] shadow-lg">
        <div className="relative min-w-0 flex-1">
          <PanelSearch ref={searchRef} boundaries={boundaries} />
          {status}
        </div>
        <button type="button" onClick={() => searchRef.current?.ask()} className="h-9 shrink-0 rounded-full bg-primary px-[var(--sp-4)] text-[14px] font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Ask
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-[var(--sp-2)]">
        <button type="button" onClick={onLayers} className="h-9 rounded-full border border-border bg-card px-[var(--sp-4)] text-[13px] font-semibold shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Layers &amp; filters
        </button>
        {transit ? (
          <button type="button" aria-pressed={transit.active} onClick={transit.onToggle} className="flex h-9 items-center gap-[var(--sp-2)] rounded-full border border-border bg-card px-[var(--sp-3)] text-[12px] font-medium shadow-md">
            <span aria-hidden className={cn("h-2 w-2 rounded-full", transit.active ? "bg-[#00933C]" : "bg-muted-foreground/50")} />
            {transit.active ? "Transit on" : "Transit off"}
          </button>
        ) : null}
      </div>
      <FeatureTopBar />
    </div>
  );
}

/**
 * The one map panel, Google Maps style: a collapsible left panel on desktop,
 * the one pull sheet (peek / half / full are its three heights) on mobile. Shows
 * pushed content (`usePanel().showPanel`), else the selected place, else home.
 */
export function MapPanel({
  isDesktop,
  boundaries,
  place,
  status,
  onOpenControls,
  onOpenSources,
}: {
  isDesktop: boolean;
  boundaries: NtaBoundary[] | null;
  /** The selected neighborhood / block (rendered by `PlaceDetails`), or null. */
  place: ReactNode;
  /** Thin loading line drawn under the search bar. */
  status?: ReactNode;
  onOpenControls: () => void;
  onOpenSources: () => void;
}) {
  const { walking, selectedNtaCode, selectedBlockKey } = useMapState();
  // Agent-first home (#370): the chat bar replaces search, so there is no top bar.
  const home = useFlag("agentHome");
  const {
    content, closePanel, snap, setSnap, setCollapsed,
    drawerOpen: layersOpen, setDrawerOpen: setLayersOpen, toggleDrawer,
    minimized, minimize, restore, modeActive,
  } = usePanel();

  // Follow / Navigate own the top HUD: on phone the sheet drops to peek.
  useEffect(() => {
    if (modeActive && !isDesktop) setSnap("peek");
  }, [modeActive, isDesktop, setSnap]);

  // A map pick replaces pushed content; it never stacks on it.
  useEffect(() => {
    if (selectedNtaCode || selectedBlockKey) {
      closePanel();
      setCollapsed(false);
    }
  }, [selectedNtaCode, selectedBlockKey, closePanel, setCollapsed]);

  // Street level keeps the street clear: the panel stays shut unless a tap
  // there opened something (pushed content, or a place picked after the walk
  // began). A selection carried in from overhead does not pop it open.
  const selection = `${selectedNtaCode ?? ""}|${selectedBlockKey ?? ""}`;
  const [walkStart, setWalkStart] = useState({ walking, selection });
  if (walkStart.walking !== walking) setWalkStart({ walking, selection });
  const pickedAtStreet = selection !== walkStart.selection && !!(selectedNtaCode || selectedBlockKey);
  const panelHidden = walking && !content && !pickedAtStreet;
  const level: SheetLevel = snap === "peek" ? 0 : snap === "half" ? 1 : 2;
  const showSheet = !!(content || place) && !panelHidden && !layersOpen && !minimized;
  // The agent home has one place for a card at every size: the phone's sheet, or the left card from 640 px
  // (PullSheet). Another place or restroom is a new view on it, so Back returns to the line under it.
  const wide = useColumnWide();
  const row = useLeftChips();
  useLayoutEffect(() => {
    const root = document.documentElement;
    const column = home ? wide : isDesktop && (showSheet || layersOpen);
    root.style.setProperty("--sheet-left", column ? (home ? "calc(var(--edge) + min(400px, 44vw))" : "calc(var(--edge) + 360px)") : "0px");
    root.style.setProperty("--controls-display", !wide && showSheet && (snap === "half" || snap === "full") ? "none" : "flex");
    return () => {
      root.style.removeProperty("--sheet-left");
      root.style.removeProperty("--controls-display");
    };
  }, [home, wide, isDesktop, showSheet, layersOpen, snap]);
  // No top bar, but the menu row (My day, layers…) sits top-left: the side sheet starts below it, or its
  // title hides under the row (owner screenshot, 2026-10-25).
  useLayoutEffect(() => {
    if (!home) return;
    const root = document.documentElement;
    const menu = document.querySelector<HTMLElement>("[data-testid='menu-row'] > *");
    root.style.setProperty("--topbar-h", `${menu ? Math.ceil(menu.getBoundingClientRect().bottom) : 0}px`);
    return () => { root.style.removeProperty("--topbar-h"); };
  }, [home]);
  if (panelHidden) return null;

  const back = () => {
    content?.onBack?.();
    closePanel();
  };
  const minimizeBtn = (
    <button type="button" onClick={minimize} className="h-7 shrink-0 rounded-full border border-border px-[var(--sp-3)] text-[12px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      Minimize
    </button>
  );
  const header = content ? (
    <>
      <div className="flex items-start gap-2">
        <Button type="button" size="icon" variant="ghost" aria-label="Back" className="-ml-2 h-7 w-7 shrink-0" onClick={back}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <button type="button" className="min-h-6 min-w-0 flex-1 text-left" onClick={() => setSnap("half")}>
          <div className="truncate text-sm font-semibold">{content.title}</div>
          {content.subtitle ? (
            <div className="truncate text-[11px] text-muted-foreground">{content.subtitle}</div>
          ) : null}
          {content.summary}
        </button>
        {minimizeBtn}
      </div>
      {/* Its own row, outside the title button: a link inside a button cannot be tapped by itself. */}
      {content.actions ? <div data-testid="panel-actions" className="mt-1 flex flex-wrap gap-1.5">{content.actions}</div> : null}
    </>
  ) : null;
  const body = content ? (
    <>
      <div className="border-b border-border/60 p-4 pb-3">{header}</div>
      {content.details ? <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-3">{content.details}</div> : null}
    </>
  ) : place ? (
    <>
      <div className="flex shrink-0 justify-end px-4 pt-2">{minimizeBtn}</div>
      {place}
    </>
  ) : null;
  const drawer = (
    <LayersDrawer open={layersOpen} onOpenChange={setLayersOpen} isDesktop={isDesktop} hudActive={modeActive} boundaries={boundaries} onOpenControls={onOpenControls} onOpenSources={onOpenSources} />
  );
  const top = home ? null : <TopBar boundaries={boundaries} status={status} onLayers={toggleDrawer} />;
  // The minimized sheet: one labelled chip that restores on tap.
  const peekLabel = content ? peekChipLabel(content.title, content.peek) : "Place";
  // On the wide home it joins the chip row at the top of the left side, clear of the ask box.
  const peekRow = home && wide ? row : null;
  const peekChip = body && minimized && !layersOpen ? (
    <button
      type="button"
      data-testid="peek-chip"
      onClick={restore}
      aria-label={`Restore ${peekLabel}`}
      className={cn(
        "h-10 truncate rounded-full border border-primary bg-card px-[var(--sp-4)] text-[14px] font-semibold text-foreground shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        peekRow ? "min-w-0 max-w-full" : "absolute bottom-[calc(var(--edge)+env(safe-area-inset-bottom))] left-[var(--edge)] z-40 max-w-[calc(100%-var(--edge)*2-120px)] lg:max-w-[340px]",
      )}
    >
      {peekLabel}
    </button>
  ) : null;
  const chip = peekChip && peekRow ? createPortal(peekChip, peekRow) : peekChip;


  // The classic layout (agentHome off) keeps its floating desktop card.
  if (isDesktop && !home) {
    return (
      <>
        {top ? <div className="absolute left-[var(--edge)] top-[var(--edge)] z-40 w-[clamp(360px,46vw,720px)]">{top}</div> : null}
        {drawer}
        {chip}
        {showSheet ? (
          <div data-testid="details-sheet" className="absolute left-[var(--edge)] top-[calc(var(--edge)+var(--topbar-h)+var(--sp-3))] z-30 flex max-h-[calc(100%-var(--edge)*2-var(--topbar-h)-var(--sp-3))] w-[360px] flex-col overflow-hidden rounded-[22px] border border-border bg-card shadow-2xl">
            {body}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      {top ? <div className="absolute z-30" style={{ top: "calc(env(safe-area-inset-top) + var(--edge))", left: "max(var(--edge), env(safe-area-inset-left))", right: "max(var(--edge), env(safe-area-inset-right))" }}>{top}</div> : null}
      {drawer}
      {chip}
      {/* The one sheet (owner, 2026-11-07): a line or a train opened from here comes up as the sheet's
          next view, and Back brings this one back (src/lib/store/pullSheet.ts). From 640 px it is the left card. */}
      {showSheet ? (
        <PullSheet testId="details-sheet" label={content?.title ?? "Place"} level={level} onLevel={(l) => setSnap(l === 0 ? "peek" : l === 1 ? "half" : "full")}
          onClose={content ? back : minimize} ownBack={Boolean(content)}
          header={content ? header : (
            <div className="flex items-center gap-2 px-1 pb-1">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">Place</span>
              {minimizeBtn}
            </div>
          )}>
          <div className="pull-sheet-body text-card-foreground sm:rounded-[18px] sm:bg-card sm:px-3 sm:pb-3">{content ? (content.details ? <div className="pt-2">{content.details}</div> : null) : place}</div>
        </PullSheet>
      ) : null}
    </>
  );
}
