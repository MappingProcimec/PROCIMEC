import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { computeProjectFinancials } from '@/lib/projectFinancials';
import { parseProjectTargets, encodeDescriptionWithMeta } from '@/app/api/admin/projects/route';
import { ProjectFinancials } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const { count } = await supabase
      .from('commercial_closings')
      .select('*', { count: 'exact', head: true });

    const currentYear = new Date().getFullYear();
    const nextNumber = (count || 0) + 1;
    const nextCode = `CIE-${currentYear}-${String(nextNumber).padStart(3, '0')}`;

    return NextResponse.json({
      data: {
        nextCode,
        nextNumber,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al obtener consecutivo de cierre';
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

  // 1. Obtener usuario en BD
  const { data: dbUser, error: userError } = await supabase
    .from('users')
    .select('id, email, full_name, role')
    .eq('email', session.user.email)
    .single();

  if (userError || !dbUser) {
    return NextResponse.json({ error: 'Usuario no encontrado en la base de datos' }, { status: 404 });
  }

  const {
    quote_code,
    proposal_id,
    project_id,
    sync_mode = 'sync_to_quote',
    direct_cost,
    result: closingResult,
    final_contract_value,
    contract_number,
    loss_reason,
    closing_notes,
    opportunity_id,
    budget_id,
  } = body;

  if (!quote_code?.trim() || !closingResult) {
    return NextResponse.json(
      { error: 'El código de cotización y el resultado del cierre son obligatorios.' },
      { status: 400 }
    );
  }

  try {
    const { count } = await supabase
      .from('commercial_closings')
      .select('*', { count: 'exact', head: true });

    const consecutiveNum = (count || 0) + 1;
    const year = new Date().getFullYear();
    const closingCode = `CIE-${year}-${String(consecutiveNum).padStart(3, '0')}`;

    // Buscar proposal_id y antecedentes si no vienen en el payload
    let resolvedProposalId = proposal_id || null;
    let resolvedOppId = opportunity_id || null;
    let resolvedBudgetId = budget_id || null;
    let resolvedProjectId = project_id || null;

    if ((!resolvedProposalId || !resolvedProjectId) && quote_code) {
      const { data: prop } = await supabase
        .from('commercial_proposals')
        .select('id, opportunity_id, budget_id, project_id')
        .eq('quote_code', quote_code.trim().toUpperCase())
        .maybeSingle();

      if (prop) {
        if (!resolvedProposalId) resolvedProposalId = prop.id;
        if (!resolvedOppId) resolvedOppId = prop.opportunity_id;
        if (!resolvedBudgetId) resolvedBudgetId = prop.budget_id;
        if (!resolvedProjectId && prop.project_id) resolvedProjectId = prop.project_id;
      }
    }

    // Payload canónico estricto según columnas existentes en public.commercial_closings
    const closingPayload: Record<string, unknown> = {
      user_id: dbUser.id,
      consecutive_number: consecutiveNum,
      closing_code: closingCode,
      proposal_id: resolvedProposalId,
      project_id: resolvedProjectId,
      sync_mode: sync_mode || 'sync_to_quote',
      opportunity_id: resolvedOppId,
      budget_id: resolvedBudgetId,
      created_by_name: dbUser.full_name || session.user.name || 'Comercial',
      created_by_email: dbUser.email || session.user.email,
      result: closingResult,
      final_contract_value: closingResult === 'won' && final_contract_value ? Number(final_contract_value) : null,
      contract_number: closingResult === 'won' && contract_number ? String(contract_number).trim() : null,
      loss_reason: closingResult !== 'won' && loss_reason ? String(loss_reason).trim() : null,
      closing_notes: closing_notes ? String(closing_notes).trim() : null,
    };

    let { data, error } = await supabase
      .from('commercial_closings')
      .insert(closingPayload)
      .select()
      .single();

    // Reintento: si la base de datos no tiene aún las columnas añadidas en migraciones recientes
    if (error && (error.code === '42703' || String(error.message || '').includes('schema cache'))) {
      delete closingPayload.consecutive_number;
      delete closingPayload.closing_code;
      delete closingPayload.budget_id;
      delete closingPayload.project_id;
      delete closingPayload.sync_mode;
      delete closingPayload.created_by_name;
      delete closingPayload.created_by_email;

      const retry = await supabase.from('commercial_closings').insert(closingPayload).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('Error insertando en commercial_closings:', error);
      const detail = error.message || error.details || 'Error en base de datos';
      return NextResponse.json({ error: `No fue posible guardar el cierre: ${detail}` }, { status: 500 });
    }

    // 3. Sincronización y Deliberación con el Proyecto Oficial
    if (data?.id && resolvedProjectId) {
      try {
        const { data: currentProject } = await supabase
          .from('projects')
          .select('*')
          .eq('id', resolvedProjectId)
          .maybeSingle();

        if (currentProject) {
          if (closingResult === 'won' && sync_mode === 'sync_to_quote' && final_contract_value) {
            // Camino 1: Sincronizar Techo Contractual con el Cierre y Presupuesto de Ejecución con Costo Directo puro APU
            let execVal = direct_cost && Number(direct_cost) > 0 ? Number(direct_cost) : 0;

            if (execVal === 0 && resolvedBudgetId) {
              const { data: bData } = await supabase
                .from('commercial_budgets')
                .select('total_direct_cost')
                .eq('id', resolvedBudgetId)
                .maybeSingle();
              if (bData?.total_direct_cost && Number(bData.total_direct_cost) > 0) {
                execVal = Number(bData.total_direct_cost);
              }
            }

            const finalValNum = Number(final_contract_value);
            let finCalc: ProjectFinancials;

            if (execVal > 0 && execVal < finalValNum) {
              const dedAmount = Math.max(0, finalValNum - execVal);
              const dedPct = Math.round((dedAmount / finalValNum) * 10000) / 100;
              finCalc = {
                contract_value: finalValNum,
                execution_value: execVal,
                deductions_amount: dedAmount,
                deductions_percentage: dedPct,
                deductions_config: currentProject.deductions_config || undefined,
              };
            } else {
              finCalc = computeProjectFinancials(finalValNum, currentProject.deductions_config);
            }

            const targets = parseProjectTargets(currentProject);
            const encodedDesc = encodeDescriptionWithMeta(currentProject.description, targets, finCalc);

            const prjUpdate: Record<string, unknown> = {
              contract_value: finCalc.contract_value,
              execution_value: finCalc.execution_value,
              deductions_amount: finCalc.deductions_amount,
              deductions_percentage: finCalc.deductions_percentage,
              commercial_closing_id: data.id,
              description: encodedDesc,
            };

            if (contract_number) {
              prjUpdate.contract_number = String(contract_number).trim();
            }
            if (resolvedProposalId) {
              prjUpdate.commercial_proposal_id = resolvedProposalId;
            }
            if (resolvedBudgetId) {
              prjUpdate.commercial_budget_id = resolvedBudgetId;
            }

            let { error: pErr } = await supabase.from('projects').update(prjUpdate).eq('id', resolvedProjectId);
            if (pErr && pErr.code === '42703') {
              delete prjUpdate.contract_value;
              delete prjUpdate.execution_value;
              delete prjUpdate.deductions_amount;
              delete prjUpdate.deductions_percentage;
              delete prjUpdate.commercial_closing_id;
              delete prjUpdate.commercial_proposal_id;
              delete prjUpdate.commercial_budget_id;
              await supabase.from('projects').update(prjUpdate).eq('id', resolvedProjectId);
            }
          } else {
            // Camino 2 o resultado no 'won': Conservar Techo y Presupuesto del Proyecto pero vincular IDs de auditoría
            const prjUpdate: Record<string, unknown> = {
              commercial_closing_id: data.id,
            };
            if (resolvedProposalId) {
              prjUpdate.commercial_proposal_id = resolvedProposalId;
            }
            if (resolvedBudgetId) {
              prjUpdate.commercial_budget_id = resolvedBudgetId;
            }
            if (contract_number && !currentProject.contract_number) {
              prjUpdate.contract_number = String(contract_number).trim();
            }

            let { error: pErr } = await supabase.from('projects').update(prjUpdate).eq('id', resolvedProjectId);
            if (pErr && pErr.code === '42703') {
              delete prjUpdate.commercial_closing_id;
              delete prjUpdate.commercial_proposal_id;
              delete prjUpdate.commercial_budget_id;
              if (Object.keys(prjUpdate).length > 0) {
                await supabase.from('projects').update(prjUpdate).eq('id', resolvedProjectId);
              }
            }
          }
        }

        // Sincronizar propuesta comercial con el proyecto y con el valor final contratado
        if (resolvedProposalId) {
          const propUpdate: Record<string, unknown> = {};
          if (resolvedProjectId) {
            propUpdate.project_id = resolvedProjectId;
          }
          if (closingResult === 'won' && final_contract_value) {
            const finalNum = Number(final_contract_value);
            const subtotalNum = Math.round(finalNum / 1.19);
            propUpdate.total_amount = finalNum;
            propUpdate.subtotal = subtotalNum;
            propUpdate.tax_amount = finalNum - subtotalNum;
            propUpdate.status = 'approved';
          }

          if (Object.keys(propUpdate).length > 0) {
            await supabase
              .from('commercial_proposals')
              .update(propUpdate)
              .eq('id', resolvedProposalId);
          }
        }
      } catch (linkErr) {
        console.error('Error no crítico vinculando proyecto oficial en cierre:', linkErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Cierre de negociación registrado exitosamente.',
      data,
    });
  } catch (err: unknown) {
    console.error('Error no controlado en POST /api/forms/cierre-comercial:', err);
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
