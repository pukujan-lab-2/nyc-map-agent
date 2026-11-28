/**
 * Every sentence a notice walk can say, as fixed patterns with named slots (plan step 3 in
 * `docs/PLAN-notice-walks.md`). The walk builder (`noticeWalk.ts`) picks a pattern by key and fills its slots;
 * nothing else writes rider-facing words. Step 7 translates this table once per app language and keys on the
 * same names, so a key never changes meaning: add a new key instead.
 *
 * Slots: {station}, {stations}, {you}, {next}, {at}, {from}, {to}, {near} are station names; {line} is a line
 * ("7"); {trains} and {train} are a line with its direction ("Flushing-bound 7 trains", "a Manhattan-bound 7");
 * {bus} is a bus route; {corner} is the MTA's corner; {stops} is a count of stops ("2 stops"); {n} is a number;
 * {end} is a direction ("Flushing"); {platform}, {detail} and {period} are the MTA's words.
 */
export const PATTERNS = {
  // Step one: what changes, then who it does not touch.
  "lead.skip": "{trains} skip {stations}.",
  "lead.skipSome": "Some {trains} skip {stations}.",
  "lead.otherWay": "{trains} still stop there.",
  "lead.notYou": "If you aren't getting on or off at {stations}, nothing changes for you.",
  "lead.notYouOne": "If you aren't getting on or off at {station}, nothing changes for you.",
  "lead.notBoarding": "If you aren't getting on at {stations}, nothing changes for you.",
  "lead.notStretch": "If your trip stays off that stretch, nothing changes for you.",
  "lead.closed": "No {line} trains at {stations}.",
  "lead.suspended": "No {line} trains between {from} and {to}.",
  "lead.shuttle": "Free shuttle buses run instead.",
  "lead.noService": "No {line} trains.",
  "lead.runs": "{line} trains run only between {from} and {to}.",
  "lead.sections": "{line} trains run in separate parts: {parts}. Change trains where they meet.",
  "lead.sectionsAny": "{line} trains run in separate parts. Change trains where they meet.",
  "lead.express": "{trains} run express from {from} to {to}.",
  "lead.local": "{trains} run local from {from} to {to}, stopping at every station.",
  "lead.extraStops": "{trains} also stop at {stations}.",
  "lead.reroute": "{trains} run on the {via} line from {from} to {to}.",
  "lead.rerouteAll": "{trains} run on the {via} line.",
  "lead.replacedBy": "{by} trains run in place of the {line} between {from} and {to}.",
  "lead.replacedByAll": "{by} trains run in place of the {line}.",
  "lead.platform": "At {stations}, {trains} board from the {platform}.",
  "lead.every": "{line} trains run every {n} minutes.",
  "lead.fewer": "{line} trains run less often, so expect longer waits.",
  "lead.slower": "{line} trains run slower, so expect longer trips.",
  "lead.delays": "{trains} are delayed.",
  "lead.delaysAt": "{trains} are delayed near {stations}.",
  "lead.shortTurn": "Some {line} trains end at {station}.",
  "lead.entrance": "At {stations}: {detail}.",
  "lead.entranceSome": "Some entrances are closed at {stations}.",
  "lead.endsEarly": "{line} service ends early.",
  "lead.beginsEarly": "{line} service begins early.",
  "lead.overnight": "{line} trains run overnight.",
  "lead.schedule": "{line} trains run on a changed schedule.",
  "lead.allTrips": "This is for every trip on the {line}.",

  // The rider's own trip: getting off or getting on at their stop.
  "skip.off": "Getting off at {you}: your train won't stop there. Stay on to the next stop, {next}.",
  "skip.offEnd": "Getting off at {you}: your train won't stop there. Get off at {next}, the stop before.",
  "skip.otherPlatform": "At {at}, go to the platform for {trains}.",
  "skip.rideBack": "Take {train} back {stops} and get off at {you}.",
  "skip.on": "Getting on at {you} toward {end}: trains that way won't stop for you. Board {train} and ride {stops} to {at}.",
  "skip.rideOn": "Take {train}. It goes past {you} without stopping, on toward {end}.",
  "skip.offBoth": "Getting off at {you}: no {line} trains stop there. The nearest stop with trains is {near}.",
  "skip.onBoth": "Getting on at {you}: no {line} trains stop there. The nearest stop with trains is {near}.",
  "closed.off": "Getting off at {you}: no {line} trains stop there. The nearest stop with trains is {near}.",
  "closed.on": "Getting on at {you}: no {line} trains stop there. The nearest stop with trains is {near}.",
  "closed.offNone": "Getting off at {you}: no {line} trains stop there, and the notice names no other way.",
  "closed.onNone": "Getting on at {you}: no {line} trains stop there, and the notice names no other way.",
  "shuttle.rideTo": "Ride the {line} to {at} and go up to the street.",
  "shuttle.board": "Take the free shuttle bus from {corner}.",
  "shuttle.boardUnknown": "Take the free shuttle bus. The notice does not say where it stops at {at}.",
  "shuttle.getOff": "Get off the bus at {you}, at {corner}.",
  "shuttle.getOffUnknown": "Get off the bus at {you}. The notice does not say at which corner.",
  "shuttle.fromYou": "Getting on at {you}: take the free shuttle bus from {corner}.",
  "shuttle.fromYouUnknown": "Getting on at {you}: take the free shuttle bus. The notice does not say at which corner.",
  "shuttle.offAt": "Get off the bus at {at} and take the {line} from there.",
  "shuttle.offYou": "Getting off at {you}: the {line} doesn't stop there. Take the free shuttle bus instead.",
  "platform.on": "Getting on at {you}: board {trains} from the {platform}.",
  "platform.off": "Getting off at {you}: your train still stops there. Nothing else changes.",
  "extra.you": "Your train now stops at {you}.",
  "express.off": "Getting off at {you}: your train runs express past it. Get off at {next} and take {train} back {stops}.",
  "express.on": "Getting on at {you}: express trains don't stop there. Take {train} to {at} and change there.",
  "reroute.off": "Getting off at {you}: {line} trains don't run there. The nearest stop with trains is {near}.",
  "reroute.on": "Getting on at {you}: {line} trains don't run there. The nearest stop with trains is {near}.",
  "sections.change": "To ride past {at}, change trains there.",
  "shortTurn.wait": "If your train ends at {station}, wait there for the next {line}.",
  "entrance.gap": "Our map can't show which entrance is closed, so follow the signs at the station.",

  // The MTA's own advice, one action a step.
  "advice.takeTo": "Take {trains} to {to}.",
  "advice.take": "Take {trains}.",
  "advice.forTake": "For {stations}, take {trains}.",
  "advice.forTakeTo": "For {stations}, take {trains} to {to}.",
  "advice.transfer": "At {at}, change to {trains}.",
  "advice.transferThere": "There, change to {trains}.",
  "advice.rideTo": "Ride it to {you}.",
  "advice.stayOn": "Getting off at {you}: your train won't stop there. Stay on to {to}.",
  "advice.boardTo": "Getting on at {you}: board {trains} and ride to {to}.",
  "advice.nearby": "Use {stations} instead, on the {lines}.",
  "advice.nearbyAny": "Use {stations} instead.",
  "advice.forNearby": "For {you}, use {stations} instead, on the {lines}.",
  "advice.forNearbyAny": "For {you}, use {stations} instead.",
  "advice.between": "Between {from} and {to}, take {trains}.",
  "advice.bus": "Take the {bus} bus.",
  "advice.busAt": "Take the {bus} bus from {corner}.",
  "advice.busUnknown": "Take the {bus} bus. The notice does not say where it stops.",
  "advice.shuttle": "Take the free shuttle bus.",
  "advice.shuttleAt": "Take the free shuttle bus from {corner}.",
  "transfer.at": "You can change between {trains} at {stations}.",
  "transfer.any": "You can change trains at {stations}.",
  "transfer.bus": "You can change between the trains and the shuttle bus at {stations}.",

  // When it applies.
  when: "When: {period}.",
  // A notice our rules could not read: its own headline.
  "mta.headline": "{text}",
} as const;

export type PatternKey = keyof typeof PATTERNS;

/** Fill a pattern's slots. A slot with no value is left out with the space before it. */
export function fill(key: PatternKey, slots: Record<string, string>, table: Record<string, string> = PATTERNS): string {
  const text = (table[key] ?? PATTERNS[key]).replace(/\{(\w+)\}/g, (_m, k: string) => slots[k] ?? "");
  const out = text.replace(/\s+([,.:])/g, "$1").replace(/\s{2,}/g, " ").trim();
  return out.charAt(0).toUpperCase() + out.slice(1);
}

const ORD = (n: string) => {
  const v = Number(n);
  const t = v % 100 >= 11 && v % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[v % 10] ?? "th";
  return `${n}${t}`;
};
const STREETS = "Street|Streets|Avenue|Avenues|Place|Road|Drive|Terrace|Lane";
const WORDS: Record<string, string> = {
  Sts: "Streets", Av: "Avenue", Ave: "Avenue", Avs: "Avenues", Sq: "Square", Pkwy: "Parkway", Blvd: "Boulevard", Rd: "Road", Pl: "Place",
  Hts: "Heights", Pk: "Park", Ctr: "Center", Tpke: "Turnpike", Hwy: "Highway", Jct: "Junction",
};

/**
 * A step as it is said aloud (owner, 2026-11-27: pauses in odd places, sentences running past their periods). Short
 * forms are said in full and never end a sentence ("St." is "Street"), numbered streets are said as ordinals
 * ("52 Street" is "52nd Street"), and the parts of a station's name are read with a pause ("74th Street, Broadway").
 * Pure, so the same step always sounds the same and its audio can be cached by the text.
 */
export function spoken(text: string): string {
  return text
    // "St George" is a saint; "52 St" and "Dyckman St" are streets.
    // A short form's own period goes only inside a sentence ("Dyckman St. and 231 St." is "Dyckman Street and 231st Street.").
    .replace(/(?<![0-9] )\bSt\.?(?= [A-Z][a-z])/g, "Saint")
    .replace(/\bSt\b(?:\.(?=\s+[a-z0-9,]))?/g, "Street")
    .replace(/\b(Sts|Av|Ave|Avs|Sq|Pkwy|Blvd|Rd|Pl|Hts|Pk|Ctr|Tpke|Hwy|Jct)\b(?:\.(?=\s+[a-z0-9,]))?/g, (_m, w: string) => WORDS[w])
    .replace(new RegExp(`\\b(\\d+)-(\\d+) (${STREETS})\\b`, "g"), (_m, a: string, b: string, w: string) => `${ORD(a)} to ${ORD(b)} ${w}`)
    .replace(new RegExp(`\\b(\\d+) (${STREETS})\\b`, "g"), (_m, a: string, w: string) => `${ORD(a)} ${w}`)
    // "Cathedral Parkway (110th Street)", "74th Street-Broadway", "5th Avenue/53rd Street": a pause between the parts.
    .replace(/\s*\(([^)]*)\)/g, ", $1")
    .replace(/(?<=[A-Za-z0-9])\s*[-/]\s*(?=[A-Z0-9])/g, ", ")
    .replace(/,\s*,/g, ",").replace(/,(?=[.:])/g, "")
    .replace(/\.{2,}/g, ".").replace(/\s{2,}/g, " ").trim();
}
