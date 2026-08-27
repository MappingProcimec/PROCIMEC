import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  // 1. Datos básicos del rol
  const { data: role, error } = await supabase
    .from('roles')
    .select('id, name, division_id, is_system_role, created_at, divisions(id, name)')
    .eq('id', id)
    .single();

  if (error || !role) {
    return NextResponse.json({ error: error?.message ?? 'Rol no encontrado' }, { status: 404 });
  }

  // 2. Herramientas asignadas al rol (consulta separada, sin join anidado)
  const { data: roleToolsRaw } = await supabase
    .from('role_tools')
    .select('tool_id')
    .eq('role_id', id);

  const toolIds = (roleToolsRaw ?? []).map((r: { tool_id: string }) => r.tool_id);
  let assignedTools: { id: string; slug: string; name: string; category: string; is_universal: boolean }[] = [];
  if (toolIds.length > 0) {
    const { data: toolsData } = await supabase
      .from('tools')
      .select('id, slug, name, category, is_universal')
      .in('id', toolIds);
    assignedTools = (toolsData ?? []) as typeof assignedTools;
  }

  // 3. Formularios asignados al rol (consulta separada, sin join anidado)
  const { data: roleFormsRaw } = await supabase
    .from('role_forms')
    .select('form_id')
    .eq('role_id', id);

  const formIds = (roleFormsRaw ?? []).map((r: { form_id: string }) => r.form_id);
  let assignedForms: { id: string; slug: string; name: string }[] = [];
  if (formIds.length > 0) {
    const { data: formsData } = await supabase
      .from('forms')
      .select('id, slug, name')
      .in('id', formIds);
    assignedForms = (formsData ?? []) as typeof assignedForms;
  }

  // 4. Usuarios con este rol
  const { data: users } = await supabase
    .from('users')
    .select('id, email, full_name, role')
    .eq('role_id', id);

  // Normalizar al formato esperado por el frontend
  const role_tools = assignedTools.map((t) => ({ tools: t }));
  const role_forms = assignedForms.map((f) => ({ forms: f }));

  return NextResponse.json({
    data: { ...role, role_tools, role_forms, users: users ?? [] },
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const supabase = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (body.name?.trim()) updates.name = body.name.trim();
  if ('division_id' in body) updates.division_id = body.division_id || null;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('roles').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(body.tool_ids)) {
    await supabase.from('role_tools').delete().eq('role_id', id);
    if (body.tool_ids.length > 0) {
      await supabase.from('role_tools').insert(
        (body.tool_ids as string[]).map((tool_id) => ({ role_id: id, tool_id }))
      );
    }
  }

  if (Array.isArray(body.form_ids)) {
    await supabase.from('role_forms').delete().eq('role_id', id);
    if (body.form_ids.length > 0) {
      await supabase.from('role_forms').insert(
        (body.form_ids as string[]).map((form_id) => ({ role_id: id, form_id }))
      );
    }
  }

  const { data, error } = await supabase
    .from('roles')
    .select('id, name, division_id, is_system_role, divisions(id, name)')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: role } = await supabase.from('roles').select('is_system_role').eq('id', id).single();
  if (role?.is_system_role) {
    return NextResponse.json({ error: 'No se puede eliminar un rol del sistema' }, { status: 400 });
  }

  const { error } = await supabase.from('roles').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
