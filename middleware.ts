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

  // Operator trying to access admin
  if (role === 'operator' && pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/projects', request.url));
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
