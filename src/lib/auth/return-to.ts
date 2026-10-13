import { BASE_PATH } from "@/lib/env";

/** Only same-app relative paths are allowed as post-login destinations (no open redirects). */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/dashboard";
  let path = value;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) path = path.slice(BASE_PATH.length) || "/dashboard";
  return path;
}
