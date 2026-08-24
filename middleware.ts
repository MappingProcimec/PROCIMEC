import { type NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { createClient } from '@supabase/supabase-js';

// Correos que siempre tienen acceso de administrador, independientemente del rol guardado en el token
const ADMIN_EMAILS = [
  'mapping.procimec2024@gmail.com',
  'marcelobarrazasantiago@gmail.com',
];

function isKnownAdmin(email?: string | null): boolean {
  if (!email) return false;
  const envAdmin = process.env.GOOGLE_DRIVE_ADMIN_EMAIL;
  if (envAdmin && email.toLowerCase() === envAdmin.toLowerCase()) return true;
  return ADMIN_EMAILS.some((e) => e.toLowerCase() === email.toLowerCase());
}

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

  // Rutas públicas → permitir siempre estando logueado
  if (pathname === '/' || pathname === '/privacy' || pathname === '/terms') {
    return NextResponse.next();
  }

  const email = token.email as string | undefined;
  let effectiveRole = token.role as string;

  if (isKnownAdmin(email)) {
    effectiveRole = 'admin';
  } else if (effectiveRole === 'pending' && email) {
    // Si la cookie dice 'pending', consultar en Supabase por si el administrador ya aprobo el rol
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

  // Si la cuenta ya fue aprobada pero esta intentando acceder a /pending -> redirigir a su modulo
  if (pathname === '/pending' && effectiveRole !== 'pending') {
    if (effectiveRole === 'admin') return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    if (effectiveRole === 'dibujo') return NextResponse.redirect(new URL('/dibujo', request.url));
    if (effectiveRole === 'operator') return NextResponse.redirect(new URL('/projects', request.url));
  }

  // Si está autenticado y entra a /login → redirigir a su panel
  if (pathname === '/login' && effectiveRole !== 'pending') {
    if (effectiveRole === 'admin') return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    if (effectiveRole === 'operator') return NextResponse.redirect(new URL('/projects', request.url));
    if (effectiveRole === 'dibujo') return NextResponse.redirect(new URL('/dibujo', request.url));
  }

  // Control de acceso por rol efectivo
  if (effectiveRole === 'pending' && pathname !== '/pending' && pathname !== '/login') {
    return NextResponse.redirect(new URL('/pending', request.url));
  }

  if (effectiveRole === 'dibujo' && !pathname.startsWith('/dibujo') && !pathname.startsWith('/api/dibujo')) {
    return NextResponse.redirect(new URL('/dibujo', request.url));
  }

  if (effectiveRole === 'operator' && (pathname.startsWith('/admin') || pathname.startsWith('/dibujo'))) {
    return NextResponse.redirect(new URL('/projects', request.url));
  }

  if (effectiveRole === 'admin' && (pathname === '/pending' || pathname.startsWith('/dibujo'))) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)'],
};
