import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    // 1. Obtener oportunidades abiertas o cotizadas para vincular opcionalmente
    const { data: opps } = await supabase
      .from('commercial_opportunities')
      .select('id, opportunity_code, opportunity_title, client_name, service_type, estimated_value, location')
      .order('created_at', { ascending: false })
      .limit(50);

    // 2. Calcular siguiente consecutivo
    let nextNumber = 1;
    const { count } = await supabase
      .from('commercial_budgets')
      .select('*', { count: 'exact', head: true });

    if (typeof count === 'number') {
      nextNumber = count + 1;
    }

    const currentYear = new Date().getFullYear();
    const nextCode = `PRE-${currentYear}-${String(nextNumber).padStart(3, '0')}`;

    // 3. Consultar catálogo de descripciones previas para autocompletado typeahead y evitar duplicados
    const historicalMap = new Map<string, { description: string; brand?: string; suggested_supplier?: string; unit?: string }>();

    try {
      const { data: recentBudgets } = await supabase
        .from('commercial_budgets')
        .select('items_detail')
        .order('created_at', { ascending: false })
        .limit(30);

      if (recentBudgets) {
        for (const b of recentBudgets) {
          const arr = Array.isArray(b.items_detail) ? b.items_detail : [];
          for (const it of arr) {
            const desc = String((it as Record<string, unknown>).description || '').trim();
            if (desc && !historicalMap.has(desc.toLowerCase())) {
              historicalMap.set(desc.toLowerCase(), {
                description: desc,
                brand: String((it as Record<string, unknown>).brand || '').trim(),
                suggested_supplier: String((it as Record<string, unknown>).suggested_supplier || '').trim(),
                unit: String((it as Record<string, unknown>).unit || '').trim(),
              });
            }
          }
        }
      }

      const { data: recentRequests } = await supabase
        .from('purchase_requests')
        .select('items')
        .order('created_at', { ascending: false })
        .limit(30);

      if (recentRequests) {
        for (const r of recentRequests) {
          const arr = Array.isArray(r.items) ? r.items : [];
          for (const it of arr) {
            const desc = String((it as Record<string, unknown>).description || '').trim();
            if (desc && !historicalMap.has(desc.toLowerCase())) {
              historicalMap.set(desc.toLowerCase(), {
                description: desc,
                brand: String((it as Record<string, unknown>).brand || '').trim(),
                suggested_supplier: String((it as Record<string, unknown>).suggested_supplier || '').trim(),
                unit: String((it as Record<string, unknown>).unit || '').trim(),
              });
            }
          }
        }
      }
    } catch (catErr) {
      console.warn('Error consultando catálogo histórico para presupuesto:', catErr);
    }

    const historicalCatalog = Array.from(historicalMap.values()).slice(0, 100);

    return NextResponse.json({
      data: {
        opportunities: opps ?? [],
        nextCode,
        nextNumber,
        historicalCatalog,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al cargar datos base de presupuesto';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await request.json();
  const supabase = createAdminClient();

  // Obtener usuario en DB
  const { data: dbUser } = await supabase
    .from('users')
    .select('id, full_name, email, role')
    .eq('email', session.user.email)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  const {
    opportunity_id,
    client_name,
    project_title,
    service_category,
    direct_cost_materials,
    direct_cost_equipment,
    direct_cost_labor,
    direct_cost_logistics,
    aiu_percentage,
    items_detail,
    notes,
    status,
  } = body;

  if (!client_name?.trim() || !project_title?.trim()) {
    return NextResponse.json(
      { error: 'El nombre del cliente y el título del proyecto son obligatorios.' },
      { status: 400 }
    );
  }

  const mat = Number(direct_cost_materials) || 0;
  const eq = Number(direct_cost_equipment) || 0;
  const lab = Number(direct_cost_labor) || 0;
  const log = Number(direct_cost_logistics) || 0;
  const totalDirect = mat + eq + lab + log;

  const aiuPct = Number(aiu_percentage) > 0 ? Number(aiu_percentage) : 25.0;
  // Precio de venta sugerido antes de IVA: Costo Directo + (Costo Directo * AIU%)
  const suggestedSale = Math.round(totalDirect * (1 + aiuPct / 100));

  // Generar consecutivo
  const { count } = await supabase
    .from('commercial_budgets')
    .select('*', { count: 'exact', head: true });
  const consecutiveNum = (count || 0) + 1;
  const year = new Date().getFullYear();
  const budgetCode = `PRE-${year}-${String(consecutiveNum).padStart(3, '0')}`;

  const creatorName = dbUser.full_name || session.user.name || 'Área Técnica';
  const creatorEmail = dbUser.email || session.user.email;

  const nowIso = new Date().toISOString();
  const rawItems = Array.isArray(items_detail) ? items_detail : [];
  const sanitizedItems = rawItems.map((it: Record<string, unknown>, idx: number) => {
    const desc = String(it.description || '').trim();
    const normalizedKey = desc
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    const qty = Number(it.quantity) || 1;
    const unitPrice = Number(it.unit_cost) || 0;

    return {
      id: (it.id as string) || `item-${Date.now()}-${idx + 1}`,
      category: (it.category as string) || 'materials',
      description: desc,
      normalized_key: normalizedKey,
      brand: String(it.brand || '').trim(),
      suggested_supplier: String(it.suggested_supplier || '').trim(),
      unit: String(it.unit || 'Und').trim(),
      quantity: qty,
      unit_cost: unitPrice,
      total_cost: qty * unitPrice,
      recorded_at: (it.recorded_at as string) || nowIso,
      client_name: String(client_name).trim(),
      project_title: String(project_title).trim(),
    };
  });

  const insertPayload = {
    consecutive_number: consecutiveNum,
    budget_code: budgetCode,
    opportunity_id: opportunity_id || null,
    created_by_user_id: dbUser.id,
    created_by_name: creatorName,
    created_by_email: creatorEmail,
    client_name: String(client_name).trim(),
    project_title: String(project_title).trim(),
    service_category: service_category || 'mapping_geofisica',
    direct_cost_materials: mat,
    direct_cost_equipment: eq,
    direct_cost_labor: lab,
    direct_cost_logistics: log,
    total_direct_cost: totalDirect,
    aiu_percentage: aiuPct,
    suggested_sale_price: suggestedSale,
    items_detail: sanitizedItems,
    status: status || 'draft',
    notes: notes ? String(notes).trim() : null,
  };

  const { data, error } = await supabase
    .from('commercial_budgets')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Si estaba atado a una oportunidad, actualizar estado de la oportunidad a 'budgeted'
  if (opportunity_id) {
    await supabase
      .from('commercial_opportunities')
      .update({ status: 'quoted' }) // o en proceso
      .eq('id', opportunity_id);
  }

  return NextResponse.json({ data }, { status: 201 });
}
