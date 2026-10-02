import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  APP_CONFIG_CACHE_KEY,
  APP_CONFIG_PATH,
  BUNDLED_APP_CONFIG,
  getAppConfig,
  openLegalLink,
  refreshAppConfig,
  resetAppConfigForTests,
  resolveAppConfig,
} from '../appConfig';

jest.mock('../apiClient', () => ({ api: { get: jest.fn() } }));
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItem: jest.fn(async (key: string) => store.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => void store.set(key, value)),
    removeItem: jest.fn(async (key: string) => void store.delete(key)),
  };
});

const { api } = jest.requireMock('../apiClient') as { api: { get: jest.Mock } };
const store = (AsyncStorage as unknown as { __store: Map<string, string> }).__store;

describe('app config', () => {
  beforeEach(() => {
    api.get.mockReset();
    store.clear();
    resetAppConfigForTests();
  });

  it('uses the single endpoint constant', () => {
    expect(APP_CONFIG_PATH).toBe('/api/config/');
  });

  it('falls back to bundled values when the endpoint is missing (404) or offline, silently', async () => {
    api.get.mockRejectedValueOnce({ response: { status: 404 } });
    await expect(refreshAppConfig({ force: true })).resolves.toEqual(BUNDLED_APP_CONFIG);
    api.get.mockRejectedValueOnce(new Error('Network Error'));
    await expect(refreshAppConfig({ force: true })).resolves.toEqual(BUNDLED_APP_CONFIG);
    expect(getAppConfig()).toEqual(BUNDLED_APP_CONFIG);
  });

  it('overrides admin contact and legal links from the server', async () => {
    api.get.mockResolvedValue({
      data: {
        terms_url: 'https://example.org/terms',
        privacy_url: 'https://example.org/privacy',
        church_admin: { name: 'Pastor Sam', email: 'admin@church.org', phone: '555-0100' },
      },
    });
    const config = await refreshAppConfig({ force: true });
    expect(config).toMatchObject({
      adminName: 'Pastor Sam',
      adminEmail: 'admin@church.org',
      adminPhone: '555-0100',
      termsUrl: 'https://example.org/terms',
      privacyUrl: 'https://example.org/privacy',
    });
    expect(config.adminContactUrl.startsWith('mailto:admin@church.org')).toBe(true);
    expect(getAppConfig().adminEmail).toBe('admin@church.org');
  });

  it('reads the admin email from church_admin, then support_email, then the bundled constant', () => {
    expect(resolveAppConfig({ church_admin: { email: 'a@b.org' }, support_email: 'help@b.org' }).adminEmail).toBe('a@b.org');
    expect(resolveAppConfig({ church_admin: null, support_email: 'help@b.org' }).adminEmail).toBe('help@b.org');
    expect(resolveAppConfig({ church_admin: { email: null }, support_email: null }).adminEmail).toBe(BUNDLED_APP_CONFIG.adminEmail);
    expect(resolveAppConfig({}).adminContactUrl).toBe(BUNDLED_APP_CONFIG.adminContactUrl);
  });

  it('keeps bundled values for null, partial, malformed or non-https fields', () => {
    expect(resolveAppConfig({ terms_url: 'http://insecure.example/terms', privacy_url: 'javascript:alert(1)' })).toMatchObject({
      termsUrl: BUNDLED_APP_CONFIG.termsUrl,
      privacyUrl: BUNDLED_APP_CONFIG.privacyUrl,
    });
    expect(resolveAppConfig({ church_admin: { email: 'not an email' } }).adminEmail).toBe(BUNDLED_APP_CONFIG.adminEmail);
    expect(resolveAppConfig(null)).toEqual(BUNDLED_APP_CONFIG);
    expect(resolveAppConfig({ terms_url: 'https://example.org/t' }).privacyUrl).toBe(BUNDLED_APP_CONFIG.privacyUrl);
  });

  it('caches the last good value for an hour and does not refetch inside the TTL', async () => {
    api.get.mockResolvedValue({ data: { terms_url: 'https://example.org/terms' } });
    await refreshAppConfig({ now: 1_000 });
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(store.has(APP_CONFIG_CACHE_KEY)).toBe(true);

    resetAppConfigForTests();
    const cached = await refreshAppConfig({ now: 1_000 + 60_000 });
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(cached.termsUrl).toBe('https://example.org/terms');

    resetAppConfigForTests();
    await refreshAppConfig({ now: 1_000 + 2 * 60 * 60 * 1000 });
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('keeps the stale cache when the refetch fails', async () => {
    api.get.mockResolvedValueOnce({ data: { privacy_url: 'https://example.org/privacy' } });
    await refreshAppConfig({ now: 0 });
    resetAppConfigForTests();
    api.get.mockRejectedValueOnce({ response: { status: 500 } });
    const config = await refreshAppConfig({ now: 10 * 60 * 60 * 1000 });
    expect(config.privacyUrl).toBe('https://example.org/privacy');
  });

  it('only opens https legal links', async () => {
    const { Linking } = jest.requireActual('react-native') as typeof import('react-native');
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await openLegalLink('http://nope.example');
    expect(spy).not.toHaveBeenCalled();
    await openLegalLink('https://example.org/terms');
    expect(spy).toHaveBeenCalledWith('https://example.org/terms');
    spy.mockRestore();
  });
});
