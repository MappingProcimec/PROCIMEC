import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export interface PurchaseRequestItem {
  item_no: number;
  quantity: number;
  unit: string;
  description: string;
  client_quote_no: string;
  brand: string;
  suggested_supplier: string;
  unit_price: number;
  total: number;
}

// GET: Obtener proyectos habilitados, datos del usuario y siguiente consecutivo
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // 1. Obtener usuario de la base de datos
  const { data: dbUser, error: userError } = await supabase
    .from('users')
    .select('id, full_name, email, role, phone')
    .eq('email', session.user.email)
    .single();

  if (userError || !dbUser) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  if (dbUser.role === 'pending') {
    return NextResponse.json({ error: 'Usuario pendiente de aprobación' }, { status: 403 });
  }

  // 2. Proyectos habilitados para el usuario
  let projectsQuery = supabase
    .from('projects')
    .select('id, name, cost_center, code, client')
    .eq('is_active', true)
    .order('name', { ascending: true });

  const isAdmin = dbUser.role === 'admin' || dbUser.role === 'management' || dbUser.role === 'gerencia';

  if (!isAdmin) {
    const { data: userProjects } = await supabase
      .from('user_projects')
      .select('project_id')
      .eq('user_id', dbUser.id);

    const allowedIds = (userProjects ?? []).map((up: { project_id: string }) => up.project_id);
    if (allowedIds.length === 0) {
      // Si no tiene proyectos asignados individualmente pero tiene rol operativo, consultar si hay proyectos públicos
      projectsQuery = projectsQuery.in('id', ['none']);
    } else {
      projectsQuery = projectsQuery.in('id', allowedIds);
    }
  }

  const { data: projectsData, error: projectsError } = await projectsQuery;
  if (projectsError) {
    return NextResponse.json({ error: projectsError.message }, { status: 500 });
  }

  const projects = (projectsData ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    name: (p.name as string) || '',
    cost_center: ((p.cost_center as string) || (p.code as string) || '').trim(),
    client: ((p.client as string) || '').trim(),
  }));

  // 3. Calcular siguiente consecutivo automatizado
  let nextConsecutive = 1;
  try {
    const { data: maxRow } = await supabase
      .from('purchase_requests')
      .select('consecutive')
      .not('consecutive', 'is', null)
      .order('consecutive', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxRow?.consecutive && typeof maxRow.consecutive === 'number') {
      nextConsecutive = maxRow.consecutive + 1;
    } else {
      // Alternativa: contar total de registros
      const { count } = await supabase
        .from('purchase_requests')
        .select('*', { count: 'exact', head: true });
      nextConsecutive = (count ?? 0) + 1;
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
      phone: dbUser.phone || '',
      role: dbUser.role,
    },
    nextConsecutive,
    requestCode,
    projects,
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

  // 1. Obtener usuario de la base de datos
  const { data: dbUser } = await supabase
    .from('users')
    .select('id, full_name, email, role')
    .eq('email', session.user.email)
    .single();

  if (!dbUser || dbUser.role === 'pending') {
    return NextResponse.json({ error: 'Usuario no autorizado' }, { status: 403 });
  }

  // 2. Extraer y validar body
  const body = await req.json();
  const {
    project_id,
    cost_center,
    project_name,
    client_name,
    applicant_name,
    approver_name,
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

  // Validar y normalizar ítems
  const sanitizedItems: PurchaseRequestItem[] = rawItems.map((item, index) => {
    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(item.unit_price) || 0;
    const total = qty * unitPrice;
    return {
      item_no: index + 1,
      quantity: qty,
      unit: String(item.unit || 'Und').trim(),
      description: String(item.description || '').trim(),
      client_quote_no: String(item.client_quote_no || '').trim(),
      brand: String(item.brand || '').trim(),
      suggested_supplier: String(item.suggested_supplier || '').trim(),
      unit_price: unitPrice,
      total,
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
  const justification = `Entrega en ${delivery_site}. Contacto: ${contact_phone}. Aprobado por: ${approver_name}.`;

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
        approver_name: String(approver_name).trim(),
        delivery_date,
        delivery_site: String(delivery_site).trim(),
        contact_phone: String(contact_phone).trim(),
        cost_center: String(cost_center || '').trim(),
        client_name: String(client_name || '').trim(),
        total_amount: totalAmount,
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
            approver_name,
            delivery_date,
            delivery_site,
            contact_phone,
            cost_center,
            client_name,
            total_amount: totalAmount,
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
    });
  } catch (insertError: unknown) {
    console.error('Error insertando en purchase_requests:', insertError);
    const msg = insertError instanceof Error ? insertError.message : 'Error interno al guardar requerimiento';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
