import React from 'react';
import { Switch as NativeSwitch } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { API_ROUTES } from '@shared/schema';
import { api } from '@services/apiClient';
import { FoyerProfileCard } from '../FoyerProfileCard';

let mockUser: Record<string, unknown>;
const mockRefresh = jest.fn().mockResolvedValue(undefined);

jest.mock('@services/appConfig', () => ({
  useAppConfig: () => ({ adminName: null, adminEmail: null, adminPhone: null, adminContactUrl: null, termsUrl: null, privacyUrl: null }),
}));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('@hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser, refreshProfile: mockRefresh }) }));
jest.mock('@services/apiClient', () => ({ api: { patch: jest.fn(), get: jest.fn().mockResolvedValue({ data: {} }) } }));
jest.mock('@foyer/mapLocation', () => ({
  useUseMyLocationSetting: () => ({ value: false, saving: false, error: false, update: jest.fn() }),
}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

const baseUser = { id: 1, email: 'anna@example.com', firstName: 'Anna', lastName: 'B', interests: [], photoAlbum: [], dateOfBirth: '1990-03-04' };

const renderCard = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <FoyerProfileCard />
    </QueryClientProvider>,
  );

const flat = (style: unknown) => Object.assign({}, ...(Array.isArray(style) ? style.flat(4) : [style]).filter(Boolean));

describe('Profile (frame 239) — Privacy and Birthday cards', () => {
  beforeEach(() => {
    mockUser = { ...baseUser, showBirthday: false };
    (api.patch as jest.Mock).mockReset().mockResolvedValue({ data: {} });
    (api.get as jest.Mock).mockClear();
  });

  it('has no "Use my location to find nearby gatherings" switch, no LOCATION section and never reads Settings', () => {
    renderCard();
    expect(screen.queryByText('Use my location to find nearby gatherings')).toBeNull();
    expect(screen.queryByLabelText('Use my location to find nearby gatherings')).toBeNull();
    expect(screen.queryByText('LOCATION')).toBeNull();
    expect(screen.queryByText('Never shown to other people.')).toBeNull();
    // The old card loaded GET /profile/ for preferences.privacy.locationSharing; nothing does now.
    expect(api.get).not.toHaveBeenCalledWith(API_ROUTES.USER_PROFILE);
  });

  it('Privacy card holds only "Use my location for maps" with its caption outside the card', () => {
    renderCard();
    expect(screen.getByText('PRIVACY')).toBeTruthy();
    expect(screen.getAllByText('Use my location for maps')).toHaveLength(1);
    expect(screen.getByText('Centers maps on you. Off by default; we never ask your phone for location unless this is on.')).toBeTruthy();
  });

  it('Birthday card: Birthday / March 4 (never the year), Show my birthday switch OFF, caption', () => {
    renderCard();
    expect(screen.getByText('BIRTHDAY')).toBeTruthy();
    expect(screen.getByText('March 4')).toBeTruthy();
    expect(screen.getByText('Others see month and day, never the year.')).toBeTruthy();
    const toggle = screen.getByLabelText('Show my birthday');
    expect(toggle.props.value).toBe(false);
    // No "Show my age" row (frame 240 is reference only).
    expect(screen.queryByText(/show my age/i)).toBeNull();
    // The Birthday card itself never prints the year (the account Birth date field above is private to you).
    expect(within(screen.getByTestId('birthday-card')).queryByText(/1990/)).toBeNull();
  });

  it('Show my birthday saves on its own with { show_birthday } and refreshes the profile', async () => {
    renderCard();
    await act(async () => {
      fireEvent(screen.getByLabelText('Show my birthday'), 'valueChange', true);
    });
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(API_ROUTES.USER_PROFILE, { show_birthday: true }));
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('snaps back with the error line when saving fails', async () => {
    (api.patch as jest.Mock).mockRejectedValue(new Error('offline'));
    renderCard();
    await act(async () => {
      fireEvent(screen.getByLabelText('Show my birthday'), 'valueChange', true);
    });
    expect(await screen.findByText("Couldn't update your birthday setting. Try again.")).toBeTruthy();
    expect(screen.getByLabelText('Show my birthday').props.value).toBe(false);
  });

  it('under 18: switch is disabled and off, label at 50%, caption says birthdays are hidden', () => {
    const born = new Date();
    mockUser = { ...baseUser, showBirthday: false, dateOfBirth: `${born.getFullYear() - 15}-01-02` };
    renderCard();
    const toggle = screen.getByLabelText('Show my birthday');
    expect(toggle.props.disabled).toBe(true);
    expect(toggle.props.value).toBe(false);
    expect(flat(screen.getByText('Show my birthday').props.style).opacity).toBe(0.5);
    expect(screen.getByText('Birthdays are hidden for members under 18.')).toBeTruthy();
    expect(screen.queryByText('Others see month and day, never the year.')).toBeNull();
  });

  it('hides the Birthday card when the profile payload does not carry show_birthday', () => {
    mockUser = { ...baseUser };
    renderCard();
    expect(screen.queryByText('BIRTHDAY')).toBeNull();
    expect(screen.queryByLabelText('Show my birthday')).toBeNull();
  });

  it('every switch on the Profile uses the visible OFF colours', () => {
    const view = renderCard();
    const switches = view.UNSAFE_getAllByType(NativeSwitch);
    expect(switches.length).toBeGreaterThanOrEqual(5);
    for (const native of switches) {
      expect(native.props.trackColor.false === '#857f7a' || native.props.trackColor.false === '#c9c3bf').toBe(true);
      expect(native.props.ios_backgroundColor === '#857f7a' || native.props.ios_backgroundColor === '#c9c3bf').toBe(true);
    }
  });

  it('visibility ladder radios use the 2pt #857f7a ring when unselected', () => {
    renderCard();
    const unselected = screen.getByLabelText('Friends');
    const ring = unselected.findAll((node) => flat(node.props.style).borderRadius === 11 && flat(node.props.style).width === 22)[0];
    expect(flat(ring.props.style)).toMatchObject({ borderColor: '#857f7a', borderWidth: 2, backgroundColor: '#ffffff' });
  });

  it('Save pill text is pure #ffffff', async () => {
    renderCard();
    fireEvent.changeText(screen.getByLabelText('Name'), 'Anna Banks');
    const label = screen.getByText('Save');
    expect(flat(label.props.style).color).toBe('#ffffff');
  });
});
