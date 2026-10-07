import { createAdminClient } from '@/lib/supabase';

export interface ActivityRecord {
  id: string;
  created_at: string;
  date: string;
  type: string;
  category: 'cad' | 'gpr' | 'hseq' | 'purchasing' | 'commercial' | 'finance' | 'accounting' | 'warehouse' | 'rrhh';
  formSlug: string;
  projectName: string;
  projectCode: string;
  detail: string;
  userName: string;
  userEmail: string;
  status: string;
  statusLabel: string;
}

export async function getDashboardActivities({
  isAdmin,
  userId,
  userEmail,
  limit = 100,
}: {
  isAdmin: boolean;
  userId: string;
  userEmail?: string;
  limit?: number;
}): Promise<ActivityRecord[]> {
  const supabase = createAdminClient();
  const cappedLimit = Math.min(Math.max(limit, 10), 100);

  // 1. Cargar Usuarios y Proyectos para mapeo O(1)
  const [usersRes, projectsRes] = await Promise.all([
    supabase.from('users').select('id, full_name, nick_name, email'),
    supabase.from('projects').select('id, name, cost_center'),
  ]);

  const userMap = new Map<string, { name: string; email: string }>();
  for (const u of usersRes.data ?? []) {
    userMap.set(u.id, {
      name: u.nick_name || u.full_name || u.email,
      email: u.email || '',
    });
  }

  const projectMap = new Map<string, { name: string; code: string }>();
  for (const p of projectsRes.data ?? []) {
    const code = p.cost_center || 'CC-S/N';
    projectMap.set(p.id, {
      name: p.name || 'Sin Asignar',
      code,
    });
  }

  const activities: ActivityRecord[] = [];
  const tasks: Promise<void>[] = [];

  // Helper para resolver usuario
  const resolveUser = (uid?: string | null, fallbackName?: string | null, fallbackEmail?: string | null) => {
    if (uid && userMap.has(uid)) {
      return userMap.get(uid)!;
    }
    return {
      name: fallbackName || 'Colaborador',
      email: fallbackEmail || '',
    };
  };

  // Helper para resolver proyecto
  const resolveProject = (pid?: string | null, fallbackName?: string | null) => {
    if (pid && projectMap.has(pid)) {
      return projectMap.get(pid)!;
    }
    return {
      name: fallbackName || 'General / Corporativo',
      code: 'PCM',
    };
  };

  // 1. CAD / BIM (drawing_activities)
  tasks.push(
    (async () => {
      try {
        let q = supabase
          .from('drawing_activities')
          .select('id, created_at, activity_date, project_name, responsible, software, elaboration_stage, hours_worked, is_rework, user_id')
          .order('created_at', { ascending: false })
          .limit(cappedLimit);

        if (!isAdmin && userId) {
          q = userEmail ? q.or(`user_id.eq.${userId},responsible.ilike.${userEmail}`) : q.eq('user_id', userId);
        }

        const { data } = await q;
        for (const r of data ?? []) {
          const u = resolveUser(r.user_id, r.responsible, r.responsible);
          activities.push({
            id: `cad-${r.id}`,
            created_at: r.created_at || `${r.activity_date}T12:00:00Z`,
            date: r.activity_date || r.created_at?.split('T')[0] || '',
            type: 'CAD / BIM',
            category: 'cad',
            formSlug: 'cad-register-form',
            projectName: r.project_name || 'Sin Asignar',
            projectCode: 'CAD',
            detail: `${Number(r.hours_worked || 8.5).toFixed(1)}h · ${r.software || 'AutoCAD'} · ${r.elaboration_stage || 'Modelado'}${r.is_rework ? ' (Reproceso)' : ''}`,
            userName: u.name,
            userEmail: u.email,
            status: 'submitted',
            statusLabel: 'Registrado',
          });
        }
      } catch (err) {
        console.error('Error cargando drawing_activities:', err);
      }
    })()
  );

  // 2. GPR - Reportes de Campo (field_reports)
  tasks.push(
    (async () => {
      try {
        let q = supabase
          .from('field_reports')
          .select('id, created_at, report_date, project_id, created_by, localizador_name, gpr_equipment, antenna_frequency, cad_priority, status')
          .order('created_at', { ascending: false })
          .limit(cappedLimit);

        if (!isAdmin && userId) {
          q = q.eq('created_by', userId);
        }

        const { data } = await q;
        for (const r of data ?? []) {
          const u = resolveUser(r.created_by, r.localizador_name);
          const p = resolveProject(r.project_id, 'Operación Campo GPR');
          activities.push({
            id: `gpr-${r.id}`,
            created_at: r.created_at || `${r.report_date}T12:00:00Z`,
            date: r.report_date || r.created_at?.split('T')[0] || '',
            type: 'Reporte GPR',
            category: 'gpr',
            formSlug: 'gpr-field-form',
            projectName: p.name,
            projectCode: p.code,
            detail: `Antena: ${r.antenna_frequency || r.gpr_equipment || 'Georradar'} · Prioridad: ${r.cad_priority || 'Media'}`,
            userName: u.name,
            userEmail: u.email,
            status: r.status || 'submitted',
            statusLabel: r.status === 'reviewed' ? 'Revisado' : 'Enviado',
          });
        }
      } catch (err) {
        console.error('Error cargando field_reports:', err);
      }
    })()
  );

  // 3. HSEQ - Inspecciones (hseq_inspections)
  tasks.push(
    (async () => {
      try {
        let q = supabase
          .from('hseq_inspections')
          .select('id, created_at, inspection_date, project_id, user_id, operator_name, format_title, format_code, equipment_brand_model, status')
          .order('created_at', { ascending: false })
          .limit(cappedLimit);

        if (!isAdmin && userId) {
          q = q.eq('user_id', userId);
        }

        const { data } = await q;
        for (const r of data ?? []) {
          const u = resolveUser(r.user_id, r.operator_name);
          const p = resolveProject(r.project_id, 'Frente de Obra HSEQ');
          activities.push({
            id: `hseq-${r.id}`,
            created_at: r.created_at || `${r.inspection_date}T12:00:00Z`,
            date: r.inspection_date || r.created_at?.split('T')[0] || '',
            type: 'Inspección HSEQ',
            category: 'hseq',
            formSlug: 'hseq-report',
            projectName: p.name,
            projectCode: p.code,
            detail: `${r.format_title || 'Inspección Pre-operacional'}${r.equipment_brand_model ? ` · ${r.equipment_brand_model}` : ''}`,
            userName: u.name,
            userEmail: u.email,
            status: r.status || 'submitted',
            statusLabel: 'Enviado',
          });
        }
      } catch (err) {
        console.error('Error cargando hseq_inspections:', err);
      }
    })()
  );

  // 4. SIG - Gestión del Cambio (sig_management_changes)
  tasks.push(
    (async () => {
      try {
        let q = supabase
          .from('sig_management_changes')
          .select('id, created_at, identification_date, project_id, user_id, identifier_name, official_code, change_description, status')
          .order('created_at', { ascending: false })
          .limit(cappedLimit);

        if (!isAdmin && userId) {
          q = q.eq('user_id', userId);
        }

        const { data } = await q;
        for (const r of data ?? []) {
          const u = resolveUser(r.user_id, r.identifier_name);
          const p = resolveProject(r.project_id, 'SIG Corporativo');
          activities.push({
            id: `sig-${r.id}`,
            created_at: r.created_at || `${r.identification_date}T12:00:00Z`,
            date: r.identification_date || r.created_at?.split('T')[0] || '',
            type: 'Cambio SIG',
            category: 'hseq',
            formSlug: 'analisis-planificacion-cambios-sig',
            projectName: p.name,
            projectCode: p.code,
            detail: `${r.official_code || 'FOR-SIG-001'} · ${(r.change_description || '').substring(0, 60)}`,
            userName: u.name,
            userEmail: u.email,
            status: r.status || 'submitted',
            statusLabel: 'Registrado',
          });
        }
      } catch (err) {
        console.error('Error cargando sig_management_changes:', err);
      }
    })()
  );

  // 5. COMPRAS - Requerimientos (purchase_requests)
  tasks.push(
    (async () => {
      try {
        let q = supabase
          .from('purchase_requests')
          .select('id, created_at, required_date, project_id, user_id, title, priority, status')
          .order('created_at', { ascending: false })
          .limit(cappedLimit);

        if (!isAdmin && userId) {
          q = q.eq('user_id', userId);
        }

        const { data } = await q;
        for (const r of data ?? []) {
          const u = resolveUser(r.user_id);
          const p = resolveProject(r.project_id);
          const s = (r.status || 'pending').toLowerCase();
          let statusLabel = 'Pendiente';
          if (s === 'approved') {
            statusLabel = 'Aprobado';
          } else if (s === 'in_quotation') {
            statusLabel = 'En Cotización';
          } else if (s === 'quoted') {
            statusLabel = 'Cotizado';
          } else if (s === 'purchased') {
            statusLabel = 'Comprado';
          } else if (s === 'rejected') {
            statusLabel = 'Rechazado';
          } else {
            statusLabel = 'Pendiente';
          }

          activities.push({
            id: `req-${r.id}`,
            created_at: r.created_at,
            date: r.required_date || r.created_at?.split('T')[0] || '',
            type: 'Requerimiento Compra',
            category: 'purchasing',
            formSlug: 'requerimiento-compra',
            projectName: p.name,
            projectCode: p.code,
            detail: `${r.title} · Prioridad: ${r.priority || 'Media'}`,
            userName: u.name,
            userEmail: u.email,
            status: s,
            statusLabel,
          });
        }
      } catch (err) {
        console.error('Error cargando purchase_requests:', err);
      }
    })()
  );

  // 6. COMPRAS - Órdenes de Compra (purchase_orders)
  tasks.push(
    (async () => {
      try {
        let q = supabase
          .from('purchase_orders')
          .select('id, created_at, project_id, user_id, order_code, supplier_name, total_amount, status')
          .order('created_at', { ascending: false })
          .limit(cappedLimit);

        if (!isAdmin && userId) {
          q = q.eq('user_id', userId);
        }

        const { data } = await q;
        for (const r of data ?? []) {
          const u = resolveUser(r.user_id);
          const p = resolveProject(r.project_id);
          activities.push({
            id: `po-${r.id}`,
            created_at: r.created_at,
            date: r.created_at?.split('T')[0] || '',
            type: 'Orden de Compra',
            category: 'purchasing',
            formSlug: 'orden-compra',
            projectName: p.name,
            projectCode: p.code,
            detail: `${r.order_code} · ${r.supplier_name} ($${Number(r.total_amount || 0).toLocaleString('es-CO')} COP)`,
            userName: u.name,
            userEmail: u.email,
            status: r.status || 'issued',
            statusLabel: 'Emitida',
          });
        }
      } catch (err) {
        console.error('Error cargando purchase_orders:', err);
      }
    })()
  );

  // 7. COMPRAS - Evaluaciones de Proveedores (supplier_evaluations)
  tasks.push(
    (async () => {
      try {
        let q = supabase
          .from('supplier_evaluations')
          .select('id, created_at, user_id, supplier_name, overall_rating')
          .order('created_at', { ascending: false })
          .limit(cappedLimit);

        if (!isAdmin && userId) {
          q = q.eq('user_id', userId);
        }

        const { data } = await q;
        for (const r of data ?? []) {
          const u = resolveUser(r.user_id);
          activities.push({
            id: `eval-${r.id}`,
            created_at: r.created_at,
            date: r.created_at?.split('T')[0] || '',
            type: 'Evaluación Proveedor',
            category: 'purchasing',
            formSlug: 'evaluacion-proveedor',
            projectName: 'Compras Corporativas',
            projectCode: 'COM',
            detail: `${r.supplier_name} · Puntuación: ${r.overall_rating || 5}/5`,
            userName: u.name,
            userEmail: u.email,
            status: 'submitted',
            statusLabel: 'Registrada',
          });
        }
      } catch (err) {
        console.error('Error cargando supplier_evaluations:', err);
      }
    })()
  );

  // 8. COMERCIAL - Oportunidades (commercial_opportunities)
  tasks.push(
    (async () => {
      try {
        let q = supabase
          .from('commercial_opportunities')
          .select('id, created_at, user_id, opportunity_title, client_name, service_type, estimated_value, status')
          .order('created_at', { ascending: false })
          .limit(cappedLimit);

        if (!isAdmin && userId) {
          q = q.eq('user_id', userId);
        }

        const { data } = await q;
        for (const r of data ?? []) {
          const u = resolveUser(r.user_id);
          activities.push({
            id: `opp-${r.id}`,
            created_at: r.created_at,
            date: r.created_at?.split('T')[0] || '',
            type: 'Oportunidad Comercial',
            category: 'commercial',
            formSlug: 'registro-oportunidad',
            projectName: r.client_name,
            projectCode: 'CRM',
            detail: `${r.opportunity_title}${r.estimated_value ? ` · $${Number(r.estimated_value).toLocaleString('es-CO')} COP` : ''}`,
            userName: u.name,
            userEmail: u.email,
            status: r.status || 'open',
            statusLabel: 'Abierta',
          });
        }
      } catch (err) {
        console.error('Error cargando commercial_opportunities:', err);
      }
    })()
  );

  // 8.1. COMERCIAL - Presupuestos APU (commercial_budgets)
  tasks.push(
    (async () => {
      try {
        let q = supabase
          .from('commercial_budgets')
          .select('id, created_at, created_by_user_id, budget_code, client_name, project_title, suggested_sale_price, status')
          .order('created_at', { ascending: false })
          .limit(cappedLimit);

        if (!isAdmin && userId) {
          q = q.eq('created_by_user_id', userId);
        }

        const { data } = await q;
        for (const r of data ?? []) {
          const u = resolveUser(r.created_by_user_id);
          activities.push({
            id: `budget-${r.id}`,
            created_at: r.created_at,
            date: r.created_at?.split('T')[0] || '',
            type: 'Presupuesto APU',
            category: 'commercial',
            formSlug: 'presupuesto-proyecto',
            projectName: r.client_name,
            projectCode: 'APU',
            detail: `${r.budget_code} · ${r.project_title} · $${Number(r.suggested_sale_price || 0).toLocaleString('es-CO')} COP`,
            userName: u.name,
            userEmail: u.email,
            status: r.status || 'draft',
            statusLabel: 'Costeado',
          });
        }
      } catch (err) {
        // Ignorar si la tabla no existe aún
      }
    })()
  );


  // 9. COMERCIAL - Cotizaciones (commercial_proposals)
  tasks.push(
    (async () => {
      try {
        let q = supabase
          .from('commercial_proposals')
          .select('id, created_at, user_id, quote_code, client_name, total_amount')
          .order('created_at', { ascending: false })
          .limit(cappedLimit);

        if (!isAdmin && userId) {
          q = q.eq('user_id', userId);
        }

        const { data } = await q;
        for (const r of data ?? []) {
          const u = resolveUser(r.user_id);
          activities.push({
            id: `prop-${r.id}`,
            created_at: r.created_at,
            date: r.created_at?.split('T')[0] || '',
            type: 'Cotización Comercial',
            category: 'commercial',
            formSlug: 'cotizacion-comercial',
            projectName: r.client_name,
            projectCode: 'COT',
            detail: `${r.quote_code} · $${Number(r.total_amount || 0).toLocaleString('es-CO')} COP`,
            userName: u.name,
            userEmail: u.email,
            status: 'submitted',
            statusLabel: 'Emitida',
          });
        }
      } catch (err) {
        console.error('Error cargando commercial_proposals:', err);
      }
    })()
  );

  // 10. FINANZAS - Solicitud de Viáticos (per_diem_requests)
  tasks.push(
    (async () => {
      try {
        let q = supabase
          .from('per_diem_requests')
          .select('id, created_at, departure_date, project_id, user_id, beneficiary_name, destination, estimated_total, status')
          .order('created_at', { ascending: false })
          .limit(cappedLimit);

        if (!isAdmin && userId) {
          q = q.eq('user_id', userId);
        }

        const { data } = await q;
        for (const r of data ?? []) {
          const u = resolveUser(r.user_id);
          const p = resolveProject(r.project_id);
          activities.push({
            id: `viat-${r.id}`,
            created_at: r.created_at,
            date: r.departure_date || r.created_at?.split('T')[0] || '',
            type: 'Solicitud Viáticos',
            category: 'finance',
            formSlug: 'solicitud-viaticos',
            projectName: p.name,
            projectCode: p.code,
            detail: `${r.beneficiary_name} · ${r.destination} · $${Number(r.estimated_total || 0).toLocaleString('es-CO')} COP`,
            userName: u.name,
            userEmail: u.email,
            status: r.status || 'submitted',
            statusLabel: 'Enviada',
          });
        }
      } catch (err) {
        console.error('Error cargando per_diem_requests:', err);
      }
    })()
  );

  // 11. FINANZAS - Legalización de Gastos (expense_legalizations)
  tasks.push(
    (async () => {
      try {
        let q = supabase
          .from('expense_legalizations')
          .select('id, created_at, project_id, user_id, advancement_amount, total_spent, balance, status')
          .order('created_at', { ascending: false })
          .limit(cappedLimit);

        if (!isAdmin && userId) {
          q = q.eq('user_id', userId);
        }

        const { data } = await q;
        for (const r of data ?? []) {
          const u = resolveUser(r.user_id);
          const p = resolveProject(r.project_id);
          activities.push({
            id: `leg-${r.id}`,
            created_at: r.created_at,
            date: r.created_at?.split('T')[0] || '',
            type: 'Legalización Gastos',
            category: 'finance',
            formSlug: 'legalizacion-gastos',
            projectName: p.name,
            projectCode: p.code,
            detail: `Gastado: $${Number(r.total_spent || 0).toLocaleString('es-CO')} · Saldo: $${Number(r.balance || 0).toLocaleString('es-CO')}`,
            userName: u.name,
            userEmail: u.email,
            status: r.status || 'submitted',
            statusLabel: 'Enviada',
          });
        }
      } catch (err) {
        console.error('Error cargando expense_legalizations:', err);
      }
    })()
  );

  // 12. FINANZAS - Registro de Pagos (payment_records)
  tasks.push(
    (async () => {
      try {
        let q = supabase
          .from('payment_records')
          .select('id, created_at, payment_date, user_id, payment_concept, recipient_name, amount')
          .order('created_at', { ascending: false })
          .limit(cappedLimit);

        if (!isAdmin && userId) {
          q = q.eq('user_id', userId);
        }

        const { data } = await q;
        for (const r of data ?? []) {
          const u = resolveUser(r.user_id);
          activities.push({
            id: `pay-${r.id}`,
            created_at: r.created_at,
            date: r.payment_date || r.created_at?.split('T')[0] || '',
            type: 'Comprobante Pago',
            category: 'finance',
            formSlug: 'registro-pago',
            projectName: r.recipient_name,
            projectCode: 'TES',
            detail: `${r.payment_concept} · $${Number(r.amount || 0).toLocaleString('es-CO')} COP`,
            userName: u.name,
            userEmail: u.email,
            status: 'submitted',
            statusLabel: 'Pagado',
          });
        }
      } catch (err) {
        console.error('Error cargando payment_records:', err);
      }
    })()
  );

  // 13. CONTABILIDAD - Radicación de Facturas (invoice_filings)
  tasks.push(
    (async () => {
      try {
        let q = supabase
          .from('invoice_filings')
          .select('id, created_at, issue_date, project_id, user_id, invoice_number, supplier_name, total_amount, status')
          .order('created_at', { ascending: false })
          .limit(cappedLimit);

        if (!isAdmin && userId) {
          q = q.eq('user_id', userId);
        }

        const { data } = await q;
        for (const r of data ?? []) {
          const u = resolveUser(r.user_id);
          const p = resolveProject(r.project_id);
          activities.push({
            id: `fac-${r.id}`,
            created_at: r.created_at,
            date: r.issue_date || r.created_at?.split('T')[0] || '',
            type: 'Radicación Factura',
            category: 'accounting',
            formSlug: 'radicacion-factura',
            projectName: p.name,
            projectCode: p.code,
            detail: `Factura ${r.invoice_number} · ${r.supplier_name} ($${Number(r.total_amount || 0).toLocaleString('es-CO')} COP)`,
            userName: u.name,
            userEmail: u.email,
            status: r.status || 'radicada',
            statusLabel: 'Radicada',
          });
        }
      } catch (err) {
        console.error('Error cargando invoice_filings:', err);
      }
    })()
  );

  // 14. CONTABILIDAD - Soportes de Cobro (billing_supports)
  tasks.push(
    (async () => {
      try {
        let q = supabase
          .from('billing_supports')
          .select('id, created_at, project_id, user_id, client_name, amount_to_bill, status')
          .order('created_at', { ascending: false })
          .limit(cappedLimit);

        if (!isAdmin && userId) {
          q = q.eq('user_id', userId);
        }

        const { data } = await q;
        for (const r of data ?? []) {
          const u = resolveUser(r.user_id);
          const p = resolveProject(r.project_id);
          activities.push({
            id: `bill-${r.id}`,
            created_at: r.created_at,
            date: r.created_at?.split('T')[0] || '',
            type: 'Soporte Cobro',
            category: 'accounting',
            formSlug: 'soporte-cobro',
            projectName: p.name,
            projectCode: p.code,
            detail: `${r.client_name} · A facturar: $${Number(r.amount_to_bill || 0).toLocaleString('es-CO')} COP`,
            userName: u.name,
            userEmail: u.email,
            status: r.status || 'ready_to_invoice',
            statusLabel: 'Por Facturar',
          });
        }
      } catch (err) {
        console.error('Error cargando billing_supports:', err);
      }
    })()
  );

  // 15. ALMACÉN - Despachos y Retornos (equipment_checkouts)
  tasks.push(
    (async () => {
      try {
        let q = supabase
          .from('equipment_checkouts')
          .select('id, created_at, checkout_date, project_id, user_id, responsible_name, responsible_user_id, status')
          .order('created_at', { ascending: false })
          .limit(cappedLimit);

        if (!isAdmin && userId) {
          q = q.or(`user_id.eq.${userId},responsible_user_id.eq.${userId}`);
        }

        const { data } = await q;
        for (const r of data ?? []) {
          const u = resolveUser(r.responsible_user_id || r.user_id, r.responsible_name);
          const p = resolveProject(r.project_id, 'Despacho de Instrumental');
          activities.push({
            id: `chk-${r.id}`,
            created_at: r.created_at,
            date: r.checkout_date || r.created_at?.split('T')[0] || '',
            type: 'Movimiento Almacén',
            category: 'warehouse',
            formSlug: 'registro-equipo',
            projectName: p.name,
            projectCode: p.code,
            detail: `Responsable: ${r.responsible_name || u.name} · Estado: ${r.status === 'returned' ? 'Retornado' : 'En Campo'}`,
            userName: u.name,
            userEmail: u.email,
            status: r.status || 'active',
            statusLabel: r.status === 'returned' ? 'Retornado' : 'En Campo',
          });
        }
      } catch (err) {
        console.error('Error cargando equipment_checkouts:', err);
      }
    })()
  );

  // 16. ALMACÉN - Consumibles (consumables_entries)
  tasks.push(
    (async () => {
      try {
        let q = supabase
          .from('consumables_entries')
          .select('id, created_at, entry_date, user_id, item_name, quantity, unit, supplier')
          .order('created_at', { ascending: false })
          .limit(cappedLimit);

        if (!isAdmin && userId) {
          q = q.eq('user_id', userId);
        }

        const { data } = await q;
        for (const r of data ?? []) {
          const u = resolveUser(r.user_id);
          activities.push({
            id: `con-${r.id}`,
            created_at: r.created_at,
            date: r.entry_date || r.created_at?.split('T')[0] || '',
            type: 'Ingreso Consumible',
            category: 'warehouse',
            formSlug: 'registro-equipo',
            projectName: 'Almacén Central',
            projectCode: 'BOD',
            detail: `${r.item_name} · ${r.quantity} ${r.unit}${r.supplier ? ` (${r.supplier})` : ''}`,
            userName: u.name,
            userEmail: u.email,
            status: 'submitted',
            statusLabel: 'Ingresado',
          });
        }
      } catch (err) {
        console.error('Error cargando consumables_entries:', err);
      }
    })()
  );

  // 17. RRHH - Cartas y Certificaciones (hr_letters)
  tasks.push(
    (async () => {
      try {
        let q = supabase
          .from('hr_letters')
          .select('id, created_at, project_id, user_id, recipient_name, letter_title, radicado, status')
          .order('created_at', { ascending: false })
          .limit(cappedLimit);

        if (!isAdmin && userId) {
          q = q.eq('user_id', userId);
        }

        const { data } = await q;
        for (const r of data ?? []) {
          const u = resolveUser(r.user_id);
          const p = resolveProject(r.project_id, 'Talento Humano');
          activities.push({
            id: `hr-${r.id}`,
            created_at: r.created_at,
            date: r.created_at?.split('T')[0] || '',
            type: 'Certificación RRHH',
            category: 'rrhh',
            formSlug: 'elaboracion-cartas',
            projectName: p.name,
            projectCode: p.code,
            detail: `${r.letter_title || 'Certificación'} · ${r.recipient_name || 'Colaborador'} · Radicado: ${r.radicado || 'S/N'}`,
            userName: u.name,
            userEmail: u.email,
            status: r.status || 'submitted',
            statusLabel: 'Emitida',
          });
        }
      } catch (err) {
        console.error('Error cargando hr_letters:', err);
      }
    })()
  );

  // Ejecución segura y paralela
  await Promise.allSettled(tasks);

  // Orden cronológico estricto: el más reciente primero
  activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Limitar al número máximo solicitado (tope duro de 100)
  return activities.slice(0, cappedLimit);
}
