/**
 * How long a hands-free turn takes today, end to end (step 1 of docs/PLAN-livekit-hands-free.md, #299).
 *
 *   pnpm build:e2e
 *   pnpm tsx scripts/voice-baseline.ts [--api live|fixture|both] [--runs 3] [--target https://nyc.design-bakery.com] [--out file.json]
 *
 * Each run opens the app in Chromium, taps hands-free and "speaks" a fixed clip from
 * scripts/voice-baseline/clips/ into a fake microphone. The app's own code does the rest: it hears the
 * pause, records, sends the clip to /api/stt, asks /api/agent and reads the answer through /api/tts.
 * The page notes when each of those happens; scripts/voice-baseline/timing.ts splits the turn.
 *
 * `live` passes /api/stt, /api/agent and /api/tts through to the deployed app (and so to the speech
 * gateway and the real agent), streaming, so first-token and first-byte times are real. `fixture`
 * answers them at once from canned replies, which leaves only the app's own waiting and work.
 * Every other request is answered by e2e/mocks.ts, as in the browser tests.
 *
 * Nothing makes sound: Chromium runs with --mute-audio, the fake microphone is never connected to the
 * speakers, the phone voice is the silent stub from e2e/mocks.ts, and the app voice's sound sources are
 * replaced with stubs that only note the time and report "ended" after the clip's length.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { Readable } from "node:stream";
import { chromium, type Browser } from "@playwright/test";
import { mockNetwork } from "../e2e/mocks";
import { median, readWav, speechEndSec, turnParts, type Mark, type TurnParts } from "./voice-baseline/timing";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const API = arg("api", "both");
const RUNS = Number(arg("runs", "3"));
const TARGET = arg("target", "https://nyc.design-bakery.com").replace(/\/$/, "");
const OUT = arg("out", "");
const APP_PORT = 4329;
const PROXY_PORT = 4330;
const ROOT = new URL("..", import.meta.url).pathname;
const CLIPS = join(ROOT, "scripts/voice-baseline/clips");

/** What each clip says, for the fixture speech-to-text. */
const QUESTIONS: Record<string, string> = {
  "next-4-downtown": "When is the next 4 train downtown?",
  "seven-at-74-street": "Does the 7 stop at 74 Street Broadway?",
  "a-train-running": "Is the A train running normally right now?",
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The built app on localhost, as the browser tests serve it. */
async function startApp(): Promise<ChildProcess> {
  if (!existsSync(join(ROOT, ".e2e-build/index.html"))) throw new Error("No .e2e-build: run `pnpm build:e2e` first.");
  const app = spawn("pnpm", ["exec", "vite", "preview", "--outDir", ".e2e-build", "--port", String(APP_PORT), "--strictPort"], { cwd: ROOT, stdio: "ignore" });
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(`http://localhost:${APP_PORT}/`)).ok) return app; } catch { /* not up yet */ }
    await wait(500);
  }
  app.kill();
  throw new Error("vite preview did not start");
}

/** Streams the three voice routes to the deployed app, so the page sees each byte when it arrives. */
function startProxy(): Promise<Server> {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      void (async () => {
        try {
          const headers: Record<string, string> = {};
          for (const h of ["content-type", "x-session-id", "x-keep"]) if (typeof req.headers[h] === "string") headers[h] = req.headers[h];
          // The page cancels a reply it no longer wants (a new answer cuts off the "still working" line).
          const gone = new AbortController();
          res.on("close", () => gone.abort());
          const up = await fetch(`${TARGET}${req.url}`, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined, signal: gone.signal });
          const out: Record<string, string> = {};
          up.headers.forEach((v, k) => { if (["content-type", "x-sample-rate", "cache-control"].includes(k)) out[k] = v; });
          res.writeHead(up.status, out);
          if (!up.body) { res.end(); return; }
          const body = Readable.fromWeb(up.body as never);
          body.on("error", () => res.destroy());
          body.pipe(res);
        } catch {
          if (!res.headersSent) res.writeHead(502);
          res.end();
        }
      })();
    });
  });
  return new Promise((resolve) => server.listen(PROXY_PORT, "127.0.0.1", () => resolve(server)));
}

/** Runs in the page before the app: the fake microphone, the silent app voice, and the marks. */
function instrument({ clip, endSec }: { clip: string; endSec: number }) {
  const marks: Array<{ name: string; t: number; text?: string }> = [];
  Object.assign(window, { __marks: marks });
  const mark = (name: string, text?: string) => marks.push({ name, t: performance.now(), ...(text ? { text } : {}) });
  // Our server speech-to-text, the path phones take: Brave is sent there too.
  Object.defineProperty(navigator, "brave", { value: {} });

  // The originals, taken by descriptor so they can be called on any node later.
  const original = <T,>(proto: object, key: string) => Object.getOwnPropertyDescriptor(proto, key)?.value as T;
  const realStart = original<(this: AudioBufferSourceNode, when?: number) => void>(AudioBufferSourceNode.prototype, "start");
  const mic = new WeakSet<AudioBufferSourceNode>();
  // The app voice: note when its first sound would play, never play it.
  AudioBufferSourceNode.prototype.start = function start(this: AudioBufferSourceNode, when?: number) {
    // The clip's conversion to WAV renders offline and must stay real.
    if (mic.has(this) || this.context instanceof OfflineAudioContext) { realStart.call(this, when); return; }
    mark("audio-start");
    const ms = (this.buffer?.duration ?? 0) * 1000;
    window.setTimeout(() => { this.onended?.call(this, new Event("ended")); }, ms);
  };
  const realStop = original<(this: AudioBufferSourceNode, when?: number) => void>(AudioScheduledSourceNode.prototype, "stop");
  AudioBufferSourceNode.prototype.stop = function stop(this: AudioBufferSourceNode, when?: number) {
    if (mic.has(this) || this.context instanceof OfflineAudioContext) realStop.call(this, when);
  };

  // The first microphone request hears the clip once; later ones (the talk-over detector) hear silence.
  let opened = 0;
  let startClip: (() => void) | null = null;
  navigator.mediaDevices.getUserMedia = async () => {
    opened += 1;
    const ctx = new AudioContext();
    await ctx.resume();
    const out = ctx.createMediaStreamDestination();
    if (opened === 1) {
      const bytes = Uint8Array.from(atob(clip), (c) => c.charCodeAt(0));
      const buf = await ctx.decodeAudioData(bytes.buffer);
      const src = ctx.createBufferSource();
      mic.add(src);
      src.buffer = buf;
      src.connect(out);
      // The question starts 0.6 s after recording does, so the app has learned the quiet room's level first:
      // its first 100 ms frame sets the background level, and speech in that frame would raise it.
      startClip = () => src.start(ctx.currentTime + 0.6);
      // The audio clock says when the clip really finished; speech ended that long before its tail.
      src.onended = () => {
        const t = performance.now() - (buf.duration - endSec) * 1000;
        marks.push({ name: "speech-end", t });
      };
    }
    return out.stream;
  };

  const recorderStart = original<(this: MediaRecorder, slice?: number) => void>(MediaRecorder.prototype, "start");
  MediaRecorder.prototype.start = function start(this: MediaRecorder, slice?: number) {
    recorderStart.call(this, slice);
    startClip?.();
    startClip = null;
  };
  const recorderStop = original<(this: MediaRecorder) => void>(MediaRecorder.prototype, "stop");
  MediaRecorder.prototype.stop = function stop(this: MediaRecorder) {
    if (this.state !== "inactive") mark("rec-stop");
    recorderStop.call(this);
  };

  // Each voice request, and when its first byte (or the agent's first text) comes back.
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const kind = /\/api\/(stt|agent|tts)\b/.exec(url)?.[1];
    if (!kind) return realFetch(input, init);
    let said: string | undefined;
    if (kind === "tts" && typeof init?.body === "string") said = (JSON.parse(init.body) as { text?: string }).text;
    mark(`${kind}-sent`, said);
    const res = await realFetch(input, init);
    if (kind === "stt") {
      const heard = await res.clone().json().then((d: { text?: string }) => d.text ?? "", () => "");
      mark("stt-done", heard);
      return res;
    }
    if (!res.body) return res;
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let firstByte = true;
    let firstText = true;
    const body = new ReadableStream<Uint8Array>({
      async pull(c) {
        const { done, value } = await reader.read();
        if (done) { if (kind === "agent") mark("agent-done"); c.close(); return; }
        if (kind === "tts" && firstByte) { firstByte = false; mark("tts-first-byte"); }
        if (kind === "agent" && firstText && /"type":"text"/.test(dec.decode(value, { stream: true }))) { firstText = false; mark("agent-first-text"); }
        c.enqueue(value);
      },
      cancel(r) { return reader.cancel(r); },
    });
    return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
  };
}

async function oneTurn(browser: Browser, mode: "live" | "fixture", name: string): Promise<TurnParts & { clip: string; mode: string }> {
  const bytes = readFileSync(join(CLIPS, `${name}.wav`));
  const { rate, samples } = readWav(bytes);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  // tsx keeps function names with a `__name` helper that only exists in Node; give the page a stand-in.
  await page.addInitScript("globalThis.__name = (f) => f;");
  await page.addInitScript(instrument, { clip: bytes.toString("base64"), endSec: speechEndSec(samples, rate) });
  await mockNetwork(page);
  const voice = /\/api\/(stt|agent|tts)(\?|$)/;
  if (mode === "live") {
    await page.route(voice, (route) => {
      const u = new URL(route.request().url());
      return route.continue({ url: `http://127.0.0.1:${PROXY_PORT}${u.pathname}${u.search}` });
    });
  } else {
    await page.route(voice, (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/stt") return route.fulfill({ json: { text: QUESTIONS[name], lang: "en" } });
      if (path === "/api/tts") return route.fulfill({ contentType: "audio/L16", body: Buffer.alloc(4800), headers: { "x-sample-rate": "24000" } });
      const lines = [{ type: "text", text: "Here is the answer. " }, { type: "text", text: "It is a short one." }, { type: "done", model: "fixture" }];
      return route.fulfill({ contentType: "application/x-ndjson", body: lines.map((l) => JSON.stringify(l)).join("\n") + "\n" });
    });
  }
  await page.goto(`http://localhost:${APP_PORT}/`);
  await page.getByRole("button", { name: "Hands-free conversation" }).click();
  if (process.env.VOICE_BASELINE_DEBUG) { page.on("console", (m) => console.error("page:", m.type(), m.text())); page.on("pageerror", (e) => console.error("page error:", e.message)); }
  const deadline = Date.now() + (mode === "live" ? 90_000 : 30_000);
  let marks: Mark[] = [];
  while (Date.now() < deadline) {
    marks = await page.evaluate(() => (window as unknown as { __marks: Mark[] }).__marks);
    const done = marks.find((m) => m.name === "agent-done");
    if (done && marks.some((m) => m.name === "audio-start" && m.t > done.t)) break;
    await wait(250);
  }
  if (process.env.VOICE_BASELINE_DEBUG) console.error(JSON.stringify(marks));
  await context.close();
  return { mode, clip: name, ...turnParts(marks) };
}

const PARTS: Array<[keyof TurnParts, string]> = [
  ["recordingEnd", "Rider stops → recording ends"],
  ["upload", "Recording ends → /api/stt sent"],
  ["stt", "/api/stt"],
  ["toAgent", "Text back → /api/agent sent"],
  ["agentFirstToken", "/api/agent first token"],
  ["agentRest", "First token → whole answer"],
  ["ttsFirstByte", "Answer in → /api/tts first byte"],
  ["playStart", "First byte → sound starts"],
  ["total", "**Rider stops → first word of the answer**"],
  ["firstSound", "Rider stops → first sound of any kind"],
];

function table(rows: Array<TurnParts & { mode: string }>): string {
  const modes = [...new Set(rows.map((r) => r.mode))];
  const s = (v: number | null) => (v === null ? "–" : `${(v / 1000).toFixed(2)} s`);
  const head = `| Part (median) | ${modes.join(" | ")} |\n|---|${modes.map(() => "---:").join("|")}|`;
  const body = PARTS.map(([k, label]) => `| ${label} | ${modes.map((m) => s(median(rows.filter((r) => r.mode === m).map((r) => r[k] as number | null)))).join(" | ")} |`);
  return [head, ...body].join("\n");
}

async function main() {
  const modes = API === "both" ? (["fixture", "live"] as const) : ([API] as Array<"live" | "fixture">);
  const clips = readdirSync(CLIPS).filter((f) => f.endsWith(".wav")).map((f) => f.replace(/\.wav$/, "")).sort();
  const app = await startApp();
  const proxy = modes.includes("live") ? await startProxy() : null;
  // Same escape hatch as playwright.config.ts, for machines whose pinned browser download is missing.
  const exe = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch({ args: ["--mute-audio", "--autoplay-policy=no-user-gesture-required"], ...(exe ? { executablePath: exe } : {}) });
  const rows: Array<TurnParts & { clip: string; mode: string }> = [];
  try {
    for (const mode of modes) {
      // One turn first, not counted: the speech server may still be loading its models.
      if (mode === "live") await oneTurn(browser, mode, clips[0]);
      for (let run = 0; run < RUNS; run += 1) {
        for (const clip of clips) {
          const r = await oneTurn(browser, mode, clip);
          rows.push(r);
          console.error(`${mode} ${clip}: ${r.total ?? "no answer"} ms (stt ${r.stt}, agent first token ${r.agentFirstToken}); heard "${r.heard ?? ""}"`);
          // The app's fair-use limit allows 12 speech-to-text requests a minute from one address.
          if (mode === "live") await wait(6000);
        }
      }
    }
  } finally {
    await browser.close();
    proxy?.close();
    app.kill();
  }
  const report = { measured: new Date().toISOString(), target: TARGET, runs: RUNS, rows };
  if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
  console.log(table(rows));
}

await main();
