/**
 * The presentation's one spine: eighteen chapters in three acts (docs/presenter/PDD.md).
 * Data only — the machine walks it, the renderer draws it, the tests enumerate it.
 * Nothing else may define chapter order, views, suggestions or labels.
 */

export interface Chapter {
  /** Stable id, 0-based; the server speaks 1-based chapters over the same order. */
  id: number;
  act: 1 | 2 | 3;
  title: string;
  /** Legal view modes; the first is the default. Views are options within a chapter, never routes. */
  views: readonly string[];
  /** Human labels for the view switcher, parallel to views. */
  viewLabels: readonly string[];
  /** Tappable questions shown above the chat; each must resolve through the router (M6). */
  suggestions: readonly string[];
  /** The advance button's label on this chapter. */
  nextLabel: string;
  /** The old drawing index in scenes.ts, until the renderer is fully spine-native. */
  draw: number;
  /** How to draw it: a walk stop photo, an evidence scene, or the sign-match frame. */
  kind: "stop" | "evidence" | "sign";
  /** The prepared direction spoken at a walk stop (authoritative, no network). */
  direction?: string;
}

const stop = (id: number, title: string, draw: number, direction: string, nextLabel: string, suggestions: readonly string[]): Chapter => ({
  id, act: 1, title, views: ["default", "walk"], viewLabels: ["Station frame", "Original walk"],
  suggestions, nextLabel, draw, kind: "stop", direction,
});

export const SPINE: readonly Chapter[] = [
  {
    id: 0, act: 1, title: "Your trip", views: ["default"], viewLabels: ["The story"],
    suggestions: ["Start the tour", "Show me the splat", "How did Washington do this?"],
    nextLabel: "Guide me →", draw: 0, kind: "evidence",
  },
  stop(1, "Broadway entrance", 10, "Enter through the glass doors. Turn right for the elevator down to the concourse.", "To the train →", ["Play the original walk here", "What do I do here?"]),
  stop(2, "Uptown platform", 11, "Take the elevator marked Uptown & Queens. Board an R or W and ride five stops to Union Square.", "Arrive at Union Sq →", ["Play the original walk here", "What do I do here?"]),
  stop(3, "Platform elevator", 12, "Leave the train at Union Square. Follow the platform to the elevator and go up one level.", "Find the turn →", ["Play the original walk here", "Where do I go?"]),
  {
    id: 4, act: 1, title: "Mezzanine", views: ["default", "walk", "video"], viewLabels: ["Station frame", "Original walk", "Simulated directions"],
    suggestions: ["Play the original walk here", "What did the sign reader see?", "Show me the left turn"],
    nextLabel: "To the street elevator →", draw: 3, kind: "stop",
    direction: "Turn left under “Elevator to L” and enter the long corridor.",
  },
  stop(5, "Street elevator", 13, "Follow the corridor to the wide gate. Turn left at the orange mural and take the elevator to the street.", "Step outside →", ["Play the original walk here", "Where do I go?"]),
  {
    id: 6, act: 1, title: "Street", views: ["default"], viewLabels: ["The street"],
    suggestions: ["Show me the GPS test", "How can I contribute a walk?"],
    nextLabel: "See the tech behind this walk →", draw: 14, kind: "stop",
    direction: "You’re outside. The Climate Clock across the street marks the end of the recorded route.",
  },
  {
    id: 7, act: 2, title: "The first pitch", views: ["default"], viewLabels: ["The clip"],
    suggestions: ["Keep going", "What does the phone record?"],
    nextLabel: "See the GPS test →", draw: 1, kind: "evidence",
  },
  {
    id: 8, act: 2, title: "One walk, two estimates", views: ["default", "map"], viewLabels: ["Watch the replay", "Estimates map"],
    suggestions: ["Show the estimates map", "How far off was GPS?"],
    nextLabel: "Look through the camera →", draw: 2, kind: "evidence",
  },
  {
    id: 9, act: 2, title: "A sign becomes a clue", views: ["default", "video"], viewLabels: ["See the match", "Play the guide"],
    suggestions: ["Play the guide", "What did the AI actually do?"],
    nextLabel: "Find another landmark →", draw: 3, kind: "sign",
  },
  {
    id: 10, act: 2, title: "One elevator, several floors", views: ["default"], viewLabels: ["The plaque"],
    suggestions: ["What does EL479 tell us?", "What did the barometer add?"],
    nextLabel: "Feel the climb →", draw: 4, kind: "evidence",
  },
  {
    id: 11, act: 2, title: "The phone feels a climb", views: ["default", "data"], viewLabels: ["Pressure", "The readings"],
    suggestions: ["Show the pressure readings", "How does this become 3D?"],
    nextLabel: "Build the 3D view →", draw: 5, kind: "evidence",
  },
  {
    id: 12, act: 2, title: "Frames become a place", views: ["default", "splat", "points", "process", "video"],
    viewLabels: ["3D map", "Splat capture", "COLMAP points", "How it is made", "Orbit video"],
    suggestions: ["Show the COLMAP points", "How was this made?", "What is a Gaussian splat?"],
    nextLabel: "Walk the station →", draw: 6, kind: "evidence",
  },
  {
    id: 13, act: 2, title: "A route through Fulton", views: ["default"], viewLabels: ["The simulation"],
    suggestions: ["Is this live guidance?", "What would AR need?"],
    nextLabel: "See what others built →", draw: 7, kind: "evidence",
  },
  {
    id: 14, act: 2, title: "Ideas proven elsewhere", views: ["default", "washington", "singapore", "london", "seoul"],
    viewLabels: ["Studies", "Washington", "Singapore", "London", "Seoul"],
    suggestions: ["How did Singapore do this?", "How did London do this?", "How did Seoul do this?"],
    nextLabel: "See the stack →", draw: 8, kind: "evidence",
  },
  {
    id: 15, act: 2, title: "The stack we build on", views: ["default"], viewLabels: ["The stack"],
    suggestions: ["What did the AI actually do?", "How can I get the data today?"],
    nextLabel: "See the AI at work →", draw: 15, kind: "evidence",
  },
  {
    id: 16, act: 2, title: "How the AI reads a sign", views: ["default"], viewLabels: ["The pipeline"],
    suggestions: ["Show me the sign match", "What is the tech stack?"],
    nextLabel: "Use the data →", draw: 16, kind: "evidence",
  },
  {
    id: 17, act: 3, title: "Build with us", views: ["default"], viewLabels: ["The invitation"],
    suggestions: ["How can I contribute a walk?", "What's the plan from here?", "How can I get the data today?"],
    nextLabel: "Start again ↺", draw: 9, kind: "evidence",
  },
];

export const ACT_NAMES: Record<1 | 2 | 3, string> = { 1: "The walk", 2: "The technology", 3: "Join in" };

/** The old scene indices (walk stops 10–14, evidence 1–9, new screens 15–16) onto the spine. */
export const OLD_TO_NEW: Record<number, number> = {
  0: 0, 1: 7, 2: 8, 3: 9, 4: 10, 5: 11, 6: 12, 7: 13, 8: 14, 9: 17,
  10: 1, 11: 2, 12: 3, 13: 5, 14: 6, 15: 15, 16: 16,
};
/** The mezzanine walk stop keeps its own spine chapter, distinct from the sign-match evidence. */
export const MEZZANINE_STOP = 4;

export const chapter = (id: number): Chapter | undefined => SPINE[id];
export const isWalkStop = (id: number): boolean => SPINE[id]?.act === 1 && id >= 1 && id <= 6;
export const legalView = (id: number, view: string): boolean => !!SPINE[id]?.views.includes(view);

/** Names a visitor may say to jump: chapter titles, stop names, and common aliases. */
export const NAME_TARGETS: ReadonlyArray<readonly [RegExp, number]> = [
  [/broadway (entrance|doors)|cortlandt (street )?entrance/, 1],
  [/uptown (platform|train|and queens)|the r or w/, 2],
  [/platform elevator|elevator (from|off) the platform/, 3],
  [/mezzanine|left turn|elevator to l/, 4],
  [/street elevator|wide gate|orange mural/, 5],
  [/climate clock|14th street and 4th avenue|street arrival|the street/, 6],
  [/first pitch|original (video|presentation)|hackathon (video|clip)/, 7],
  [/67\s*(av|ave|avenue)|gps (test|replay|drift)|two estimates/, 8],
  [/sign (match|reader|vision)|union square sign|saved frame/, 9],
  [/el479|plaque|elevator (number|id|clue)|queensboro sign/, 10],
  [/pressure|barometer|the climb|height readings/, 11],
  [/splat|colmap|point cloud|3d (map|capture|view)|gaussian/, 12],
  [/fulton|route graph|simulated walk/, 13],
  [/other (cities|countries)|research|washington|singapore|london|seoul|tokyo|waymap|wmata|navilens|floorpair|clew|anyone else|other people/, 14],
  [/tech stack|the stack|under the hood|built with|gis/, 15],
  [/ai (pipeline|at work)|how the ai|vision (model|analysis)|what did the (ai|model)/, 16],
  [/open data|build with us|contribute|get the data|sample data/, 17],
  [/union square|14th street|14 st/, 3],
  [/\belevator\b/, 3],
];