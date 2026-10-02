import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { discoverGoingButton, joinButtonFor } from '@foyer/approval';

import { SwipeActionButtons, swipeGoingColors, type GoingKind } from '../SwipeActionButtons';

const BURGUNDY = '#a2033f';
const GREY_FILL = '#e1dbd7';
const GREY_TEXT = '#7a7572';

type Row = { fill: string; text: string; border?: string; tappable: boolean };
const FILLED: Row = { fill: BURGUNDY, text: '#ffffff', tappable: true };
const GREY: Row = { fill: GREY_FILL, text: GREY_TEXT, tappable: false };

// Design frame 141, one row per state.
const cases: Array<{
  name: string;
  activity: Record<string, unknown>;
  full?: boolean;
  cancelled?: boolean;
  label: string;
  kind: GoingKind;
  row: Row;
}> = [
  { name: 'Request to join', activity: { my_request_status: 'none', requires_approval: true }, label: 'Request to join', kind: 'request', row: FILLED },
  { name: "I'm going", activity: { my_request_status: 'none' }, label: "I'm going", kind: 'join', row: FILLED },
  { name: 'Ask again', activity: { my_request_status: 'declined', allow_rerequest: true, requires_approval: true }, label: 'Ask again', kind: 'askAgain', row: { fill: '#ffffff', text: BURGUNDY, border: BURGUNDY, tappable: true } },
  { name: 'Request sent', activity: { my_request_status: 'pending', requires_approval: true }, label: 'Request sent', kind: 'sent', row: { fill: '#e9c9d3', text: '#7a1a3f', tappable: false } },
  { name: 'Closed', activity: { my_request_status: 'declined', allow_rerequest: false, requires_approval: true }, label: 'Registration closed', kind: 'closed', row: GREY },
  { name: 'Full', activity: { my_request_status: 'none', requires_approval: true }, full: true, label: 'This gathering is full', kind: 'full', row: GREY },
  { name: 'Cancelled', activity: { my_request_status: 'none' }, cancelled: true, label: 'This gathering was cancelled', kind: 'cancelled', row: GREY },
];

describe('Discover primary button: fill and label colour per state', () => {
  it.each(cases)('$name', ({ activity, full, cancelled, label, kind, row }) => {
    const join = joinButtonFor(activity as never, "I'm going");
    const going = discoverGoingButton({ join, full: Boolean(full), cancelled: Boolean(cancelled) });
    expect(going.kind).toBe(kind);

    const view = render(
      <SwipeActionButtons
        onPass={jest.fn()}
        onGoing={jest.fn()}
        goingLabel={going.label}
        goingDisabled={going.disabled}
        goingKind={going.kind}
      />,
    );
    const button = view.getByTestId('swipe-going');
    const style = StyleSheet.flatten(button.props.style);
    const text = StyleSheet.flatten(view.getByText(label).props.style);

    // The style is a plain object/array (never a callback), so the fill cannot be dropped at render time.
    expect(typeof button.props.style).not.toBe('function');
    expect(style.backgroundColor).toBe(row.fill);
    expect(text.color).toBe(row.text);
    expect(style.minHeight).toBe(54);
    if (row.border) {
      expect(style.borderColor).toBe(row.border);
      expect(style.borderWidth).toBe(1.6);
    }
    expect(button.props.accessibilityState.disabled).toBe(!row.tappable);
    // White text only ever sits on burgundy.
    expect(text.color === '#ffffff' ? style.backgroundColor : BURGUNDY).toBe(BURGUNDY);
  });

  it('Pass is 110pt wide, white with a 1.2pt warm-grey outline', () => {
    const view = render(<SwipeActionButtons onPass={jest.fn()} onGoing={jest.fn()} />);
    const style = StyleSheet.flatten(view.getByTestId('swipe-pass').props.style);
    expect(style.width).toBe(110);
    expect(style.backgroundColor).toBe('#ffffff');
    expect(style.borderColor).toBe('#c8beba');
    expect(style.borderWidth).toBe(1.2);
  });

  it('keeps the burgundy fill while an RSVP is in flight and while pressed', () => {
    const view = render(<SwipeActionButtons onPass={jest.fn()} onGoing={jest.fn()} goingLabel="Request to join" goingKind="request" disabled />);
    const style = StyleSheet.flatten(view.getByTestId('swipe-going').props.style);
    expect(style.backgroundColor).toBe(BURGUNDY);
    expect(style.opacity).toBe(0.5);

    const enabled = render(<SwipeActionButtons onPass={jest.fn()} onGoing={jest.fn()} goingLabel="Request to join" goingKind="request" />);
    fireEvent(enabled.getByTestId('swipe-going'), 'pressIn');
    expect(StyleSheet.flatten(enabled.getByTestId('swipe-going').props.style).backgroundColor).toBe('#870234');
    expect(swipeGoingColors('request', true).textColor).toBe('#ffffff');
  });
});

describe('discoverGoingButton', () => {
  const join = joinButtonFor({ my_request_status: 'none', requires_approval: true } as never, "I'm going");
  it('lets Cancelled win over Full, and Full win over the approval state', () => {
    expect(discoverGoingButton({ join, full: true, cancelled: true }).kind).toBe('cancelled');
    expect(discoverGoingButton({ join, full: true, cancelled: false }).kind).toBe('full');
    expect(discoverGoingButton({ join, full: false, cancelled: false })).toEqual({ kind: 'request', label: 'Request to join', disabled: false });
  });
});

// ---- Source guard: white label on a burgundy fill must never depend on a Pressable style callback ----
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === '__tests__' || name === 'node_modules') {
      return [];
    }
    return statSync(path).isDirectory() ? walk(path) : /\.tsx$/.test(name) ? [path] : [];
  });

describe('source guard: filled burgundy buttons', () => {
  const src = join(__dirname, '..', '..');
  const files = walk(src);
  // Legacy IRLobby-only screens and the studio screenshot tools are not Foyer UI.
  const ignored = [/vibeQuiz/, /screenshots/, /AuthSignInToast/, /ui\/Chip/];

  it('has no Pressable style callbacks on Foyer button components that draw a burgundy fill', () => {
    const offenders = files
      .filter((file) => !ignored.some((pattern) => pattern.test(file)))
      .filter((file) => {
        const text = readFileSync(file, 'utf8');
        return /style=\{\(\{ pressed \}\)/.test(text);
      })
      .map((file) => file.replace(src, ''));
    expect(offenders).toEqual([]);
  });
});
