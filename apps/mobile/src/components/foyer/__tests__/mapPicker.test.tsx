import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { MAP_COPY } from '@constants/foyerCopy';
import { MapLocationSettingRow } from '../MapLocationSettingRow';
import { MapPickerSheet } from '../MapPickerSheet';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('@hooks/useSafeInsets', () => ({ useSafeInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) }));
jest.mock('@components/MapViewCompat', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker' }));
jest.mock('@foyer/mapLocation', () => {
  const actual = jest.requireActual('@foyer/mapLocation');
  return { ...actual, useMapCenter: jest.fn(), useUseMyLocationSetting: jest.fn() };
});
const mapLocation = jest.requireMock('@foyer/mapLocation') as { useMapCenter: jest.Mock; useUseMyLocationSetting: jest.Mock; FRANCONIA_CENTER: object };

describe('map picker', () => {
  it('opens on Franconia with the caption chip, no recenter button, and the header below the status bar', async () => {
    mapLocation.useMapCenter.mockReturnValue({ center: mapLocation.FRANCONIA_CENTER, source: 'default', loading: false });
    const onChoose = jest.fn();
    const view = render(<MapPickerSheet visible onCancel={jest.fn()} onChoose={onChoose} />);
    expect(view.getByText('Choose a location')).toBeTruthy();
    expect(view.getByText(MAP_COPY.defaultCaption)).toBeTruthy();
    expect(view.queryByLabelText(MAP_COPY.recenter)).toBeNull();
    expect(view.queryByText('You are here')).toBeNull();
    const header = view.getByTestId('map-picker-header');
    const flat = Array.isArray(header.props.style) ? Object.assign({}, ...header.props.style.flat(3).filter(Boolean)) : header.props.style;
    expect(flat.paddingTop).toBeGreaterThanOrEqual(47);
    fireEvent.press(view.getByTestId('map-use-location'));
    await waitFor(() => expect(onChoose).toHaveBeenCalled());
    expect(onChoose.mock.calls[0][0]).toMatchObject({ latitude: expect.any(Number), longitude: expect.any(Number) });
  });

  it('opens on the home church with the church name and a church caption when location is off', () => {
    mapLocation.useMapCenter.mockReturnValue({ center: { latitude: 40.25, longitude: -75.38 }, source: 'church', loading: false });
    const view = render(
      <MapPickerSheet visible onCancel={jest.fn()} onChoose={jest.fn()} homeChurch={{ id: 7, name: 'Plains Mennonite Church', latitude: 40.25, longitude: -75.38 }} />,
    );
    expect(mapLocation.useMapCenter).toHaveBeenCalledWith(true, expect.objectContaining({ id: 7 }));
    expect(view.getByText(MAP_COPY.churchCaption)).toBeTruthy();
    expect(view.getByText('Plains Mennonite Church')).toBeTruthy();
    expect(view.queryByLabelText(MAP_COPY.recenter)).toBeNull();
    expect(view.queryByText('You are here')).toBeNull();
  });

  it('centered on the user: You are here + recenter, no caption chip', () => {
    mapLocation.useMapCenter.mockReturnValue({ center: { latitude: 40.3, longitude: -75.3 }, source: 'user', loading: false });
    const view = render(<MapPickerSheet visible onCancel={jest.fn()} onChoose={jest.fn()} />);
    expect(view.getByText('You are here')).toBeTruthy();
    expect(view.getByLabelText(MAP_COPY.recenter)).toBeTruthy();
    expect(view.queryByText(MAP_COPY.defaultCaption)).toBeNull();
  });

  it('does not mount (or resolve a location) while closed', () => {
    mapLocation.useMapCenter.mockClear();
    const view = render(<MapPickerSheet visible={false} onCancel={jest.fn()} onChoose={jest.fn()} />);
    expect(view.toJSON()).toBeNull();
    expect(mapLocation.useMapCenter).not.toHaveBeenCalled();
  });
});

describe('Use my location for maps row', () => {
  it('is off by default and saves through the local setting', async () => {
    const update = jest.fn();
    mapLocation.useUseMyLocationSetting.mockReturnValue({ value: false, saving: false, error: false, update });
    const view = render(<MapLocationSettingRow />);
    const toggle = view.getByLabelText('Use my location for maps');
    expect(toggle.props.value).toBe(false);
    expect(view.getByText(MAP_COPY.settingCaption)).toBeTruthy();
    await act(async () => {
      fireEvent(toggle, 'valueChange', true);
    });
    expect(update).toHaveBeenCalledWith(true);
  });

  it('shows a spinner while saving and the error line when the save failed', () => {
    mapLocation.useUseMyLocationSetting.mockReturnValue({ value: false, saving: true, error: false, update: jest.fn() });
    const saving = render(<MapLocationSettingRow />);
    expect(saving.queryByLabelText('Use my location for maps')).toBeNull();
    expect(saving.getByLabelText('Saving')).toBeTruthy();
    mapLocation.useUseMyLocationSetting.mockReturnValue({ value: false, saving: false, error: true, update: jest.fn() });
    const failed = render(<MapLocationSettingRow />);
    expect(failed.getByText("Couldn't update your location setting. Try again.")).toBeTruthy();
  });
});

describe('map picker label', () => {
  const { isUserDrag } = jest.requireActual('../MapPickerSheet') as { isUserDrag: (r: object, c: object, d?: object) => boolean };
  const center = { latitude: 40.2866, longitude: -75.3877 };

  it('does not geocode (or move the pin) for the initial region or the animate-to-center callback', () => {
    expect(isUserDrag(center, center)).toBe(false);
    expect(isUserDrag({ latitude: 40.28660004, longitude: -75.38770004 }, center)).toBe(false);
    expect(isUserDrag({ latitude: 40.5, longitude: -75.1 }, center, { isGesture: false })).toBe(false);
  });

  it('geocodes once the user actually drags', () => {
    expect(isUserDrag({ latitude: 40.29, longitude: -75.39 }, center)).toBe(true);
    expect(isUserDrag(center, center, { isGesture: true })).toBe(true);
  });

  it('keeps the fixed Franconia label when the initial region callback fires', async () => {
    mapLocation.useMapCenter.mockReturnValue({ center, source: 'default', loading: false });
    const view = render(<MapPickerSheet visible onCancel={jest.fn()} onChoose={jest.fn()} />);
    const map = view.UNSAFE_getByType('MapView' as never);
    await act(async () => {
      map.props.onRegionChangeComplete({ ...center, latitudeDelta: 0.05, longitudeDelta: 0.05 });
    });
    expect(view.getByText('Franconia, PA')).toBeTruthy();
  });
});
