import fs from 'fs';
import path from 'path';

import React from 'react';
import { Switch as NativeSwitch } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { Checkbox, Radio, checkboxBoxStyle, radioRingStyle } from '../Choice';
import { Switch, switchColors } from '../Switch';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

const flat = (style: unknown) => Object.assign({}, ...(Array.isArray(style) ? style.flat(4) : [style]).filter(Boolean));

describe('shared Switch (frame 237)', () => {
  it('OFF track #857f7a, ON track #a2033f, white thumb, iOS background #857f7a', () => {
    expect(switchColors(false)).toEqual({
      trackColor: { false: '#857f7a', true: '#a2033f' },
      thumbColor: '#ffffff',
      ios_backgroundColor: '#857f7a',
    });
  });

  it('disabled: OFF track #c9c3bf, ON track burgundy at 50%', () => {
    expect(switchColors(true)).toEqual({
      trackColor: { false: '#c9c3bf', true: 'rgba(162, 3, 63, 0.5)' },
      thumbColor: '#ffffff',
      ios_backgroundColor: '#c9c3bf',
    });
  });

  it('renders the native switch with those colours in a 51 x 31 box and forwards the change', () => {
    const onValueChange = jest.fn();
    const view = render(<Switch accessibilityLabel="Require approval" value={false} onValueChange={onValueChange} />);
    const native = view.UNSAFE_getByType(NativeSwitch);
    expect(native.props.trackColor).toEqual({ false: '#857f7a', true: '#a2033f' });
    expect(native.props.thumbColor).toBe('#ffffff');
    expect(native.props.ios_backgroundColor).toBe('#857f7a');
    expect(native.props.value).toBe(false);
    expect(flat(native.props.style).elevation).toBe(1);
    const box = flat(native.parent?.props.style);
    expect(box).toMatchObject({ width: 51, height: 31 });
    fireEvent(view.getByLabelText('Require approval'), 'valueChange', true);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('disabled switch uses the pale OFF track and is not interactive', () => {
    const view = render(<Switch accessibilityLabel="Phone" value={false} disabled />);
    const native = view.UNSAFE_getByType(NativeSwitch);
    expect(native.props.disabled).toBe(true);
    expect(native.props.trackColor.false).toBe('#c9c3bf');
  });
});

describe('shared Checkbox and Radio (frame 237)', () => {
  it('unchecked checkbox: white fill, 2pt #857f7a border (was 1.5pt #aaa29e)', () => {
    expect(checkboxBoxStyle(false)).toEqual({ backgroundColor: '#ffffff', borderColor: '#857f7a', borderWidth: 2 });
    expect(checkboxBoxStyle(true)).toMatchObject({ backgroundColor: '#a2033f', borderColor: '#a2033f' });
    const view = render(<Checkbox checked={false} testID="box" />);
    expect(flat(view.getByTestId('box').props.style)).toMatchObject({ borderWidth: 2, borderColor: '#857f7a', backgroundColor: '#ffffff', width: 22, height: 22 });
  });

  it('checked checkbox shows a white tick on burgundy', () => {
    const view = render(<Checkbox checked testID="box" />);
    expect(flat(view.getByTestId('box').props.style)).toMatchObject({ backgroundColor: '#a2033f' });
    expect(view.UNSAFE_getByType('MaterialCommunityIcons' as never).props.color).toBe('#ffffff');
  });

  it('unselected radio: 2pt #857f7a ring on white, same 22pt circle as selected (no layout shift)', () => {
    expect(radioRingStyle(false)).toEqual({ backgroundColor: '#ffffff', borderColor: '#857f7a', borderWidth: 2 });
    expect(radioRingStyle(true)).toMatchObject({ borderColor: '#a2033f', borderWidth: 2 });
    const off = render(<Radio selected={false} testID="r" />);
    const on = render(<Radio selected testID="r" />);
    const a = flat(off.getByTestId('r').props.style);
    const b = flat(on.getByTestId('r').props.style);
    expect([a.width, a.height, a.borderRadius, a.borderWidth]).toEqual([22, 22, 11, 2]);
    expect([b.width, b.height, b.borderRadius, b.borderWidth]).toEqual([22, 22, 11, 2]);
  });
});

/** Source scan: nothing may bring back a one-off Switch, checkbox box or radio ring. */
const SRC = path.resolve(__dirname, '../../..');
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' || entry.name === 'node_modules' ? [] : walk(full);
    }
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [full] : [];
  });
const files = walk(SRC).map((file) => ({ file: path.relative(SRC, file), text: fs.readFileSync(file, 'utf8') }));

describe('no stray Switch / checkbox / radio implementations', () => {
  it('only components/foyer/Switch.tsx imports Switch from react-native or react-native-paper', () => {
    const offenders = files
      .filter(({ file }) => file !== path.join('components', 'foyer', 'Switch.tsx'))
      .filter(({ text }) => {
        const imports = text.match(/import\s*\{[^}]*\}\s*from\s*'(react-native|react-native-paper)'/g) ?? [];
        return imports.some((statement) => /\bSwitch\b/.test(statement.replace(/\bSwitch as \w+/, 'Switch')));
      })
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('no <Switch> sets its own trackColor / thumbColor', () => {
    const offenders = files.filter(({ file, text }) => file !== path.join('components', 'foyer', 'Switch.tsx') && /<Switch[^>]*(trackColor|thumbColor)/s.test(text)).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('every file that renders <Switch> imports the shared one', () => {
    const users = files.filter(({ text }) => /<Switch[\s>]/.test(text));
    expect(users.length).toBeGreaterThan(5);
    for (const { file, text } of users) {
      expect([file, /from '@components\/foyer\/Switch'/.test(text) || file === path.join('components', 'foyer', 'Switch.tsx')]).toEqual([file, true]);
    }
  });

  it('checkbox and radio indicators come from the shared Choice component (no 1.5pt #aaa29e / #cec8c4 ring)', () => {
    const roleFiles = files.filter(({ text }) => /accessibilityRole="(checkbox|radio)"/.test(text));
    expect(roleFiles.length).toBeGreaterThan(3);
    for (const { file, text } of roleFiles) {
      if (/accessibilityRole="checkbox"/.test(text)) {
        expect([file, /<Checkbox\b/.test(text)]).toEqual([file, true]);
      }
      if (/accessibilityRole="radio"/.test(text) && /styles\.radio\b|<Radio\b/.test(text)) {
        expect([file, /<Radio\b/.test(text)]).toEqual([file, true]);
      }
    }
    for (const { file, text } of files) {
      if (file === path.join('components', 'foyer', 'Choice.tsx')) {
        continue;
      }
      expect([file, /#aaa29e/i.test(text)]).toEqual([file, false]);
      expect([file, /radio:\s*\{[^}]*#cec8c4/.test(text)]).toEqual([file, false]);
    }
  });
});
