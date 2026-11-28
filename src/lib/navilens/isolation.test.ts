/**
 * This folder must be removable in one step (see README.md): nothing outside it
 * may import from it except the files named here. Add a file to the list only
 * together with the line in README.md that says how to take it out again.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ALLOWED: string[] = [];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === "node_modules" || name.startsWith(".")) return [];
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx|js|jsx|mjs)$/.test(name) ? [p] : [];
  });
}

describe("the NaviLens reader stays in its own folder", () => {
  it("is imported by nothing outside src/lib/navilens, beyond the files this test allows", () => {
    const users = ["src", "server", "api", "scripts", "e2e"]
      .flatMap((d) => files(d))
      .filter((p) => !p.startsWith(join("src", "lib", "navilens")))
      .filter((p) => /from\s+["'][^"']*lib\/navilens|import\(\s*["'][^"']*lib\/navilens/.test(readFileSync(p, "utf8")));
    expect(users.sort()).toEqual(ALLOWED.sort());
  });

  it("imports nothing from the rest of the app, so deleting the folder breaks nothing else", () => {
    const reaching = files(join("src", "lib", "navilens"))
      .filter((p) => /from\s+["'](@\/|\.\.\/)/.test(readFileSync(p, "utf8")));
    expect(reaching).toEqual([]);
  });
});
