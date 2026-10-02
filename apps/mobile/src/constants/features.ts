/**
 * Feature switches for Foyer features whose backend is not deployed everywhere yet.
 *
 *   'auto' (default) - the UI appears only when the live API's activity payload proves the
 *                      backend supports it (see `@foyer/capabilities`). With today's API
 *                      nothing new is visible.
 *   'on'             - force the UI on (use once the backend is live, or for a demo build).
 *   'off'            - force the UI off.
 *
 * To flip without a code change set EXPO_PUBLIC_FOYER_HOST_CANCEL / EXPO_PUBLIC_FOYER_REQUIRE_APPROVAL
 * to `on`, `off` or `auto` at build time.
 */
export type FeatureSwitch = 'auto' | 'on' | 'off';

const readSwitch = (raw: string | undefined, fallback: FeatureSwitch): FeatureSwitch => {
  const value = raw?.trim().toLowerCase();
  return value === 'on' || value === 'off' || value === 'auto' ? value : fallback;
};

export const FEATURES: {
  hostCancel: FeatureSwitch;
  requireApproval: FeatureSwitch;
  householdEdit: FeatureSwitch;
  birthdays: FeatureSwitch;
} = {
  /** "Cancel this gathering" (backend PR #36: POST /api/activities/<id>/cancel-event/). */
  hostCancel: readSwitch(process.env.EXPO_PUBLIC_FOYER_HOST_CANCEL, 'auto'),
  /** Require approval: host toggles, request-to-join, Requests deck. */
  requireApproval: readSwitch(process.env.EXPO_PUBLIC_FOYER_REQUIRE_APPROVAL, 'auto'),
  /**
   * Edit family member and `Add day` on legacy month/year rows (PATCH /api/users/household/<id>/, Backend is adding it).
   * `auto` probes the endpoint with a side-effect-free OPTIONS request and shows the UI only if PATCH is allowed.
   */
  householdEdit: readSwitch(process.env.EXPO_PUBLIC_FOYER_HOUSEHOLD_EDIT, 'auto'),
  /**
   * Birthday sharing (own `Show my birthday`, `Birthdays this week`, wishes/cards/push, child `Show on my profile`).
   * OFF until Aaron answers the privacy questions. Never `auto`: the UI stays hidden even if the backend has the endpoints.
   * `on` additionally needs the endpoint or field to exist (see `@foyer/birthdays`).
   */
  birthdays: readSwitch(process.env.EXPO_PUBLIC_FOYER_BIRTHDAYS, 'off') === 'on' ? 'on' : 'off',
};
