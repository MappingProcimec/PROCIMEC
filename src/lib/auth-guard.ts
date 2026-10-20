import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { isKnownAdmin } from '@/lib/admin-emails';

export interface DbUserRecord {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  role_id?: string | null;
  division_id?: string | null;
  is_active?: boolean;
}

export interface AuthContext {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  dbUser: DbUserRecord;
  user: DbUserRecord;
  supabase: ReturnType<typeof createAdminClient>;
}

export interface GuardOptions {
  /** Lista de roles permitidos (ej: ['commercial', 'comercial', 'admin']) */
  roles?: string[];
  /** Slug de la herramienta requerida en user_tools */
  tool?: string;
  /** Slug del formulario requerido en user_forms */
  form?: string;
  /** ID de proyecto para validar pertenencia en user_projects */
  projectId?: string;
  /** Si es true (por defecto), bloquea cuentas pending o inactivas */
  requireActive?: boolean;
  /** Petición NextRequest opcional si se requiere inspección de JWT en el Edge */
  req?: NextRequest;
}

export type GuardResult =
  | {
      ok: false;
      errorResponse: NextResponse;
      response: NextResponse;
      ctx?: undefined;
    }
  | {
      ok: true;
      errorResponse?: undefined;
      response?: undefined;
      ctx: AuthContext;
    };

/**
 * Helper centralizado de autorización PROCIMEC.
 * Valida identidad, estado de cuenta y permisos RBAC/herramienta/proyecto
 * ANTES de que el handler acceda a la base de datos o ejecute lógica de negocio.
 */
export async function requireAuth(options: GuardOptions = {}): Promise<GuardResult> {
  const { roles, tool, form, projectId, requireActive = true, req } = options;

  // 1. Obtener sesión de NextAuth o Token JWT
  let email: string | undefined;
  let sessionUserId: string | undefined;
  let sessionRole: string | undefined;
  let sessionFullName: string | undefined;

  try {
    const session = await getServerSession(authOptions);
    if (session?.user) {
      email = session.user.email || undefined;
      sessionUserId = session.user.id || undefined;
      sessionRole = session.user.role || undefined;
      sessionFullName = session.user.name || undefined;
    }
  } catch {
    // Entorno de prueba o contexto fuera del AsyncLocalStorage de Next.js
  }

  // Fallback a getToken si vino req y session falló
  if (!email && req) {
    try {
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      if (token?.email) {
        email = token.email as string;
        sessionUserId = (token.userId || token.sub) as string | undefined;
        sessionRole = token.role as string | undefined;
      }
    } catch {
      // Ignorar error de token
    }
  }

  if (!email) {
    const errRes = NextResponse.json(
      { error: 'No autorizado. Se requiere iniciar sesión.' },
      { status: 401 }
    );
    return { ok: false, errorResponse: errRes, response: errRes };
  }

  const supabase = createAdminClient();

  // 2. Resolver usuario real en PostgreSQL
  let dbUser: DbUserRecord | null = null;
  try {
    const { data: userByEmail } = await supabase
      .from('users')
      .select('id, full_name, email, role, role_id, division_id, is_active')
      .ilike('email', email.trim())
      .maybeSingle();

    if (userByEmail) {
      dbUser = userByEmail;
    } else if (sessionUserId) {
      const { data: userById } = await supabase
        .from('users')
        .select('id, full_name, email, role, role_id, division_id, is_active')
        .eq('id', sessionUserId)
        .maybeSingle();
      if (userById) dbUser = userById;
    }
  } catch (err) {
    console.warn('Advertencia consultando users en requireAuth:', err);
  }

  if (!dbUser) {
    if (isKnownAdmin(email)) {
      dbUser = {
        id: sessionUserId || 'admin-root',
        email,
        full_name: sessionFullName || 'Administrador PROCIMEC',
        role: 'admin',
        is_active: true,
      };
    } else {
      const errRes = NextResponse.json(
        { error: 'Usuario no registrado en los registros de la plataforma.' },
        { status: 401 }
      );
      return { ok: false, errorResponse: errRes, response: errRes };
    }
  }

  // Normalizar rol efectivo
  let effectiveRole = dbUser.role || sessionRole || 'operator';
  if (isKnownAdmin(email)) {
    effectiveRole = 'admin';
  }

  // 3. Validar estado de cuenta activo
  if (requireActive) {
    if (effectiveRole === 'pending' || dbUser.is_active === false) {
      const errRes = NextResponse.json(
        { error: 'Cuenta de usuario inactiva o pendiente de aprobación administrativa.' },
        { status: 403 }
      );
      return { ok: false, errorResponse: errRes, response: errRes };
    }
  }

  const userPayload: DbUserRecord = { ...dbUser, role: effectiveRole };
  const authCtx: AuthContext = {
    userId: dbUser.id,
    email: dbUser.email,
    fullName: dbUser.full_name || sessionFullName || email.split('@')[0],
    role: effectiveRole,
    dbUser: userPayload,
    user: userPayload,
    supabase,
  };

  // 4. Administrador y Gerencia tienen bypass total de permisos funcionales
  if (effectiveRole === 'admin') {
    return { ok: true, ctx: authCtx };
  }

  // 5. Validar Roles permitidos
  if (roles && roles.length > 0) {
    const isRoleMatched = roles.some((r) => r.toLowerCase() === effectiveRole.toLowerCase());
    
    if (!isRoleMatched) {
      // Si el rol base no coincide, verificar si tiene acceso específico por asignación individual
      let hasIndividualGrant = false;

      if (tool) {
        try {
          const { data: ut } = await supabase
            .from('user_tools')
            .select('tools!inner(slug)')
            .eq('user_id', dbUser.id)
            .eq('tools.slug', tool)
            .maybeSingle();

          if (ut) hasIndividualGrant = true;
        } catch {}
      }

      if (!hasIndividualGrant && form) {
        try {
          const { data: uf } = await supabase
            .from('user_forms')
            .select('forms!inner(slug)')
            .eq('user_id', dbUser.id)
            .eq('forms.slug', form)
            .maybeSingle();

          if (uf) hasIndividualGrant = true;
        } catch {}
      }

      if (!hasIndividualGrant) {
        const errRes = NextResponse.json(
          { error: 'No cuentas con los permisos requeridos para ejecutar esta operación.' },
          { status: 403 }
        );
        return { ok: false, errorResponse: errRes, response: errRes };
      }
    }
  }

  // 6. Validar Pertenencia de Proyecto (Anti-IDOR) si se solicita
  if (projectId) {
    const isManager = effectiveRole === 'management' || effectiveRole === 'gerencia';
    if (!isManager) {
      const { data: assignment } = await supabase
        .from('user_projects')
        .select('project_id')
        .eq('user_id', dbUser.id)
        .eq('project_id', projectId)
        .maybeSingle();

      if (!assignment) {
        const errRes = NextResponse.json(
          { error: 'No tienes autorización sobre el proyecto especificado.' },
          { status: 403 }
        );
        return { ok: false, errorResponse: errRes, response: errRes };
      }
    }
  }

  return { ok: true, ctx: authCtx };
}
