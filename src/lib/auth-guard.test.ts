import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAuth } from './auth-guard';
import { getServerSession } from 'next-auth';
import { createAdminClient } from './supabase';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}));

vi.mock('./supabase', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('./admin-emails', () => ({
  isKnownAdmin: vi.fn((email: string) => email === 'admin@procimec.com'),
}));

describe('requireAuth Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe rechazar con 401 si no hay sesión activa', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const { errorResponse, ctx } = await requireAuth();

    expect(ctx).toBeUndefined();
    expect(errorResponse).toBeDefined();
    expect(errorResponse?.status).toBe(401);
    const body = await errorResponse?.json();
    expect(body.error).toContain('No autorizado');
  });

  it('debe rechazar con 403 si el usuario tiene rol pending', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: 'pending@procimec.com', role: 'pending' },
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'u-pending',
                email: 'pending@procimec.com',
                role: 'pending',
                is_active: true,
              },
              error: null,
            }),
          }),
        }),
      }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createAdminClient>);

    const { errorResponse, ctx } = await requireAuth();

    expect(ctx).toBeUndefined();
    expect(errorResponse?.status).toBe(403);
    const body = await errorResponse?.json();
    expect(body.error).toContain('pendiente de aprobación');
  });

  it('debe rechazar con 403 si el rol es insuficiente y no tiene herramienta asignada', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: 'operator@procimec.com', role: 'operator' },
    });

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'u-operator',
                    email: 'operator@procimec.com',
                    role: 'operator',
                    is_active: true,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'user_tools') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createAdminClient>);

    const { errorResponse, ctx } = await requireAuth({
      roles: ['commercial', 'gerencia'],
      tool: 'commercial-pipeline',
    });

    expect(ctx).toBeUndefined();
    expect(errorResponse?.status).toBe(403);
  });

  it('debe otorgar acceso si el rol coincide', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: 'comercial@procimec.com', role: 'commercial' },
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'u-comercial',
                email: 'comercial@procimec.com',
                role: 'commercial',
                is_active: true,
              },
              error: null,
            }),
          }),
        }),
      }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createAdminClient>);

    const { errorResponse, ctx } = await requireAuth({
      roles: ['commercial', 'admin'],
    });

    expect(errorResponse).toBeUndefined();
    expect(ctx).toBeDefined();
    expect(ctx?.role).toBe('commercial');
    expect(ctx?.userId).toBe('u-comercial');
  });

  it('debe otorgar acceso irrestricto si el rol es admin', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: 'admin@procimec.com', role: 'admin' },
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'u-admin',
                email: 'admin@procimec.com',
                role: 'admin',
                is_active: true,
              },
              error: null,
            }),
          }),
        }),
      }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createAdminClient>);

    const { errorResponse, ctx } = await requireAuth({
      roles: ['purchasing'],
    });

    expect(errorResponse).toBeUndefined();
    expect(ctx).toBeDefined();
    expect(ctx?.role).toBe('admin');
  });
});
