import { useEffect, useRef } from "react";
import { useSharedLocation } from "@/lib/geo/sharedLocation";
import { useDataView } from "@/lib/store/DataViewContext";
import { useMapState } from "@/lib/store/MapStateContext";
import { usePanel } from "@/lib/store/PanelContext";
import { onRestroomPick } from "@/lib/store/restroomPick";
import { hasArrived, setWalkTarget, useWalkTarget } from "./arrival";
import { ArrivalQuestion } from "./ArrivalQuestion";
import { metresBetween } from "./layers";
import { RestroomPick } from "./RestroomPick";

/** Panel ids this overlay opens (the module's panel prefix is "restroom:"). */
const PICK_PANEL = "restroom:pick";
const arrivalPanel = (id: string) => `restroom:arrived:${id}`;

/**
 * Renders nothing. Opens the restroom pick when the home's Restroom button
 * asks (src/lib/store/restroomPick.ts), and asks the arrival question when a
 * Walk me there ends at that restroom: walking guidance on, not the street
 * camera, and the phone's own location within a few metres of it.
 */
export default function RestroomOverlay() {
  const { showPanel } = usePanel();
  const { followingRoute, routeEnd, clearRoute } = useDataView();
  const { walking } = useMapState();
  const shared = useSharedLocation();
  const target = useWalkTarget();
  const wasFollowing = useRef(false);

  useEffect(
    () => onRestroomPick(() => showPanel({ id: PICK_PANEL, title: "Restroom", subtitle: "Open now, nearest first", details: <RestroomPick /> })),
    [showPanel],
  );

  useEffect(() => {
    if (!target) return;
    const toTarget = routeEnd !== null && metresBetween([routeEnd.lon, routeEnd.lat], [target.lon, target.lat]) < 5;
    if (followingRoute && toTarget) wasFollowing.current = true;
    // The walk was stopped, or now goes somewhere else.
    if ((wasFollowing.current && !followingRoute) || (routeEnd !== null && !toTarget)) {
      wasFollowing.current = false;
      setWalkTarget(null);
      return;
    }
    const at = shared.status === "on" ? shared.coords : null;
    if (!followingRoute || walking || !toTarget || !at) return;
    if (!hasArrived(metresBetween([at.lon, at.lat], [target.lon, target.lat]), shared.accuracy ?? null)) return;
    wasFollowing.current = false;
    setWalkTarget(null);
    clearRoute();
    showPanel({ id: arrivalPanel(target.id), title: target.name, subtitle: "You're here", details: <ArrivalQuestion restroom={target} /> });
  }, [target, followingRoute, walking, routeEnd, shared, clearRoute, showPanel]);

  return null;
}
