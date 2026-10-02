import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { MEMBER_COPY, PHOTO_COPY } from '@constants/foyerCopy';
import { PhotoGalleryScreen } from '../PhotoGalleryScreen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
  useRoute: () => ({ params: { activityId: 12 } }),
}));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('@hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 1 } }) }));
jest.mock('@services/activityService', () => ({ fetchActivity: jest.fn() }));
jest.mock('@services/foyerService', () => ({
  ...(jest.requireActual('@services/foyerService') as object),
  reportMember: jest.fn(),
}));
jest.mock('@services/apiClient', () => ({ api: { post: jest.fn(), get: jest.fn() } }));
jest.mock('@foyer/photoDownload', () => ({
  ensureAddOnlyPermission: jest.fn(async () => 'granted'),
  savePhotosToLibrary: jest.fn(),
}));

const { fetchActivity } = jest.requireMock('@services/activityService') as { fetchActivity: jest.Mock };
const { api } = jest.requireMock('@services/apiClient') as { api: { post: jest.Mock } };

const renderScreen = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <PhotoGalleryScreen />
    </QueryClientProvider>,
  );
};

describe('photo viewer and the report sheet', () => {
  beforeEach(() => {
    api.post.mockReset();
    fetchActivity.mockReset();
    fetchActivity.mockResolvedValue({
      id: 12,
      title: 'Family Game Night',
      host: { id: 9 },
      my_rsvp: { status: 'confirmed' },
      photos: [
        { id: 31, url: 'https://example.com/a.jpg' },
        { id: 32, url: 'https://example.com/b.jpg' },
      ],
    });
  });

  it('keeps the viewer open while the menu and report sheet are shown over it, and sends the photo report', async () => {
    api.post.mockResolvedValue({ data: { id: 1 } });
    renderScreen();
    fireEvent.press(await screen.findByLabelText('Photo 2 of 2'));
    expect(screen.getByText(PHOTO_COPY.viewerPosition(2, 2))).toBeTruthy();

    fireEvent.press(screen.getByTestId('photo-report'));
    // The menu sheet is up and the viewer (counter, close button) is still mounted underneath.
    expect(await screen.findByTestId('photo-report-row')).toBeTruthy();
    expect(screen.getByText(PHOTO_COPY.viewerPosition(2, 2))).toBeTruthy();
    expect(screen.getAllByLabelText('Close').length).toBeGreaterThanOrEqual(1);

    fireEvent.press(screen.getByTestId('photo-report-row'));
    expect(await screen.findByText(MEMBER_COPY.reportPhotoLead)).toBeTruthy();
    expect(screen.getByText(PHOTO_COPY.viewerPosition(2, 2))).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Spam or a fake account'));
    fireEvent.press(screen.getByLabelText(MEMBER_COPY.submitReport));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][0]).toBe('/api/activities/12/photos/32/report/');
  });
});
