import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder } from 'react-native';

export type SwipeDirection = 'left' | 'right';

/** Horizontal drag (pt) a release must pass to count as a swipe. */
export const SWIPE_THRESHOLD = 80;
/** How far the card travels when it is flung off the deck. */
export const SWIPE_OFF_DISTANCE = 420;
const TILT_DISTANCE = 240;
const MAX_TILT_DEG = 10;

type UseSwipeCardOptions = {
  /** When false (no card, or a request is in flight) gestures spring back and buttons do nothing. */
  enabled: boolean;
  /**
   * Runs after the card has been flung off. Resolve `true` when the deck advanced
   * (the next card appears at center). Anything else (`false`, a thrown error, a
   * dismissed sheet) springs the card back to center, un-tilted.
   */
  onCommit: (direction: SwipeDirection) => Promise<boolean | void> | boolean | void;
  /** Changes whenever a different card is on top; the card is reset to center. */
  resetKey?: string | number | null;
};

/**
 * Drag, tilt and fling for the Discover card.
 *
 * Invariant: every way a gesture or button press can end (release below the
 * threshold, responder terminated by the ScrollView/OS, handler declined, handler
 * threw, RSVP sheet cancelled, request failed) finishes with the card either
 * advanced or animated back to x = 0 with no rotation.
 *
 * The PanResponder is created once and reads the latest props through refs, so a
 * re-render in the middle of a drag (a query refetch, `rsvpPending` flipping) can
 * never swap it out and strand the card mid-gesture.
 */
export const useSwipeCard = ({ enabled, onCommit, resetKey }: UseSwipeCardOptions) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const enabledRef = useRef(enabled);
  const onCommitRef = useRef(onCommit);
  const committingRef = useRef(false);
  enabledRef.current = enabled;
  onCommitRef.current = onCommit;

  const springBack = useCallback(() => {
    pan.stopAnimation();
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        pan.setValue({ x: 0, y: 0 });
      }
    });
  }, [pan]);

  const flingOff = useCallback(
    (direction: SwipeDirection) =>
      new Promise<void>((resolve) => {
        pan.stopAnimation();
        Animated.timing(pan, {
          toValue: { x: direction === 'right' ? SWIPE_OFF_DISTANCE : -SWIPE_OFF_DISTANCE, y: 0 },
          duration: 180,
          useNativeDriver: false,
        }).start(() => resolve());
      }),
    [pan],
  );

  const reset = useCallback(() => {
    pan.stopAnimation();
    pan.setValue({ x: 0, y: 0 });
  }, [pan]);

  /** Swipe or button press: fling the card off, run the handler, then advance or spring back. */
  const commit = useCallback(
    async (direction: SwipeDirection) => {
      if (!enabledRef.current || committingRef.current) {
        return;
      }
      committingRef.current = true;
      let advanced = false;
      try {
        await flingOff(direction);
        advanced = Boolean(await onCommitRef.current(direction));
      } catch {
        // The handler owns its own error message; the card must still come back.
        advanced = false;
      } finally {
        committingRef.current = false;
        if (advanced) {
          reset();
        } else {
          springBack();
        }
      }
    },
    [flingOff, reset, springBack],
  );

  const onGestureMove = useCallback(
    (dx: number) => {
      pan.setValue({ x: dx, y: 0 });
    },
    [pan],
  );

  const onGestureEnd = useCallback(
    (dx: number) => {
      if (!enabledRef.current || committingRef.current) {
        springBack();
        return;
      }
      if (dx > SWIPE_THRESHOLD) {
        void commit('right');
      } else if (dx < -SWIPE_THRESHOLD) {
        void commit('left');
      } else {
        springBack();
      }
    },
    [commit, springBack],
  );

  /** The responder was taken away (ScrollView, system gesture, alert): never leave the card tilted. */
  const onGestureCancel = useCallback(() => {
    if (!committingRef.current) {
      springBack();
    }
  }, [springBack]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          enabledRef.current &&
          !committingRef.current &&
          Math.abs(gesture.dx) > 6 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, gesture) => onGestureMove(gesture.dx),
        onPanResponderRelease: (_, gesture) => onGestureEnd(gesture.dx),
        onPanResponderTerminate: () => onGestureCancel(),
      }),
    [onGestureCancel, onGestureEnd, onGestureMove],
  );

  useEffect(() => {
    if (!committingRef.current) {
      reset();
    }
  }, [reset, resetKey]);

  useEffect(
    () => () => {
      pan.stopAnimation();
    },
    [pan],
  );

  const cardStyle = useMemo(
    () => ({
      transform: [
        { translateX: pan.x },
        {
          rotate: pan.x.interpolate({
            inputRange: [-TILT_DISTANCE, 0, TILT_DISTANCE],
            outputRange: [`-${MAX_TILT_DEG}deg`, '0deg', `${MAX_TILT_DEG}deg`],
            extrapolate: 'clamp',
          }),
        },
      ],
    }),
    [pan],
  );

  return {
    pan,
    cardStyle,
    panHandlers: panResponder.panHandlers,
    commit,
    reset,
    springBack,
    onGestureMove,
    onGestureEnd,
    onGestureCancel,
  };
};
