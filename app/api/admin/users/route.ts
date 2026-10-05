import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { z } from 'zod';

const userUpdateSchema = z.object({
  id: z.string().min(1, 'ID de usuario requerido'),
  role: z.string().optional(),
  is_active: z.boolean().optional(),
  role_id: z.string().nullable().optional(),
  full_name: z.string().optional(),
  nick_name: z.string().nullable().optional(),
  email: z.string().optional(),
  phone: z.string().nullable().optional(),
  project_ids: z.array(z.string()).optional(),
  division_roles: z
    .array(
      z.object({
        division_id: z.string(),
        role_id: z.string().nullable().optional(),
      })
    )
    .optional(),
  tool_ids: z.array(z.string()).optional(),
  form_ids: z.array(z.string()).optional(),
});

// GET /api/admin/users
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, full_name, nick_name, avatar_url, phone, role, role_id, division_id, is_active, created_at, roles(id, name), user_projects(project_id), user_division_roles(division_id, role_id)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = (users ?? []).map((u) => u.id);
  const userToolsMap: Record<string, { tool_id: string }[]> = {};
  const userFormsMap: Record<string, { form_id: string }[]> = {};

  if (userIds.length > 0) {
    // Consultas concurrentes y acotadas únicamente a los usuarios recuperados
    const [utResult, ufResult] = await Promise.allSettled([
      supabase.from('user_tools').select('user_id, tool_id').in('user_id', userIds),
      supabase.from('user_forms').select('user_id, form_id').in('user_id', userIds),
    ]);

    if (utResult.status === 'fulfilled' && !utResult.value.error && utResult.value.data) {
      utResult.value.data.forEach((ut: { user_id: string; tool_id: string }) => {
        if (!userToolsMap[ut.user_id]) userToolsMap[ut.user_id] = [];
        userToolsMap[ut.user_id].push({ tool_id: ut.tool_id });
      });
    }

    if (ufResult.status === 'fulfilled' && !ufResult.value.error && ufResult.value.data) {
      ufResult.value.data.forEach((uf: { user_id: string; form_id: string }) => {
        if (!userFormsMap[uf.user_id]) userFormsMap[uf.user_id] = [];
        userFormsMap[uf.user_id].push({ form_id: uf.form_id });
      });
    }
  }

  const enrichedUsers = (users ?? []).map((u) => ({
    ...u,
    user_tools: userToolsMap[u.id] ?? [],
    user_forms: userFormsMap[u.id] ?? [],
  }));

  return NextResponse.json({ data: enrichedUsers });
}

// Helpers concurrentes para sincronización en PATCH
async function syncUserProjects(supabase: ReturnType<typeof createAdminClient>, userId: string, projectIds: string[]) {
  await supabase.from('user_projects').delete().eq('user_id', userId);
  if (projectIds.length > 0) {
    const { error } = await supabase.from('user_projects').insert(
      projectIds.map((pid: string) => ({ user_id: userId, project_id: pid }))
    );
    if (error) throw new Error(error.message);
  }
}

async function syncUserDivisionRoles(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  divisionRoles: { division_id: string; role_id?: string | null }[]
) {
  await supabase.from('user_division_roles').delete().eq('user_id', userId);
  const valid = divisionRoles.filter((dr) => dr.division_id);
  if (valid.length > 0) {
    const { error } = await supabase.from('user_division_roles').insert(
      valid.map((dr) => ({ user_id: userId, division_id: dr.division_id, role_id: dr.role_id || null }))
    );
    if (error) throw new Error(error.message);
  }
}

async function syncUserTools(supabase: ReturnType<typeof createAdminClient>, userId: string, toolIds: string[]) {
  try {
    const { error: delErr } = await supabase.from('user_tools').delete().eq('user_id', userId);
    if (delErr) {
      return 'Nota: Para guardar herramientas específicas, ejecuta la migración 007_user_tools_and_forms.sql en Supabase SQL Editor.';
    }
    if (toolIds.length > 0) {
      const { error: insErr } = await supabase.from('user_tools').insert(
        toolIds.map((tid: string) => ({ user_id: userId, tool_id: tid }))
      );
      if (insErr) return insErr.message;
    }
  } catch (e) {
    console.warn('user_tools sync error:', e);
  }
  return null;
}

async function syncUserForms(supabase: ReturnType<typeof createAdminClient>, userId: string, formIds: string[]) {
  try {
    const { error: delErr } = await supabase.from('user_forms').delete().eq('user_id', userId);
    if (delErr) {
      return 'Nota: Para guardar formularios específicos, ejecuta la migración 007_user_tools_and_forms.sql en Supabase SQL Editor.';
    }
    if (formIds.length > 0) {
      const { error: insErr } = await supabase.from('user_forms').insert(
        formIds.map((fid: string) => ({ user_id: userId, form_id: fid }))
      );
      if (insErr) return insErr.message;
    }
  } catch (e) {
    console.warn('user_forms sync error:', e);
  }
  return null;
}

// PATCH /api/admin/users — update role, active status, project assignments, division roles, user_tools, user_forms
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const rawBody = await request.json();
  const parseResult = userUpdateSchema.safeParse(rawBody);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message || 'Datos de actualización inválidos' },
      { status: 400 }
    );
  }

  const {
    id,
    role,
    is_active,
    project_ids,
    role_id,
    division_roles,
    tool_ids,
    form_ids,
    full_name,
    nick_name,
    email,
    phone,
  } = parseResult.data;

  const supabase = createAdminClient();
  const updates: Record<string, unknown> = {};

  if (role !== undefined) updates.role = role;
  if (is_active !== undefined) updates.is_active = is_active;
  if (role_id !== undefined) updates.role_id = role_id || null;

  if (full_name !== undefined) {
    const trimmedName = full_name.trim();
    if (!trimmedName) {
      return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 });
    }
    updates.full_name = trimmedName;
  }

  if (nick_name !== undefined) {
    const trimmedNick = nick_name ? nick_name.trim() : '';
    updates.nick_name = trimmedNick || null;
  }

  if (email !== undefined) {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      return NextResponse.json({ error: 'Ingresa un correo electrónico válido' }, { status: 400 });
    }
    updates.email = trimmedEmail;
  }

  if (phone !== undefined) {
    updates.phone = phone && phone.trim() ? phone.trim() : null;
  }

  let dbWarning: string | null = null;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('users').update(updates).eq('id', id);
    if (error) {
      if (error.code === '23505' || error.message?.includes('users_email_key') || error.message?.includes('duplicate key')) {
        return NextResponse.json({ error: 'El correo electrónico ya está registrado por otro usuario' }, { status: 400 });
      }

      if (error.message?.includes('nick_name') || error.message?.includes('phone') || error.code === '42703') {
        if (updates.nick_name !== undefined) delete updates.nick_name;
        if (updates.phone !== undefined) delete updates.phone;
        const retry = await supabase.from('users').update(updates).eq('id', id);
        if (retry.error) {
          return NextResponse.json({ error: retry.error.message }, { status: 500 });
        }
        dbWarning = 'Datos actualizados, pero para guardar apodo y teléfono ejecuta la migración 022 en Supabase SQL Editor.';
      } else {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  // Sincronizaciones concurrentes para reducir la latencia de waterfall
  const syncTasks: Promise<string | null | void>[] = [];

  if (Array.isArray(project_ids)) {
    syncTasks.push(syncUserProjects(supabase, id, project_ids));
  }

  if (Array.isArray(division_roles)) {
    syncTasks.push(syncUserDivisionRoles(supabase, id, division_roles));
  }

  let toolsWarning: string | null = null;
  if (Array.isArray(tool_ids)) {
    syncTasks.push(syncUserTools(supabase, id, tool_ids).then((w) => { toolsWarning = w; }));
  }

  let formsWarning: string | null = null;
  if (Array.isArray(form_ids)) {
    syncTasks.push(syncUserForms(supabase, id, form_ids).then((w) => { formsWarning = w; }));
  }

  if (syncTasks.length > 0) {
    try {
      await Promise.all(syncTasks);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error en la sincronización de asignaciones';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    warning: dbWarning || toolsWarning || formsWarning || undefined,
  });
}
