import { type NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

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

  // Rutas 100% públicas (landing, privacy, terms, login, assets)
  const isPublicRoute =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/privacy' ||
    pathname === '/terms' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons');

  // Si no está autenticado
  if (!token) {
    if (isPublicRoute) return NextResponse.next();
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Rutas públicas → permitir siempre estando logueado
  if (pathname === '/' || pathname === '/privacy' || pathname === '/terms') {
    return NextResponse.next();
  }

  // Determinar el rol efectivo: si el correo es admin conocido, ignorar el token y tratar como admin
  const email = token.email as string | undefined;
  const tokenRole = token.role as string;
  const effectiveRole = isKnownAdmin(email) ? 'admin' : tokenRole;

  // Si el email es admin conocido y está en /login o /pending → redirigir a dashboard
  if (isKnownAdmin(email) && (pathname === '/login' || pathname === '/pending')) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
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
