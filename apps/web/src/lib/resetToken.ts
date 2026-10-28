/**
 * Pull a password-reset token out of whatever the user pasted: the bare code,
 * an https://irlobby.com/reset-password/<token> link, a ?token= link, or an
 * irlobby://reset-password/<token> deep link from older emails.
 */
export function extractResetToken(input: string | null | undefined): string {
  const value = (input ?? '').trim();
  if (!value) return '';

  const queryMatch = value.match(/[?&]token=([^&#\s]+)/);
  if (queryMatch) return safeDecode(queryMatch[1]);

  const pathMatch = value.match(/reset-password\/([^/?#\s]+)/);
  if (pathMatch) return safeDecode(pathMatch[1]);

  return value.replace(/\s+/g, '');
}

function safeDecode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}
