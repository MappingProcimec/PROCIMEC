import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { parseProjectTargets, cleanDescription } from '@/app/api/admin/projects/route';

interface OperationalSummaryRow {
  ml?: number;
  m2?: number;
}

interface FieldReport {
  id: string;
  operational_summary: OperationalSummaryRow[];
  gpr_equipment?: string;
  positioning_equipment?: string;
}

// GET /api/projects — returns projects for the current user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createAdminClient();
  const userId = session.user.id;
  const role = session.user.role;

  let query = supabase
    .from('projects')
    .select('*, field_reports(id, operational_summary, gpr_equipment, positioning_equipment)')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  // Localizadores / Operators only see assigned projects
  if (role === 'operator' || role === 'localizador') {
    const { data: assignments } = await supabase
      .from('user_projects')
      .select('project_id')
      .eq('user_id', userId);

    const projectIds = (assignments || []).map((a: { project_id: string }) => a.project_id);
    if (projectIds.length === 0) return NextResponse.json({ data: [] });
    query = query.in('id', projectIds);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  const formatted = (data || []).map((p: Record<string, unknown>) => {
    const ccVal = String(p.cost_center || p.code || '');
    const targets = parseProjectTargets(p);
    const fieldReports: FieldReport[] = (p.field_reports as FieldReport[]) || [];

    let totalML = 0;
    let totalM2 = 0;
    let mappingML = 0;
    let mappingM2 = 0;
    let positioningML = 0;
    let positioningM2 = 0;

    fieldReports.forEach((r) => {
      const rows = Array.isArray(r.operational_summary) ? r.operational_summary : [];
      const reportML = rows.reduce((s, row) => s + (Number(row.ml) || 0), 0);
      const reportM2 = rows.reduce((s, row) => s + (Number(row.m2) || 0), 0);

      totalML += reportML;
      totalM2 += reportM2;

      const eq = (r.gpr_equipment || '').trim();
      const hasMapping = eq.length > 0 && eq.toLowerCase() !== 'ninguno';

      const pos = (r.positioning_equipment || '').trim();
      const hasPositioning = pos.length > 0 && pos.toLowerCase() !== 'sin posicionamiento' && pos.toLowerCase() !== 'ninguno';

      if (hasMapping) {
        mappingML += reportML;
        mappingM2 += reportM2;
      }
      if (hasPositioning) {
        positioningML += reportML;
        positioningM2 += reportM2;
      }
    });

    const targetValue = targets.target_metric_type === 'm2' ? targets.target_m2 : targets.target_ml;
    const mappingExecuted = targets.target_metric_type === 'm2' ? mappingM2 : mappingML;
    const positioningExecuted = targets.target_metric_type === 'm2' ? positioningM2 : positioningML;

    let mappingProgressPct = 0;
    let positioningProgressPct = 0;
    if (targetValue > 0) {
      mappingProgressPct = Math.min(100, Math.round(((mappingExecuted / targetValue) * 100) * 10) / 10);
      positioningProgressPct = Math.min(100, Math.round(((positioningExecuted / targetValue) * 100) * 10) / 10);
    }

    let overallProgressPct = 0;
    if (targets.requires_mapping && targets.requires_positioning) {
      overallProgressPct = Math.round(((mappingProgressPct + positioningProgressPct) / 2) * 10) / 10;
    } else if (targets.requires_mapping) {
      overallProgressPct = mappingProgressPct;
    } else if (targets.requires_positioning) {
      overallProgressPct = positioningProgressPct;
    } else {
      overallProgressPct = 100;
    }

    return {
      ...p,
      cost_center: ccVal,
      code: ccVal,
      description: cleanDescription(p.description as string),
      target_ml: targets.target_ml,
      target_m2: targets.target_m2,
      target_metric_type: targets.target_metric_type,
      requires_mapping: targets.requires_mapping,
      requires_positioning: targets.requires_positioning,
      total_ml: totalML,
      total_m2: totalM2,
      mapping_ml: mappingML,
      mapping_m2: mappingM2,
      positioning_ml: positioningML,
      positioning_m2: positioningM2,
      mapping_progress_pct: mappingProgressPct,
      positioning_progress_pct: positioningProgressPct,
      overall_progress_pct: overallProgressPct,
    };
  });
  return NextResponse.json({ data: formatted });
}
