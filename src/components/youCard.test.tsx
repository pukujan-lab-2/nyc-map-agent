import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import SettingsSheet from "./SettingsSheet";

const noop = () => {};

describe("the You card (person button)", () => {
  it("keeps settings, language and memory first, then every page that left the map", () => {
    const html = renderToStaticMarkup(<MemoryRouter><SettingsSheet onClose={noop} /></MemoryRouter>);
    const order = ["Settings", "Language", "What we remember", "City data", "Meet Design Baker", "Record a station walk", "Tracker health", "What&#x27;s coming", "Share this app", "About this project"];
    let at = -1;
    for (const label of order) {
      const i = html.indexOf(label, at + 1);
      expect(i, label).toBeGreaterThan(at);
      at = i;
    }
    for (const href of ["/city-data", "/present", "/record", "/tracker-health", "/coming-soon.html", "/info/"]) expect(html).toContain(`href="${href}"`);
  });
});
