import "./nav.css";
import "@/components/task-screens.css";
import { useSharedLocation } from "@/lib/geo/sharedLocation";
import { turnAroundLine, useWrongWay } from "@/lib/geo/wrongWay";
import { metres } from "@/lib/map/mapRead";
import { useFlag } from "@/lib/flags";
import { loadGuideLandmarks, type GuideLandmark } from "@/lib/guide/landmarkGuide";
import { nextCheckpoint } from "./checkpoints";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, CornerUpLeft, CornerUpRight, Flag, LocateFixed, Navigation, Square, Undo2 } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { onMapInstance } from "@/lib/map/mapInstance";
import { keepInView } from "@/lib/map/keepInView";
import { LOOK_CENTER_DISTANCE_M, poseAlongRoute } from "@/lib/map/walk";
import { useDataView } from "@/lib/store/DataViewContext";
import { setTripStep, useTripStep } from "@/lib/store/tripStep";
import { useCssHeight } from "@/lib/useCssHeight";
import { PullSheet } from "@/components/PullSheet";
import type { SheetLevel } from "@/components/sheetSwipe";
import { appGeo } from "@/lib/geo/devGeo";
import { useMapState } from "@/lib/store/MapStateContext";
import { useActiveTrip } from "@/lib/transit/activeTrip";
import { useLostHelper } from "@/lib/underground/lostHelper";
import { bearingTo } from "./heading";
import { installNavLayers, readNavColors, removeNavLayers, roadNameAt, updateNavLayers } from "./layers";
import { distanceAlong, fetchGuidedRoute, formatMetres, metresLeft, progressAt, type RouteStep } from "./steps";
import { sendCamera, useCameraMode } from "@/lib/map/cameraMode";

const MILE = 1609.344;
const LiveViewBeta = lazy(() => import("./LiveViewBeta"));

function TurnIcon({ step }: { step: RouteStep | null }) {
  const cls = "h-7 w-7 shrink-0 text-primary";
  if (!step) return <ArrowUp className={cls} />;
  if (step.type === "arrive") return <Flag className={cls} />;
  const m = step.modifier ?? "";
  if (m === "uturn") return <Undo2 className={cls} />;
  if (m.includes("left")) return <CornerUpLeft className={cls} />;
  if (m.includes("right")) return <CornerUpRight className={cls} />;
  return <ArrowUp className={cls} />;
}

interface Fix {
  lon: number;
  lat: number;
  accuracy: number;
  heading: number | null;
}

/**
 * Navigation guidance for the walking route: glowing route with chevrons and a
 * turn arrow, a compact next-turn card, and a street-name pill. In street
 * view it follows the camera; in 2D, "Navigate" follows your location on a
 * still, top-down, north-up map. Location is asked for only when you tap Navigate,
 * stays in this tab, and is never sent to our API.
 */
export default function RouteGuide() {
  const home = useFlag("agentHome");
  const { routeStart, routeEnd, clearRoute, followingRoute } = useDataView();
  const { walking, stopWalk } = useMapState();
  // Where am I opens the where-am-I helper with this walk's destination and landmark (#131).
  const walkTo = useActiveTrip()?.destination.label ?? null;
  const lost = useLostHelper();
  const [landmarks, setLandmarks] = useState<readonly GuideLandmark[]>([]);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  useEffect(() => { void loadGuideLandmarks().then(setLandmarks).catch(() => {}); }, []);
  useEffect(() => { setConfirmed([]); }, [routeStart, routeEnd]);
  const shared = useSharedLocation();
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [pos, setPos] = useState<{ lon: number; lat: number; bearing: number } | null>(null);
  // Guidance is a camera mode: it can't overlap a street walk, and a view you pick keeps it from re-tilting.
  const camera = useCameraMode();
  const navigating = camera.kind === "guide" || (camera.kind === "street" && camera.back === "guide");
  const centered = camera.kind === "guide" && camera.centred;
  const tilt = camera.kind === "guide" && camera.tilt;
  const [fix, setFix] = useState<Fix | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);
  const arFlag = useFlag("liveviewAr");

  useEffect(() => onMapInstance(setMap), []);

  const { data: route } = useQuery({
    queryKey: ["walk-steps", routeStart?.lon, routeStart?.lat, routeEnd?.lon, routeEnd?.lat],
    enabled: routeStart !== null && routeEnd !== null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
    queryFn: ({ signal }) => fetchGuidedRoute(routeStart!, routeEnd!, signal),
  });

  const active = Boolean(route) && (walking || navigating || (home && followingRoute));
  // The rest of a train or bus trip, waiting at the end of this walk.
  const tripStep = useTripStep();
  const banner = useCssHeight("--task-top-h", 12);
  const [trayLevel, setTrayLevel] = useState<SheetLevel>(1);
  useEffect(() => { if (!followingRoute && !walking && !navigating) setTripStep(null); }, [followingRoute, walking, navigating]);

  // Layers live while guidance is active; re-added after a style reload and on theme change.
  useEffect(() => {
    if (!map || !active) return;
    let busy = false;
    const install = () => {
      // Only when missing, and never re-entrantly: installing fires styledata itself.
      if (busy || map.getSource("nav-puck") || !map.isStyleLoaded()) return;
      busy = true;
      try {
        installNavLayers(map, readNavColors());
      } finally {
        busy = false;
      }
    };
    install();
    map.on("styledata", install);
    const obs = new MutationObserver(() => {
      removeNavLayers(map);
      install();
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    return () => {
      map.off("styledata", install);
      obs.disconnect();
      removeNavLayers(map);
    };
  }, [map, active]);

  // Street view: the camera is the walker.
  useEffect(() => {
    if (!map || !walking || !route) return;
    const read = () => {
      // The street camera looks at a point LOOK_CENTER_DISTANCE_M ahead; step back to the eye.
      const c = map.getCenter();
      const b = (map.getBearing() * Math.PI) / 180;
      const back = LOOK_CENTER_DISTANCE_M / 111_320;
      setPos({
        lon: c.lng - (Math.sin(b) * back) / Math.cos((c.lat * Math.PI) / 180),
        lat: c.lat - Math.cos(b) * back,
        bearing: map.getBearing(),
      });
    };
    read();
    map.on("move", read);
    return () => {
      map.off("move", read);
    };
  }, [map, walking, route]);

  // 2D navigation: geolocation only after the tap, cleared on stop and unmount.
  const stopNav = () => {
    if (watchRef.current !== null) appGeo()?.clearWatch(watchRef.current);
    watchRef.current = null;
    sendCamera({ type: "stop-guide" });
    setFix(null);
  };
  // Precise GPS for the walker, shared by navigation and the home screen's Live View.
  const watchFix = () => {
    const g = appGeo();
    if (!g) {
      setGeoError("This browser has no location access.");
      return false;
    }
    setGeoError(null);
    if (watchRef.current !== null) return true;
    watchRef.current = g.watchPosition(
      (p) =>
        setFix({
          lon: p.coords.longitude,
          lat: p.coords.latitude,
          accuracy: p.coords.accuracy,
          heading: p.coords.speed && p.coords.speed > 0.5 ? p.coords.heading : null,
        }),
      (e) => setGeoError(e.code === e.PERMISSION_DENIED ? "Location permission was declined." : "Location is unavailable."),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20_000 },
    );
    return true;
  };
  const startNav = () => {
    if (watchFix()) sendCamera({ type: "guide" });
  };
  // Live View opened from the home walking card: GPS only while the camera is up.
  const liveViewOpen = (open: boolean) => {
    if (open) watchFix();
    else if (!navigating) {
      if (watchRef.current !== null) appGeo()?.clearWatch(watchRef.current);
      watchRef.current = null;
      setFix(null);
    }
  };
  useEffect(() => () => {
    if (watchRef.current !== null) appGeo()?.clearWatch(watchRef.current);
    sendCamera({ type: "stop-guide" });
  }, []);
  useEffect(() => {
    if (!routeStart || !routeEnd) stopNav();
  }, [routeStart, routeEnd]);

  const here = walking ? pos : fix ?? (home && followingRoute ? shared.coords ?? routeStart : null);
  const along = route && here ? distanceAlong(route.coordinates, here) : 0;
  const routeBearing = route ? poseAlongRoute(route.coordinates, along + 1)?.bearing ?? 0 : 0;
  const heading = walking ? pos?.bearing ?? 0 : fix?.heading ?? routeBearing;
  const progress = route && here ? progressAt(route, here) : null;
  const stepStreet = progress && route ? route.steps[progress.nextIndex - 1]?.name ?? "" : "";
  // In street view the eye is below the screen; probe a little ahead along the heading.
  const probe = here && walking ? poseAlongRoute(route?.coordinates ?? [], along + 15) : here;
  const street = stepStreet || (map && active && probe ? roadNameAt(map, probe.lon, probe.lat) : "");
  // Real walking only (not the street-view camera): warn when you head away from the next turn.
  const accuracy = fix ? fix.accuracy : home && followingRoute ? shared.accuracy ?? null : null;
  const awayFrom = active && !walking && progress && here ? progress.next.name || street : null;
  const away = useWrongWay(awayFrom !== null && progress && here ? { key: String(progress.nextIndex), metres: metres([here.lon, here.lat], progress.next.location), accuracy, place: awayFrom } : null);

  // Draw the frame.
  useEffect(() => {
    if (!map || !active || !route || !map.getSource("nav-route")) return;
    updateNavLayers(map, {
      route,
      along,
      next: progress?.next ?? null,
      puck: here
        ? { lon: here.lon, lat: here.lat, bearing: heading, accuracyM: fix?.accuracy ?? 0, show: !walking }
        : null,
    });
  });

  // The camera follows the fix until you pan away.
  useEffect(() => {
    if (!map || !navigating || walking) return;
    const off = () => sendCamera({ type: "pan" });
    map.on("dragstart", off);
    return () => {
      map.off("dragstart", off);
    };
  }, [map, navigating, walking]);
  // Top-down and north up. The first fix frames you close (until you pick a view yourself);
  // after that the map stays still and re-centres only when you near the edge, not on every fix.
  const framed = useRef(false);
  useEffect(() => {
    if (!map || camera.kind !== "guide" || !centered) { framed.current = false; return; }
    if (!fix) return;
    if (!framed.current) {
      framed.current = true;
      map.easeTo({ center: [fix.lon, fix.lat], pitch: 0, bearing: 0, ...(tilt ? { zoom: Math.max(map.getZoom(), 17) } : {}), duration: 600 });
      return;
    }
    keepInView(map, [fix.lon, fix.lat]);
  }, [map, camera.kind, fix, centered, tilt]);
  // Walking guidance from the answer: your shared dot stays on screen the same way.
  const homeWalk = home && followingRoute && !walking && !navigating && here !== null;
  useEffect(() => {
    if (!map || !homeWalk || !here) return;
    keepInView(map, [here.lon, here.lat]);
  }, [map, homeWalk, here?.lon, here?.lat]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!route) return null;

  const left = here ? metresLeft(route, here) : route.steps.reduce((s, x) => s + x.distance, 0);

  const checkpoint = here ? nextCheckpoint(here, heading, landmarks, confirmed) : null;
  if (home && active) {
    // An open answer no longer hides the walk: the one sheet shows whichever view is on top.
    if (lost) return null;
    const mins = Math.max(1, Math.round(left / 80));
    const arrived = left <= 20;
    const arriveAt = new Date(Date.now() + mins * 60_000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const end = () => { stopNav(); stopWalk(); clearRoute(); setTripStep(null); };
    // Near the station the next step of the trip wins over a landmark hint.
    const hint = checkpoint?.landmark.picture && !(tripStep && left < 150) ? checkpoint : null;
    return <>
      {/* The turn banner, as Apple Maps navigates: the next turn or landmark, at the top. */}
      <section ref={banner} className="task-panel task-top flex items-center gap-3 px-3.5 py-3 min-[380px]:gap-3.5 min-[380px]:px-4 min-[380px]:py-3.5" aria-label="Walking guidance">
        <TurnIcon step={arrived ? { type: "arrive" } as RouteStep : progress?.next ?? null} />
        <div className="min-w-0 flex-1"><h2 className="text-base font-bold leading-tight min-[380px]:text-xl"><span className="line-clamp-2">{arrived ? (walkTo ? `You're at ${walkTo.split(",")[0]}` : "You're here") : checkpoint ? `Walk toward ${checkpoint.landmark.name}` : progress?.instruction ?? "Follow the walking route"}</span></h2>
          {away ? <p className="mt-0.5 truncate text-sm font-semibold text-amber-300" role="alert" data-testid="wrong-way">{turnAroundLine(awayFrom ?? "")}</p> : !arrived ? <p className="mt-0.5 truncate text-sm text-slate-300">{[progress && !checkpoint ? `In ${formatMetres(progress.metresToNext)}` : progress?.instruction, street].filter(Boolean).join(" · ")}</p> : null}</div>
        {arFlag && progress ? (
          <Suspense fallback={null}>
            <LiveViewBeta
              compact
              onOpenChange={liveViewOpen}
              accuracyM={fix?.accuracy ?? null}
              targetBearing={here ? bearingTo(here, { lon: progress.next.location[0], lat: progress.next.location[1] }) : routeBearing}
              instruction={progress.instruction}
              distanceLabel={formatMetres(progress.metresToNext)}
              frame={{ route, along, next: progress.next }}
              at={fix}
            />
          </Suspense>
        ) : null}
      </section>
      {/* The rest is the sheet's: time and distance left, the next landmark as a hint, and End. */}
      <PullSheet testId="walk-tray" label="Walking" level={trayLevel} onLevel={(l) => setTrayLevel(l || 1)}
        header={<div className="flex min-h-11 items-center gap-2.5" data-testid="walk-left">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-bold">{arrived ? "Arrived" : `${mins} min · ${formatMetres(left)}`}</p>
            {arrived ? null : <p className="truncate text-[13px] text-slate-300">Arrive {arriveAt}</p>}
          </div>
          <button type="button" className="task-action shrink-0 bg-red-600 px-5" aria-label="End walking guidance" onClick={end}>{arrived ? "Done" : "End"}</button>
        </div>}>
        <div className="pull-sheet-body mt-1 flex flex-col gap-2">
          {hint ? <div className="flex items-center gap-2.5" data-testid="walk-hint">
            <img src={hint.landmark.picture!.url} alt="" className="h-12 w-12 shrink-0 rounded-xl border border-slate-400/25 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[15px] font-semibold leading-snug">{hint.landmark.name} {hint.direction}</p>
              <p className="text-[13px] text-slate-300">in {formatMetres(hint.distanceM)} · <a href={hint.landmark.picture!.page} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">Photo: {hint.landmark.picture!.artist}</a></p>
            </div>
          </div> : null}
          {tripStep ? <div className="flex items-center gap-2.5" data-testid="walk-next">
            <p className="line-clamp-2 min-w-0 flex-1 text-[15px] font-semibold leading-snug">{tripStep.then}</p>
            <button type="button" className="task-action shrink-0 px-4" onClick={() => { stopNav(); stopWalk(); tripStep.go(); }}>{tripStep.action}</button>
          </div> : null}
        </div>
      </PullSheet>
    </>;
  }

  return (
    <>
      {active && progress ? (
        <div className={`pointer-events-none absolute left-1/2 z-30 w-[min(20rem,calc(100%-1.5rem))] -translate-x-1/2 ${walking ? "bottom-[16rem] sm:bottom-24" : "bottom-40"}`}>
          <div className="flex items-center gap-3 rounded-lg border bg-background/90 p-3 shadow-lg backdrop-blur" role="status">
            <TurnIcon step={progress.next} />
            <div className="min-w-0">
              <div className={`truncate text-sm font-semibold ${away ? "text-amber-600" : "text-foreground"}`} data-testid={away ? "wrong-way" : undefined}>
                {away ? turnAroundLine(awayFrom ?? "") : `${progress.instruction}, ${formatMetres(progress.metresToNext)}`}
              </div>
              <div className="text-xs tabular-nums text-muted-foreground">{(left / MILE).toFixed(2)} mi to go</div>
            </div>
          </div>
        </div>
      ) : null}

      {active && street && walking ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-[4.5rem] z-30 flex justify-center">
          <span className="rounded-full border bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow">
            {street}
          </span>
        </div>
      ) : null}

      {!walking ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-30 flex flex-col items-center gap-2 [&>*]:pointer-events-auto">
          {navigating && !centered ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => sendCamera({ type: "recenter" })}>
              <LocateFixed className="h-4 w-4" /> Recenter
            </Button>
          ) : null}
          <Button type="button" size="sm" variant={navigating ? "outline" : "default"} onClick={navigating ? stopNav : startNav}>
            {navigating ? <Square className="h-4 w-4" /> : <Navigation className="h-4 w-4" />}
            {navigating ? "Stop navigation" : "Navigate"}
          </Button>
          {arFlag && navigating && progress ? (
            <Suspense fallback={null}>
              <LiveViewBeta
                accuracyM={fix?.accuracy ?? null}
                targetBearing={fix ? bearingTo(fix, { lon: progress.next.location[0], lat: progress.next.location[1] }) : routeBearing}
                instruction={progress.instruction}
                distanceLabel={formatMetres(progress.metresToNext)}
                frame={route ? { route, along, next: progress.next } : null}
                at={fix}
              />
            </Suspense>
          ) : null}
          {navigating && fix ? (
            <span className="rounded bg-background/90 px-2 py-0.5 text-[11px] text-muted-foreground">
              Location accuracy: about {Math.round(fix.accuracy)} m
            </span>
          ) : null}
          {geoError ? <span className="rounded bg-background/90 px-2 py-0.5 text-[11px] text-destructive">{geoError}</span> : null}
        </div>
      ) : null}
    </>
  );
}
