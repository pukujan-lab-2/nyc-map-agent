/**
 * Seed the presenter's reviewed Q&A into the NYC presentation Octo workspace.
 *
 * Run: NYC_PRESENTER_OCTO_WORKSPACE_ID=<id> NYC_PRESENTER_OCTO_KEY=<key> node_modules/.bin/tsx scripts/presenter-seed.ts
 *
 * Each topic in docs/presenter/qa becomes ONE document with a stable title
 * (Octo has no external-id field; a re-ingest under the same title versions
 * the document, so re-runs update instead of duplicating). After seeding, a
 * RAG query per topic verifies searchability, and manifest.json records the
 * document ids. Keys are read from the environment and never printed.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://octodb.design-bakery.com";
const QA_DIR = join(process.cwd(), "docs", "presenter", "qa");
const TOPICS = ["mission", "plan", "stack", "get-data", "contribute", "walk-stops", "evidence", "research"] as const;

type Source = { title: string; url: string };
type Pair = { question: string; answer: string; sources?: Source[] };
type Topic = { title: string; questions: Pair[] };
type ManifestRow = { file: string; title: string; documentId: string | null; verified: boolean };

const workspaceEnv = process.env.NYC_PRESENTER_OCTO_WORKSPACE_ID?.trim() || process.env.OCTO_WORKSPACE_ID?.trim();
const keyEnv = process.env.NYC_PRESENTER_OCTO_KEY?.trim() || process.env.OCTO_API_KEY?.trim();
if (!workspaceEnv || !keyEnv) {
  console.error(
    "Missing credentials. Set NYC_PRESENTER_OCTO_WORKSPACE_ID and NYC_PRESENTER_OCTO_KEY,\n" +
      "or the app's own OCTO_WORKSPACE_ID and OCTO_API_KEY (the presenter documents then\n" +
      "live in the map's workspace, kept apart by the server's document allowlist), then re-run:\n" +
      "  node_modules/.bin/tsx scripts/presenter-seed.ts",
  );
  process.exit(1);
}
const workspaceId: string = workspaceEnv;
const key: string = keyEnv;

const headers = { authorization: `Bearer ${key}`, "content-type": "application/json" };

async function call(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const data: unknown = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

function fail(message: string): never {
  console.error(message);
  console.error(
    "If the key was rejected: mint or renew a workspace key in Octo for the NYC presentation\n" +
      "workspace (write scope, operator role), export it as NYC_PRESENTER_OCTO_KEY, and re-run.",
  );
  process.exit(1);
}

/** The stable title doubles as the upsert key: same title re-ingests as a new version. */
const documentTitle = (slug: string, topic: Topic) => `Presenter Q&A: ${topic.title} [presenter-${slug}]`;

function documentText(topic: Topic): string {
  const lines = [topic.title, ""];
  for (const pair of topic.questions) {
    lines.push(`Q: ${pair.question}`, `A: ${pair.answer}`);
    for (const source of pair.sources ?? []) lines.push(`Source: ${source.title} — ${source.url}`);
    lines.push("");
  }
  return lines.join("\n");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function listedDocuments(data: unknown): Array<{ id: string; title: string }> {
  const record = asRecord(data);
  const list = Array.isArray(record.documents) ? record.documents : Array.isArray(data) ? data : [];
  return list.map(asRecord).filter((doc) => typeof doc.id === "string" && typeof doc.title === "string") as Array<{ id: string; title: string }>;
}

async function findByTitle(title: string): Promise<string | null> {
  const list = await call("GET", `/api/rag/documents?workspaceId=${encodeURIComponent(workspaceId)}`);
  if (!list.ok) fail(`Could not list documents (HTTP ${list.status}).`);
  const matches = listedDocuments(list.data).filter((doc) => doc.title === title);
  if (matches.length > 1) console.warn(`  note: ${matches.length} documents share the title; using the first`);
  return matches[0]?.id ?? null;
}

async function main(): Promise<void> {
  const files = readdirSync(QA_DIR).filter((name) => name.endsWith(".json") && name !== "manifest.json");
  for (const slug of TOPICS) if (!files.includes(`${slug}.json`)) fail(`Missing topic file: ${slug}.json`);

  const manifest: ManifestRow[] = [];
  for (const slug of TOPICS) {
    const file = `${slug}.json`;
    const topic = JSON.parse(readFileSync(join(QA_DIR, file), "utf8")) as Topic;
    if (!topic.title || !Array.isArray(topic.questions) || topic.questions.length === 0) fail(`Bad topic file: ${file}`);
    const title = documentTitle(slug, topic);
    const existing = await findByTitle(title);
    console.log(`${slug}: ${existing ? "updating" : "creating"} "${title}" (${topic.questions.length} pairs)`);

    const ingest = await call("POST", "/api/rag/documents", { workspaceId, title, text: documentText(topic), mimeType: "text/plain" });
    if (!ingest.ok) fail(`Ingest failed for ${slug} (HTTP ${ingest.status}).`);
    const body = asRecord(ingest.data);
    const nested = asRecord(body.document);
    let documentId = typeof body.id === "string" ? body.id : typeof nested.id === "string" ? nested.id : null;
    documentId ??= await findByTitle(title);
    if (!documentId) fail(`Ingest returned no document id for ${slug}.`);

    const probe = topic.questions[0].question;
    const query = await call("POST", "/api/rag/query", {
      workspaceId,
      query: probe,
      limit: 3,
      filter: { documentIds: [documentId], latestVersionOnly: true },
    });
    const matches = asRecord(query.data).matches;
    const verified = query.ok && Array.isArray(matches) && matches.length > 0;
    console.log(`  ${verified ? "verified searchable" : "NOT verified by RAG query"} (id ${documentId})`);
    manifest.push({ file, title, documentId, verified });
  }

  writeFileSync(join(QA_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  const ok = manifest.filter((row) => row.verified).length;
  console.log(`Done: ${ok}/${manifest.length} topics seeded and verified. Manifest: docs/presenter/qa/manifest.json`);
  if (ok < manifest.length) process.exit(1);
}

main().catch((error: unknown) => {
  // Never echo request headers or keys; the error message alone is safe.
  fail(error instanceof Error ? error.message : String(error));
});