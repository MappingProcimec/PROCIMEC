import { NextRequest, NextResponse } from 'next/server';
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
    .from('roles')
    .select(`
      id, name, division_id, is_system_role, created_at,
      divisions(id, name),
      role_tools(tools(id, slug, name, category, is_universal)),
      role_forms(forms(id, slug, name))
    `)
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const name = (body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });

  const supabase = createAdminClient();

  const { data: role, error: roleErr } = await supabase
    .from('roles')
    .insert({
      name,
      division_id: body.division_id || null,
      is_system_role: false,
    })
    .select()
    .single();

  if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 500 });

  const toolIds: string[] = body.tool_ids ?? [];
  const formIds: string[] = body.form_ids ?? [];

  if (toolIds.length > 0) {
    await supabase.from('role_tools').insert(toolIds.map((tool_id) => ({ role_id: role.id, tool_id })));
  }
  if (formIds.length > 0) {
    await supabase.from('role_forms').insert(formIds.map((form_id) => ({ role_id: role.id, form_id })));
  }

  return NextResponse.json({ data: role }, { status: 201 });
}
