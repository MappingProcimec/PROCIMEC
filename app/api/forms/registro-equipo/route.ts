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

// GET: List recent equipment or verify code availability
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

  const { data: equipment, error } = await supabase
    .from('equipment')
    .select('id, code, name, category, brand, model, serial_number, status, calibration_expiry_date, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: equipment ?? [] });
}

// POST: Register new equipment
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== 'admin' && role !== 'warehouse') {
    return NextResponse.json(
      { error: 'Solo los usuarios con rol de Almacén o Administrador pueden registrar equipos.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
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

    // Validaciones estrictas
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

    if (status && !VALID_STATUSES.includes(status as EquipmentStatus)) {
      return NextResponse.json(
        { error: `Estado inválido. Debe ser uno de: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toUpperCase();

    const supabase = createAdminClient();

    // Obtener ID del usuario en Supabase
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'Usuario no encontrado en la base de datos.' }, { status: 404 });
    }

    // Verificar unicidad de código
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

    // Insertar en la tabla equipment
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
      console.error('Error insertando equipo:', insertError);
      return NextResponse.json({ error: `Error en base de datos: ${insertError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Equipo ${cleanCode} registrado exitosamente.`,
      data: newEquipment,
    });
  } catch (err: unknown) {
    console.error('Error en POST /api/forms/registro-equipo:', err);
    const message = err instanceof Error ? err.message : 'Error interno al procesar el registro.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
