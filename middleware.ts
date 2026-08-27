import { type NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { createClient } from '@supabase/supabase-js';
import { isKnownAdmin } from '@/lib/admin-emails';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = request.nextUrl;

  // Rutas 100% públicas (landing, privacy, terms, login, logout, assets)
  const isPublicRoute =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/privacy' ||
    pathname === '/terms' ||
    pathname === '/api/logout' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons');

  if (pathname === '/api/logout') {
    return NextResponse.next();
  }

  // Si no está autenticado
  if (!token) {
    if (isPublicRoute) return NextResponse.next();
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Privacy / terms: siempre accesibles
  if (pathname === '/privacy' || pathname === '/terms') {
    return NextResponse.next();
  }

  const email = token.email as string | undefined;
  let effectiveRole = token.role as string;

  if (isKnownAdmin(email)) {
    effectiveRole = 'admin';
  } else if (effectiveRole === 'pending' && email) {
    // Si la cookie dice 'pending', consultar en Supabase por si el administrador ya aprobó el rol
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && serviceRoleKey) {
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('email', email)
          .maybeSingle();

        if (data?.role) {
          effectiveRole = data.role;
        }
      }
    } catch (e) {
      console.error('Error en middleware al verificar rol en Supabase:', e);
    }
  }

  // Landing ('/') → redirigir a su panel según rol efectivo
  if (pathname === '/') {
    if (effectiveRole === 'admin') return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    if (effectiveRole === 'pending') return NextResponse.redirect(new URL('/pending', request.url));
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Si la cuenta ya fue aprobada pero está intentando acceder a /pending -> redirigir a su módulo
  if (pathname === '/pending' && effectiveRole !== 'pending') {
    if (effectiveRole === 'admin') return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Si está autenticado y entra a /login → redirigir a su panel
  if (pathname === '/login' && effectiveRole !== 'pending') {
    if (effectiveRole === 'admin') return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Control para usuarios pendientes
  if (effectiveRole === 'pending' && pathname !== '/pending' && pathname !== '/login') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Usuario pendiente de aprobación' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/pending', request.url));
  }

  // Solo admin puede acceder a rutas y APIs de administración
  if (effectiveRole !== 'admin') {
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (pathname.startsWith('/api/admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)'],
};
