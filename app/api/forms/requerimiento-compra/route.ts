import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export interface PurchaseRequestItem {
  item_no: number;
  quantity: number;
  unit: string;
  description: string;
  normalized_key?: string;
  budget_item_id?: string;
  budget_rubro?: string;
  client_quote_no?: string;
  brand: string;
  suggested_supplier: string;
  unit_price: number;
  total: number;
  recorded_at?: string;
  delivery_site?: string;
  project_id?: string;
  cost_center?: string;
}

function formatDateTimeCO(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'America/Bogota',
  }).format(d);
}

// GET: Obtener proyectos habilitados, datos del usuario y siguiente consecutivo
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // 1. Obtener usuario de la base de datos (con fallback robusto a la sesión)
  let dbUser: { id: string; full_name?: string | null; email: string; role: string } | null = null;

  try {
    const { data: userByEmail } = await supabase
      .from('users')
      .select('id, full_name, email, role')
      .ilike('email', session.user.email.trim())
      .maybeSingle();

    if (userByEmail) {
      dbUser = userByEmail;
    } else if (session.user.id) {
      const { data: userById } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('id', session.user.id)
        .maybeSingle();
      if (userById) dbUser = userById;
    }
  } catch (err) {
    console.warn('Error consultando tabla users en requerimiento-compra:', err);
  }

  // Fallback seguro si el usuario tiene sesión activa pero no existe en users
  if (!dbUser) {
    dbUser = {
      id: session.user.id || 'session-user',
      full_name: session.user.name || session.user.email.split('@')[0],
      email: session.user.email,
      role: session.user.role || 'operator',
    };
  }

  if (dbUser.role === 'pending') {
    return NextResponse.json({ error: 'Usuario pendiente de aprobación' }, { status: 403 });
  }

  // 2. Proyectos habilitados para el usuario
  let projects: Array<{ id: string; name: string; cost_center: string; client: string }> = [];

  try {
    const { data: allProjects, error: pError } = await supabase
      .from('projects')
      .select('*')
      .order('name', { ascending: true });

    if (!pError && allProjects) {
      const activeProjects = allProjects.filter((p) => p.is_active !== false);
      const formatted = activeProjects.map((p: Record<string, unknown>) => ({
        id: p.id as string,
        name: (p.name as string) || '',
        cost_center: String(p.cost_center || '').trim(),
        client: ((p.client as string) || '').trim(),
      }));

      const effectiveUserId = session.user.id || dbUser.id;
      const isUnrestricted =
        dbUser.role === 'admin' ||
        dbUser.role === 'management' ||
        dbUser.role === 'gerencia' ||
        session.user.role === 'admin' ||
        session.user.role === 'management';

      if (!isUnrestricted && effectiveUserId) {
        // Consultar asignaciones de proyectos para el usuario
        const { data: userProjects } = await supabase
          .from('user_projects')
          .select('project_id')
          .eq('user_id', effectiveUserId);

        const assignedIds = new Set((userProjects ?? []).map((up: { project_id: string }) => up.project_id));
        if (assignedIds.size > 0) {
          projects = formatted.filter((p) => assignedIds.has(p.id));
        } else {
          // Si no tiene proyectos asignados específicamente, mostrar proyectos activos
          projects = formatted;
        }
      } else {
        projects = formatted;
      }
    }
  } catch (err) {
    console.warn('Error consultando proyectos en requerimiento-compra:', err);
  }

  // 3. Consultar usuarios asignados por proyecto para el desplegable de aprobadores
  const projectUsers: Record<string, Array<{ id: string; full_name: string; email: string; role: string }>> = {};
  let allApprovers: Array<{ id: string; full_name: string; email: string; role: string }> = [];

  try {
    const { data: upRows } = await supabase
      .from('user_projects')
      .select('project_id, user_id, users(id, full_name, email, role, is_active)');

    if (upRows) {
      for (const up of upRows) {
        const u = up.users as unknown as { id: string; full_name: string; email: string; role: string; is_active: boolean } | null;
        if (u && u.is_active !== false && up.project_id) {
          if (!projectUsers[up.project_id]) {
            projectUsers[up.project_id] = [];
          }
          if (!projectUsers[up.project_id].some((existing) => existing.id === u.id)) {
            projectUsers[up.project_id].push({
              id: u.id,
              full_name: u.full_name,
              email: u.email,
              role: u.role,
            });
          }
        }
      }
    }

    // Usuarios con roles de gestión o activos para fallback garantizado
    const { data: adminUsers } = await supabase
      .from('users')
      .select('id, full_name, email, role, is_active')
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    if (adminUsers) {
      allApprovers = adminUsers.map((u) => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
      }));
    }
  } catch (uErr) {
    console.warn('Error obteniendo usuarios de proyectos:', uErr);
  }

  // 3b. Consultar presupuestos APU asociados a proyectos (para autocompletar Rubro de Presupuesto)
  const projectBudgets: Record<
    string,
    {
      budget_id: string;
      budget_code: string;
      project_title: string;
      items: Array<{
        id: string;
        category?: string;
        description: string;
        brand?: string;
        suggested_supplier?: string;
        unit: string;
        quantity: number;
        unit_cost: number;
      }>;
    }
  > = {};

  try {
    const { data: allBudgets } = await supabase
      .from('commercial_budgets')
      .select('id, budget_code, project_title, client_name, items_detail');

    if (allBudgets && allBudgets.length > 0) {
      const budgetMap = new Map<string, typeof allBudgets[0]>();
      allBudgets.forEach((b) => budgetMap.set(b.id, b));

      const { data: allPrjWithBudgets } = await supabase
        .from('projects')
        .select('id, commercial_budget_id, commercial_proposal_id')
        .eq('is_active', true);

      if (allPrjWithBudgets) {
        for (const p of allPrjWithBudgets) {
          const bId = p.commercial_budget_id as string | undefined;
          if (bId && budgetMap.has(bId)) {
            const b = budgetMap.get(bId)!;
            const rawItems = Array.isArray(b.items_detail) ? b.items_detail : [];
            projectBudgets[p.id as string] = {
              budget_id: b.id,
              budget_code: b.budget_code,
              project_title: b.project_title,
              items: rawItems
                .map((it: Record<string, unknown>) => ({
                  id: (it.id as string) || String(Math.random()),
                  category: (it.category as string) || 'materials',
                  description: String(it.description || '').trim(),
                  brand: String(it.brand || '').trim(),
                  suggested_supplier: String(it.suggested_supplier || '').trim(),
                  unit: String(it.unit || 'Und').trim(),
                  quantity: Number(it.quantity) || 1,
                  unit_cost: Number(it.unit_cost) || 0,
                }))
                .filter((it: { description: string }) => Boolean(it.description)),
            };
          }
        }
      }

      // Complementar con propuestas vinculadas a proyectos
      const { data: propRows } = await supabase
        .from('commercial_proposals')
        .select('project_id, budget_id')
        .not('project_id', 'is', null)
        .not('budget_id', 'is', null);

      if (propRows) {
        for (const pr of propRows) {
          if (pr.project_id && pr.budget_id && !projectBudgets[pr.project_id] && budgetMap.has(pr.budget_id)) {
            const b = budgetMap.get(pr.budget_id)!;
            const rawItems = Array.isArray(b.items_detail) ? b.items_detail : [];
            projectBudgets[pr.project_id] = {
              budget_id: b.id,
              budget_code: b.budget_code,
              project_title: b.project_title,
              items: rawItems
                .map((it: Record<string, unknown>) => ({
                  id: (it.id as string) || String(Math.random()),
                  category: (it.category as string) || 'materials',
                  description: String(it.description || '').trim(),
                  brand: String(it.brand || '').trim(),
                  suggested_supplier: String(it.suggested_supplier || '').trim(),
                  unit: String(it.unit || 'Und').trim(),
                  quantity: Number(it.quantity) || 1,
                  unit_cost: Number(it.unit_cost) || 0,
                }))
                .filter((it: { description: string }) => Boolean(it.description)),
            };
          }
        }
      }
    }
  } catch (bErr) {
    console.warn('Error obteniendo presupuestos de proyectos:', bErr);
  }

  // 3c. Consultar catálogo de descripciones canónicas previas para autocompletado typeahead
  const historicalMap = new Map<string, { description: string; brand?: string; suggested_supplier?: string; unit?: string }>();
  try {
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
  } catch (cErr) {
    console.warn('Error consultando catálogo previo en requerimiento-compra:', cErr);
  }

  const historicalCatalog = Array.from(historicalMap.values()).slice(0, 100);

  // 4. Calcular siguiente consecutivo automatizado con tolerancia de esquema
  let nextConsecutive = 1;
  try {
    const { count } = await supabase
      .from('purchase_requests')
      .select('*', { count: 'exact', head: true });
    nextConsecutive = (count ?? 0) + 1;

    const { data: maxRow, error: maxErr } = await supabase
      .from('purchase_requests')
      .select('consecutive')
      .not('consecutive', 'is', null)
      .order('consecutive', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!maxErr && maxRow?.consecutive && typeof maxRow.consecutive === 'number') {
      nextConsecutive = Math.max(nextConsecutive, maxRow.consecutive + 1);
    }
  } catch (e) {
    console.warn('Advertencia al consultar consecutivo de purchase_requests:', e);
  }

  const requestCode = `REQ-${String(nextConsecutive).padStart(4, '0')}`;

  return NextResponse.json({
    success: true,
    user: {
      id: dbUser.id,
      full_name: dbUser.full_name || session.user.name || '',
      email: dbUser.email,
      role: dbUser.role,
    },
    nextConsecutive,
    requestCode,
    projects,
    projectUsers,
    projectBudgets,
    historicalCatalog,
    allApprovers,
    today: new Date().toISOString().split('T')[0],
  });
}

// POST: Registrar Solicitud de Requerimiento con consecutivo secuencial
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // 1. Obtener usuario de la base de datos (con coincidencia robusta)
  let dbUser: { id: string; full_name?: string | null; email: string; role: string } | null = null;
  try {
    const { data: userByEmail } = await supabase
      .from('users')
      .select('id, full_name, email, role')
      .ilike('email', session.user.email.trim())
      .maybeSingle();

    if (userByEmail) {
      dbUser = userByEmail;
    } else if (session.user.id) {
      const { data: userById } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('id', session.user.id)
        .maybeSingle();
      if (userById) dbUser = userById;
    }
  } catch (err) {
    console.warn('Error consultando usuario en POST requerimiento-compra:', err);
  }

  if (!dbUser && session.user.id) {
    dbUser = {
      id: session.user.id,
      full_name: session.user.name || session.user.email.split('@')[0],
      email: session.user.email,
      role: session.user.role || 'operator',
    };
  }

  if (!dbUser || dbUser.role === 'pending') {
    return NextResponse.json({ error: 'Usuario no autorizado o pendiente de aprobación' }, { status: 403 });
  }

  // 2. Extraer y validar body
  const body = await req.json();
  const {
    project_id,
    cost_center,
    project_name,
    client_name,
    applicant_name,
    applicant_cedula,
    approver_name,
    approver_user_id,
    delivery_date,
    delivery_site,
    contact_phone,
    items,
  } = body;

  if (!project_id) {
    return NextResponse.json({ error: 'Debe seleccionar un proyecto válido.' }, { status: 400 });
  }

  if (!applicant_name || !String(applicant_name).trim()) {
    return NextResponse.json({ error: 'El nombre del solicitante es obligatorio.' }, { status: 400 });
  }

  if (!applicant_cedula || !String(applicant_cedula).trim()) {
    return NextResponse.json({ error: 'La cédula del solicitante es obligatoria para la firma digital.' }, { status: 400 });
  }

  if (!approver_name || !String(approver_name).trim()) {
    return NextResponse.json({ error: 'El nombre de quien aprueba es obligatorio.' }, { status: 400 });
  }

  if (!delivery_date) {
    return NextResponse.json({ error: 'La fecha de entrega es obligatoria.' }, { status: 400 });
  }

  if (!delivery_site || !String(delivery_site).trim()) {
    return NextResponse.json({ error: 'El sitio de entrega es obligatorio.' }, { status: 400 });
  }

  if (!contact_phone || !String(contact_phone).trim()) {
    return NextResponse.json({ error: 'El contacto / teléfono es obligatorio.' }, { status: 400 });
  }

  const rawItems: PurchaseRequestItem[] = Array.isArray(items) ? items : [];
  if (rawItems.length === 0) {
    return NextResponse.json({ error: 'Debe agregar al menos un ítem al requerimiento.' }, { status: 400 });
  }

  // Validar y normalizar ítems con fecha inmutable y clave normalizada sin duplicar rubro
  const nowIso = new Date().toISOString();
  const sanitizedItems: PurchaseRequestItem[] = rawItems.map((item, index) => {
    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(item.unit_price) || 0;
    const total = qty * unitPrice;
    const desc = String(item.description || '').trim();
    const normalizedKey = desc
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    return {
      item_no: index + 1,
      quantity: qty,
      unit: String(item.unit || 'Und').trim(),
      description: desc,
      normalized_key: normalizedKey,
      budget_item_id: item.budget_item_id ? String(item.budget_item_id).trim() : undefined,
      brand: String(item.brand || '').trim(),
      suggested_supplier: String(item.suggested_supplier || '').trim(),
      unit_price: unitPrice,
      total,
      recorded_at: nowIso,
      delivery_site: String(delivery_site || '').trim(),
      project_id: String(project_id || '').trim(),
      cost_center: String(cost_center || '').trim(),
    };
  });

  // Validar que cada ítem tenga descripción
  for (const it of sanitizedItems) {
    if (!it.description) {
      return NextResponse.json({ error: `El ítem #${it.item_no} debe tener una descripción válida.` }, { status: 400 });
    }
  }

  const totalAmount = sanitizedItems.reduce((acc, it) => acc + it.total, 0);

  // 3. Determinar consecutivo en tiempo real de inserción
  let consecutive = 1;
  try {
    const { data: maxRow } = await supabase
      .from('purchase_requests')
      .select('consecutive')
      .not('consecutive', 'is', null)
      .order('consecutive', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxRow?.consecutive && typeof maxRow.consecutive === 'number') {
      consecutive = maxRow.consecutive + 1;
    } else {
      const { count } = await supabase
        .from('purchase_requests')
        .select('*', { count: 'exact', head: true });
      consecutive = (count ?? 0) + 1;
    }
  } catch (err) {
    console.warn('Error calculando consecutivo en POST purchase_requests:', err);
  }

  const requestCode = `REQ-${String(consecutive).padStart(4, '0')}`;
  const title = `Requerimiento ${requestCode} - ${project_name || cost_center || 'Operación'}`;
  const justification = `Entrega en ${delivery_site}. Contacto: ${contact_phone}. Aprobado por: ${approver_name}. Cédula solicitante: ${String(applicant_cedula).trim()}.`;

  const nowFormatted = formatDateTimeCO(new Date());
  const initialSignatures = {
    applicant: {
      name: String(applicant_name).trim(),
      cedula: String(applicant_cedula).trim(),
      date_time: nowFormatted,
      role_label: 'Solicitante / Ingeniero de Campo',
      user_id: dbUser.id,
    },
  };

  // 4. Intentar inserción con esquema completo
  try {
    const { data, error } = await supabase
      .from('purchase_requests')
      .insert({
        project_id,
        user_id: dbUser.id,
        title,
        category: 'insumos_campo',
        priority: 'media',
        required_date: delivery_date,
        items: sanitizedItems,
        justification,
        status: 'pending',
        consecutive,
        request_code: requestCode,
        applicant_name: String(applicant_name).trim(),
        applicant_cedula: String(applicant_cedula).trim(),
        approver_name: String(approver_name).trim(),
        approver_user_id: approver_user_id || null,
        delivery_date,
        delivery_site: String(delivery_site).trim(),
        contact_phone: String(contact_phone).trim(),
        cost_center: String(cost_center || '').trim(),
        client_name: String(client_name || '').trim(),
        total_amount: totalAmount,
        signatures: initialSignatures,
      })
      .select()
      .single();

    if (error) {
      // Si el error es porque alguna columna nueva aún no existe en Supabase remoto, hacemos fallback
      if (error.message.includes('column') || error.code === '42703') {
        console.warn('Detectada falta de columnas extendidas en purchase_requests, aplicando fallback resiliente...');
        const extendedItemsPayload = {
          _metadata: {
            consecutive,
            request_code: requestCode,
            applicant_name,
            applicant_cedula: String(applicant_cedula).trim(),
            approver_name,
            delivery_date,
            delivery_site,
            contact_phone,
            cost_center,
            client_name,
            total_amount: totalAmount,
            signatures: initialSignatures,
          },
          items: sanitizedItems,
        };

        const { data: fallbackData, error: fallbackError } = await supabase
          .from('purchase_requests')
          .insert({
            project_id,
            user_id: dbUser.id,
            title,
            category: 'insumos_campo',
            priority: 'media',
            required_date: delivery_date,
            items: extendedItemsPayload,
            justification,
            status: 'pending',
          })
          .select()
          .single();

        if (fallbackError) throw fallbackError;
        return NextResponse.json({
          success: true,
          message: 'Solicitud de Requerimiento registrada con éxito.',
          data: fallbackData,
          request_code: requestCode,
          consecutive,
        });
      }

      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Solicitud de Requerimiento registrada con éxito.',
      data,
      request_code: requestCode,
      consecutive,
      applicant_cedula: String(applicant_cedula).trim(),
    });
  } catch (insertError: unknown) {
    console.error('Error insertando en purchase_requests:', insertError);
    const msg = insertError instanceof Error ? insertError.message : 'Error interno al guardar requerimiento';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
