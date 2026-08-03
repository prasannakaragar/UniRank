/**
 * utils/media.js
 *
 * Resolves an uploaded-file path (e.g. "/api/static/uploads/xyz.png") into an
 * absolute URL pointing at the backend, since the frontend and backend are
 * deployed on different origins (Vercel + Render).
 *
 * In local dev, VITE_API_URL is typically unset (Vite proxies /api/* to
 * localhost:5001), so this falls back to the relative path, which the dev
 * proxy handles correctly.
 */
export function resolveMediaUrl(path) {
  if (!path) return ''
  // Already an absolute URL — pass through unchanged
  if (/^https?:\/\//i.test(path)) return path
  // Strip trailing /api (or /api/) from the env var to get the server origin
  const apiOrigin = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')
  return `${apiOrigin}${path}`
}
