import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { FoyerProfileCard } from '../FoyerProfileCard';

type Cfg = {
  adminName: string | null;
  adminEmail: string | null;
  adminPhone: string | null;
  adminContactUrl: string | null;
  termsUrl: string | null;
  privacyUrl: string | null;
};
let mockConfig: Cfg;

jest.mock('@services/appConfig', () => ({ useAppConfig: () => mockConfig }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser, refreshProfile: jest.fn() }),
}));
jest.mock('@services/apiClient', () => ({ api: { patch: jest.fn(), get: jest.fn().mockResolvedValue({ data: {} }) } }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

const mockUser = { id: 1, email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace', interests: [] as string[], photoAlbum: [] as string[] };

const renderCard = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <FoyerProfileCard />
    </QueryClientProvider>,
  );

describe('FoyerProfileCard church contact and legal rows', () => {
  it('shows the "not available" state, no card and no email button when the config has no email', () => {
    mockConfig = { adminName: null, adminEmail: null, adminPhone: null, adminContactUrl: null, termsUrl: 'https://irlobby.com/terms', privacyUrl: 'https://irlobby.com/privacy' };
    renderCard();
    expect(screen.getByText("Contact details aren't available right now. Please try again later.")).toBeTruthy();
    expect(screen.queryByTestId('church-contact-card')).toBeNull();
    expect(screen.queryByTestId('email-admins')).toBeNull();
    expect(screen.getByLabelText('Terms of Use')).toBeTruthy();
    expect(screen.getByLabelText('Privacy Policy')).toBeTruthy();
    expect(screen.getByLabelText('Delete account')).toBeTruthy();
  });

  it('shows the card and the email button from the config, and hides a legal row whose URL is null', () => {
    mockConfig = {
      adminName: 'Pastor Rob',
      adminEmail: 'rob@church.org',
      adminPhone: null,
      adminContactUrl: 'mailto:rob@church.org?subject=The%20Foyer%20help',
      termsUrl: null,
      privacyUrl: 'https://irlobby.com/privacy',
    };
    renderCard();
    expect(screen.getByTestId('church-contact-card')).toBeTruthy();
    expect(screen.getByText('rob@church.org')).toBeTruthy();
    expect(screen.getByTestId('email-admins')).toBeTruthy();
    expect(screen.queryByText("Contact details aren't available right now. Please try again later.")).toBeNull();
    expect(screen.queryByLabelText('Terms of Use')).toBeNull();
    expect(screen.getByLabelText('Privacy Policy')).toBeTruthy();
  });
});
