/**
 * Visible product mode.
 *
 * Defaults to `foyer` (The Foyer). Set EXPO_PUBLIC_APP_MODE=irlobby to restore
 * ticket, door-scan, wallet, and payout UI. Screen files stay in the repo.
 */
export type AppMode = 'foyer' | 'irlobby';

export function readAppMode(): AppMode {
  const raw = (process.env.EXPO_PUBLIC_APP_MODE ?? 'foyer').trim().toLowerCase();
  return raw === 'irlobby' ? 'irlobby' : 'foyer';
}

export function isFoyerMode(): boolean {
  return readAppMode() === 'foyer';
}

/** Ticket, scan, wallet, and payout UI. Off in Foyer mode even if ticketing is enabled. */
export function isTicketingUiEnabled(ticketingEnabled: boolean): boolean {
  return Boolean(ticketingEnabled) && !isFoyerMode();
}
