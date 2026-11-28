/**
 * The home's Restroom button asks for the restroom pick (#249). The restrooms
 * feature listens while its flag is on; with no listener the caller falls
 * back to asking the agent.
 */
type Listener = () => void;
let listener: Listener | null = null;

/** Open the restroom pick. False when nothing is listening (the restrooms flag is off). */
export function requestRestroomPick(): boolean {
  if (!listener) return false;
  listener();
  return true;
}

/** The restrooms feature's overlay registers here; the returned function unregisters. */
export function onRestroomPick(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}
