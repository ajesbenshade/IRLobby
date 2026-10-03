import { act, renderHook } from '@testing-library/react-native';

import { SHEET_HANDOFF_FALLBACK_MS, useSheetHandoff } from '../useSheetHandoff';

describe('useSheetHandoff', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('runs the queued step when the closing sheet reports it is gone (flush), exactly once', () => {
    const { result } = renderHook(() => useSheetHandoff());
    const step = jest.fn();
    act(() => result.current.after(step));
    expect(step).not.toHaveBeenCalled();
    act(() => result.current.flush());
    expect(step).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(SHEET_HANDOFF_FALLBACK_MS * 2);
      result.current.flush();
    });
    expect(step).toHaveBeenCalledTimes(1);
  });

  it('falls back to a timer when the sheet never reports (Android / hosts without onDismiss)', () => {
    const { result } = renderHook(() => useSheetHandoff());
    const step = jest.fn();
    act(() => result.current.after(step));
    act(() => {
      jest.advanceTimersByTime(SHEET_HANDOFF_FALLBACK_MS - 1);
    });
    expect(step).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(step).toHaveBeenCalledTimes(1);
  });

  it('a newer step replaces an older one, and nothing runs after unmount', () => {
    const { result, unmount } = renderHook(() => useSheetHandoff());
    const first = jest.fn();
    const second = jest.fn();
    act(() => {
      result.current.after(first);
      result.current.after(second);
      result.current.flush();
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    const late = jest.fn();
    act(() => result.current.after(late));
    unmount();
    jest.advanceTimersByTime(SHEET_HANDOFF_FALLBACK_MS * 2);
    expect(late).not.toHaveBeenCalled();
  });
});
