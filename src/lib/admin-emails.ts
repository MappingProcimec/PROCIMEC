/**
 * Centralizes admin email detection.
 * Configure via env vars GOOGLE_DRIVE_ADMIN_EMAIL and ADMIN_EMAILS (comma-separated).
 */
export function isKnownAdmin(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase();

  const driveAdmin = process.env.GOOGLE_DRIVE_ADMIN_EMAIL;
  if (driveAdmin && normalized === driveAdmin.toLowerCase()) return true;

  const extras = process.env.ADMIN_EMAILS ?? '';
  return extras
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}
