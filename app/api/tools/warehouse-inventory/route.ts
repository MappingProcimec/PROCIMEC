import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Consultas paralelas para consolidar el Kárdex e Inventario Activo
  const [equipmentRes, checkoutsRes, consumablesRes] = await Promise.all([
    // Todos los equipos
    supabase
      .from('equipment')
      .select('id, code, name, category, brand, model, serial_number, status, calibration_date, calibration_expiry_date, notes, created_at')
      .order('code', { ascending: true }),

    // Historial y despachos activos con detalles de proyecto y responsable
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
        actual_return_date,
        status,
        checklist,
        notes,
        return_notes,
        created_at,
        equipment:equipment(id, code, name, category, brand, model, serial_number),
        project:projects(id, name, cost_center, client),
        responsible_user:users!responsible_user_id(id, full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(100),

    // Historial de entradas de consumibles
    supabase
      .from('consumables_entries')
      .select(`
        id,
        item_name,
        category,
        quantity,
        unit,
        supplier,
        invoice_number,
        entry_date,
        notes,
        created_at,
        users:users(id, full_name, email)
      `)
      .order('entry_date', { ascending: false })
      .limit(100),
  ]);

  if (equipmentRes.error) {
    return NextResponse.json({ error: equipmentRes.error.message }, { status: 500 });
  }

  const equipmentList = equipmentRes.data ?? [];
  const checkouts = checkoutsRes.data ?? [];
  const consumables = consumablesRes.data ?? [];

  // Calcular alertas de calibración (vencidas o a vencer en los próximos 30 días)
  const now = new Date();
  const thirtyDaysAhead = new Date();
  thirtyDaysAhead.setDate(now.getDate() + 30);

  const calibrationAlerts = equipmentList.filter((eq) => {
    if (!eq.calibration_expiry_date) return false;
    const expiry = new Date(eq.calibration_expiry_date);
    return expiry <= thirtyDaysAhead;
  });

  // Mapear equipo con su checkout activo (si está en campo)
  const activeCheckoutsMap = new Map<string, typeof checkouts[0]>();
  checkouts.forEach((chk) => {
    if (chk.status === 'active' && !activeCheckoutsMap.has(chk.equipment_id)) {
      activeCheckoutsMap.set(chk.equipment_id, chk);
    }
  });

  const enrichedEquipment = equipmentList.map((eq) => {
    const activeCheckout = activeCheckoutsMap.get(eq.id);
    let calibrationStatus: 'ok' | 'warning' | 'expired' | 'none' = 'none';

    if (eq.calibration_expiry_date) {
      const expiry = new Date(eq.calibration_expiry_date);
      if (expiry < now) {
        calibrationStatus = 'expired';
      } else if (expiry <= thirtyDaysAhead) {
        calibrationStatus = 'warning';
      } else {
        calibrationStatus = 'ok';
      }
    }

    return {
      ...eq,
      activeCheckout: activeCheckout ?? null,
      calibrationStatus,
    };
  });

  // Estadísticas operativas consolidadas
  const stats = {
    totalEquipment: equipmentList.length,
    availableCount: equipmentList.filter((e) => e.status === 'available').length,
    inFieldCount: equipmentList.filter((e) => e.status === 'in_field').length,
    maintenanceCount: equipmentList.filter((e) => e.status === 'maintenance' || e.status === 'calibration').length,
    calibrationAlertsCount: calibrationAlerts.length,
    totalConsumablesEntries: consumables.length,
  };

  return NextResponse.json({
    data: {
      equipment: enrichedEquipment,
      checkouts,
      consumables,
      stats,
    },
  });
}
