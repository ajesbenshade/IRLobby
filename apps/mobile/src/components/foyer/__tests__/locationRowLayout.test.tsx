import React from 'react';
import { ActivityIndicator, Switch as NativeSwitch } from 'react-native';
import { render } from '@testing-library/react-native';

import { MAP_COPY } from '@constants/foyerCopy';
import { appColors } from '@theme/index';
import { MapLocationSettingRow } from '../MapLocationSettingRow';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('@foyer/mapLocation', () => ({ useUseMyLocationSetting: jest.fn() }));
const { useUseMyLocationSetting } = jest.requireMock('@foyer/mapLocation') as { useUseMyLocationSetting: jest.Mock };

const flat = (style: unknown) => Object.assign({}, ...(Array.isArray(style) ? style.flat(4) : [style]).filter(Boolean));

describe('Use my location for maps row (frame 144)', () => {
  beforeEach(() => {
    useUseMyLocationSetting.mockReturnValue({ value: false, saving: false, error: false, update: jest.fn() });
  });

  it('is one white 16pt-radius card, exactly 56pt tall (48 min + 4pt top and bottom), centred on one line', () => {
    const view = render(<MapLocationSettingRow />);
    const card = flat(view.getByTestId('location-row-card').props.style);
    expect(card).toMatchObject({
      backgroundColor: '#ffffff',
      borderRadius: 16,
      height: 56,
      minHeight: 56,
      paddingVertical: 4,
      alignItems: 'center',
      flexDirection: 'row',
    });
    expect(card.paddingBottom).toBeUndefined();
    expect(card.paddingLeft).toBe(16);
    expect(card.paddingRight).toBe(16);
  });

  it('label is 15.5pt medium; the switch is 51x31 with the 16pt right inset and shares the card centre line', () => {
    const view = render(<MapLocationSettingRow />);
    const label = flat(view.getByText(MAP_COPY.settingTitle).props.style);
    expect(label.fontSize).toBe(15.5);
    expect(label.fontFamily).toMatch(/medium/i);
    expect(label.paddingBottom).toBeUndefined();
    const native = view.UNSAFE_getByType(NativeSwitch);
    expect(flat(native.parent?.props.style)).toMatchObject({ width: 51, height: 31 });
    // 56 - 31 = 25 -> centred by alignItems, i.e. 28pt centre line for both children (no per-child margins).
    expect(flat(view.getByText(MAP_COPY.settingTitle).props.style).marginTop).toBeUndefined();
    expect(native.props.trackColor).toEqual({ false: '#857f7a', true: '#a2033f' });
  });

  it('puts the caption OUTSIDE and below the card: gray 12.5pt, 8pt gap, 20pt left inset', () => {
    const view = render(<MapLocationSettingRow />);
    const caption = view.getByText(MAP_COPY.settingCaption);
    const style = flat(caption.props.style);
    expect(style).toMatchObject({ fontSize: 12.5, marginTop: 8, paddingLeft: 20 });
    expect(style.color).toBe(appColors.mutedInk);
    const card = view.getByTestId('location-row-card');
    expect(card.findAll((node) => node === caption)).toHaveLength(0);
  });

  it('saving: a 22pt burgundy spinner replaces the switch in the same 51x31 slot', () => {
    useUseMyLocationSetting.mockReturnValue({ value: false, saving: true, error: false, update: jest.fn() });
    const view = render(<MapLocationSettingRow />);
    expect(view.UNSAFE_queryByType(NativeSwitch)).toBeNull();
    const spinner = view.UNSAFE_getByType(ActivityIndicator);
    expect(spinner.props.color).toBe('#a2033f');
    expect(flat(spinner.props.style)).toMatchObject({ width: 22, height: 22 });
    expect(flat(view.getByTestId('location-row-spinner-slot').props.style)).toMatchObject({ width: 51, height: 31 });
  });

  it('error box sits under the card and above the caption', () => {
    useUseMyLocationSetting.mockReturnValue({ value: false, saving: false, error: true, update: jest.fn() });
    const view = render(<MapLocationSettingRow />);
    const text = JSON.stringify(view.toJSON());
    expect(text.indexOf('location-row-card')).toBeLessThan(text.indexOf('location-row-error'));
    expect(text.indexOf('location-row-error')).toBeLessThan(text.indexOf(MAP_COPY.settingCaption));
  });

  it('error box matches frame 147: pink #fbe8ea, #ebc0c6 border, alert icon, bold dark-red #8a0a1f text', () => {
    useUseMyLocationSetting.mockReturnValue({ value: false, saving: false, error: true, update: jest.fn() });
    const view = render(<MapLocationSettingRow />);
    const box = flat(view.getByTestId('location-row-error').props.style);
    expect(box).toMatchObject({ backgroundColor: '#fbe8ea', borderColor: '#ebc0c6', borderWidth: 1, flexDirection: 'row' });
    expect(view.UNSAFE_getByType('MaterialCommunityIcons' as never).props).toMatchObject({ name: 'alert-circle-outline', color: '#8a0a1f' });
    const text = flat(view.getByText(MAP_COPY.settingError).props.style);
    expect(text.color).toBe('#8a0a1f');
    expect(String(text.fontWeight)).toBe('700');
  });
});
