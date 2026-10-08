import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseDateToIso(dateStr?: string | null): string | null {
  if (!dateStr || !dateStr.trim()) return null;
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parts = trimmed.split('/');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return trimmed;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { formSlug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { formSlug } = params;
  const body = await req.json();
  const supabase = createAdminClient();

  // Obtener usuario autenticado en BD
  const { data: dbUser } = await supabase
    .from('users')
    .select('id, full_name, email, role')
    .eq('email', session.user.email)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: 'Usuario no encontrado en la base de datos' }, { status: 404 });
  }

  // Bloquear usuarios pendientes
  if (dbUser.role === 'pending') {
    return NextResponse.json({ error: 'Usuario pendiente de aprobación' }, { status: 403 });
  }

  // Si no es admin, validar si tiene autorización por rol o asignación en user_forms
  if (dbUser.role !== 'admin') {
    let isAuthorized = false;

    // 1. Verificar si el formulario está asignado individualmente en user_forms
    try {
      const { data: uf } = await supabase
        .from('user_forms')
        .select('forms!inner(slug)')
        .eq('user_id', dbUser.id)
        .eq('forms.slug', formSlug)
        .maybeSingle();

      if (uf) isAuthorized = true;
    } catch {
      // Si la relación o tabla no responde, continuar validación por rol
    }

    // 2. Si no tiene asignación individual, verificar matriz de roles canónicos
    if (!isAuthorized) {
      const ROLE_ALLOWED_FORMS: Record<string, string[]> = {
        purchasing: ['requerimiento-compra', 'orden-compra', 'evaluacion-proveedor', 'registro-proveedor'],
        compras: ['requerimiento-compra', 'orden-compra', 'evaluacion-proveedor', 'registro-proveedor'],
        commercial: ['registro-oportunidad', 'cotizacion-comercial', 'cierre-comercial'],
        comercial: ['registro-oportunidad', 'cotizacion-comercial', 'cierre-comercial'],
        finance: ['solicitud-viaticos', 'legalizacion-gastos', 'registro-pago'],
        finanzas: ['solicitud-viaticos', 'legalizacion-gastos', 'registro-pago'],
        accounting: ['radicacion-factura', 'soporte-cobro', 'requerimiento-compra'],
        contabilidad: ['radicacion-factura', 'soporte-cobro', 'requerimiento-compra'],
        warehouse: ['requerimiento-compra', 'evaluacion-proveedor'],
        almacen: ['requerimiento-compra', 'evaluacion-proveedor'],
        management: [
          'requerimiento-compra', 'orden-compra', 'evaluacion-proveedor', 'registro-proveedor',
          'registro-oportunidad', 'cotizacion-comercial', 'cierre-comercial',
          'solicitud-viaticos', 'legalizacion-gastos', 'registro-pago',
          'radicacion-factura', 'soporte-cobro'
        ],
        gerencia: [
          'requerimiento-compra', 'orden-compra', 'evaluacion-proveedor', 'registro-proveedor',
          'registro-oportunidad', 'cotizacion-comercial', 'cierre-comercial',
          'solicitud-viaticos', 'legalizacion-gastos', 'registro-pago',
          'radicacion-factura', 'soporte-cobro'
        ],
        // Personal operativo y técnico: solicitudes y viáticos propios
        operator: ['requerimiento-compra', 'solicitud-viaticos', 'legalizacion-gastos'],
        localizador: ['requerimiento-compra', 'solicitud-viaticos', 'legalizacion-gastos'],
        dibujo: ['requerimiento-compra', 'solicitud-viaticos', 'legalizacion-gastos'],
        hseq: ['requerimiento-compra', 'solicitud-viaticos', 'legalizacion-gastos'],
        rrhh: ['requerimiento-compra', 'solicitud-viaticos', 'legalizacion-gastos'],
        hr: ['requerimiento-compra', 'solicitud-viaticos', 'legalizacion-gastos'],
      };

      const allowedFormsForRole = ROLE_ALLOWED_FORMS[dbUser.role] || [];
      if (allowedFormsForRole.includes(formSlug)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: `No tienes permisos para diligenciar el formulario '${formSlug}'.` },
        { status: 403 }
      );
    }
  }

  try {
    let result = null;

    // ──────────────────────────────────────────────────────────────────────────
    // 1. COMPRAS (purchasing)
    // ──────────────────────────────────────────────────────────────────────────
    if (formSlug === 'requerimiento-compra') {
      const { title, project_id, category, priority, required_date, items_text, justification } = body;
      if (!title?.trim()) return NextResponse.json({ error: 'El título del requerimiento es obligatorio' }, { status: 400 });

      const { data, error } = await supabase
        .from('purchase_requests')
        .insert({
          title: String(title).trim(),
          project_id: project_id || null,
          user_id: dbUser.id,
          category: category || 'general',
          priority: priority || 'media',
          required_date: required_date || null,
          items: [{ text: items_text || '' }],
          justification: String(justification || '').trim(),
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else if (formSlug === 'orden-compra') {
      const { order_code, project_id, supplier_name, supplier_nit, total_amount, delivery_deadline, payment_terms, notes } = body;
      if (!order_code?.trim() || !supplier_name?.trim()) {
        return NextResponse.json({ error: 'Código de orden y proveedor son obligatorios' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('purchase_orders')
        .insert({
          order_code: String(order_code).trim().toUpperCase(),
          project_id: project_id || null,
          user_id: dbUser.id,
          supplier_name: String(supplier_name).trim(),
          supplier_nit: supplier_nit ? String(supplier_nit).trim() : null,
          total_amount: Number(total_amount) || 0,
          delivery_deadline: delivery_deadline || null,
          payment_terms: payment_terms ? String(payment_terms).trim() : null,
          notes: notes ? String(notes).trim() : null,
          status: 'issued',
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else if (formSlug === 'evaluacion-proveedor') {
      const { supplier_name, quality_score, delivery_time_score, service_score, recommend_supplier, comments } = body;
      if (!supplier_name?.trim()) return NextResponse.json({ error: 'El nombre del proveedor es obligatorio' }, { status: 400 });

      const q = Number(quality_score) || 5;
      const d = Number(delivery_time_score) || 5;
      const s = Number(service_score) || 5;
      const rating = Number(((q + d + s) / 3).toFixed(2));

      const { data, error } = await supabase
        .from('supplier_evaluations')
        .insert({
          user_id: dbUser.id,
          supplier_name: String(supplier_name).trim(),
          quality_score: q,
          delivery_time_score: d,
          service_score: s,
          overall_rating: rating,
          recommend_supplier: recommend_supplier !== 'no',
          comments: comments ? String(comments).trim() : null,
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. COMERCIAL (commercial)
    // ──────────────────────────────────────────────────────────────────────────
    else if (formSlug === 'registro-oportunidad') {
      const { opportunity_title, client_name, client_contact, client_email, client_phone, service_type, estimated_value, deadline_date, location, notes } = body;
      if (!opportunity_title?.trim() || !client_name?.trim()) {
        return NextResponse.json({ error: 'Título de la oportunidad y cliente son obligatorios' }, { status: 400 });
      }

      const { count } = await supabase.from('commercial_opportunities').select('*', { count: 'exact', head: true });
      const consecutiveNum = (count || 0) + 1;
      const year = new Date().getFullYear();
      const oppCode = `OPP-${year}-${String(consecutiveNum).padStart(3, '0')}`;

      const oppPayload: Record<string, unknown> = {
        user_id: dbUser.id,
        consecutive_number: consecutiveNum,
        opportunity_code: oppCode,
        created_by_name: dbUser.full_name || session.user.name || 'Comercial',
        created_by_email: dbUser.email || session.user.email,
        opportunity_title: String(opportunity_title).trim(),
        client_name: String(client_name).trim(),
        client_contact: client_contact ? String(client_contact).trim() : null,
        client_email: client_email ? String(client_email).trim() : null,
        client_phone: client_phone ? String(client_phone).trim() : null,
        service_type: service_type || 'gpr_localizacion',
        estimated_value: estimated_value ? Number(estimated_value) : null,
        deadline_date: parseDateToIso(deadline_date),
        location: location ? String(location).trim() : null,
        notes: notes ? String(notes).trim() : null,
        status: 'open',
      };

      let { data, error } = await supabase.from('commercial_opportunities').insert(oppPayload).select().single();
      if (error && error.code === '42703') {
        delete oppPayload.consecutive_number;
        delete oppPayload.opportunity_code;
        delete oppPayload.created_by_name;
        delete oppPayload.created_by_email;
        const retry = await supabase.from('commercial_opportunities').insert(oppPayload).select().single();
        data = retry.data;
        error = retry.error;
      }

      if (error && (error.code === '23514' || String(error.message || '').includes('check constraint'))) {
        const originalService = String(oppPayload.service_type);
        oppPayload.service_type = 'consultoria';
        oppPayload.notes = `[Línea Solicitada: ${originalService}] ${oppPayload.notes || ''}`.trim();
        const retryCheck = await supabase.from('commercial_opportunities').insert(oppPayload).select().single();
        data = retryCheck.data;
        error = retryCheck.error;
      }

      if (error) throw error;
      result = data;
    } else if (formSlug === 'presupuesto-proyecto') {
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
        return NextResponse.json({ error: 'Nombre del cliente y proyecto son obligatorios' }, { status: 400 });
      }

      const mat = Number(direct_cost_materials) || 0;
      const eq = Number(direct_cost_equipment) || 0;
      const lab = Number(direct_cost_labor) || 0;
      const log = Number(direct_cost_logistics) || 0;
      const totalDirect = mat + eq + lab + log;
      const aiuPct = Number(aiu_percentage) > 0 ? Number(aiu_percentage) : 25.0;
      const suggestedSale = Math.round(totalDirect * (1 + aiuPct / 100));

      const { count } = await supabase.from('commercial_budgets').select('*', { count: 'exact', head: true });
      const consecutiveNum = (count || 0) + 1;
      const year = new Date().getFullYear();
      const budgetCode = `PRE-${year}-${String(consecutiveNum).padStart(3, '0')}`;

      const { data, error } = await supabase.from('commercial_budgets').insert({
        consecutive_number: consecutiveNum,
        budget_code: budgetCode,
        opportunity_id: opportunity_id || null,
        created_by_user_id: dbUser.id,
        created_by_name: dbUser.full_name || session.user.name || 'Área Técnica',
        created_by_email: dbUser.email || session.user.email,
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
        items_detail: Array.isArray(items_detail) ? items_detail : [],
        status: status || 'draft',
        notes: notes ? String(notes).trim() : null,
      }).select().single();

      if (error) throw error;
      result = data;
    } else if (formSlug === 'cotizacion-comercial') {
      const { quote_code, client_name, scope_description, subtotal, tax_amount, total_amount, validity_days, delivery_weeks, notes, opportunity_id, budget_id, project_id } = body;
      if (!quote_code?.trim() || !client_name?.trim()) {
        return NextResponse.json({ error: 'Código de cotización y cliente son obligatorios' }, { status: 400 });
      }

      const { count } = await supabase.from('commercial_proposals').select('*', { count: 'exact', head: true });
      const consecutiveNum = (count || 0) + 1;

      const proposalPayload: Record<string, unknown> = {
        user_id: dbUser.id,
        consecutive_number: consecutiveNum,
        opportunity_id: opportunity_id || null,
        budget_id: budget_id || null,
        project_id: project_id || null,
        created_by_name: dbUser.full_name || session.user.name || 'Comercial',
        created_by_email: dbUser.email || session.user.email,
        quote_code: String(quote_code).trim().toUpperCase(),
        client_name: String(client_name).trim(),
        scope_description: String(scope_description || '').trim(),
        subtotal: Number(subtotal) || 0,
        tax_amount: Number(tax_amount) || 0,
        total_amount: Number(total_amount) || (Number(subtotal) || 0),
        validity_days: Number(validity_days) || 30,
        delivery_weeks: Number(delivery_weeks) || 2,
        notes: notes ? String(notes).trim() : null,
      };

      let { data, error } = await supabase.from('commercial_proposals').insert(proposalPayload).select().single();
      if (error && error.code === '42703') {
        delete proposalPayload.consecutive_number;
        delete proposalPayload.budget_id;
        delete proposalPayload.project_id;
        delete proposalPayload.created_by_name;
        delete proposalPayload.created_by_email;
        const retry = await supabase.from('commercial_proposals').insert(proposalPayload).select().single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;

      // Vinculación bidireccional si se seleccionó un proyecto existente
      if (project_id && data?.id) {
        try {
          await supabase.from('projects').update({ commercial_proposal_id: data.id }).eq('id', project_id);
        } catch {}
      }

      result = data;
    } else if (formSlug === 'cierre-comercial') {
      const { quote_code, proposal_id, budget_id, opportunity_id, result: closingResult, final_contract_value, contract_number, loss_reason, closing_notes } = body;
      if (!quote_code?.trim() || !closingResult) {
        return NextResponse.json({ error: 'Código de cotización y resultado son obligatorios' }, { status: 400 });
      }

      const { count } = await supabase.from('commercial_closings').select('*', { count: 'exact', head: true });
      const consecutiveNum = (count || 0) + 1;
      const year = new Date().getFullYear();
      const closingCode = `CIE-${year}-${String(consecutiveNum).padStart(3, '0')}`;

      // Buscar proposal_id si no viene explícito
      let resolvedProposalId = proposal_id || null;
      if (!resolvedProposalId && quote_code) {
        const { data: prop } = await supabase.from('commercial_proposals').select('id, opportunity_id, budget_id').eq('quote_code', quote_code.trim().toUpperCase()).maybeSingle();
        if (prop) {
          resolvedProposalId = prop.id;
        }
      }

      const closingPayload: Record<string, unknown> = {
        user_id: dbUser.id,
        consecutive_number: consecutiveNum,
        closing_code: closingCode,
        proposal_id: resolvedProposalId,
        opportunity_id: opportunity_id || null,
        budget_id: budget_id || null,
        created_by_name: dbUser.full_name || session.user.name || 'Comercial',
        created_by_email: dbUser.email || session.user.email,
        result: closingResult,
        final_contract_value: closingResult === 'won' && final_contract_value ? Number(final_contract_value) : null,
        contract_number: closingResult === 'won' && contract_number ? String(contract_number).trim() : null,
        loss_reason: closingResult !== 'won' && loss_reason ? String(loss_reason).trim() : null,
        closing_notes: closing_notes ? String(closing_notes).trim() : null,
      };

      let { data, error } = await supabase.from('commercial_closings').insert(closingPayload).select().single();
      if (error && (error.code === '42703' || String(error.message || '').includes('schema cache'))) {
        delete closingPayload.consecutive_number;
        delete closingPayload.closing_code;
        delete closingPayload.budget_id;
        delete closingPayload.created_by_name;
        delete closingPayload.created_by_email;
        const retry = await supabase.from('commercial_closings').insert(closingPayload).select().single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      result = data;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. FINANZAS (finance)
    // ──────────────────────────────────────────────────────────────────────────
    else if (formSlug === 'solicitud-viaticos') {
      const { project_id, beneficiary_name, beneficiary_document, destination, departure_date, return_date, estimated_transport, estimated_lodging, estimated_meals, estimated_tolls_fuel, estimated_total, notes } = body;
      if (!project_id) return NextResponse.json({ error: 'Debes seleccionar el proyecto imputable' }, { status: 400 });
      if (!beneficiary_name?.trim()) return NextResponse.json({ error: 'El nombre del beneficiario es obligatorio' }, { status: 400 });

      const trans = Number(estimated_transport) || 0;
      const lodg = Number(estimated_lodging) || 0;
      const meal = Number(estimated_meals) || 0;
      const tolls = Number(estimated_tolls_fuel) || 0;
      const total = Number(estimated_total) || (trans + lodg + meal + tolls);

      const { data, error } = await supabase
        .from('per_diem_requests')
        .insert({
          project_id,
          user_id: dbUser.id,
          beneficiary_name: String(beneficiary_name).trim(),
          beneficiary_document: String(beneficiary_document || '').trim(),
          destination: String(destination || '').trim(),
          departure_date: departure_date || new Date().toISOString().split('T')[0],
          return_date: return_date || new Date().toISOString().split('T')[0],
          estimated_transport: trans,
          estimated_lodging: lodg,
          estimated_meals: meal,
          estimated_tolls_fuel: tolls,
          estimated_total: total,
          notes: notes ? String(notes).trim() : null,
          status: 'submitted',
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else if (formSlug === 'legalizacion-gastos') {
      const { project_id, advancement_amount, total_spent, balance, receipts_summary, notes } = body;
      if (!project_id) return NextResponse.json({ error: 'Debes seleccionar el proyecto' }, { status: 400 });

      const adv = Number(advancement_amount) || 0;
      const spent = Number(total_spent) || 0;
      const bal = balance !== undefined ? Number(balance) : (adv - spent);

      const { data, error } = await supabase
        .from('expense_legalizations')
        .insert({
          project_id,
          user_id: dbUser.id,
          advancement_amount: adv,
          total_spent: spent,
          balance: bal,
          expense_receipts: [{ summary: receipts_summary || '' }],
          notes: notes ? String(notes).trim() : null,
          status: 'submitted',
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else if (formSlug === 'registro-pago') {
      const { payment_date, payment_concept, recipient_name, recipient_nit, amount, bank_source, transaction_reference, notes } = body;
      if (!payment_concept?.trim() || !recipient_name?.trim() || !amount) {
        return NextResponse.json({ error: 'Concepto, beneficiario y monto son obligatorios' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('payment_records')
        .insert({
          user_id: dbUser.id,
          payment_date: payment_date || new Date().toISOString().split('T')[0],
          payment_concept: String(payment_concept).trim(),
          recipient_name: String(recipient_name).trim(),
          recipient_nit: recipient_nit ? String(recipient_nit).trim() : null,
          amount: Number(amount) || 0,
          bank_source: bank_source || 'Bancolombia Cta Cte',
          transaction_reference: String(transaction_reference || '').trim(),
          notes: notes ? String(notes).trim() : null,
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. CONTABILIDAD (accounting)
    // ──────────────────────────────────────────────────────────────────────────
    else if (formSlug === 'radicacion-factura') {
      const { invoice_number, supplier_name, supplier_nit, project_id, issue_date, due_date, subtotal, tax_amount, withholding_tax, total_amount, concept, notes } = body;
      if (!invoice_number?.trim() || !supplier_name?.trim() || !supplier_nit?.trim()) {
        return NextResponse.json({ error: 'Número de factura, proveedor y NIT son obligatorios' }, { status: 400 });
      }

      const sub = Number(subtotal) || 0;
      const tax = Number(tax_amount) || 0;
      const ret = Number(withholding_tax) || 0;
      const tot = Number(total_amount) || (sub + tax - ret);

      const { data, error } = await supabase
        .from('invoice_filings')
        .insert({
          project_id: project_id || null,
          user_id: dbUser.id,
          invoice_number: String(invoice_number).trim().toUpperCase(),
          supplier_name: String(supplier_name).trim(),
          supplier_nit: String(supplier_nit).trim(),
          issue_date: issue_date || new Date().toISOString().split('T')[0],
          due_date: due_date || new Date().toISOString().split('T')[0],
          subtotal: sub,
          tax_amount: tax,
          withholding_tax: ret,
          total_amount: tot,
          concept: String(concept || '').trim(),
          notes: notes ? String(notes).trim() : null,
          status: 'radicada',
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else if (formSlug === 'soporte-cobro') {
      const { project_id, client_name, cut_period_start, cut_period_end, delivered_ml, delivered_m2, amount_to_bill, acta_number, approver_client_name, notes } = body;
      if (!project_id || !client_name?.trim() || !amount_to_bill) {
        return NextResponse.json({ error: 'Proyecto, cliente y monto a facturar son obligatorios' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('billing_supports')
        .insert({
          project_id,
          user_id: dbUser.id,
          client_name: String(client_name).trim(),
          cut_period_start: cut_period_start || new Date().toISOString().split('T')[0],
          cut_period_end: cut_period_end || new Date().toISOString().split('T')[0],
          delivered_ml: delivered_ml ? Number(delivered_ml) : null,
          delivered_m2: delivered_m2 ? Number(delivered_m2) : null,
          amount_to_bill: Number(amount_to_bill) || 0,
          acta_number: acta_number ? String(acta_number).trim() : null,
          approver_client_name: approver_client_name ? String(approver_client_name).trim() : null,
          notes: notes ? String(notes).trim() : null,
          status: 'ready_to_invoice',
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      return NextResponse.json({ error: `Formulario "${formSlug}" no reconocido.` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Registro operativo capturado exitosamente.',
      data: result,
    });
  } catch (err: unknown) {
    console.error(`Error en POST /api/forms/${formSlug}:`, err);
    let message = 'Error interno al procesar el formulario';
    if (err instanceof Error) {
      message = err.message;
    } else if (typeof err === 'object' && err !== null) {
      const pg = err as { message?: string; details?: string };
      if (pg.message) message = `${pg.message}${pg.details ? ` (${pg.details})` : ''}`;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
