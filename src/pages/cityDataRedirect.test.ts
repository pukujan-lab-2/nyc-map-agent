import { describe, expect, it } from "vitest";
import { cityDataRedirect } from "./Index";

describe("old analytics links open City data", () => {
  it("sends ?view= and ?layer= to /city-data with the whole query", () => {
    expect(cityDataRedirect("?view=noise&window=30d")).toBe("/city-data?view=noise&window=30d");
    expect(cityDataRedirect("?layer=crashes")).toBe("/city-data?layer=crashes");
  });

  it("leaves the getting-around map where it is", () => {
    expect(cityDataRedirect("")).toBeNull();
    expect(cityDataRedirect("?style=dark&restrooms=1")).toBeNull();
  });
});
