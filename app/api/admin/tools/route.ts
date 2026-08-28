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

  // Limpiar herramientas obsoletas de la base de datos
  await supabase.from('tools').delete().in('slug', ['forms-area', 'projects-area']);

  const { data, error } = await supabase
    .from('tools')
    .select('id, slug, name, category, is_universal')
    .not('slug', 'in', '("forms-area","projects-area")')
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
