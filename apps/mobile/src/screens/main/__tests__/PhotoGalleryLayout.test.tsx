import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { PhotoGalleryScreen } from '../PhotoGalleryScreen';

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: { activityId: 12 } }),
}));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('@hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 1 } }) }));
jest.mock('@hooks/useSafeInsets', () => ({ useSafeInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) }));
jest.mock('@services/activityService', () => ({ fetchActivity: jest.fn() }));
jest.mock('@services/apiClient', () => ({ api: { post: jest.fn(), get: jest.fn() } }));
jest.mock('@foyer/photoDownload', () => ({
  ensureAddOnlyPermission: jest.fn(async () => 'granted'),
  savePhotosToLibrary: jest.fn(),
}));

const { fetchActivity } = jest.requireMock('@services/activityService') as { fetchActivity: jest.Mock };
const { savePhotosToLibrary } = jest.requireMock('@foyer/photoDownload') as { savePhotosToLibrary: jest.Mock };

const renderScreen = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <PhotoGalleryScreen />
    </QueryClientProvider>,
  );
};

const photos = [31, 32, 33].map((id) => ({ id, url: `https://example.com/${id}.jpg` }));
const flat = (node: { props: Record<string, any> }) => StyleSheet.flatten(node.props.style as never) as Record<string, any>;

describe('Photos page layout and safe areas', () => {
  beforeEach(() => {
    fetchActivity.mockReset();
    savePhotosToLibrary.mockReset();
    mockGoBack.mockReset();
    fetchActivity.mockResolvedValue({ id: 12, title: 'Game Night', host: { id: 1 }, my_rsvp: { status: 'confirmed' }, photos });
  });

  it('title is below the status bar and holds no buttons; Back, Download all and Select live in the bottom bar', async () => {
    const view = renderScreen();
    await view.findByText('Photos · 3');
    const header = view.getByTestId('photos-header');
    expect(flat(header).paddingTop).toBeGreaterThanOrEqual(47);
    // Nothing tappable inside the header.
    expect(header.findAll((node) => node.props.accessibilityRole === 'button')).toHaveLength(0);
    const bar = view.getByTestId('photo-bottom-bar');
    expect(bar.findAll((node) => node.props.accessibilityLabel === 'Back').length).toBeGreaterThan(0);
    expect(view.getByTestId('photo-download-all')).toBeTruthy();
    expect(view.getByTestId('photo-select')).toBeTruthy();
    fireEvent.press(view.getByTestId('photo-back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('scroll padding = bar height + bottom inset + 16', async () => {
    const view = renderScreen();
    await view.findByText('Photos · 3');
    const grid = view.getByTestId('photo-grid');
    expect(StyleSheet.flatten(grid.props.contentContainerStyle).paddingBottom).toBe(72 + 34 + 16);
  });

  it('select mode flow: Select, tap photos, Download (2), Select all', async () => {
    const view = renderScreen();
    await view.findByText('Photos · 3');
    fireEvent.press(view.getByTestId('photo-select'));
    fireEvent.press(view.getByLabelText('Photo 1 of 3'));
    fireEvent.press(view.getByLabelText('Photo 2 of 3'));
    expect(view.getByText('Download (2)')).toBeTruthy();
    fireEvent.press(view.getByTestId('photo-select-all'));
    expect(view.getByText('Download (3)')).toBeTruthy();
    fireEvent.press(view.getByTestId('photo-cancel'));
    expect(view.getByTestId('photo-select')).toBeTruthy();
  });

  it('empty gallery: Photos · 0, empty copy, Download all and Select disabled', async () => {
    fetchActivity.mockResolvedValue({ id: 12, title: 'Game Night', host: { id: 1 }, my_rsvp: { status: 'confirmed' }, photos: [] });
    const view = renderScreen();
    expect(await view.findByText('No photos yet')).toBeTruthy();
    expect(view.getByText('Photos · 0')).toBeTruthy();
    expect(view.getByText('Photos added by people who were at this gathering will show up here.')).toBeTruthy();
    expect(view.getByTestId('photo-download-all').props.accessibilityState.disabled).toBe(true);
    expect(view.getByTestId('photo-select').props.accessibilityState.disabled).toBe(true);
    expect(view.getByTestId('photo-back').props.accessibilityState.disabled).toBe(false);
  });

  it('failed download shows the banner above the bar and keeps Download all enabled', async () => {
    savePhotosToLibrary.mockRejectedValue(new Error('offline'));
    const view = renderScreen();
    await view.findByText('Photos · 3');
    fireEvent.press(view.getByTestId('photo-download-all'));
    await waitFor(() => expect(view.getByText("Couldn't download. Check your connection and try again.")).toBeTruthy());
    expect(flat(view.getByTestId('photo-failed-banner')).bottom).toBe(72 + 34 + 12);
    expect(view.getByTestId('photo-download-all').props.accessibilityState.disabled).toBe(false);
  });

  it('photo viewer header sits below the status bar', async () => {
    const view = renderScreen();
    fireEvent.press(await view.findByLabelText('Photo 2 of 3'));
    expect(flat(view.getByTestId('viewer-header')).paddingTop).toBeGreaterThanOrEqual(47);
  });
});
