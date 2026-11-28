import type { Map as MapLibreMap } from "maplibre-gl";
import { RESTROOM_PICTOGRAM } from "./restroomPictogram";

/**
 * Restroom icons, the same on the map and in lists (#249): a public restroom
 * is a green disc with the restroom figures; a business shows its kind (a
 * café cup, a knife and fork, a glass, a bag) or its brand logo, with a small
 * green restroom badge. Never "WC". Glyphs are lucide's (ISC), drawn as paths
 * so the map canvas and React draw the same shapes.
 */
export const RESTROOM_GREEN = "#15803d";
export const BUSINESS_INK = "#6d28d9";

export type BusinessKind = "cafe" | "food" | "bar" | "shop";

export const KIND_GLYPH: Record<BusinessKind, string[]> = {
  cafe: ["M10 2v2", "M14 2v2", "M6 2v2", "M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"],
  food: ["M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2", "M7 2v20", "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"],
  bar: ["M8 22h8", "M7 10h10", "M12 15v7", "M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"],
  shop: ["M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z", "M3 6h18", "M16 10a4 4 0 0 1-8 0"],
};

/** An OSM amenity or "shop" → the glyph a business restroom shows. */
export function businessKind(kind: string): BusinessKind {
  if (kind === "cafe") return "cafe";
  if (kind === "bar" || kind === "pub") return "bar";
  if (kind === "shop") return "shop";
  return "food";
}

/** Map image ids. */
export const PUBLIC_ICON = "restroom-public";
export const businessIconId = (k: BusinessKind) => `restroom-biz-${k}`;
export const brandIconId = (qid: string) => `restroom-brand-${qid}`;

const SIZE = 64;

function canvas(): CanvasRenderingContext2D {
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d canvas");
  ctx.canvas.width = ctx.canvas.height = SIZE;
  return ctx;
}

function pictogram(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  for (const d of RESTROOM_PICTOGRAM) ctx.fill(new Path2D(d));
  ctx.restore();
}

/** The public restroom: a green disc, a white ring and white figures. */
export function publicRestroomIcon(): ImageData {
  const ctx = canvas();
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 3, 0, Math.PI * 2);
  ctx.fillStyle = RESTROOM_GREEN;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  pictogram(ctx, SIZE / 2, SIZE / 2, 34, "#ffffff");
  return ctx.getImageData(0, 0, SIZE, SIZE);
}

/** A white rounded tile (the business), with the green restroom badge top right. */
function businessTile(ctx: CanvasRenderingContext2D, inner: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => void): ImageData {
  const x = 4;
  const y = 12;
  const s = 46;
  ctx.beginPath();
  ctx.roundRect(x, y, s, s, 11);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgba(17,24,39,0.35)";
  ctx.stroke();
  inner(ctx, x, y, s);
  // Badge.
  ctx.beginPath();
  ctx.arc(50, 14, 12, 0, Math.PI * 2);
  ctx.fillStyle = RESTROOM_GREEN;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  pictogram(ctx, 50, 14, 15, "#ffffff");
  return ctx.getImageData(0, 0, SIZE, SIZE);
}

/** A business restroom by its kind. */
export function businessRestroomIcon(kind: BusinessKind): ImageData {
  return businessTile(canvas(), (ctx, x, y, s) => {
    const g = 28;
    ctx.save();
    ctx.translate(x + (s - g) / 2, y + (s - g) / 2);
    ctx.scale(g / 24, g / 24);
    ctx.strokeStyle = BUSINESS_INK;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const d of KIND_GLYPH[kind]) ctx.stroke(new Path2D(d));
    ctx.restore();
  });
}

/** A business restroom with its brand logo in the tile. */
export function brandRestroomIcon(logo: CanvasImageSource & { width: number; height: number }): ImageData {
  return businessTile(canvas(), (ctx, x, y, s) => {
    const pad = 6;
    const box = s - pad * 2;
    const k = Math.min(box / logo.width, box / logo.height);
    const w = logo.width * k;
    const h = logo.height * k;
    ctx.drawImage(logo, x + pad + (box - w) / 2, y + pad + (box - h) / 2, w, h);
  });
}

/** Loads a brand logo the storefronts route serves (same origin, cached a day). Null on any failure. */
export async function loadBrandLogo(qid: string): Promise<HTMLImageElement | null> {
  if (!/^Q\d+$/.test(qid)) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img.width && img.height ? img : null);
    img.onerror = () => resolve(null);
    img.src = `${window.location.origin}/api/v1/storefronts/logo?qid=${qid}`;
  });
}

/** Adds the public and the four business icons to a map style once. */
export function ensureRestroomIcons(map: MapLibreMap): void {
  if (!map.hasImage(PUBLIC_ICON)) map.addImage(PUBLIC_ICON, publicRestroomIcon(), { pixelRatio: 2 });
  for (const k of Object.keys(KIND_GLYPH) as BusinessKind[]) {
    if (!map.hasImage(businessIconId(k))) map.addImage(businessIconId(k), businessRestroomIcon(k), { pixelRatio: 2 });
  }
}

const brandTried = new Set<string>();
/** Loads and adds a brand's logo icon once per page; resolves true when the map has it. */
export async function ensureBrandIcon(map: MapLibreMap, qid: string): Promise<boolean> {
  const id = brandIconId(qid);
  if (map.hasImage(id)) return true;
  if (brandTried.has(qid)) return false;
  brandTried.add(qid);
  const logo = await loadBrandLogo(qid);
  if (!logo) return false;
  try {
    if (!map.hasImage(id)) map.addImage(id, brandRestroomIcon(logo), { pixelRatio: 2 });
    return true;
  } catch {
    return false; // a tainted canvas or a style that went away
  }
}

/**
 * The icon-image expression for a feature with `kind` ("public" or a
 * business kind) and an optional `brand` (a brand:wikidata id with a loaded logo).
 */
export const ICON_IMAGE = [
  "case",
  ["==", ["get", "kind"], "public"],
  PUBLIC_ICON,
  ["coalesce", ["image", ["concat", "restroom-brand-", ["coalesce", ["get", "brand"], "none"]]], ["image", ["concat", "restroom-biz-", ["get", "kind"]]]],
] as unknown as string;
