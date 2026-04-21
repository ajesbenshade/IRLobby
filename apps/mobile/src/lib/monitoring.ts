/**
 * Lightweight crash-reporting wrapper around `@sentry/react-native`.
 *
 * Designed to be safe to ship before the native dependency is installed and
 * before a DSN is configured. Both behaviours fall back to no-ops (or a
 * `console.error` for `captureException`) so the app boots cleanly in any
 * environment.
 */

let sentryInitialized = false;

type SentryModule = {
  init: (options: Record<string, unknown>) => void;
  captureException: (error: unknown, context?: Record<string, unknown>) => void;
  setUser?: (user: SentryUser | null) => void;
};

export type SentryUser = {
  id: string;
  email?: string;
  username?: string;
};

function loadSentry(): SentryModule | null {
  try {
    // Lazy require so the bundler doesn't fail when the package isn't installed yet.
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    const mod = require('@sentry/react-native') as SentryModule;
    return mod ?? null;
  } catch {
    return null;
  }
}

export function initMonitoring(): void {
  if (sentryInitialized) {
    return;
  }
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.info('[monitoring] Sentry disabled (no EXPO_PUBLIC_SENTRY_DSN)');
    }
    return;
  }
  const Sentry = loadSentry();
  if (!Sentry) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.info('[monitoring] Sentry SDK not installed — skipping init');
    }
    return;
  }
  try {
    Sentry.init({
      dsn,
      enableAutoSessionTracking: true,
      tracesSampleRate: 0.1,
      environment: __DEV__ ? 'development' : 'production',
    });
    sentryInitialized = true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[monitoring] Sentry.init failed', error);
  }
}

export function captureException(error: unknown, extra?: Record<string, unknown>): void {
  const Sentry = loadSentry();
  if (Sentry && sentryInitialized) {
    try {
      Sentry.captureException(error, extra ? { extra } : undefined);
      return;
    } catch {
      // fall through to console
    }
  }
  // eslint-disable-next-line no-console
  console.error('[monitoring] captureException', error, extra);
}

/**
 * Tag subsequent crash reports with the current user. Safe no-op when Sentry
 * is unavailable or hasn't been initialized.
 */
export function setUser(user: SentryUser): void {
  const Sentry = loadSentry();
  if (Sentry?.setUser && sentryInitialized) {
    try {
      Sentry.setUser(user);
    } catch {
      /* ignore */
    }
  }
}

/** Drop the user tag (e.g. on logout). */
export function clearUser(): void {
  const Sentry = loadSentry();
  if (Sentry?.setUser && sentryInitialized) {
    try {
      Sentry.setUser(null);
    } catch {
      /* ignore */
    }
  }
}
