/**
 * Bundled FALLBACKS for the legal links, and the legal version stamp sent with sign-up.
 *
 * The app reads the live values from the server (GET /api/config/, see services/appConfig.ts) so they
 * can change without a new build. There is deliberately NO bundled church admin email: if the server
 * has neither church_admin.email nor support_email, the contact screen shows its "not available" state.
 */
export const CHURCH_ADMIN_MAIL_SUBJECT = 'The Foyer help';

/**
 * Terms and Privacy pages used only when the config request has not returned (offline, endpoint not
 * deployed yet, nothing cached). They match the backend defaults. A server value of null hides the link.
 */
export const TERMS_URL = 'https://irlobby.com/terms';
export const PRIVACY_URL = 'https://irlobby.com/privacy';

/** Version strings sent as terms_version / privacy_version when someone accepts at sign-up. */
export const TERMS_VERSION = '2026-10-02';
export const PRIVACY_VERSION = '2026-10-02';
