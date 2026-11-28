import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Footprints, PersonStanding } from "lucide-react";
import type { LngLat } from "@/lib/api/routing";
import { Button } from "@/components/ui/button";
import { sharedCoords, startSharing } from "@/lib/geo/sharedLocation";
import { frameRestrooms } from "@/lib/map/mapCover";
import { getMapInstance } from "@/lib/map/mapInstance";
import { useDataView } from "@/lib/store/DataViewContext";
import { useMapState } from "@/lib/store/MapStateContext";
import { usePanel } from "@/lib/store/PanelContext";
import { setWalkTarget } from "./arrival";
import { answerLine, loadAnswers, loadOptions, type AnswerSummary } from "./data";
import { hoursLabel } from "@/lib/openHours";
import { accessLine, listOrder, pickable, pickRestroom, type RestroomOption } from "./pick";
import { clearPickOnMap, showPickOnMap } from "./pickLayer";
import { RestroomKindIcon } from "./RestroomKindIcon";

type Phase = "locating" | "loading" | "ready" | "noLocation";

function Row({ o, tag, picked, answer, onPick, now }: { o: RestroomOption; tag?: string; picked: boolean; answer?: AnswerSummary; onPick: () => void; now: Date }) {
  const can = pickable(o);
  const said = answerLine(answer, now);
  return (
    <button
      type="button"
      disabled={!can}
      aria-pressed={picked}
      onClick={onPick}
      data-testid="restroom-row"
      className={`flex min-h-14 w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left ${picked ? "bg-primary/10" : "hover:bg-muted"} ${can ? "" : "opacity-50"}`}
    >
      <RestroomKindIcon option={o} />
      <span className="min-w-0 flex-1 text-sm leading-snug">
        {tag ? <span className="block text-xs font-bold text-primary">{tag}</span> : null}
        <span className="block truncate font-semibold text-foreground">{o.name}</span>
        <span className="block text-xs text-muted-foreground">{accessLine(o)}</span>
        <span className="block text-xs text-muted-foreground">{hoursLabel(o.open, now)}</span>
        {said ? <span className={`block text-xs ${said.warn ? "font-semibold text-amber-600 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>{said.text}</span> : null}
      </span>
      <span className={`shrink-0 tabular-nums text-foreground ${tag ? "text-xl" : "text-base"}`}><b>{o.minutes}</b> min</span>
      <span className="flex h-6 w-5 shrink-0 items-center text-primary">{picked ? <Check className="h-5 w-5" aria-label="Picked" /> : null}</span>
    </button>
  );
}

/**
 * Tapping Restroom (#249): the closest open restroom, public or business, by
 * walking time, with its route drawn. A business also offers the closest
 * free public one when it is open and at most five minutes further. All
 * restrooms nearby lists the rest (closed ones greyed, not pickable).
 */
export function RestroomPick() {
  const { setRoutePoint, setFollowingRoute, beginRestroomTrip, clearRoute } = useDataView();
  const { flyTo, setChatOpen } = useMapState();
  const { closePanel } = usePanel();
  const [phase, setPhase] = useState<Phase>("locating");
  const [here, setHere] = useState<LngLat | null>(null);
  const [options, setOptions] = useState<RestroomOption[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerSummary>>({});
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const leaving = useRef(false);
  const now = useMemo(() => new Date(), [options]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      // The tap is the gesture that may show the browser's location prompt.
      const at = sharedCoords() ?? (await startSharing());
      if (ctrl.signal.aborted) return;
      if (!at) return setPhase("noLocation");
      setHere({ lon: at.lon, lat: at.lat });
      setPhase("loading");
      const list = await loadOptions({ lon: at.lon, lat: at.lat }, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setOptions(list);
      const { closest } = pickRestroom(list);
      setPickedId(closest?.id ?? null);
      if (!closest) setAll(true);
      setPhase("ready");
      void loadAnswers(list.map((o) => o.id)).then((a) => !ctrl.signal.aborted && setAnswers(a));
    })();
    return () => ctrl.abort();
  }, []);

  const { closest, free } = useMemo(() => pickRestroom(options), [options]);
  const picked = options.find((o) => o.id === pickedId) ?? null;
  const shown = all ? listOrder(options) : [closest, free].filter((o): o is RestroomOption => o !== null);

  // The picked restroom's walking route, and the shown restrooms on the map with you.
  useEffect(() => {
    const m = getMapInstance();
    if (!here || !m) return;
    showPickOnMap(m, shown, pickedId);
    if (picked) {
      setRoutePoint("start", here);
      setRoutePoint("end", { lon: picked.lon, lat: picked.lat });
      frameRestrooms(m, [[here.lon, here.lat], [picked.lon, picked.lat]]);
    }
  }, [here, pickedId, all, options]); // eslint-disable-line react-hooks/exhaustive-deps

  // Closing the sheet without walking takes the route and the icons away.
  useEffect(() => () => {
    const m = getMapInstance();
    if (m) clearPickOnMap(m);
    if (!leaving.current) clearRoute();
  }, [clearRoute]);

  const walk = () => {
    if (!here || !picked) return;
    leaving.current = true;
    setWalkTarget(picked);
    setRoutePoint("start", here);
    setRoutePoint("end", { lon: picked.lon, lat: picked.lat });
    setFollowingRoute(true);
    setChatOpen(false);
    closePanel();
    flyTo({ lon: here.lon, lat: here.lat, zoom: 16 });
  };
  const preview = () => {
    if (!here || !picked) return;
    leaving.current = true;
    closePanel();
    beginRestroomTrip(here, { lon: picked.lon, lat: picked.lat });
  };

  if (phase === "noLocation") return <p className="text-sm text-muted-foreground">Location isn't shared. Allow it, then tap Restroom again.</p>;
  if (phase !== "ready") return <p className="text-sm text-muted-foreground" role="status">{phase === "locating" ? "Finding you" : "Finding restrooms"}</p>;
  if (!options.length) return <p className="text-sm text-muted-foreground">No restrooms within a 25-minute walk.</p>;

  return (
    <div className="flex flex-col gap-2" data-testid="restroom-pick">
      {!closest ? <p className="px-1 text-sm font-semibold text-foreground">Nothing nearby is open now</p> : null}
      <div className="flex flex-col gap-0.5" role="group" aria-label={all ? "All restrooms nearby" : "Closest open restroom"}>
        {shown.map((o) => (
          <Row
            key={o.id}
            o={o}
            now={now}
            tag={all ? undefined : o === closest ? "Closest" : `Free, ${o.minutes - (closest?.minutes ?? 0)} min further`}
            picked={o.id === pickedId}
            answer={answers[o.id]}
            onPick={() => setPickedId(o.id)}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" className="h-11 gap-1.5 rounded-full text-sm" disabled={!picked} onClick={walk}>
          <Footprints className="h-4 w-4" aria-hidden="true" />
          Walk me there
        </Button>
        <Button type="button" variant="secondary" className="h-auto min-h-11 gap-1.5 whitespace-normal rounded-full py-1.5 text-sm leading-tight" disabled={!picked} onClick={preview}>
          <PersonStanding className="h-4 w-4" aria-hidden="true" />
          Preview in Street view
        </Button>
      </div>
      {closest ? (
        <button type="button" className="flex min-h-10 items-center justify-between rounded-xl px-2.5 text-sm text-muted-foreground hover:bg-muted" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "Fewer" : "All restrooms nearby"}
          {all ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
        </button>
      ) : null}
    </div>
  );
}
