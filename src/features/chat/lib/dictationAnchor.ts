/**
 * Dictation anchor utilities
 * Tracks the committed prefix vs the pending (still-forming) tail.
 * Any user keystroke after the anchor commits the tail up to that point.
 */

export interface DictationAnchorState {
  anchor: number; // position in the full text where pending tail begins
  pending: string; // the still-forming transcript
}

/**
 * When the user types or pastes, we commit everything up to the new caret
 * and clear the pending tail (or keep only what comes after the edit).
 */
export function commitOnUserEdit(
  fullText: string,
  caret: number,
): { newAnchor: number; committed: string; pending: string } {
  const newAnchor = Math.min(caret, fullText.length);
  const committed = fullText.slice(0, newAnchor);
  const pending = fullText.slice(newAnchor);
  return { newAnchor, committed, pending };
}

/**
 * Merge a new realtime delta into the pending tail.
 * The caller is responsible for calling this only while dictation is active.
 */
export function appendRealtimeDelta(
  currentPending: string,
  delta: string,
): string {
  return currentPending + delta;
}
