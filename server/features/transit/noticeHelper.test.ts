import { readFileSync } from "node:fs";
import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { slimAlert, type MercuryAlert, type SlimAlert } from "./alerts";
import { hasFacts, noticeFacts, type Station } from "./noticeFacts";
import { checkProposal, coverageReport, forgetNoticeHelp, helpNotice, modelCalls, mtaLines, noticeKey, noticeText, parseProposal, rulesOnly, subwayData, type NoticeDeps } from "./noticeHelper";
import { dueAt, GET_FACTS, GET_REPORT, runNoticeReport } from "./noticeRoutes";

// The live MTA subway alerts feed on 2026-11-27 (the step 2 fixture) and our stations.
const feed = JSON.parse(readFileSync(new URL("./__fixtures__/subway-alerts-2026-11-27.json", import.meta.url), "utf8")) as { header: { timestamp: number }; entity: MercuryAlert[] };
const subway = JSON.parse(readFileSync(new URL("../../../public/transit/subway.json", import.meta.url), "utf8")) as { stations: { features: Array<{ properties: Station }> } };
const data = subwayData(subway);
const at = Number(feed.header.timestamp);
const alerts = feed.entity.flatMap((e) => slimAlert(e, at, at + 366 * 86_400) ?? []);

/** A notice in wording no rule reads: the rules find no change, so it goes to the model. */
const odd = (over: Partial<SlimAlert> = {}): SlimAlert => ({
  ...alerts.find((a) => a.routes.length === 1 && a.routes[0] === "7")!,
  id: "lmm:planned_work:999001",
  text: "Flushing-bound [7] trains will bypass Queensboro Plaza and Court Sq",
  description: "Ride past and come back on a Manhattan-bound [7] from Hunters Point Av.",
  ...over,
});

const reply = (text: string) => ({ content: [{ type: "text", text }], finishReason: { unified: "stop", raw: "stop" }, usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } }, warnings: [] });
/** A model that answers `text` and counts its calls. */
const modelSaying = (text: string | ((prompt: string) => string)) => {
  const doGenerate = vi.fn((opts: { prompt: unknown }) => Promise.resolve(reply(typeof text === "string" ? text : text(JSON.stringify(opts.prompt))) as never));
  return { doGenerate, deps: { model: () => new MockLanguageModelV4({ doGenerate }), translate: vi.fn() } as unknown as NoticeDeps };
};

const good = {
  toward: "Flushing",
  changes: [{ kind: "skip", line: "7", toward: "Flushing", stations: [{ name: "Queensboro Plaza" }, { name: "Court Sq" }] }],
  advice: [{ case: "to", stations: [], take: { lines: [{ line: "7", toward: "Manhattan" }], to: [] }, text: "Ride past and come back on a Manhattan-bound [7] from Hunters Point Av." }],
  transfers: [],
  buses: [],
};
const rules = (a: SlimAlert) => noticeFacts(a, data.idx);
const check = (p: unknown, a = odd()) => checkProposal(p as Record<string, unknown>, a, data, rules(a));

beforeEach(() => forgetNoticeHelp());

describe("the checker (plan step 8)", () => {
  it("the test notice really is one no rule reads", () => {
    expect(hasFacts(rules(odd()))).toBe(false);
  });

  it("takes facts whose stations, lines and directions are all ours, with our station ids", () => {
    const r = check(good);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const skip = r.facts.changes[0];
    expect(skip.kind === "skip" && skip.stations.map((s) => s.id)).toEqual(["718", "719"]);
    expect(r.facts.toward).toBe("Flushing");
    // Time windows come from the feed, never from the model.
    expect(r.facts.when).toEqual(rules(odd()).when);
  });

  it("refuses a station that is not in our data", () => {
    const r = check({ ...good, changes: [{ ...good.changes[0], stations: [{ name: "Queensboro Plaza" }, { name: "Atlantis Av" }] }] });
    expect(r).toEqual({ ok: false, problems: ['unknown station "Atlantis Av"'] });
  });

  it("refuses a station that is not on the line it says is skipped there", () => {
    const r = check({ ...good, changes: [{ ...good.changes[0], stations: [{ name: "Court Sq-23 St" }] }] });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.problems).toContain('"Court Sq-23 St" is not a 7 station');
  });

  it("refuses a direction the line does not run", () => {
    const r = check({ ...good, advice: [{ ...good.advice[0], take: { lines: [{ line: "7", toward: "Coney Island" }], to: [] } }] });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.problems).toContain('"Coney Island" is not a direction the 7 runs');
  });

  it("refuses a direction that is not the one the notice's headline names", () => {
    const r = check({ ...good, toward: "Manhattan", changes: [{ ...good.changes[0], toward: "Manhattan" }] });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.problems).toContain('direction "Manhattan" for the 7 is not the notice\'s "Flushing"');
  });

  it("refuses an unknown line, an unknown bus and words that are not the MTA's", () => {
    const r = check({
      ...good,
      changes: [...good.changes, { kind: "noService", line: "K", toward: null }],
      advice: [{ ...good.advice[0], text: "Just walk, it is faster." }],
      buses: [{ routes: ["Hovercraft 1"], shuttle: false }],
    });
    expect(!r.ok && r.problems).toEqual(expect.arrayContaining(['unknown line "K"', 'an advice sentence "Just walk, it is faster." is not the notice\'s own words', 'unknown bus route "Hovercraft 1"']));
  });

  it("refuses an answer with no change to service", () => {
    expect(check({ ...good, changes: [] })).toEqual({ ok: false, problems: ["no change to service"] });
  });

  it("reads only a JSON object from the reply", () => {
    expect(parseProposal('Here you go: {"changes": []}')).toEqual({ changes: [] });
    expect(parseProposal("[1, 2]")).toBeNull();
    expect(parseProposal("no")).toBeNull();
  });
});

describe("the helper", () => {
  it("never asks the model about a notice the rules read", async () => {
    const m = modelSaying(JSON.stringify(good));
    const h = await helpNotice(alerts[0], data, m.deps);
    expect(h.source).toBe("rules");
    expect(m.doGenerate).not.toHaveBeenCalled();
  });

  it("uses the model's facts when they pass, and never sends the same notice twice", async () => {
    const m = modelSaying(JSON.stringify(good));
    const a = await helpNotice(odd(), data, m.deps);
    expect(a.source).toBe("model");
    expect(a.flags).toEqual(["no rule matched"]);
    const b = await helpNotice(odd(), data, m.deps);
    expect(b).toEqual(a);
    expect(m.doGenerate).toHaveBeenCalledTimes(1);
    expect(modelCalls()).toBe(1);
  });

  it("asks once even when two riders open the notice at the same moment", async () => {
    const m = modelSaying(JSON.stringify(good));
    await Promise.all([helpNotice(odd(), data, m.deps), helpNotice(odd(), data, m.deps)]);
    expect(m.doGenerate).toHaveBeenCalledTimes(1);
  });

  it("keeps a refused answer too, so a bad notice is not sent again every time it is opened", async () => {
    const m = modelSaying(JSON.stringify({ ...good, changes: [{ ...good.changes[0], stations: [{ name: "Atlantis Av" }] }] }));
    const a = await helpNotice(odd(), data, m.deps);
    expect(a).toMatchObject({ source: "text", facts: null });
    expect(a.flags).toEqual(expect.arrayContaining(["no rule matched", 'model\'s facts refused: unknown station "Atlantis Av"']));
    await helpNotice(odd(), data, m.deps);
    expect(m.doGenerate).toHaveBeenCalledTimes(1);
  });

  it("asks again when the MTA changes the notice's text", async () => {
    const m = modelSaying(JSON.stringify(good));
    await helpNotice(odd(), data, m.deps);
    const edited = odd({ description: "Ride past and come back on a Manhattan-bound [7] from Vernon Blvd-Jackson Av." });
    expect(noticeKey(edited)).not.toBe(noticeKey(odd()));
    await helpNotice(edited, data, m.deps);
    expect(m.doGenerate).toHaveBeenCalledTimes(2);
  });

  it("tries again an hour after the model did not answer at all", async () => {
    const doGenerate = vi.fn(() => Promise.reject(new Error("provider down")));
    const deps = { model: () => new MockLanguageModelV4({ doGenerate }), translate: vi.fn() } as unknown as NoticeDeps;
    const t = 1_800_000_000_000;
    expect((await helpNotice(odd(), data, deps, t)).flags.at(-1)).toMatch(/model did not answer: .*provider down/);
    await helpNotice(odd(), data, deps, t + 60_000);
    // The AI SDK retries a failed call itself; what matters is that the second open did not start a new one.
    const first = doGenerate.mock.calls.length;
    await helpNotice(odd(), data, deps, t + 3_600_001);
    expect(doGenerate.mock.calls.length).toBeGreaterThan(first);
  });
});

describe("the MTA text for a notice we cannot walk", () => {
  it("is cut into lines the translate path takes", () => {
    const long = odd({ description: `${"Trains run local. ".repeat(40)}\nTake the [7].` });
    const lines = mtaLines(long);
    expect(lines.every((l) => l.length <= 400)).toBe(true);
    expect(lines.join(" ")).toContain("Take the [7].");
  });

  it("comes back in the rider's language, or in English when translation fails", async () => {
    const translate = vi.fn((_lang: string, lines: string[]) => Promise.resolve({ lines: lines.map((l) => `es: ${l}`) }));
    const es = await noticeText(odd(), "es", { translate });
    expect(es).toMatchObject({ lang: "es", translated: true });
    expect(es.lines[0]).toMatch(/^es: Flushing-bound/);
    expect(await noticeText(odd(), "en", { translate })).toMatchObject({ lang: "en", translated: false });
    const failing = await noticeText(odd(), "fr", { translate: () => Promise.resolve({ error: "translation failed" }) });
    expect(failing).toMatchObject({ lang: "en", translated: false, lines: mtaLines(odd()) });
  });

  it("is what /api/transit-notices answers when the model's facts are refused", async () => {
    const m = modelSaying(JSON.stringify({ ...good, toward: "Coney Island" }));
    const translate = vi.fn((_lang: string, lines: string[]) => Promise.resolve({ lines: lines.map((l) => `bn: ${l}`) }));
    const res = await GET_FACTS(new Request(`http://x/api/transit-notices?id=${odd().id}&lang=bn`), { ...m.deps, translate }, () => Promise.resolve([odd()]), () => data);
    const body = (await res.json()) as { source: string; mta: { lang: string; lines: string[] }; flags: string[] };
    expect(body.source).toBe("text");
    expect(body.mta.lang).toBe("bn");
    expect(body.flags.some((f) => f.includes("Coney Island"))).toBe(true);
    expect((await GET_FACTS(new Request("http://x/api/transit-notices?id=nope&lang=bn"), m.deps, () => Promise.resolve([]), () => data)).status).toBe(404);
    expect((await GET_FACTS(new Request("http://x/api/transit-notices?id=x&lang=de"), m.deps, () => Promise.resolve([]), () => data)).status).toBe(400);
  });
});

describe("the nightly coverage report", () => {
  it("runs over the step 2 fixture", async () => {
    const r = await coverageReport(alerts, rulesOnly(data), new Date(at * 1000));
    expect(r.notices).toBe(alerts.length);
    expect(r.rules).toBe(alerts.filter((a) => hasFacts(rules(a))).length);
    expect(r.rules / r.notices).toBeGreaterThanOrEqual(0.95);
    expect(r.markdown).toMatch(new RegExp(`^# Notice coverage, 2026-11-28 01:12 UTC\\n\\n${r.rules} of ${r.notices} subway notices became walk facts`));
  });

  it("lists each notice that fell back to text with why, and each the model read", async () => {
    const refused = odd({ id: "lmm:planned_work:999002", text: "[7] trains will bypass Atlantis Av" });
    const m = modelSaying((prompt) => JSON.stringify(prompt.includes("Atlantis") ? { ...good, changes: [{ ...good.changes[0], stations: [{ name: "Atlantis Av" }] }] } : good));
    const r = await runNoticeReport(m.deps, () => Promise.resolve([...alerts.slice(0, 5), odd(), refused]), () => data);
    expect(r).toMatchObject({ notices: 7, rules: 5, model: 1, text: 1 });
    expect(r.markdown).toContain("## Fell back to the MTA text\n\n- lmm:planned_work:999002 [7] [7] trains will bypass Atlantis Av\n  no rule matched; model's facts refused: unknown station \"Atlantis Av\"");
    expect(r.markdown).toContain("## Read by the model (each needs a new rule)\n\n- lmm:planned_work:999001");
    const page = await GET_REPORT(new Request("http://x/api/transit-health/notices?format=text"));
    expect(await page.text()).toBe(r.markdown);
  });

  it("runs once each New York day, from 4 AM", () => {
    // 2026-11-28 08:30 UTC is 3:30 AM in New York; 09:30 UTC is 4:30 AM.
    expect(dueAt(Date.UTC(2026, 10, 28, 8, 30), "2026-11-27")).toBeNull();
    expect(dueAt(Date.UTC(2026, 10, 28, 9, 30), "2026-11-27")).toBe("2026-11-28");
    expect(dueAt(Date.UTC(2026, 10, 28, 20, 0), "2026-11-28")).toBeNull();
  });
});
