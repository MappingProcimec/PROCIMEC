import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimiter, getClientIp } from './rate-limiter';

describe('rate-limiter', () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it('should allow requests within configured threshold', () => {
    const key = 'user_123';
    const limit = 3;
    const windowSec = 60;

    const r1 = checkRateLimit(key, limit, windowSec);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit(key, limit, windowSec);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit(key, limit, windowSec);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('should block requests exceeding the threshold with 429 semantics', () => {
    const key = 'ip_192.168.1.1';
    const limit = 2;
    const windowSec = 10;

    checkRateLimit(key, limit, windowSec);
    checkRateLimit(key, limit, windowSec);

    const blocked = checkRateLimit(key, limit, windowSec);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetSeconds).toBeGreaterThan(0);
    expect(blocked.resetSeconds).toBeLessThanOrEqual(10);
  });

  it('should maintain independent counters for distinct client keys', () => {
    const rA1 = checkRateLimit('client_A', 1, 60);
    const rB1 = checkRateLimit('client_B', 1, 60);

    expect(rA1.allowed).toBe(true);
    expect(rB1.allowed).toBe(true);

    const rA2 = checkRateLimit('client_A', 1, 60);
    const rB2 = checkRateLimit('client_B', 1, 60);

    expect(rA2.allowed).toBe(false);
    expect(rB2.allowed).toBe(false);
  });

  it('should extract client IP from x-forwarded-for header properly', () => {
    const req = new Request('https://procimec.com/api/test', {
      headers: {
        'x-forwarded-for': '200.118.50.12, 10.0.0.1',
      },
    });

    const ip = getClientIp(req);
    expect(ip).toBe('200.118.50.12');
  });

  it('should fallback to 127.0.0.1 when no proxy headers exist', () => {
    const req = new Request('https://procimec.com/api/test');
    const ip = getClientIp(req);
    expect(ip).toBe('127.0.0.1');
  });
});
