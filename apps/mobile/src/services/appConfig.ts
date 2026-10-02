import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Linking } from 'react-native';

import { CHURCH_ADMIN_MAIL_SUBJECT, PRIVACY_URL, TERMS_URL } from '@constants/churchAdmin';
import { parseHttpsUrl } from '@utils/safeUrl';

import { api } from './apiClient';

/**
 * Server-driven app config: GET /api/config/ (unauthenticated).
 *
 *   { terms_url, privacy_url, support_email, church_admin: { name, email, phone } | null }
 *
 * Every field may be null or missing.
 * - Admin email: church_admin.email, then support_email, then nothing (no bundled address; the contact
 *   screen shows its "not available" state and hides the email button).
 * - Terms / Privacy URLs: a server value wins; an explicit null (or a non-https value) means "hide the link";
 *   a field that is absent because the request never succeeded falls back to the bundled defaults.
 * A 404 (endpoint not deployed yet) or a network error is silent.
 */
export const APP_CONFIG_PATH = '/api/config/';
export const APP_CONFIG_CACHE_KEY = '@irlobby/app-config/v1';
/** Short TTL: refetch at most once an hour per launch. A stale cache is still used when offline. */
export const APP_CONFIG_TTL_MS = 60 * 60 * 1000;

export type AppConfigPayload = {
  church_admin?: { name?: unknown; email?: unknown; phone?: unknown } | null;
  terms_url?: unknown;
  privacy_url?: unknown;
  support_email?: unknown;
};

export type ResolvedAppConfig = {
  adminName: string | null;
  /** null when the server has neither church_admin.email nor support_email. */
  adminEmail: string | null;
  adminPhone: string | null;
  /** mailto: link for the contact button (built from the email); null when there is no email. */
  adminContactUrl: string | null;
  /** null hides the row / makes the sign-up words plain text. */
  termsUrl: string | null;
  privacyUrl: string | null;
};

export const BUNDLED_APP_CONFIG: ResolvedAppConfig = {
  adminName: null,
  adminEmail: null,
  adminPhone: null,
  adminContactUrl: null,
  termsUrl: TERMS_URL,
  privacyUrl: PRIVACY_URL,
};

const EMAIL_PATTERN = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** Only https links are accepted from the server. */
const httpsUrl = (value: unknown): string | null => {
  const candidate = text(value);
  return candidate && parseHttpsUrl(candidate) ? candidate : null;
};

/** A url field: absent -> bundled default; present -> the https value, or null (hide) when null/invalid. */
const urlField = (payload: AppConfigPayload | null | undefined, key: 'terms_url' | 'privacy_url', fallback: string): string | null => {
  if (!payload || typeof payload !== 'object' || !(key in payload) || payload[key] === undefined) {
    return fallback;
  }
  return httpsUrl(payload[key]);
};

/** Merge a (possibly partial or junk) server payload over the bundled defaults, field by field. */
export const resolveAppConfig = (payload: AppConfigPayload | null | undefined): ResolvedAppConfig => {
  const admin = payload && typeof payload === 'object' ? payload.church_admin : null;
  const validEmailOf = (value: unknown): string | null => {
    const candidate = text(value);
    return candidate && EMAIL_PATTERN.test(candidate) ? candidate : null;
  };
  const validEmail = validEmailOf(admin?.email) ?? validEmailOf(payload?.support_email);
  return {
    adminName: text(admin?.name) ?? BUNDLED_APP_CONFIG.adminName,
    adminEmail: validEmail,
    adminPhone: text(admin?.phone) ?? BUNDLED_APP_CONFIG.adminPhone,
    adminContactUrl: validEmail
      ? `mailto:${validEmail}?subject=${encodeURIComponent(CHURCH_ADMIN_MAIL_SUBJECT)}`
      : null,
    termsUrl: urlField(payload, 'terms_url', BUNDLED_APP_CONFIG.termsUrl as string),
    privacyUrl: urlField(payload, 'privacy_url', BUNDLED_APP_CONFIG.privacyUrl as string),
  };
};

type Cached = { savedAt: number; payload: AppConfigPayload };

let current: ResolvedAppConfig = BUNDLED_APP_CONFIG;
let inflight: Promise<ResolvedAppConfig> | null = null;
const listeners = new Set<() => void>();

const publish = (next: ResolvedAppConfig) => {
  current = next;
  listeners.forEach((listener) => listener());
};

/** The config as currently known (bundled until the first good fetch or cache read). */
export const getAppConfig = (): ResolvedAppConfig => current;

const readCache = async (): Promise<Cached | null> => {
  try {
    const raw = await AsyncStorage.getItem(APP_CONFIG_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Cached) : null;
    return parsed && typeof parsed.savedAt === 'number' && parsed.payload ? parsed : null;
  } catch {
    return null;
  }
};

const writeCache = async (payload: AppConfigPayload, now: number) => {
  try {
    await AsyncStorage.setItem(APP_CONFIG_CACHE_KEY, JSON.stringify({ savedAt: now, payload } satisfies Cached));
  } catch {
    // Cache is best effort.
  }
};

/**
 * Loads the config: fresh cache wins (no request); otherwise fetch, cache the last good value, publish.
 * Never throws. On any failure the cached value (even stale) or the bundled fallback stays in place.
 * Call on app start and before sign-up (`force` skips the TTL).
 */
export const refreshAppConfig = async (options: { force?: boolean; now?: number } = {}): Promise<ResolvedAppConfig> => {
  if (inflight) {
    return inflight;
  }
  const now = options.now ?? Date.now();
  inflight = (async () => {
    const cached = await readCache();
    if (cached) {
      publish(resolveAppConfig(cached.payload));
      if (!options.force && now - cached.savedAt < APP_CONFIG_TTL_MS) {
        return current;
      }
    }
    try {
      const response = await api.get<AppConfigPayload>(APP_CONFIG_PATH);
      const data = response?.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        await writeCache(data, now);
        publish(resolveAppConfig(data));
      }
    } catch {
      // 404 (not deployed), offline, 5xx: silent. Cached or bundled values stay.
    }
    return current;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
};

/** Test helper: back to bundled values with no listeners. */
export const resetAppConfigForTests = () => {
  current = BUNDLED_APP_CONFIG;
  inflight = null;
  listeners.clear();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Screens read the admin contact and legal links from here; they update when the fetch lands. */
export const useAppConfig = (): ResolvedAppConfig => useSyncExternalStore(subscribe, getAppConfig, getAppConfig);

/** Opens a Terms / Privacy link in the system browser. Only https links open. */
export const openLegalLink = (url: string): Promise<void> => {
  if (!parseHttpsUrl(url)) {
    return Promise.resolve();
  }
  return Linking.openURL(url).catch(() => undefined);
};
