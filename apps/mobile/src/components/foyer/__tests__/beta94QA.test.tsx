import fs from 'fs';
import path from 'path';
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { FoyerHeader } from '@components/FoyerHeader';
import { IrlobbyLoginMark } from '@components/IrlobbyLoginMark';
import { PICK_CHURCH_BUTTON_HEIGHT, PickChurchCard } from '@components/foyer/PickChurchCard';
import { ChurchPicker } from '@components/foyer/ChurchPicker';
import * as foyerCopy from '@constants/foyerCopy';
import { memberChurchHasWebsiteCalendar, memberChurchName, resetChurchNameCache } from '@foyer/churchName';
import { fetchChurches } from '@services/foyerService';

let mockUser: Record<string, unknown> | null = null;

jest.mock('@hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser, refreshProfile: jest.fn() }) }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('@services/apiClient', () => ({ api: { patch: jest.fn(), get: jest.fn() } }));
jest.mock('@services/foyerService', () => ({
  fetchChurches: jest.fn(async () => [
    { id: 3, name: 'Blooming Glen Mennonite' },
    { id: 4, name: 'Salford Mennonite' },
  ]),
}));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

const src = (rel: string) => fs.readFileSync(path.join(__dirname, '../../..', rel), 'utf8');
const wrap = (node: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
};

beforeEach(() => {
  jest.clearAllMocks();
  resetChurchNameCache();
  mockUser = null;
});

describe("M1: the member's own church under The Foyer", () => {
  it('memberChurchName uses church.name, else churchId in the list, else null (never Franconia)', () => {
    const list = [{ id: 4, name: 'Salford Mennonite' }];
    expect(memberChurchName({ church: { id: 4, name: ' Salford Mennonite ' }, churchId: 4 }, null)).toBe('Salford Mennonite');
    expect(memberChurchName({ church: null, churchId: 4 }, list)).toBe('Salford Mennonite');
    expect(memberChurchName({ church: null, churchId: 99 }, list)).toBeNull();
    expect(memberChurchName({ church: null, churchId: null }, list)).toBeNull();
    expect(memberChurchName(null)).toBeNull();
  });

  it("header shows the member's church name", () => {
    mockUser = { id: 1, church: { id: 3, name: 'Blooming Glen Mennonite' }, churchId: 3 };
    render(<FoyerHeader />);
    expect(screen.getByTestId('foyer-header-church').props.children).toBe('Blooming Glen Mennonite');
    expect(screen.queryByText('Franconia Mennonite Church')).toBeNull();
    expect(fetchChurches).not.toHaveBeenCalled();
  });

  it('header hides the line when no church is picked (frame 245)', () => {
    mockUser = { id: 1, church: null, churchId: null };
    render(<FoyerHeader />);
    expect(screen.getByText('The Foyer')).toBeTruthy();
    expect(screen.queryByTestId('foyer-header-church')).toBeNull();
    expect(screen.queryByText('Franconia Mennonite Church')).toBeNull();
  });

  it('header looks churchId up in the churches list when the profile has no name', async () => {
    mockUser = { id: 1, church: null, churchId: 4 };
    render(<FoyerHeader />);
    await waitFor(() => expect(screen.getByTestId('foyer-header-church').props.children).toBe('Salford Mennonite'));
    expect(fetchChurches).toHaveBeenCalledWith('');
  });

  it('signed-out login mark shows no church line in Foyer mode', () => {
    render(<IrlobbyLoginMark />);
    expect(screen.getByText('The Foyer')).toBeTruthy();
    expect(screen.queryByText('Franconia Mennonite Church')).toBeNull();
  });

  it('Discover header is bare Discover with no church subtitle, and Host-as uses the member church', () => {
    const discover = src('screens/main/DiscoverScreen.tsx');
    expect(discover).not.toMatch(/\|\| 'Franconia Mennonite Church'/);
    expect(discover).not.toMatch(/`From \$\{churchName\}`/);
    expect(discover).not.toMatch(/Upcoming gatherings/);
    expect(discover).toMatch(/PRAYER_COPY\.listTitle/);
    expect(discover).toMatch(/: 'Discover'/);
    expect(src('screens/main/FoyerHostForm.tsx')).not.toMatch(/Host as Franconia/);
    expect(src('components/FoyerProfileCard.tsx')).not.toMatch(/every Franconia gathering/);
  });
});

describe('church website calendar flag', () => {
  it('reads the profile church, or the churches-list entry for church_id', () => {
    expect(memberChurchHasWebsiteCalendar({ church: { id: 1, name: 'A', has_website_calendar: true }, churchId: 1 }, null)).toBe(true);
    expect(memberChurchHasWebsiteCalendar({ church: null, churchId: 5 }, [{ id: 5, name: 'B', has_website_calendar: true }])).toBe(true);
    expect(memberChurchHasWebsiteCalendar({ church: null, churchId: 5 }, [{ id: 5, name: 'B' }])).toBe(false);
    expect(memberChurchHasWebsiteCalendar({ church: null, churchId: null }, [{ id: 5, name: 'B', has_website_calendar: true }])).toBe(false);
  });

});

describe('nits', () => {
  it('N1: pick-church card buttons are 48pt', async () => {
    mockUser = { id: 1, church: null, churchId: null };
    wrap(<PickChurchCard surface="discover" />);
    await screen.findByTestId('pick-church-choose');
    expect(PICK_CHURCH_BUTTON_HEIGHT).toBe(48);
    for (const id of ['pick-church-choose', 'pick-church-not-now']) {
      expect(StyleSheet.flatten(screen.getByTestId(id).props.style).minHeight).toBe(48);
    }
  });

  it('N2: church list dividers start at the label, not the radio', async () => {
    wrap(<ChurchPicker selected={null} onSelect={jest.fn()} />);
    const label = await screen.findByTestId('church-option-label-3');
    expect(StyleSheet.flatten(label.props.style).borderBottomWidth).toBe(1);
    expect(StyleSheet.flatten(screen.getByTestId('church-option-3').props.style).borderBottomWidth).toBeUndefined();
    // Last row has no divider.
    expect(StyleSheet.flatten(screen.getByTestId('church-option-label-4').props.style).borderBottomWidth).toBeUndefined();
  });

  it('N4: a photo-limit error after posting opens the new gathering with sheet 248/249, not a system alert', () => {
    const form = src('screens/main/FoyerHostForm.tsx');
    expect(form).toMatch(/navigation\.navigate\('GatheringDetail', \{ activityId: saved\.id, photoNotice: photoProblem\.notice \}\)/);
    expect(form).not.toMatch(/Alert\.alert\(photoProblem\.title/);
  });

  it('M1b: the public-calendar note names no church site', () => {
    const { CALENDAR_ADDRESS_WARNING } = require('@foyer/logic') as typeof import('@foyer/logic');
    expect(CALENDAR_ADDRESS_WARNING).toBe(
      "Public gatherings appear on your church's website calendar, with their location, after a church admin approves them.",
    );
    expect(src('screens/main/FoyerHostForm.tsx')).toMatch(/\{CALENDAR_ADDRESS_WARNING\}/);
  });

  it("host form Place placeholder is Design's final wording", () => {
    const form = src('screens/main/FoyerHostForm.tsx');
    expect(form).toContain(`placeholder="Fellowship hall, a park, or someone's home."`);
    expect(form).not.toMatch(/Franconia Mennonite Church"/);
  });

  it('N5: the unspecced Profile welcome note is gone', () => {
    expect((foyerCopy as Record<string, unknown>).WELCOME_COPY).toBeUndefined();
    expect(src('screens/main/ProfileScreen.tsx')).not.toMatch(/foyer-welcome/);
  });
});
