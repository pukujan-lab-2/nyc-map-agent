import type { FeatureModule } from "@/lib/features/types";

const restrooms: FeatureModule = {
  id: "restrooms",
  layers: () => import("./layers"),
  // The restroom pick (the home's Restroom button) and the question when a walk arrives (#249).
  overlay: { load: () => import("./RestroomOverlay") },
  panel: { idPrefix: "restroom:" },
  chips: ["restrooms"],
  flags: ["restrooms"],
  routes: ["/api/restrooms", "/api/restroom-answers"],
};

export default restrooms;
