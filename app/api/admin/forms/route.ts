import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('forms')
    .select('id, slug, name, description, steps_count, has_attachments, created_at')
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const normalized = (data ?? []).map((f) => {
    if (f.slug === 'gpr-field-form') {
      return { ...f, steps_count: 3, has_attachments: true };
    }
    return f;
  });

  return NextResponse.json({ data: normalized });
}
