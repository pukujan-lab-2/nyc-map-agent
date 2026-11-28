/**
 * npx tsx scripts/notice-walk-report.ts [feed.json] [--trips]
 *
 * Builds the notice walk (src/features/transit/noticeWalk.ts) for every saved notice on every line it names and
 * prints the steps, so a change to the sentence patterns can be read end to end. With --trips it also prints the
 * walk for each stop a rider can pick, getting off and getting on. Default snapshot: the step 2 fixture.
 */
import { readFileSync } from "node:fs";
import { slimAlert, type MercuryAlert } from "../server/features/transit/alerts";
import { noticeWalk } from "../src/features/transit/noticeWalk";
import type { StaticSystem } from "../src/features/transit/model";

const SNAPSHOT = "server/features/transit/__fixtures__/subway-alerts-2026-11-27.json";
const args = process.argv.slice(2);
const trips = args.includes("--trips");
const path = args.find((a) => !a.startsWith("--")) ?? SNAPSHOT;
const feed = JSON.parse(readFileSync(path, "utf8")) as { header?: { timestamp?: number | string }; entity?: MercuryAlert[] };
const sys = JSON.parse(readFileSync("public/transit/subway.json", "utf8")) as StaticSystem;
const at = Number(feed.header?.timestamp ?? Math.round(Date.now() / 1000));
const alerts = (feed.entity ?? []).flatMap((e) => slimAlert(e, at, at + 366 * 86_400) ?? []);
for (const a of alerts) {
  for (const route of a.routes.filter((r) => sys.stopM[r])) {
    const w = noticeWalk(a, sys, route, null);
    console.log(`\n## ${a.id} on the ${route}${w.read ? "" : " (MTA headline only)"}\n${a.text}`);
    w.steps.forEach((s, i) => console.log(`  ${i + 1}. ${s.text}`));
    if (!trips) continue;
    for (const stop of w.stops) for (const mode of ["off", "on"] as const) {
      const t = noticeWalk(a, sys, route, { stop, mode });
      console.log(`  -- ${stop} ${mode}`);
      t.steps.forEach((s, i) => console.log(`     ${i + 1}. ${s.text}`));
    }
  }
}
