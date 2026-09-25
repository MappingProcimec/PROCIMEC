import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import type { EquipmentCategory, EquipmentStatus } from '@/types';

const VALID_CATEGORIES: EquipmentCategory[] = [
  'gpr',
  'antenna',
  'gnss',
  'total_station',
  'radiodetection',
  'vehicle',
  'accessory',
  'other',
];

const VALID_STATUSES: EquipmentStatus[] = [
  'available',
  'in_field',
  'maintenance',
  'calibration',
  'decommissioned',
];

// GET: Unified form data for Warehouse operations (Alta, Despacho, Retorno, Consumibles)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const checkCode = req.nextUrl.searchParams.get('checkCode');

  if (checkCode) {
    const { data: existing } = await supabase
      .from('equipment')
      .select('id, code')
      .eq('code', checkCode.trim().toUpperCase())
      .maybeSingle();

    return NextResponse.json({ exists: Boolean(existing) });
  }

  const userRole = session.user.role;
  const userId = session.user.id;

  if (userRole === 'pending') {
    return NextResponse.json({ error: 'Usuario pendiente de aprobación' }, { status: 403 });
  }

  let hasAccess = userRole === 'admin' || userRole === 'warehouse' || userRole === 'almacen' || userRole === 'management' || userRole === 'gerencia';
  if (!hasAccess && userId) {
    try {
      const { data: uf } = await supabase
        .from('user_forms')
        .select('forms!inner(slug)')
        .eq('user_id', userId)
        .eq('forms.slug', 'registro-equipo')
        .maybeSingle();

      if (uf) hasAccess = true;
    } catch {
      // Ignorar
    }
  }

  if (!hasAccess) {
    return NextResponse.json({ error: 'No autorizado para consultar inventario operativo de almacén' }, { status: 403 });
  }

  // Carga concurrente para alimentar las 4 pestañas operativas de almacén
  const [
    equipmentRes,
    activeCheckoutsRes,
    projectsRes,
    usersRes,
    consumablesRes,
  ] = await Promise.all([
    // Todos los equipos para consulta y disponibles para despacho
    supabase
      .from('equipment')
      .select('id, code, name, category, brand, model, serial_number, status, calibration_expiry_date, created_at')
      .order('code', { ascending: true }),

    // Despachos activos en campo pendientes de retorno
    supabase
      .from('equipment_checkouts')
      .select(`
        id,
        project_id,
        equipment_id,
        user_id,
        responsible_user_id,
        responsible_name,
        checkout_date,
        expected_return_date,
        status,
        checklist,
        notes,
        created_at,
        equipment:equipment(id, code, name, category, brand, model, serial_number),
        project:projects(id, name, cost_center, client),
        responsible_user:users!responsible_user_id(id, full_name, email)
      `)
      .eq('status', 'active')
      .order('checkout_date', { ascending: false }),

    // Proyectos activos
    supabase
      .from('projects')
      .select('id, name, cost_center, client')
      .eq('is_active', true)
      .order('name', { ascending: true }),

    // Usuarios de campo
    supabase
      .from('users')
      .select('id, full_name, email, role')
      .eq('is_active', true)
      .not('role', 'eq', 'pending')
      .order('full_name', { ascending: true }),

    // Entradas recientes de consumibles
    supabase
      .from('consumables_entries')
      .select('id, item_name, category, quantity, unit, supplier, invoice_number, entry_date, notes, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const allEquipment = equipmentRes.data ?? [];
  const availableEquipment = allEquipment.filter(e => e.status === 'available');

  return NextResponse.json({
    data: {
      allEquipment,
      availableEquipment,
      activeCheckouts: activeCheckoutsRes.data ?? [],
      projects: (projectsRes.data ?? []).map(p => ({
        ...p,
        code: p.cost_center || '',
      })),
      fieldUsers: usersRes.data ?? [],
      recentConsumables: consumablesRes.data ?? [],
    },
  });
}

// POST: Execute Warehouse operations (Alta, Despacho, Retorno, Consumibles)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== 'admin' && role !== 'warehouse') {
    return NextResponse.json(
      { error: 'Solo los usuarios con rol de Almacén o Administrador pueden operar movimientos de instrumental.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const action = body.action || 'alta'; // 'alta' | 'despacho' | 'retorno' | 'consumable'

    const supabase = createAdminClient();

    // Obtener usuario autenticado en BD
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'Usuario no encontrado en la base de datos.' }, { status: 404 });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // MODO 1: ALTA DE NUEVO INSTRUMENTAL
    // ──────────────────────────────────────────────────────────────────────────
    if (action === 'alta') {
      const {
        code,
        name,
        category,
        brand,
        model,
        serial_number,
        status = 'available',
        calibration_date,
        calibration_expiry_date,
        notes,
      } = body;

      if (!code || typeof code !== 'string' || !code.trim()) {
        return NextResponse.json({ error: 'El código interno del equipo es obligatorio.' }, { status: 400 });
      }

      if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'El nombre o descripción del equipo es obligatorio.' }, { status: 400 });
      }

      if (!category || !VALID_CATEGORIES.includes(category as EquipmentCategory)) {
        return NextResponse.json(
          { error: `Categoría inválida. Debe ser una de: ${VALID_CATEGORIES.join(', ')}` },
          { status: 400 }
        );
      }

      const cleanCode = code.trim().toUpperCase();

      const { data: existing } = await supabase
        .from('equipment')
        .select('id, code')
        .eq('code', cleanCode)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: `El código "${cleanCode}" ya se encuentra registrado para otro equipo en el inventario.` },
          { status: 409 }
        );
      }

      const { data: newEquipment, error: insertError } = await supabase
        .from('equipment')
        .insert({
          code: cleanCode,
          name: name.trim(),
          category,
          brand: brand ? String(brand).trim() : null,
          model: model ? String(model).trim() : null,
          serial_number: serial_number ? String(serial_number).trim() : null,
          status,
          calibration_date: calibration_date || null,
          calibration_expiry_date: calibration_expiry_date || null,
          notes: notes ? String(notes).trim() : null,
          created_by: dbUser.id,
        })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json({ error: `Error en base de datos: ${insertError.message}` }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Equipo ${cleanCode} dado de alta exitosamente en inventario.`,
        data: newEquipment,
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // MODO 2: DESPACHO / SALIDA A CAMPO
    // ──────────────────────────────────────────────────────────────────────────
    if (action === 'despacho') {
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

      const { data: targetEquipment, error: eqError } = await supabase
        .from('equipment')
        .select('id, code, name, status')
        .eq('id', equipment_id)
        .single();

      if (eqError || !targetEquipment) {
        return NextResponse.json({ error: 'El equipo seleccionado no existe.' }, { status: 404 });
      }

      if (targetEquipment.status !== 'available') {
        return NextResponse.json(
          { error: `El equipo ${targetEquipment.code} no está disponible (Estado actual: ${targetEquipment.status}).` },
          { status: 409 }
        );
      }

      const { data: checkout, error: checkoutError } = await supabase
        .from('equipment_checkouts')
        .insert({
          project_id,
          equipment_id,
          user_id: dbUser.id,
          responsible_user_id: responsible_user_id || null,
          responsible_name: responsible_name?.trim() || null,
          checkout_date: checkout_date || new Date().toISOString().split('T')[0],
          expected_return_date: expected_return_date || null,
          checklist,
          notes: notes ? String(notes).trim() : null,
          status: 'active',
        })
        .select()
        .single();

      if (checkoutError) {
        return NextResponse.json({ error: `Error creando despacho: ${checkoutError.message}` }, { status: 500 });
      }

      await supabase
        .from('equipment')
        .update({ status: 'in_field', updated_at: new Date().toISOString() })
        .eq('id', equipment_id);

      return NextResponse.json({
        success: true,
        message: `Despacho del equipo ${targetEquipment.code} registrado exitosamente.`,
        data: checkout,
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // MODO 3: RETORNO / REINGRESO DESDE CAMPO
    // ──────────────────────────────────────────────────────────────────────────
    if (action === 'retorno') {
      const {
        checkout_id,
        return_date,
        destination_status = 'available',
        return_checklist = {},
        return_notes,
      } = body;

      if (!checkout_id) {
        return NextResponse.json({ error: 'Debes seleccionar el despacho activo a reingresar.' }, { status: 400 });
      }

      const { data: checkout, error: chkError } = await supabase
        .from('equipment_checkouts')
        .select('id, equipment_id, status, equipment:equipment(id, code, name)')
        .eq('id', checkout_id)
        .single();

      if (chkError || !checkout) {
        return NextResponse.json({ error: 'El registro de despacho no fue encontrado.' }, { status: 404 });
      }

      if (checkout.status === 'returned') {
        return NextResponse.json({ error: 'Este despacho ya fue cerrado y devuelto previamente.' }, { status: 409 });
      }

      const actualReturn = return_date || new Date().toISOString().split('T')[0];

      // Actualizar el checkout a returned
      const { error: updateCheckoutErr } = await supabase
        .from('equipment_checkouts')
        .update({
          status: 'returned',
          actual_return_date: actualReturn,
          return_checklist,
          return_notes: return_notes ? String(return_notes).trim() : null,
          return_user_id: dbUser.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', checkout_id);

      if (updateCheckoutErr) {
        return NextResponse.json({ error: `Error cerrando despacho: ${updateCheckoutErr.message}` }, { status: 500 });
      }

      // Actualizar el equipo al nuevo estado (available, maintenance, o calibration)
      const validDestStatus = ['available', 'maintenance', 'calibration'].includes(destination_status)
        ? destination_status
        : 'available';

      await supabase
        .from('equipment')
        .update({ status: validDestStatus, updated_at: new Date().toISOString() })
        .eq('id', checkout.equipment_id);

      const eqData = checkout.equipment as unknown as { code: string; name: string } | null;
      const eqCode = eqData?.code || 'Instrumental';

      return NextResponse.json({
        success: true,
        message: `Retorno del equipo ${eqCode} procesado exitosamente. Estado: ${validDestStatus}.`,
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // MODO 4: INGRESO DE CONSUMIBLES
    // ──────────────────────────────────────────────────────────────────────────
    if (action === 'consumable') {
      const {
        item_name,
        category = 'terreno',
        quantity,
        unit = 'unidades',
        supplier,
        invoice_number,
        entry_date,
        notes,
      } = body;

      if (!item_name || typeof item_name !== 'string' || !item_name.trim()) {
        return NextResponse.json({ error: 'El nombre del material consumible es obligatorio.' }, { status: 400 });
      }

      const parsedQty = Number(quantity);
      if (isNaN(parsedQty) || parsedQty <= 0) {
        return NextResponse.json({ error: 'La cantidad debe ser un número positivo.' }, { status: 400 });
      }

      const { data: consumable, error: consError } = await supabase
        .from('consumables_entries')
        .insert({
          item_name: item_name.trim(),
          category: category.trim(),
          quantity: parsedQty,
          unit: unit.trim(),
          supplier: supplier ? String(supplier).trim() : null,
          invoice_number: invoice_number ? String(invoice_number).trim() : null,
          entry_date: entry_date || new Date().toISOString().split('T')[0],
          notes: notes ? String(notes).trim() : null,
          user_id: dbUser.id,
        })
        .select()
        .single();

      if (consError) {
        return NextResponse.json({ error: `Error registrando consumible: ${consError.message}` }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Ingreso de consumible "${item_name}" (${parsedQty} ${unit}) registrado exitosamente.`,
        data: consumable,
      });
    }

    return NextResponse.json({ error: 'Operación no reconocida.' }, { status: 400 });
  } catch (err: unknown) {
    console.error('Error en POST /api/forms/registro-equipo:', err);
    const message = err instanceof Error ? err.message : 'Error interno al procesar la operación de almacén.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
