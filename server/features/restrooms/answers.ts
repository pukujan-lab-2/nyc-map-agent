import { z } from "@hono/zod-openapi";
import { octoQuery } from "../../../api/_lib/octo";
import { fail, json } from "../../../api/_lib/http";

/**
 * What riders found when a walk ended at a restroom (#249): "Was the restroom
 * available to use?" and up to three skippable follow-ups. Anonymous: the row
 * holds the restroom id, the answers and a timestamp, nothing about who or
 * where. The phone checks it is near the restroom before it asks.
 */
const RestroomId = z
  .string()
  .max(160)
  .regex(/^(osm:(node|way|relation)\/\d+|nyc:.+)$/)
  .openapi({ example: "osm:node/123" });

const Problem = z.enum(["closed", "customers_only", "out_of_order", "not_found"]);

export const AnswerBody = z
  .object({
    restroomId: RestroomId,
    available: z.boolean(),
    paid: z.boolean().nullable().optional().openapi({ description: "Had to pay or buy something" }),
    customersOnly: z.boolean().nullable().optional(),
    codeNeeded: z.boolean().nullable().optional().openapi({ description: "Needed a code or key" }),
    problem: Problem.nullable().optional().openapi({ description: "After No: what happened" }),
  })
  .openapi("RestroomAnswer");
export type AnswerBody = z.infer<typeof AnswerBody>;

export const SummaryQuery = z.object({
  ids: z.string().max(8000).openapi({ description: "Comma-separated restroom ids, at most 100" }),
});

export const AnswerSummary = z
  .object({
    confirmedAt: z.string().nullable().openapi({ description: "The latest Yes in the last 30 days (ISO)" }),
    free: z.boolean().nullable().openapi({ description: "That Yes said nothing had to be paid or bought (false: it did; null: skipped)" }),
    recentNo: z.number().int().openapi({ description: "No answers in the last 14 days since that Yes" }),
    warn: z.boolean().openapi({ description: "Several recent No answers: the card warns" }),
    problem: Problem.nullable().openapi({ description: "What the latest of those No answers said happened" }),
  })
  .openapi("RestroomAnswerSummary");
export type AnswerSummary = z.infer<typeof AnswerSummary>;

export const SummaryResponse = z.object({ answers: z.record(z.string(), AnswerSummary) }).openapi("RestroomAnswerSummaries");

export interface StoredAnswer {
  available: boolean;
  paid: boolean | null;
  problem: string | null;
  answeredAt: string;
}

const DAY = 86_400_000;
/** A Yes counts as a confirmation this long. */
const CONFIRM_DAYS = 30;
/** A No counts towards the warning this long. */
const NO_DAYS = 14;
/** This many recent No answers, with no Yes after them, show a warning. */
const WARN_AT = 2;

/** One restroom's recent answers, newest first or in any order, as the card reads them. */
export function summarize(answers: StoredAnswer[], now: Date): AnswerSummary | null {
  const recent = answers
    .filter((a) => now.getTime() - new Date(a.answeredAt).getTime() <= CONFIRM_DAYS * DAY)
    .sort((a, b) => b.answeredAt.localeCompare(a.answeredAt));
  if (!recent.length) return null;
  const yes = recent.find((a) => a.available) ?? null;
  const noSinceYes = recent.filter(
    (a) => !a.available && now.getTime() - new Date(a.answeredAt).getTime() <= NO_DAYS * DAY && (!yes || a.answeredAt > yes.answeredAt),
  );
  return {
    confirmedAt: yes ? new Date(yes.answeredAt).toISOString() : null,
    free: yes && yes.paid !== null ? !yes.paid : null,
    recentNo: noSinceYes.length,
    warn: noSinceYes.length >= WARN_AT,
    problem: (noSinceYes[0]?.problem as AnswerSummary["problem"]) ?? null,
  };
}

/** POST /api/restroom-answers: store one answer. 204 on success. */
export async function POST(request: Request): Promise<Response> {
  const parsed = AnswerBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_body", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  const a = parsed.data;
  try {
    await octoQuery(
      `INSERT INTO core.restroom_answers (restroom_id, available, paid, customers_only, code_needed, problem)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [a.restroomId, a.available, a.available ? (a.paid ?? null) : null, a.available ? (a.customersOnly ?? null) : null, a.available ? (a.codeNeeded ?? null) : null, a.available ? null : (a.problem ?? null)],
    );
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  } catch (err) {
    return fail(err);
  }
}

interface Row {
  restroom_id: string;
  available: boolean | string;
  paid: boolean | string | null;
  problem: string | null;
  answered_at: string | Date;
}

const bool = (v: boolean | string | null): boolean | null => (typeof v === "boolean" ? v : v === "t" || v === "true" ? true : v === "f" || v === "false" ? false : null);
const iso = (v: string | Date): string => (v instanceof Date ? v : new Date(String(v).replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"))).toISOString();

/** GET /api/restroom-answers?ids=a,b: each restroom's recent answers, summarised; ids with none are left out. */
export async function GET(request: Request): Promise<Response> {
  const q = SummaryQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  const ids = q.success ? [...new Set(q.data.ids.split(",").map((s) => s.trim()).filter(Boolean))] : [];
  if (!q.success || !ids.length || ids.length > 100 || !ids.every((id) => RestroomId.safeParse(id).success)) {
    return json({ error: "invalid_query", issues: ["ids: 1 to 100 restroom ids"] }, { status: 400 });
  }
  try {
    const { rows } = await octoQuery<Row>(
      `SELECT restroom_id, available, paid, problem, answered_at FROM core.restroom_answers
       WHERE restroom_id IN (SELECT jsonb_array_elements_text($1::jsonb)) AND answered_at > now() - interval '${CONFIRM_DAYS} days'
       ORDER BY answered_at DESC`,
      [JSON.stringify(ids)],
      { rowLimit: 5000 },
    );
    const byId = new Map<string, StoredAnswer[]>();
    for (const r of rows) {
      const list = byId.get(r.restroom_id) ?? [];
      list.push({ available: bool(r.available) === true, paid: bool(r.paid), problem: r.problem, answeredAt: iso(r.answered_at) });
      byId.set(r.restroom_id, list);
    }
    const now = new Date();
    const answers: Record<string, AnswerSummary> = {};
    for (const [id, list] of byId) {
      const s = summarize(list, now);
      if (s) answers[id] = s;
    }
    return json({ answers }, { maxAge: 60, browserMaxAge: 60 });
  } catch (err) {
    return fail(err);
  }
}
