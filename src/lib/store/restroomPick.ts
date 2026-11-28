/**
 * The home's Restroom button asks for the restroom pick (#249). The restrooms
 * feature listens while its flag is on. Its overlay is lazy, so a tap that
 * comes before it has loaded waits for it; with the flag off the caller falls
 * back to asking the agent.
 */
type Listener = () => void;
let listener: Listener | null = null;
let pending = false;

/**
 * Open the restroom pick. `featureOn` says the restrooms feature is on, so a
 * tap before its overlay loads is kept and opens the pick once it does.
 * False when nothing will open it (the feature is off).
 */
export function requestRestroomPick(featureOn = false): boolean {
  if (listener) {
    listener();
    return true;
  }
  if (!featureOn) return false;
  pending = true;
  return true;
}

/** The restrooms feature's overlay registers here; the returned function unregisters. */
export function onRestroomPick(fn: Listener): () => void {
  listener = fn;
  if (pending) {
    pending = false;
    fn();
  }
  return () => {
    if (listener === fn) listener = null;
  };
}
