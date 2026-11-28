/**
 * npx tsx scripts/notice-facts-coverage.ts [feed.json] [--live] [--all]
 *
 * Runs the notice-facts parser (server/features/transit/noticeFacts.ts) over a saved snapshot of the MTA subway
 * alerts feed and prints how many notices became facts, then lists the rest with what was missing. With --live it
 * reads the feed from the MTA instead. --all also lists guidance sentences the rules did not understand in notices
 * that did become facts.
 *
 * Default snapshot: server/features/transit/__fixtures__/subway-alerts-2026-11-27.json (the live feed on
 * 2026-11-27, English text only). Exits 1 when fewer than 95% of notices become facts.
 */
import { readFileSync } from "node:fs";
import { slimAlert, type MercuryAlert } from "../server/features/transit/alerts";
import { hasFacts, noticeFacts, stationIndex, type Station } from "../server/features/transit/noticeFacts";

const FEED = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts.json";
const SNAPSHOT = "server/features/transit/__fixtures__/subway-alerts-2026-11-27.json";
const BAR = 0.95;

const args = process.argv.slice(2);
const live = args.includes("--live");
const all = args.includes("--all");
const path = args.find((a) => !a.startsWith("--")) ?? SNAPSHOT;

type Feed = { header?: { timestamp?: number | string }; entity?: MercuryAlert[] };
const feed = (live ? await (await fetch(FEED, { signal: AbortSignal.timeout(15_000) })).json() : JSON.parse(readFileSync(path, "utf8"))) as Feed;
const subway = JSON.parse(readFileSync("public/transit/subway.json", "utf8")) as { stations: { features: Array<{ properties: Station }> } };
const idx = stationIndex(subway.stations.features.map((f) => f.properties));

const at = Number(feed.header?.timestamp ?? Math.round(Date.now() / 1000));
// Every notice that has not ended yet, however far ahead it starts.
const alerts = (feed.entity ?? []).flatMap((e) => slimAlert(e, at, at + 366 * 86_400) ?? []);
const facts = alerts.map((a) => ({ a, f: noticeFacts(a, idx) }));
const good = facts.filter((x) => hasFacts(x.f));
const rest = facts.filter((x) => !hasFacts(x.f));
const pct = (n: number) => `${Math.round((n / Math.max(1, facts.length)) * 1000) / 10}%`;

console.log(`Snapshot: ${live ? FEED : path} (${new Date(at * 1000).toISOString()})`);
console.log(`${good.length} of ${facts.length} notices became facts (${pct(good.length)}).`);
const clean = good.filter((x) => x.f.leftover.length === 0).length;
console.log(`${clean} of them have no guidance sentence left over for the MTA text.`);
if (rest.length) {
  console.log(`\nThe other ${rest.length}:`);
  for (const { a, f } of rest) {
    const why = [f.changes.length ? "" : "no change recognised", f.unresolved.length ? `stations not found: ${f.unresolved.join(", ")}` : ""].filter(Boolean).join("; ");
    console.log(`- ${a.id} [${a.routes.join(" ")}] ${a.text}\n    ${why}`);
  }
}
if (all) {
  const left = good.filter((x) => x.f.leftover.length);
  if (left.length) console.log(`\nGuidance left as MTA text in ${left.length} notices:`);
  for (const { a, f } of left) console.log(`- ${a.id} [${a.routes.join(" ")}]\n${f.leftover.map((s) => `    · ${s}`).join("\n")}`);
}
process.exit(good.length / Math.max(1, facts.length) >= BAR ? 0 : 1);
