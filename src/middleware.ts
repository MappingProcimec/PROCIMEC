import { type NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = request.nextUrl;

  // Public routes
  if (pathname === '/' || pathname.startsWith('/api/auth') || pathname.startsWith('/_next') || pathname.startsWith('/icons')) {
    return NextResponse.next();
  }

  // Not authenticated → redirect to login
  if (!token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const role = token.role as string;

  // Pending role → only allow /pending
  if (role === 'pending' && pathname !== '/pending') {
    return NextResponse.redirect(new URL('/pending', request.url));
  }

  // Non-admin trying to access admin
  if (role !== 'admin' && pathname.startsWith('/admin')) {
    if (role === 'warehouse') return NextResponse.redirect(new URL('/warehouse', request.url));
    if (role === 'purchasing') return NextResponse.redirect(new URL('/purchasing', request.url));
    if (role === 'commercial') return NextResponse.redirect(new URL('/commercial', request.url));
    if (role === 'finance') return NextResponse.redirect(new URL('/finance', request.url));
    if (role === 'accounting') return NextResponse.redirect(new URL('/accounting', request.url));
    if (role === 'management') return NextResponse.redirect(new URL('/management', request.url));
    if (role === 'dibujo') return NextResponse.redirect(new URL('/dibujo', request.url));
    return NextResponse.redirect(new URL('/projects', request.url));
  }

  // Dedicated role landing route protection
  const roleProtectedPrefixes: Record<string, string> = {
    '/warehouse': 'warehouse',
    '/purchasing': 'purchasing',
    '/commercial': 'commercial',
    '/finance': 'finance',
    '/accounting': 'accounting',
    '/management': 'management',
  };

  for (const [prefix, allowedRole] of Object.entries(roleProtectedPrefixes)) {
    if (pathname.startsWith(prefix) && role !== allowedRole && role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Admin going to /pending → redirect to admin dashboard
  if (role === 'admin' && pathname === '/pending') {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)'],
};
