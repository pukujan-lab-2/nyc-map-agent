/**
 * What the map shows while one walk step is read (plan step 3 writes it, step 4 draws it; see
 * `docs/PLAN-notice-walks.md`). Every station, line, bus and entrance the step's words name is in here: a test
 * (`noticeWalk.test.ts`) checks that for every saved notice. Station ids are ours (`public/transit/subway.json`,
 * `stations.features[].properties.id`); entrance ids are `entrances.features[].properties.id` in the same file.
 */
export interface StepMap {
  /** Stations the step names, plus the ones it rides between. The map labels these and keeps them in view. */
  stations: string[];
  /** Lines the step names ("7", "E", "GS"), drawn in their colour. */
  lines: string[];
  /** The rider's own stop, when they picked one. */
  you?: string;
  /**
   * The line's two tracks over a stretch. `toward` is the direction the track with changes runs ("Flushing",
   * "uptown"); null when both tracks change. `skip`: stations that track passes without stopping. `closed`: no
   * trains on that stretch at all. `stops`: stations it stops at that it usually skips.
   */
  tracks?: Array<{ line: string; from: string; to: string; toward: string | null; skip?: string[]; closed?: true; stops?: string[] }>;
  /** The train the rider is on in this step, from one station to another, and the direction label it runs toward. */
  ride?: { line: string; from: string; to: string; toward: string | null };
  /**
   * Where the rider changes. "cross": to the other platform; "same": the other direction uses the same platform;
   * "line": to another line (`to` lists them); "bus": between the train and a bus.
   */
  change?: Array<{ at: string; kind: "cross" | "same" | "line" | "bus"; to?: string[] }>;
  /**
   * Buses the step names. `route` is the MTA's name ("M14", "Q10", "shuttle"); `stops` are the stations it serves in
   * this step, with the MTA's corner when the notice gives one.
   */
  bus?: Array<{ route: string; shuttle: boolean; stops: Array<{ station: string; corner: string | null }> }>;
  /** Walking lines from one station to another. */
  walk?: Array<{ from: string; to: string }>;
  /** Entrances the step names. `id` null: our data has no such entrance, and the step's words say so. */
  entrances?: Array<{ station: string; id: string | null; state: "closed" | "use" }>;
}
