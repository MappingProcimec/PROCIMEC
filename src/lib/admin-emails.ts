export const KNOWN_ADMIN_EMAILS = ['mapping.procimec2024@gmail.com'];

/**
 * Centralizes admin email detection.
 * Configure via env vars ADMIN_PRIMARY_EMAIL, GOOGLE_DRIVE_ADMIN_EMAIL and ADMIN_EMAILS (comma-separated).
 */
export function isKnownAdmin(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();

  if (KNOWN_ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(normalized)) return true;

  const primaryAdmin = process.env.ADMIN_PRIMARY_EMAIL || process.env.GOOGLE_DRIVE_ADMIN_EMAIL || 'mapping.procimec2024@gmail.com';
  if (normalized === primaryAdmin.trim().toLowerCase()) return true;

  const extras = process.env.ADMIN_EMAILS ?? '';
  return extras
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}
