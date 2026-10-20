import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/telemetry/route';
import { NextRequest } from 'next/server';
import { resetRateLimiter } from '@/lib/rate-limiter';

describe('POST /api/telemetry', () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it('should accept valid telemetry event payloads', async () => {
    const payload = {
      name: 'TestError',
      message: 'Failed to load CAD preview',
      route: '/tools/gsf-processor',
      timestamp: new Date().toISOString(),
    };

    const req = new NextRequest('https://procimec.com/api/telemetry', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '181.129.50.1',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.received).toBe(true);
  });

  it('should reject invalid or empty payloads with 400', async () => {
    const req = new NextRequest('https://procimec.com/api/telemetry', {
      method: 'POST',
      body: '',
      headers: {
        'x-forwarded-for': '181.129.50.2',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should enforce rate limiting on high-frequency error bursts', async () => {
    const clientIp = '190.25.10.99';
    const makeReq = () =>
      new NextRequest('https://procimec.com/api/telemetry', {
        method: 'POST',
        body: JSON.stringify({ message: 'Burst error' }),
        headers: { 'x-forwarded-for': clientIp },
      });

    // 60 allowed per minute
    for (let i = 0; i < 60; i++) {
      const res = await POST(makeReq());
      expect(res.status).toBe(200);
    }

    // 61st should be rate-limited with 429
    const blockedRes = await POST(makeReq());
    expect(blockedRes.status).toBe(429);
  });
});
