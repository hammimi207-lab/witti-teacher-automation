/** Absolute public links; session redirects must stay on the requesting origin. */
export function getSiteUrl(): string {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim()
    || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://girok-fairy-v2.vercel.app");
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || url.pathname !== '/' || url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_APP_URL must be an HTTP(S) origin without a path or credentials.");
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS in production.");
  }
  return url.origin;
}
