/**
 * Bundled FALLBACKS for the church admin contact and the legal links.
 *
 * The app reads the live values from the server (GET /api/config/, see services/appConfig.ts) so they
 * can change without a new build; these constants are used when the request fails, the endpoint is not
 * deployed yet (404), or a field is missing. They are also what Aaron edits if the server has no value.
 *
 * PLACEHOLDER: TODO(Aaron) replace with the real church admin address or URL (also needed in the App Store metadata).
 */
export const CHURCH_ADMIN_CONTACT_URL = 'mailto:support@irlobby.com?subject=The%20Foyer%20help';

/** Address behind CHURCH_ADMIN_CONTACT_URL; shown as text next to the contact row. PLACEHOLDER (Aaron). */
export const CHURCH_ADMIN_EMAIL = 'support@irlobby.com';
export const CHURCH_ADMIN_MAIL_SUBJECT = 'The Foyer help';

/**
 * Terms and Privacy pages that were already in the app before the server config existed
 * (Login and Register). Server values win; these are the fallback.
 * NOTE: Webmaster's proposed placeholders were https://irlobby.com/terms and /privacy; the shipped
 * app already links the -of-service / -policy pages below, so those stay until the server says otherwise.
 */
export const TERMS_URL = 'https://irlobby.com/terms-of-service';
export const PRIVACY_URL = 'https://irlobby.com/privacy-policy';
