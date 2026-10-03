import { useCallback, useEffect, useRef } from 'react';

/**
 * iOS cannot present a modal while another is presented (or still animating out): the second `Modal` silently never shows,
 * or the app freezes on a blank scrim. So sheets are handed off in sequence: hide the first, and only open the next once
 * the first has finished closing.
 *
 *   handoff.after(() => setNext(true))   // queue "open the next sheet"
 *   <FoyerSheet onClosed={handoff.flush} />  // iOS `onDismiss` runs the queued step as soon as the sheet is gone
 *
 * `onDismiss` is iOS-only (and not fired by every host), so a short fallback timer runs the queued step if the sheet never
 * reports. The step runs exactly once, whichever comes first.
 */
export const SHEET_HANDOFF_FALLBACK_MS = 450;

export const useSheetHandoff = (fallbackMs = SHEET_HANDOFF_FALLBACK_MS) => {
  const pending = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const flush = useCallback(() => {
    clear();
    const step = pending.current;
    pending.current = null;
    step?.();
  }, []);

  const after = useCallback(
    (step: () => void) => {
      clear();
      pending.current = step;
      timer.current = setTimeout(flush, fallbackMs);
    },
    [fallbackMs, flush],
  );

  useEffect(
    () => () => {
      clear();
      pending.current = null;
    },
    [],
  );

  return { after, flush };
};
