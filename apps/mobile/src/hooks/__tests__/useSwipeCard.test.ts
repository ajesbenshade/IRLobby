import { act, renderHook } from '@testing-library/react-native';
import { Animated } from 'react-native';

import { SWIPE_OFF_DISTANCE, SWIPE_THRESHOLD, useSwipeCard } from '../useSwipeCard';

type Value = Animated.ValueXY;

const xOf = (pan: Value) => (pan.x as unknown as { __getValue: () => number }).__getValue();
const yOf = (pan: Value) => (pan.y as unknown as { __getValue: () => number }).__getValue();

/** Animations finish instantly so the final resting position can be asserted. */
const settleAnimationsImmediately = () => {
  const run = (value: Value, config: { toValue: { x: number; y: number } }) => ({
    start: (callback?: (result: { finished: boolean }) => void) => {
      value.setValue(config.toValue);
      callback?.({ finished: true });
    },
    stop: jest.fn(),
    reset: jest.fn(),
  });
  jest.spyOn(Animated, 'spring').mockImplementation(run as never);
  jest.spyOn(Animated, 'timing').mockImplementation(run as never);
};

const setup = (options: Partial<Parameters<typeof useSwipeCard>[0]> = {}) => {
  const onCommit = jest.fn<Promise<boolean | void> | boolean | void, ['left' | 'right']>();
  const hook = renderHook(
    (props: Parameters<typeof useSwipeCard>[0]) => useSwipeCard(props),
    { initialProps: { enabled: true, onCommit, ...options } },
  );
  return { ...hook, onCommit };
};

describe('useSwipeCard', () => {
  beforeEach(() => {
    settleAnimationsImmediately();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('springs back to center when a drag ends below the swipe threshold', () => {
    const { result, onCommit } = setup();

    act(() => result.current.onGestureMove(SWIPE_THRESHOLD - 10));
    expect(xOf(result.current.pan)).toBe(SWIPE_THRESHOLD - 10);

    act(() => result.current.onGestureEnd(SWIPE_THRESHOLD - 10));
    expect(xOf(result.current.pan)).toBe(0);
    expect(yOf(result.current.pan)).toBe(0);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('springs back when the responder is terminated mid-drag (ScrollView steal, system gesture)', () => {
    const { result } = setup();

    act(() => result.current.onGestureMove(200));
    expect(xOf(result.current.pan)).toBe(200);

    act(() => result.current.onGestureCancel());
    expect(xOf(result.current.pan)).toBe(0);
  });

  it('springs back instead of stranding the card when gestures are disabled (request in flight)', () => {
    const { result, onCommit } = setup({ enabled: false });

    act(() => result.current.onGestureMove(-200));
    act(() => result.current.onGestureEnd(-200));

    expect(xOf(result.current.pan)).toBe(0);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('flings off and resets to center when the handler advances the deck', async () => {
    const { result, onCommit } = setup();
    onCommit.mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');

    await act(async () => {
      await result.current.commit('left');
    });

    expect(timing).toHaveBeenCalledWith(
      result.current.pan,
      expect.objectContaining({ toValue: { x: -SWIPE_OFF_DISTANCE, y: 0 } }),
    );
    expect(onCommit).toHaveBeenCalledWith('left');
    expect(xOf(result.current.pan)).toBe(0);
  });

  it('springs back to center when the RSVP sheet is dismissed (handler resolves false)', async () => {
    const { result, onCommit } = setup();
    onCommit.mockResolvedValue(false);

    await act(async () => {
      await result.current.commit('right');
    });

    expect(onCommit).toHaveBeenCalledWith('right');
    expect(xOf(result.current.pan)).toBe(0);
  });

  it('springs back to center when the request fails (handler throws)', async () => {
    const { result, onCommit } = setup();
    onCommit.mockRejectedValue(new Error('Choose yourself or a child.'));

    await act(async () => {
      await result.current.commit('right');
    });

    expect(xOf(result.current.pan)).toBe(0);
    expect(yOf(result.current.pan)).toBe(0);
  });

  it('swiping past the threshold commits in that direction', async () => {
    const { result, onCommit } = setup();
    onCommit.mockResolvedValue(true);

    await act(async () => {
      result.current.onGestureEnd(SWIPE_THRESHOLD + 1);
    });
    expect(onCommit).toHaveBeenLastCalledWith('right');

    await act(async () => {
      result.current.onGestureEnd(-(SWIPE_THRESHOLD + 1));
    });
    expect(onCommit).toHaveBeenLastCalledWith('left');
  });

  it('ignores a second commit while one is running', async () => {
    const { result, onCommit } = setup();
    let finish: (value: boolean) => void = () => undefined;
    onCommit.mockImplementation(() => new Promise<boolean>((resolve) => { finish = resolve; }));

    await act(async () => {
      void result.current.commit('right');
      void result.current.commit('left');
    });
    expect(onCommit).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish(false);
    });
    expect(xOf(result.current.pan)).toBe(0);
  });

  it('does nothing when disabled', async () => {
    const { result, onCommit } = setup({ enabled: false });

    await act(async () => {
      await result.current.commit('right');
    });

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('keeps one stable PanResponder across re-renders so a refetch cannot strand a drag', () => {
    const { result, rerender, onCommit } = setup();
    const before = result.current.panHandlers;

    rerender({ enabled: false, onCommit });
    rerender({ enabled: true, onCommit: jest.fn() });

    expect(result.current.panHandlers.onResponderRelease).toBe(before.onResponderRelease);
    expect(result.current.panHandlers.onResponderTerminate).toBe(before.onResponderTerminate);
  });

  it('recenters when a different card comes to the top', () => {
    const { result, rerender, onCommit } = setup({ resetKey: 'a' });

    act(() => result.current.onGestureMove(150));
    rerender({ enabled: true, onCommit, resetKey: 'b' });

    expect(xOf(result.current.pan)).toBe(0);
  });
});
