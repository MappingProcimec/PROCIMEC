import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { getDashboardActivities } from '@/lib/dashboard-activities';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: dbUser } = await supabase
    .from('users')
    .select('id, email, full_name, role')
    .eq('email', session.user.email)
    .single();

  if (!dbUser || dbUser.role === 'pending') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit')) || 100, 100);
  const isAdmin = dbUser.role === 'admin';

  const activities = await getDashboardActivities({
    isAdmin,
    userId: dbUser.id,
    userEmail: dbUser.email,
    limit,
  });

  return NextResponse.json(
    { data: activities },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    }
  );
}
