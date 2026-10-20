import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/hseq/generate/route';
import { NextRequest } from 'next/server';
import { resetRateLimiter } from '@/lib/rate-limiter';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue(null), // Simulando no autenticado por defecto
}));

describe('POST /api/hseq/generate', () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it('should reject unauthenticated requests with 403', async () => {
    const req = new NextRequest('https://procimec.com/api/hseq/generate', {
      method: 'POST',
      body: JSON.stringify({ templateFileId: 'FOR-HSEQ-024' }),
      headers: {
        'x-forwarded-for': '186.84.1.20',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('No autorizado');
  });

  it('should enforce rate limit of 15 requests per minute', async () => {
    const clientIp = '186.84.1.99';
    const makeReq = () =>
      new NextRequest('https://procimec.com/api/hseq/generate', {
        method: 'POST',
        body: JSON.stringify({ templateFileId: 'FOR-HSEQ-024' }),
        headers: { 'x-forwarded-for': clientIp },
      });

    // Run 15 times
    for (let i = 0; i < 15; i++) {
      const res = await POST(makeReq());
      // Expect 403 since not authenticated, but allowed through rate limiter
      expect(res.status).toBe(403);
    }

    // 16th time should hit rate limiter with 429
    const blocked = await POST(makeReq());
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeDefined();
  });
});
