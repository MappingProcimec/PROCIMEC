import { type NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

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

  // Si no está autenticado y es ruta pública -> permitir
  if (!token) {
    if (isPublicRoute) return NextResponse.next();
    // Si intenta acceder a una ruta protegida -> redirigir a /login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Si está logueado y visita rutas públicas (/, /privacy, /terms), permitir sin atraparlo
  if (pathname === '/' || pathname === '/privacy' || pathname === '/terms') {
    return NextResponse.next();
  }

  const role = token.role as string;

  // Si está autenticado y entra a /login directamente (sin cerrar sesión):
  // Redirigir a su panel correspondiente (excepto si el rol es pending, que puede ver la pantalla de login)
  if (pathname === '/login' && role !== 'pending') {
    if (role === 'admin') return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    if (role === 'operator') return NextResponse.redirect(new URL('/projects', request.url));
    if (role === 'dibujo') return NextResponse.redirect(new URL('/dibujo', request.url));
  }

  // Control de acceso por roles para rutas protegidas
  if (role === 'pending' && pathname !== '/pending' && pathname !== '/login') {
    return NextResponse.redirect(new URL('/pending', request.url));
  }

  if (role === 'dibujo' && !pathname.startsWith('/dibujo') && !pathname.startsWith('/api/dibujo')) {
    return NextResponse.redirect(new URL('/dibujo', request.url));
  }

  if (role === 'operator' && (pathname.startsWith('/admin') || pathname.startsWith('/dibujo'))) {
    return NextResponse.redirect(new URL('/projects', request.url));
  }

  if (role === 'admin' && (pathname === '/pending' || pathname.startsWith('/dibujo'))) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)'],
};
