/**
 * True when a form POST's `Origin` header is this app's own origin. Used where a
 * plain HTML form posts (no JSON preflight) so other sites can't post on a user's behalf.
 */
export function isSameOrigin(originHeader: string | null, appUrl: string): boolean {
  if (!originHeader) return false;
  try {
    return new URL(originHeader).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}
