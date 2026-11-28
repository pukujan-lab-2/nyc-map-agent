import { Globe, Phone } from "lucide-react";
import { DirectionsFromHere } from "@/components/DirectionsFromHere";
import { Button } from "@/components/ui/button";
import { hoursLabel, stateAt } from "@/lib/openHours";
import { CUSTOMERS_LINE, KIND_LABEL, type PlaceToiletProps } from "./data";

/** Only http(s) links leave the app. */
const safeUrl = (u: string | null | undefined): string | null => {
  if (!u) return null;
  const withScheme = /^https?:\/\//i.test(u) ? u : `https://${u}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
};

/**
 * A tapped business restroom (#249): open now and until when, the plain
 * warning that it may be for customers only, the address, Website and Call,
 * Directions, and the OpenStreetMap source.
 */
export function PlaceToiletSheet({ place, lon, lat }: { place: PlaceToiletProps; lon: number; lat: number }) {
  const open = stateAt(place.open, new Date());
  const site = safeUrl(place.website);
  const tel = place.phone ? place.phone.split(/[;,]/)[0].replace(/[^\d+]/g, "") : null;
  const extras = [place.changingTable ? "Changing table" : null, place.fee === true ? "Fee" : null].filter(Boolean);
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={open.status === "open" ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-900" : "rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-800"}>
          {hoursLabel(open, new Date())}
        </span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">{CUSTOMERS_LINE}</span>
        {place.wheelchair ? (
          <span role="img" aria-label="Wheelchair accessible toilet" className="text-[13px] leading-none">
            ♿
          </span>
        ) : null}
      </div>
      {place.address ? <div className="text-foreground">{place.address}</div> : null}
      {place.openingHours ? <div className="text-muted-foreground">Hours: {place.openingHours}</div> : null}
      {extras.length ? <div className="text-muted-foreground">{extras.join(" · ")}</div> : null}
      <DirectionsFromHere lon={lon} lat={lat} />
      <div className="flex flex-wrap gap-2 pt-1">
        {site ? (
          <Button asChild type="button" size="sm" variant="outline" className="h-8 gap-1 text-[11px]">
            <a href={site} target="_blank" rel="noreferrer"><Globe className="h-3.5 w-3.5" aria-hidden="true" />Website</a>
          </Button>
        ) : null}
        {tel ? (
          <Button asChild type="button" size="sm" variant="outline" className="h-8 gap-1 text-[11px]">
            <a href={`tel:${tel}`}><Phone className="h-3.5 w-3.5" aria-hidden="true" />Call</a>
          </Button>
        ) : null}
        <Button asChild type="button" size="sm" variant="outline" className="h-8 text-[11px]">
          <a href={place.url} target="_blank" rel="noreferrer">
            Source: OpenStreetMap
          </a>
        </Button>
      </div>
      <div className="text-[10px] text-muted-foreground">{KIND_LABEL[place.kind] ?? "Place"} · © OpenStreetMap contributors (ODbL)</div>
    </div>
  );
}
