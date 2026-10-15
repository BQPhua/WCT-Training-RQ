/**
 * True only for an `application/json` body. Browsers must preflight that type
 * cross-origin, so requiring it blocks form-style CSRF posts.
 */
export function isJsonContentType(header: string | null): boolean {
  return (header ?? "").split(";")[0].trim().toLowerCase() === "application/json";
}
