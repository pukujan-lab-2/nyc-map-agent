import { useMemo } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ChatPanel } from "@/components/ChatPanel";
import { ContextCleanChip } from "@/components/ContextCleanChip";
import { FeatureOverlays, useChatReplaced } from "@/components/FeatureOverlays";
import { MapPanel } from "@/components/MapPanel";
import { MapView } from "@/components/MapView";
import { RoutePanel } from "@/components/RoutePanel";
import { useWalkingRoute } from "@/lib/api/routing";
import { useFlag } from "@/lib/flags";
import { useMapData } from "@/lib/geo/aggregate";
import { useAreas } from "@/lib/geo/useAreas";
import { buildMapModel } from "@/lib/layers";
import { useDataView } from "@/lib/store/DataViewContext";
import { useMapState } from "@/lib/store/MapStateContext";
import { useMediaQuery } from "@/lib/useMediaQuery";

/** Old links that opened an analytics view on the map (`?view=`, `?layer=`) now open City data. */
export function cityDataRedirect(search: string): string | null {
  const params = new URLSearchParams(search);
  return params.has("view") || params.has("layer") ? `/city-data?${params.toString()}` : null;
}

/** The map page: getting around NYC, and nothing else (owner, 2026-11-27). Analytics live at /city-data. */
export default function Index() {
  const { search } = useLocation();
  const redirect = cityDataRedirect(search);
  return redirect ? <Navigate to={redirect} replace /> : <GettingAround />;
}

function GettingAround() {
  const { window: windowId, scale } = useMapState();
  const navigate = useNavigate();
  const chatReplaced = useChatReplaced();
  const { routeStart, routeEnd } = useDataView();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  // Neighbourhood shapes only: the map draws no 311 or crash counts here.
  const data = useMapData(windowId, false);
  const routeQuery = useWalkingRoute(routeStart, routeEnd);
  const route = routeQuery.data ?? null;
  const blockDensity = useFlag("blockDensity");
  const model = useMemo(
    () => buildMapModel({ boundaries: data.boundaries, noise: null, crashes: null, layer: "combined", scale, blockDensity }),
    [data.boundaries, scale, blockDensity],
  );
  const areas = useAreas(model, data.boundaries, scale);
  const openCityData = () => navigate("/city-data");

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <MapView model={model} boundaries={data.boundaries} areas={areas} route={route} />
      <RoutePanel route={route} isLoading={routeQuery.isFetching} error={routeQuery.error ? routeQuery.error.message : null} />
      {chatReplaced ? null : <ChatPanel boundaries={data.boundaries} noise={null} crashes={null} isDesktop={isDesktop} />}
      <FeatureOverlays />
      <ContextCleanChip />
      <MapPanel isDesktop={isDesktop} onOpenControls={openCityData} onOpenSources={openCityData} boundaries={data.boundaries} place={null} />
    </div>
  );
}
