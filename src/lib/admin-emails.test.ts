import { describe, it, expect } from 'vitest';
import { isKnownAdmin, KNOWN_ADMIN_EMAILS } from './admin-emails';

describe('Admin Emails Security Verification', () => {
  it('should identify known admin email correctly', () => {
    expect(isKnownAdmin('mapping.procimec2024@gmail.com')).toBe(true);
    expect(isKnownAdmin('MAPPING.PROCIMEC2024@GMAIL.COM')).toBe(true);
    expect(isKnownAdmin('  mapping.procimec2024@gmail.com  ')).toBe(true);
  });

  it('should reject non-admin emails', () => {
    expect(isKnownAdmin('operador@procimec.com')).toBe(false);
    expect(isKnownAdmin('attacker@evil.com')).toBe(false);
    expect(isKnownAdmin(null)).toBe(false);
    expect(isKnownAdmin(undefined)).toBe(false);
    expect(isKnownAdmin('')).toBe(false);
  });

  it('should contain official company email in known admins list', () => {
    expect(KNOWN_ADMIN_EMAILS).toContain('mapping.procimec2024@gmail.com');
  });
});
