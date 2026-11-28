import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMapState } from "@/lib/store/MapStateContext";
import { escapeTarget, getSlot, sendSlot, useSlot } from "@/lib/sheet/sheet";

/**
 * The one map panel (left side panel on desktop, bottom sheet on mobile).
 * Features never draw their own floating card: they push content here.
 *
 *   const { showPanel } = usePanel();
 *   showPanel({ id: "station:123", title: "14 St", summary: <…/>, details: <…/> });
 *
 * Content replaces whatever was there (never stacks); the panel's back arrow
 * calls `onBack` and then returns to the home view. A map selection
 * (neighborhood / block) clears pushed content, and pushing content clears
 * the selection, so only one thing is ever shown.
 */
export interface PanelContent {
  /** Stable id, e.g. "restroom:42" or "station:R20". */
  id: string;
  title: string;
  subtitle?: string;
  /** Shown at the peek snap point: name + headline. */
  summary?: ReactNode;
  /** A row of links or buttons under the title, there at the peek too (a shop's photo and map links). */
  actions?: ReactNode;
  /** Shown when pulled up (mobile) / below the summary (desktop). */
  details?: ReactNode;
  /** Label for the minimized peek chip, e.g. "Q · 2 min". Defaults to title. */
  peek?: string;
  onBack?: () => void;
  /** How high a phone sheet opens. A list worth reading (Lines) opens at half; most panels start at the peek. */
  snap?: SheetSnap;
}

/** A quick-filter chip under the search bar. Features register their own. */
export interface PanelChip {
  id: string;
  label: string;
  active: boolean;
  onToggle: () => void;
  /** Live buses only: the routes showing, a way to change them, routes near the map, and why nothing showed. */
  routes?: string[];
  setRoutes?: (routes: string[]) => void;
  suggest?: () => Promise<string[]>;
  /** Every bus route, for choosing by group instead of typing. */
  catalog?: () => Promise<string[]>;
  note?: string | null;
}

/** One search hit; `onSelect` is the feature's own action (fly, select…). */
export interface SearchHit {
  id: string;
  label: string;
  /** Group label shown in the dropdown, e.g. "Station". */
  kind: string;
  onSelect: () => void;
}

/** A search source, e.g. transit stations. Return [] when it has nothing. */
export type SearchProvider = (query: string) => SearchHit[];

type SheetSnap = "peek" | "half" | "full";

interface PanelValue {
  content: PanelContent | null;
  showPanel: (content: PanelContent) => void;
  closePanel: () => void;
  chips: PanelChip[];
  searchProviders: SearchProvider[];
  /** Mobile sheet snap point. */
  snap: SheetSnap;
  setSnap: (snap: SheetSnap) => void;
  /** Desktop side panel collapsed. */
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  /** Layers & filters drawer: shares the one primary slot with the sheet. */
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
  /** The sheet is folded into its peek chip. */
  minimized: boolean;
  minimize: () => void;
  restore: () => void;
  /** Chat and the trip assistant: close the drawer and the details sheet. */
  closeAll: () => void;
  /** A tap on empty map: close a details sheet. The layers drawer stays open. */
  emptyMapTap: () => void;
  /** Esc / Back: close the top panel, else stop the active mode. True if it acted. */
  dismissTop: () => boolean;
  /** Follow / Navigate active: owns the top HUD (phone sheet drops to peek). */
  modeActive: boolean;
  setMode: (id: string, stop: (() => void) | null) => void;
  register: (kind: "chip", id: string, value: PanelChip | null) => void;
  registerSearch: (id: string, provider: SearchProvider | null) => void;
}

const PanelContext = createContext<PanelValue | null>(null);

/**
 * Push panel content from outside React (a map layer's click handler in a
 * feature's lazy `layers` chunk). The mounted PanelProvider shows it.
 */
const bus = new Set<(content: PanelContent) => void>();
export function pushPanel(content: PanelContent): void {
  bus.forEach((show) => show(content));
}
// Handle for the browser tests (open a card the way a map tap does) in dev and the e2e build only; production compiles it away.
if ((import.meta.env.DEV || import.meta.env.VITE_E2E) && typeof window !== "undefined") (window as unknown as { __pushPanel?: unknown }).__pushPanel = pushPanel;

export function PanelProvider({ children }: { children: ReactNode }) {
  const { selectNta, selectBlock, selectedNtaCode, selectedBlockKey } = useMapState();
  const [content, setContent] = useState<PanelContent | null>(null);
  const [chipMap, setChipMap] = useState<Record<string, PanelChip>>({});
  const [searchMap, setSearchMap] = useState<Record<string, SearchProvider>>({});
  const [snap, setSnap] = useState<SheetSnap>("peek");
  const [collapsed, setCollapsed] = useState(false);
  // The slot (drawer open, sheet minimised) is the sheet machine's (src/lib/sheet/sheetMachine.ts).
  const slot = useSlot();
  const [modes, setModes] = useState<Record<string, () => void>>({});

  // A neighborhood / block pick is a sheet too: it takes the slot.
  const hasPlace = !!(selectedNtaCode || selectedBlockKey);
  const sheet = !!content || hasPlace;
  const placeKey = `${selectedNtaCode ?? ""}|${selectedBlockKey ?? ""}`;
  useEffect(() => {
    if (hasPlace) sendSlot({ type: "showSheet" });
  }, [hasPlace, placeKey]);
  // Keep the reducer's "sheet" in step with what is actually shown.
  useEffect(() => {
    if (!sheet) sendSlot({ type: "closeSheet" });
  }, [sheet]);

  const showPanel = useCallback(
    (next: PanelContent) => {
      selectNta(null);
      setContent(next);
      setCollapsed(false);
      setSnap(next.snap ?? "peek");
      sendSlot({ type: "showSheet" });
    },
    [selectNta],
  );
  const clearSheet = useCallback(() => {
    setContent(null);
    selectNta(null);
    selectBlock(null);
    sendSlot({ type: "closeSheet" });
  }, [selectNta, selectBlock]);
  const closePanel = useCallback(() => setContent(null), []);
  const setDrawerOpen = useCallback((open: boolean) => sendSlot({ type: open ? "openDrawer" : "closeDrawer" }), []);
  const toggleDrawer = useCallback(() => sendSlot({ type: "toggleDrawer" }), []);
  const minimize = useCallback(() => sendSlot({ type: "minimize" }), []);
  const restore = useCallback(() => {
    sendSlot({ type: "restore" });
    setSnap("peek");
  }, []);
  const closeAll = useCallback(() => {
    sendSlot({ type: "closeDrawer" });
    clearSheet();
  }, [clearSheet]);
  const emptyMapTap = useCallback(() => {
    if (slot.drawerOpen) return;
    sendSlot({ type: "emptyTap" });
    clearSheet();
  }, [slot.drawerOpen, clearSheet]);
  const setMode = useCallback((id: string, stop: (() => void) | null) => {
    setModes((prev) => {
      if (stop) return { ...prev, [id]: stop };
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);
  const modeActive = Object.keys(modes).length > 0;

  const live = useRef({ sheet, modes, clearSheet });
  live.current = { sheet, modes, clearSheet };
  const dismissTop = useCallback((): boolean => {
    const { sheet: hasSheet, modes: m, clearSheet: clear } = live.current;
    const target = escapeTarget({ ...getSlot(), sheet: hasSheet }, Object.keys(m).length > 0);
    if (target === "drawer") sendSlot({ type: "closeDrawer" });
    else if (target === "sheet") clear();
    else if (target === "mode") Object.values(m).forEach((stop) => stop());
    return target !== null;
  }, []);

  // Esc: capture phase so the top panel closes before any mode's own Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.metaKey || e.ctrlKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (dismissTop()) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [dismissTop]);

  // Browser Back: one history entry stands for "something is open"; popping
  // it closes the top panel (or stops the mode) and the entry comes back while
  // anything is still open.
  const anyOpen = slot.drawerOpen || sheet || modeActive;
  const pushed = useRef(false);
  useEffect(() => {
    if (anyOpen && !pushed.current) {
      window.history.pushState({ ...(window.history.state ?? {}), nmaSlot: true }, "");
      pushed.current = true;
    }
  });
  useEffect(() => {
    const onPop = () => {
      if (!pushed.current) return;
      pushed.current = false;
      dismissTop();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [dismissTop]);

  useEffect(() => {
    bus.add(showPanel);
    return () => {
      bus.delete(showPanel);
    };
  }, [showPanel]);
  const register = useCallback((_kind: "chip", id: string, value: PanelChip | null) => {
    setChipMap((prev) => {
      const next = { ...prev };
      if (value) next[id] = value;
      else delete next[id];
      return next;
    });
  }, []);
  const registerSearch = useCallback((id: string, provider: SearchProvider | null) => {
    setSearchMap((prev) => {
      const next = { ...prev };
      if (provider) next[id] = provider;
      else delete next[id];
      return next;
    });
  }, []);

  const value = useMemo<PanelValue>(
    () => ({
      content,
      showPanel,
      closePanel,
      chips: Object.values(chipMap),
      searchProviders: Object.values(searchMap),
      snap,
      setSnap,
      collapsed,
      setCollapsed,
      drawerOpen: slot.drawerOpen,
      setDrawerOpen,
      toggleDrawer,
      minimized: slot.minimized && sheet,
      minimize,
      restore,
      closeAll,
      emptyMapTap,
      dismissTop,
      modeActive,
      setMode,
      register,
      registerSearch,
    }),
    [content, showPanel, closePanel, chipMap, searchMap, snap, collapsed, slot, sheet, setDrawerOpen, toggleDrawer, minimize, restore, closeAll, emptyMapTap, dismissTop, modeActive, setMode, register, registerSearch],
  );
  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>;
}

/** Register an active mode (Follow, Navigate) that Esc / Back stop once no panel is open. */
export function usePanelMode(id: string, stop: (() => void) | null) {
  const { setMode } = usePanel();
  useEffect(() => {
    setMode(id, stop);
    return () => setMode(id, null);
  }, [setMode, id, stop]);
}

export function usePanel() {
  const ctx = useContext(PanelContext);
  if (!ctx) throw new Error("usePanel must be used inside PanelProvider");
  return ctx;
}

/** Register a quick-filter chip (e.g. "transit", "schools") while mounted. */
export function usePanelChip(chip: PanelChip | null) {
  const { register } = usePanel();
  const id = chip?.id;
  const label = chip?.label;
  const active = chip?.active;
  const onToggle = chip?.onToggle;
  const routesKey = chip?.routes?.join(",");
  const setRoutes = chip?.setRoutes;
  const suggest = chip?.suggest;
  const catalog = chip?.catalog;
  const note = chip?.note;
  useEffect(() => {
    if (!id || !label || !onToggle) return;
    const routes = routesKey === undefined ? undefined : routesKey ? routesKey.split(",") : [];
    register("chip", id, { id, label, active: !!active, onToggle, routes, setRoutes, suggest, catalog, note });
    return () => register("chip", id, null);
  }, [register, id, label, active, onToggle, routesKey, setRoutes, suggest, catalog, note]);
}

/** Register a search source (e.g. transit stations) while mounted. */
export function usePanelSearch(id: string, provider: SearchProvider | null) {
  const { registerSearch } = usePanel();
  useEffect(() => {
    registerSearch(id, provider);
    return () => registerSearch(id, null);
  }, [registerSearch, id, provider]);
}
