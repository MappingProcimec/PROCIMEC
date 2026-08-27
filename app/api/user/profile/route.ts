import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const full_name = (body.full_name ?? '').trim();
  if (!full_name) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('users')
    .update({ full_name })
    .eq('email', session.user.email);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
