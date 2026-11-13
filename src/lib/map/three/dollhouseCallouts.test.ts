import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { enterModel, pickEnter, pickWalk, type DollhouseModel } from "./dollhouse";
import { enterCallouts, walkCallouts } from "./dollhouseCallouts";

const model = JSON.parse(readFileSync("public/transit/fulton-model.json", "utf8")) as DollhouseModel;

describe("what the voice says on the Fulton St walk", () => {
  const walk = pickWalk(model, [-74.0075959, 40.710219])!;
  const lines = walkCallouts(model, walk.path, "Fulton St & Nassau St · NE corner");

  it("first says where on the train the figure got off, and the side the train leaves on", () => {
    expect(lines[0].wait).toBe(true);
    expect(lines[0].text).toMatch(/^Starting from the (front|middle|back) of the downtown [\w ]+ train, about car \d+ of 10, on the platform\. The train pulls out on your (left|right)\.$/);
  });

  it("gives turns, stairs and the fare line in order, and ends on the street corner", () => {
    const texts = lines.map((l) => l.text);
    expect(texts.some((t) => /^(Turn|Bear) (left|right)\.$|first (left|right)/.test(t))).toBe(true);
    expect(texts.some((t) => /stairs/.test(t))).toBe(true);
    expect(texts).toContain("Out through the turnstiles or the exit gate.");
    expect(texts.at(-1)).toBe("You're on the street at Fulton St & Nassau St · NE corner.");
    for (let i = 1; i < lines.length; i++) expect(lines[i].f).toBeGreaterThan(lines[i - 1].f);
  });
});

describe("what the voice says on the walk in to the uptown A/C (#126)", () => {
  const e = pickEnter(model, [-74.00969, 40.71039])!;
  const { model: em, walk } = enterModel(model, e);
  const lines = enterCallouts(em, walk.path, "Fulton St & Broadway · SW corner", e.direction);

  it("starts at the entrance and ends on the uptown platform, as the train comes in", () => {
    expect(lines[0].text).toBe("Starting at the street, at Fulton St & Broadway · SW corner. Going down into Fulton St station to the uptown A and C platform.");
    expect(lines.at(-1)).toMatchObject({ f: 1, wait: true });
    expect(lines.at(-1)!.text).toMatch(/^This is the uptown A and C platform\./);
  });

  it("goes down stairs and in through the turnstiles, in order", () => {
    const texts = lines.map((l) => l.text);
    expect(texts).toContain("Take the stairs down.");
    expect(texts).toContain("In through the turnstiles.");
    expect(texts.indexOf("In through the turnstiles.")).toBeGreaterThan(texts.indexOf("Take the stairs down."));
    for (let i = 1; i < lines.length; i++) expect(lines[i].f).toBeGreaterThan(lines[i - 1].f);
  });

  it("is only played for an entrance near Fulton St", () => {
    expect(pickEnter(model, [-74.0118, 40.7076])).toBeNull();
  });
});
