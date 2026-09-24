import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

// GET: Options for checkout (available equipment, active projects, field users)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const [equipmentRes, projectsRes, usersRes] = await Promise.all([
    supabase
      .from('equipment')
      .select('id, code, name, category, brand, model, serial_number, status')
      .eq('status', 'available')
      .order('code', { ascending: true }),
    supabase
      .from('projects')
      .select('id, name, code, cost_center, client')
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('users')
      .select('id, full_name, email, role')
      .eq('is_active', true)
      .not('role', 'eq', 'pending')
      .order('full_name', { ascending: true }),
  ]);

  return NextResponse.json({
    data: {
      availableEquipment: equipmentRes.data ?? [],
      projects: (projectsRes.data ?? []).map(p => ({
        ...p,
        code: p.cost_center || p.code || '',
      })),
      fieldUsers: usersRes.data ?? [],
    },
  });
}

// POST: Execute equipment checkout to field
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== 'admin' && role !== 'warehouse') {
    return NextResponse.json(
      { error: 'Solo los usuarios con rol de Almacén o Administrador pueden despachar equipos.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      project_id,
      equipment_id,
      responsible_user_id,
      responsible_name,
      checkout_date,
      expected_return_date,
      checklist = {},
      notes,
    } = body;

    if (!project_id) {
      return NextResponse.json({ error: 'Debes seleccionar el proyecto destino.' }, { status: 400 });
    }

    if (!equipment_id) {
      return NextResponse.json({ error: 'Debes seleccionar el equipo a despachar.' }, { status: 400 });
    }

    if (!responsible_name?.trim() && !responsible_user_id) {
      return NextResponse.json({ error: 'Debes indicar el responsable que recibe el equipo en campo.' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Obtener usuario despachador (sesión)
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'Usuario despachador no encontrado.' }, { status: 404 });
    }

    // Verificar que el equipo exista y esté disponible
    const { data: targetEquipment, error: eqError } = await supabase
      .from('equipment')
      .select('id, code, name, status')
      .eq('id', equipment_id)
      .single();

    if (eqError || !targetEquipment) {
      return NextResponse.json({ error: 'El equipo seleccionado no existe.' }, { status: 404 });
    }

    if (targetEquipment.status !== 'available') {
      const statusLabels: Record<string, string> = {
        in_field: 'En campo',
        maintenance: 'En mantenimiento',
        calibration: 'En calibración',
        decommissioned: 'De baja',
      };
      return NextResponse.json(
        { error: `El equipo "${targetEquipment.code}" no está disponible (estado actual: ${statusLabels[targetEquipment.status] || targetEquipment.status}).` },
        { status: 400 }
      );
    }

    // Resolver nombre del responsable
    let finalResponsibleName = responsible_name ? String(responsible_name).trim() : '';
    if (responsible_user_id && !finalResponsibleName) {
      const { data: respUser } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', responsible_user_id)
        .single();
      if (respUser?.full_name) {
        finalResponsibleName = respUser.full_name;
      }
    }

    // 1. Crear el registro en equipment_checkouts
    const { data: checkout, error: checkoutError } = await supabase
      .from('equipment_checkouts')
      .insert({
        project_id,
        equipment_id,
        user_id: dbUser.id,
        responsible_user_id: responsible_user_id || null,
        responsible_name: finalResponsibleName || null,
        checkout_date: checkout_date || new Date().toISOString().split('T')[0],
        expected_return_date: expected_return_date || null,
        status: 'active',
        checklist,
        notes: notes ? String(notes).trim() : null,
      })
      .select()
      .single();

    if (checkoutError) {
      console.error('Error insertando despacho:', checkoutError);
      return NextResponse.json({ error: `Error en base de datos: ${checkoutError.message}` }, { status: 500 });
    }

    // 2. Transicionar estado del equipo a 'in_field'
    const { error: updateEqError } = await supabase
      .from('equipment')
      .update({
        status: 'in_field',
        updated_at: new Date().toISOString(),
      })
      .eq('id', equipment_id);

    if (updateEqError) {
      console.error('Error actualizando estado del equipo:', updateEqError);
    }

    return NextResponse.json({
      success: true,
      message: `Equipo ${targetEquipment.code} despachado exitosamente a campo.`,
      data: checkout,
    });
  } catch (err: unknown) {
    console.error('Error en POST /api/forms/despacho-equipo:', err);
    const message = err instanceof Error ? err.message : 'Error interno al procesar el despacho.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
