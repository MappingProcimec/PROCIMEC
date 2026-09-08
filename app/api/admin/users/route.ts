import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

// GET /api/admin/users
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: users, error } = await supabase
    .from('users')
    .select('*, role_id, roles(id, name), user_projects(project_id), user_division_roles(division_id, role_id)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Safe fetch user_tools and user_forms (if tables exist)
  const userToolsMap: Record<string, { tool_id: string }[]> = {};
  const userFormsMap: Record<string, { form_id: string }[]> = {};

  try {
    const { data: utData, error: utErr } = await supabase
      .from('user_tools')
      .select('user_id, tool_id');

    if (!utErr && utData) {
      utData.forEach((ut: { user_id: string; tool_id: string }) => {
        if (!userToolsMap[ut.user_id]) userToolsMap[ut.user_id] = [];
        userToolsMap[ut.user_id].push({ tool_id: ut.tool_id });
      });
    }
  } catch {
    // Si la tabla no existe aún, se ignora silenciosamente
  }

  try {
    const { data: ufData, error: ufErr } = await supabase
      .from('user_forms')
      .select('user_id, form_id');

    if (!ufErr && ufData) {
      ufData.forEach((uf: { user_id: string; form_id: string }) => {
        if (!userFormsMap[uf.user_id]) userFormsMap[uf.user_id] = [];
        userFormsMap[uf.user_id].push({ form_id: uf.form_id });
      });
    }
  } catch {
    // Si la tabla no existe aún, se ignora silenciosamente
  }

  const enrichedUsers = (users ?? []).map((u) => ({
    ...u,
    user_tools: userToolsMap[u.id] ?? [],
    user_forms: userFormsMap[u.id] ?? [],
  }));

  return NextResponse.json({ data: enrichedUsers });
}

// PATCH /api/admin/users — update role, active status, project assignments, division roles, user_tools, user_forms
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json();
  const { id, role, is_active, project_ids, role_id, division_roles, tool_ids, form_ids } = body;
  if (!id) return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });

  const supabase = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (role !== undefined) updates.role = role;
  if (is_active !== undefined) updates.is_active = is_active;
  if (role_id !== undefined) updates.role_id = role_id || null;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('users').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sync project assignments
  if (Array.isArray(project_ids)) {
    await supabase.from('user_projects').delete().eq('user_id', id);
    if (project_ids.length > 0) {
      const { error } = await supabase.from('user_projects').insert(
        project_ids.map((pid: string) => ({ user_id: id, project_id: pid }))
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Sync user_division_roles
  if (Array.isArray(division_roles)) {
    await supabase.from('user_division_roles').delete().eq('user_id', id);
    type DR = { division_id: string; role_id: string | null };
    const valid = (division_roles as DR[]).filter((dr) => dr.division_id);
    if (valid.length > 0) {
      await supabase.from('user_division_roles').insert(
        valid.map((dr) => ({ user_id: id, division_id: dr.division_id, role_id: dr.role_id || null }))
      );
    }
  }

  // Sync user_tools (asignación individual de herramientas)
  let toolsWarning: string | null = null;
  if (Array.isArray(tool_ids)) {
    try {
      const { error: delErr } = await supabase.from('user_tools').delete().eq('user_id', id);
      if (delErr) {
        toolsWarning = 'Nota: Para guardar herramientas específicas, ejecuta la migración 007_user_tools_and_forms.sql en Supabase SQL Editor.';
      } else if (tool_ids.length > 0) {
        const { error: insErr } = await supabase.from('user_tools').insert(
          tool_ids.map((tid: string) => ({ user_id: id, tool_id: tid }))
        );
        if (insErr) {
          toolsWarning = insErr.message;
        }
      }
    } catch (e) {
      console.warn('user_tools sync error:', e);
    }
  }

  // Sync user_forms (asignación individual de formularios)
  let formsWarning: string | null = null;
  if (Array.isArray(form_ids)) {
    try {
      const { error: delErr } = await supabase.from('user_forms').delete().eq('user_id', id);
      if (delErr) {
        formsWarning = 'Nota: Para guardar formularios específicos, ejecuta la migración 007_user_tools_and_forms.sql en Supabase SQL Editor.';
      } else if (form_ids.length > 0) {
        const { error: insErr } = await supabase.from('user_forms').insert(
          form_ids.map((fid: string) => ({ user_id: id, form_id: fid }))
        );
        if (insErr) {
          formsWarning = insErr.message;
        }
      }
    } catch (e) {
      console.warn('user_forms sync error:', e);
    }
  }

  return NextResponse.json({
    success: true,
    warning: toolsWarning || formsWarning || undefined,
  });
}
