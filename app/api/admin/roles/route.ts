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

  // 1. Roles básicos
  const { data: rolesRaw, error } = await supabase
    .from('roles')
    .select('id, name, division_id, is_system_role, created_at, divisions(id, name)')
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const roles = rolesRaw ?? [];
  const roleIds = roles.map((r) => r.id);

  if (roleIds.length === 0) return NextResponse.json({ data: [] });

  // 2. Herramientas por rol (separado, sin join anidado)
  const { data: roleToolsRaw } = await supabase
    .from('role_tools')
    .select('role_id, tool_id')
    .in('role_id', roleIds);

  const toolIds = Array.from(new Set((roleToolsRaw ?? []).map((rt: { tool_id: string }) => rt.tool_id)));
  const toolsMap: Record<string, { id: string; slug: string; name: string; category: string; is_universal: boolean }> = {};
  if (toolIds.length > 0) {
    const { data: toolsData } = await supabase
      .from('tools')
      .select('id, slug, name, category, is_universal')
      .in('id', toolIds);
    (toolsData ?? []).forEach((t: typeof toolsMap[string]) => { toolsMap[t.id] = t; });
  }

  // Agrupar herramientas por role_id
  const toolsByRole: Record<string, { tools: { id: string; slug: string; name: string; category: string; is_universal: boolean } }[]> = {};
  (roleToolsRaw ?? []).forEach((rt: { role_id: string; tool_id: string }) => {
    if (!toolsByRole[rt.role_id]) toolsByRole[rt.role_id] = [];
    const tool = toolsMap[rt.tool_id];
    if (tool) toolsByRole[rt.role_id].push({ tools: tool });
  });

  // 3. Formularios por rol (separado, sin join anidado)
  const { data: roleFormsRaw } = await supabase
    .from('role_forms')
    .select('role_id, form_id')
    .in('role_id', roleIds);

  const formIds = Array.from(new Set((roleFormsRaw ?? []).map((rf: { form_id: string }) => rf.form_id)));
  const formsMap: Record<string, { id: string; slug: string; name: string }> = {};
  if (formIds.length > 0) {
    const { data: formsData } = await supabase
      .from('forms')
      .select('id, slug, name')
      .in('id', formIds);
    (formsData ?? []).forEach((f: typeof formsMap[string]) => { formsMap[f.id] = f; });
  }

  // Agrupar formularios por role_id
  const formsByRole: Record<string, { forms: { id: string; slug: string; name: string } }[]> = {};
  (roleFormsRaw ?? []).forEach((rf: { role_id: string; form_id: string }) => {
    if (!formsByRole[rf.role_id]) formsByRole[rf.role_id] = [];
    const form = formsMap[rf.form_id];
    if (form) formsByRole[rf.role_id].push({ forms: form });
  });

  // 4. Combinar todo
  const data = roles.map((r) => ({
    ...r,
    role_tools: toolsByRole[r.id] ?? [],
    role_forms: formsByRole[r.id] ?? [],
  }));

  return NextResponse.json({ data });
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
