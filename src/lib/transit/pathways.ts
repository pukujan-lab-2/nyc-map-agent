/**
 * How a subway station connects inside: its platforms, mezzanines, gates and
 * street entrances, and the stairs, escalators, elevators and walkways between
 * them, each with the sign a rider sees. From the MTA's draft station data
 * (GTFS Pathways), built into public/transit/pathways.json by
 * scripts/build-pathways.ts. It says what connects to what; it has no
 * positions inside a station, no levels and no distances. Pure.
 */

export type PathMode = "walkway" | "stairs" | "moving walkway" | "escalator" | "elevator" | "fare gate" | "exit gate";
/** The file's modes, in the order their numbers stand for (GTFS pathway_mode 1 to 7). */
export const PATH_MODES: readonly PathMode[] = ["walkway", "stairs", "moving walkway", "escalator", "elevator", "fare gate", "exit gate"];
/** p: a platform, by its GTFS stop id; e: a street entrance; n: a point inside (a mezzanine, a landing). */
export type NodeKind = "p" | "e" | "n";

export interface PathNode { name: string; kind: NodeKind; at?: [lon: number, lat: number] }
/** from, to, mode (index into PATH_MODES), both ways, sign seen going from → to, sign seen coming back, MTA equipment id. */
export type PathRow = [from: string, to: string, mode: number, bothWays: 0 | 1, sign: string, signBack: string, equipment: string];
export interface Pathways { source: string; nodes: Record<string, PathNode>; paths: PathRow[] }

export interface RouteStep {
  mode: PathMode;
  /** The sign a rider follows for this step, as the MTA wrote it; empty when the data has none. */
  sign: string;
  /** The elevator's or escalator's MTA number (the one the outage feed uses); a gate's or stair's own id otherwise. */
  equipment: string;
  /** Where the step ends. */
  to: string;
  toName: string;
}

const STEPS: ReadonlySet<PathMode> = new Set<PathMode>(["stairs", "escalator"]);

type Edge = { to: string; row: PathRow; back: boolean };
/** The two graphs with nothing out of service, kept per data file: a station answer asks for dozens of routes. */
const whole = new WeakMap<Pathways, { free?: Map<string, Edge[]>; any?: Map<string, Edge[]> }>();
function graph(data: Pathways, stepFree: boolean, out: ReadonlySet<string>): Map<string, Edge[]> {
  if (out.size) return build(data, stepFree, out);
  const kept = whole.get(data) ?? whole.set(data, {}).get(data)!;
  return stepFree ? (kept.free ??= build(data, true, out)) : (kept.any ??= build(data, false, out));
}
function build(data: Pathways, stepFree: boolean, out: ReadonlySet<string>): Map<string, Edge[]> {
  const g = new Map<string, Edge[]>();
  const add = (from: string, e: Edge) => { const list = g.get(from); if (list) list.push(e); else g.set(from, [e]); };
  for (const row of data.paths) {
    const mode = PATH_MODES[row[2]];
    if (stepFree && STEPS.has(mode)) continue;
    if (out.has(row[6])) continue;
    add(row[0], { to: row[1], row, back: false });
    if (row[3]) add(row[1], { to: row[0], row, back: true });
  }
  return g;
}

export interface RouteOptions {
  /** No stairs and no escalators (the default). */
  stepFree?: boolean;
  /** Equipment that is out of service right now, by MTA number: the route goes round it or there is none. */
  outOfService?: Iterable<string>;
}

/**
 * The fewest-steps way from one point of a station to the first point `goal`
 * accepts, or null when there is none. With `stepFree` it uses only
 * elevators, walkways and gates.
 */
export function route(data: Pathways, from: string, goal: (id: string, node: PathNode | undefined) => boolean, { stepFree = true, outOfService = [] }: RouteOptions = {}): RouteStep[] | null {
  return search(data, graph(data, stepFree, new Set(outOfService)), from, goal);
}

function search(data: Pathways, g: Map<string, Edge[]>, from: string, goal: (id: string, node: PathNode | undefined) => boolean): RouteStep[] | null {
  const came = new Map<string, { from: string; edge: Edge } | null>([[from, null]]);
  const queue = [from];
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head];
    if (at !== from && goal(at, data.nodes[at])) {
      const steps: RouteStep[] = [];
      for (let id = at, c = came.get(id); c; id = c.from, c = came.get(id)) {
        steps.push({ mode: PATH_MODES[c.edge.row[2]], sign: c.edge.back ? c.edge.row[5] : c.edge.row[4], equipment: c.edge.row[6], to: id, toName: data.nodes[id]?.name ?? id });
      }
      return steps.reverse();
    }
    for (const e of g.get(at) ?? []) if (!came.has(e.to)) { came.set(e.to, { from: at, edge: e }); queue.push(e.to); }
  }
  return null;
}

/** The step-free way from a platform to any street entrance. */
export const toStreet = (data: Pathways, platform: string, opts?: RouteOptions): RouteStep[] | null =>
  route(data, platform, (_, n) => n?.kind === "e", opts);

/** The step-free way from a street entrance to a platform. */
export const toPlatform = (data: Pathways, entrance: string, platform: string, opts?: RouteOptions): RouteStep[] | null =>
  route(data, entrance, (id) => id === platform, opts);

/**
 * The step-free way from the street to a platform: the entrance with the
 * fewest steps to it. Only entrances joined to the platform at all are tried.
 */
const neighbours = new WeakMap<Pathways, Map<string, string[]>>();
/** Every point's neighbours, whichever way the pathways run. */
function joinedOf(data: Pathways): Map<string, string[]> {
  let joined = neighbours.get(data);
  if (!joined) {
    joined = new Map<string, string[]>();
    for (const [a, b] of data.paths) {
      (joined.get(a) ?? joined.set(a, []).get(a)!).push(b);
      (joined.get(b) ?? joined.set(b, []).get(b)!).push(a);
    }
    neighbours.set(data, joined);
  }
  return joined;
}

export function fromStreet(data: Pathways, platform: string, opts?: RouteOptions): RouteStep[] | null {
  const joined = joinedOf(data);
  // With equipment out, the graph is built once here and not again for each entrance tried.
  const out = new Set(opts?.outOfService ?? []);
  const g = graph(data, opts?.stepFree ?? true, out);
  const seen = new Set([platform]);
  const queue = [platform];
  for (let head = 0; head < queue.length; head++) for (const next of joined.get(queue[head]) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
  let best: RouteStep[] | null = null;
  for (const id of queue) {
    if (data.nodes[id]?.kind !== "e") continue;
    const steps = search(data, g, id, (at) => at === platform);
    if (steps && (!best || steps.length < best.length)) best = steps;
  }
  return best;
}

/** Where a route from the street starts: the entrance its first step leaves. */
export function entranceOf(data: Pathways, steps: readonly RouteStep[], platform: string): string | null {
  if (!steps.length) return null;
  const first = steps[0];
  const row = data.paths.find(([a, b, mode, both, , , eq]) => eq === first.equipment && PATH_MODES[mode] === first.mode && ((b === first.to && data.nodes[a]?.kind === "e") || (both === 1 && a === first.to && data.nodes[b]?.kind === "e")));
  if (!row) return null;
  const id = row[1] === first.to ? row[0] : row[1];
  return id === platform ? null : data.nodes[id]?.name ?? null;
}
