import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PlaceToiletProps } from "./data";
import { PlaceToiletSheet } from "./PlaceToiletSheet";

vi.mock("@/lib/store/DataViewContext", () => ({ useDataView: () => ({ setRoutePoint: vi.fn(), setRoutePicking: vi.fn() }) }));
vi.mock("@/lib/store/MapStateContext", () => ({ useMapState: () => ({ seedChat: vi.fn(), setChatOpen: vi.fn() }) }));

const base: PlaceToiletProps = {
  id: "osm:node/1",
  name: "Cafe",
  kind: "cafe",
  access: "customers",
  accessTagged: true,
  wheelchair: null,
  changingTable: null,
  fee: null,
  source: "openstreetmap",
  url: "https://www.openstreetmap.org/node/1",
};
const html = (p: Partial<PlaceToiletProps>) => renderToStaticMarkup(<PlaceToiletSheet place={{ ...base, ...p }} lon={-74} lat={40.7} />);

describe("PlaceToiletSheet", () => {
  it("says it may be customers only, with the source link and Directions", () => {
    const out = html({});
    expect(out).toContain("May be customers only");
    expect(out).toContain("Directions");
    expect(out).toContain('href="https://www.openstreetmap.org/node/1"');
    expect(out).not.toContain("Wheelchair accessible toilet");
  });
  it("says customers only even where OSM tags the toilet open to anyone, and shows the wheelchair mark only where tagged", () => {
    const out = html({ access: "anyone", wheelchair: true });
    expect(out).toContain("May be customers only");
    expect(out).toContain("Wheelchair accessible toilet");
  });
  it("shows open now, the address, Website and Call", () => {
    const until = new Date(Date.now() + 3_600_000).toISOString();
    const out = html({ open: { status: "open", until, opensAt: null, reason: null }, address: "120 Fulton St", website: "joe.example", phone: "+1 212-555-0100" });
    expect(out).toContain("Open until");
    expect(out).toContain("120 Fulton St");
    expect(out).toContain('href="https://joe.example/"');
    expect(out).toContain('href="tel:+12125550100"');
  });
  it("never says open without hours, and drops a link that is not http", () => {
    const out = html({ website: "javascript:alert(1)" });
    expect(out).toContain("Hours may have changed");
    expect(out).not.toContain("javascript:");
  });
});
