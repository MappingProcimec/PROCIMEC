import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createAdminClient } from '@/lib/supabase';
import { GprPipelineCostRates, GprPipelineCostBreakdown, GprPipelineInputMetrics } from '@/types/gpr-pipeline';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RawOperationalRow {
  sector?: string;
  ml?: number | string;
  m2?: number | string;
  max_depth_m?: number | string;
  observations?: string;
}

interface RawUtility {
  type?: string;
  diameter?: string;
  estimated_depth_m?: number | string;
  confidence?: string;
  description?: string;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth({ req: request });
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  const supabase = createAdminClient();

  try {
    // 1. Obtener lista de proyectos para el selector
    let projectsQuery = supabase
      .from('projects')
      .select('id, name, client, cost_center, location, description, is_active')
      .order('name');

    if (auth.ctx.role !== 'admin') {
      const { data: userProjects } = await supabase
        .from('user_projects')
        .select('project_id')
        .eq('user_id', auth.ctx.userId);

      const assignedIds = (userProjects || []).map((up: { project_id: string }) => up.project_id);
      if (assignedIds.length === 0) {
        return NextResponse.json({
          data: {
            projects: [],
            activeJob: null,
            projectSummary: null,
          },
        });
      }
      projectsQuery = projectsQuery.in('id', assignedIds);
    }

    const { data: rawProjects, error: projErr } = await projectsQuery;
    if (projErr) throw projErr;
    const projects = rawProjects || [];

    // Buscar coincidencia por ID o por centro de costos
    const matchedProject = projectId
      ? projects.find((p: { id: string; cost_center?: string }) => p.id === projectId || p.cost_center === projectId)
      : null;
    const targetProjectId = matchedProject ? matchedProject.id : (projectId || (projects.length > 0 ? projects[0].id : null));

    if (!targetProjectId) {
      return NextResponse.json({
        data: {
          projects,
          activeJob: null,
          projectSummary: null,
        },
      });
    }

    // 2. Obtener reportes de campo (GPR) acumulados de este proyecto
    const { data: rawReports, error: repErr } = await supabase
      .from('field_reports')
      .select('id, report_date, report_time, localizador_name, operational_summary, detected_utilities, global_max_depth, created_at, antenna_frequency, gpr_equipment, terrain_conditions, weather_conditions, capture_method')
      .eq('project_id', targetProjectId)
      .order('report_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (repErr) throw repErr;
    const reports = rawReports || [];

    // 3. Contar y asociar archivos adjuntos de campo (datos crudos, gps, fotos)
    const reportIds = (reports || []).map((r: { id: string }) => r.id);
    let rawGprCount = 0;
    let gpsCount = 0;
    let photosCount = 0;

    const filesByReportId: Record<string, Array<{
      id: string;
      field_report_id: string;
      file_type: string;
      original_name: string;
      url?: string | null;
      caption?: string | null;
      created_at?: string;
    }>> = {};

    if (reportIds.length > 0) {
      const { data: rawFiles = [] } = await supabase
        .from('report_files')
        .select('id, field_report_id, file_type, original_name, storage_url, drive_download_url, drive_webview_url, caption, created_at')
        .in('field_report_id', reportIds);

      (rawFiles || []).forEach((f: {
        id: string;
        field_report_id: string;
        file_type: string;
        original_name?: string | null;
        storage_url?: string | null;
        drive_download_url?: string | null;
        drive_webview_url?: string | null;
        caption?: string | null;
        created_at?: string;
      }) => {
        if (f.file_type === 'raw_gpr') rawGprCount++;
        else if (f.file_type === 'gps') gpsCount++;
        else if (f.file_type === 'photo') photosCount++;

        if (!filesByReportId[f.field_report_id]) {
          filesByReportId[f.field_report_id] = [];
        }
        filesByReportId[f.field_report_id].push({
          id: f.id,
          field_report_id: f.field_report_id,
          file_type: f.file_type,
          original_name: f.original_name || 'Archivo adjunto',
          url: f.storage_url || f.drive_download_url || f.drive_webview_url || null,
          caption: f.caption || null,
          created_at: f.created_at,
        });
      });
    }

    // Consolidar métricas de entrada y construir lista de reportes estructurados
    let totalMl = 0;
    let totalM2 = 0;
    let maxDepthGlobal = 0;
    const tramosList: Array<{
      id?: string;
      sector: string;
      ml: number;
      m2: number;
      max_depth_m: number;
      observations?: string;
      report_date: string;
      localizador_name: string;
    }> = [];

    const utilitiesList: Array<{
      id?: string;
      type: string;
      diameter?: string;
      estimated_depth_m: number;
      confidence: string;
      description?: string;
      report_date: string;
    }> = [];

    const structuredFieldReports = reports.map((rep: {
      id: string;
      report_date: string;
      report_time?: string | null;
      localizador_name: string;
      antenna_frequency?: string | null;
      gpr_equipment?: string | null;
      terrain_conditions?: string | null;
      weather_conditions?: string | null;
      capture_method?: string | null;
      global_max_depth?: number | null;
      operational_summary?: RawOperationalRow[] | null;
      detected_utilities?: RawUtility[] | null;
      created_at: string;
    }) => {
      let repMl = 0;
      let repM2 = 0;
      let repMaxDep = Number(rep.global_max_depth) || 0;

      if (Array.isArray(rep.operational_summary)) {
        rep.operational_summary.forEach((row) => {
          repMl += Number(row.ml) || 0;
          repM2 += Number(row.m2) || 0;
          const d = Number(row.max_depth_m) || 0;
          if (d > repMaxDep) repMaxDep = d;
        });
      }

      const utilsCount = Array.isArray(rep.detected_utilities) ? rep.detected_utilities.length : 0;
      const repFiles = filesByReportId[rep.id] || [];
      const rawCount = repFiles.filter((f) => f.file_type === 'raw_gpr').length;
      const gpsCountRep = repFiles.filter((f) => f.file_type === 'gps').length;
      const photosCountRep = repFiles.filter((f) => f.file_type === 'photo').length;

      return {
        id: rep.id,
        report_date: rep.report_date,
        report_time: rep.report_time || null,
        localizador_name: rep.localizador_name || 'Localizador',
        antenna_frequency: rep.antenna_frequency || '400 MHz',
        gpr_equipment: rep.gpr_equipment || 'GPR ProEx',
        terrain_conditions: rep.terrain_conditions || 'Asfalto / Mixto',
        weather_conditions: rep.weather_conditions || 'Despejado',
        capture_method: rep.capture_method || 'Rueda odómetro',
        global_max_depth: Number(repMaxDep.toFixed(2)),
        total_ml: Number(repMl.toFixed(2)),
        total_m2: Number(repM2.toFixed(2)),
        utilities_count: utilsCount,
        operational_summary: rep.operational_summary || [],
        detected_utilities: rep.detected_utilities || [],
        files_count: repFiles.length,
        raw_gpr_count: rawCount,
        gps_count: gpsCountRep,
        photos_count: photosCountRep,
        files: repFiles,
        created_at: rep.created_at,
      };
    });

    reports?.forEach((rep: {
      id: string;
      report_date: string;
      localizador_name: string;
      global_max_depth?: number | null;
      operational_summary?: RawOperationalRow[] | null;
      detected_utilities?: RawUtility[] | null;
    }) => {
      const repDep = Number(rep.global_max_depth) || 0;
      if (repDep > maxDepthGlobal) maxDepthGlobal = repDep;

      if (Array.isArray(rep.operational_summary)) {
        rep.operational_summary.forEach((row, idx) => {
          const ml = Number(row.ml) || 0;
          const m2 = Number(row.m2) || 0;
          const dep = Number(row.max_depth_m) || 0;
          totalMl += ml;
          totalM2 += m2;
          if (dep > maxDepthGlobal) maxDepthGlobal = dep;

          tramosList.push({
            id: `${rep.id}_${idx}`,
            sector: row.sector || `Tramo ${tramosList.length + 1}`,
            ml,
            m2,
            max_depth_m: dep,
            observations: row.observations || '',
            report_date: rep.report_date,
            localizador_name: rep.localizador_name || 'Localizador',
          });
        });
      }

      if (Array.isArray(rep.detected_utilities)) {
        rep.detected_utilities.forEach((util, idx) => {
          utilitiesList.push({
            id: `${rep.id}_u_${idx}`,
            type: util.type || 'Interferencia No Especificada',
            diameter: util.diameter || '',
            estimated_depth_m: Number(util.estimated_depth_m) || 0,
            confidence: util.confidence || 'Media',
            description: util.description || '',
            report_date: rep.report_date,
          });
        });
      }
    });

    const targetProject = projects.find((p: { id: string }) => p.id === targetProjectId);

    const projectSummary = {
      project_id: targetProjectId,
      project_name: targetProject?.name || 'Proyecto',
      client: targetProject?.client || 'Cliente',
      cost_center: targetProject?.cost_center || '',
      location: targetProject?.location || '',
      total_ml: Number(totalMl.toFixed(2)),
      total_m2: Number(totalM2.toFixed(2)),
      max_depth_m: Number(maxDepthGlobal.toFixed(2)),
      reports_count: reports.length,
      tramos: tramosList,
      detected_utilities: utilitiesList,
      raw_gpr_files_count: rawGprCount,
      gps_files_count: gpsCount,
      photos_count: photosCount,
      field_reports: structuredFieldReports,
    };

    // 4. Buscar o crear el job activo para este proyecto
    let activeJob = null;
    const { data: foundJob, error: jobErr } = await supabase
      .from('gpr_pipeline_jobs')
      .select('*, steps:gpr_pipeline_steps(*)')
      .eq('project_id', targetProjectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (jobErr) {
      console.warn('Aviso: Consulta de jobs falló o tabla en inicialización:', jobErr.message);
    } else if (foundJob) {
      activeJob = foundJob;
    }

    // Si no existe un job previo en BD, generar la estructura canónica con los 5 pasos listos
    if (!activeJob) {
      activeJob = {
        id: '',
        project_id: targetProjectId,
        created_by: auth.ctx.userId,
        title: `Pipeline GPR & CAD/BIM — ${new Date().toLocaleDateString('es-CO')}`,
        status: 'draft',
        current_step: 'cad_2d',
        total_cost_cop: 0,
        input_metrics: {
          total_ml: projectSummary.total_ml,
          total_m2: projectSummary.total_m2,
          utilities_count: projectSummary.detected_utilities.length,
          reports_count: projectSummary.reports_count,
          tramos_count: projectSummary.tramos.length,
          max_depth_m: projectSummary.max_depth_m,
        },
        cost_rates: {
          cad_2d_rate_per_ml: 2500,
          gpr_proc_rate_per_ml: 3000,
          cad_refine_rate_per_utility: 35000,
          bim_3d_rate_per_ml: 4500,
          report_fixed_rate: 350000,
        },
        cost_breakdown: {
          cad_2d_cost: 0,
          gpr_proc_cost: 0,
          cad_refine_cost: 0,
          bim_3d_cost: 0,
          report_cost: 0,
        },
        steps: [
          {
            id: 'step_1_cad_2d',
            job_id: '',
            step_order: 1,
            step_key: 'cad_2d',
            step_name: 'Paso 1: Elaboración del Plano 2D (.dwg)',
            status: 'pending',
            cost_cop: 0,
            ai_model_used: 'Gemini 1.5 Pro',
            token_usage: { input_tokens: 1420, output_tokens: 680 },
            output_file_type: 'dwg',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 'step_2_gpr_raw_proc',
            job_id: '',
            step_order: 2,
            step_key: 'gpr_raw_proc',
            step_name: 'Paso 2: Procesamiento de Datos Crudos GPR',
            status: 'pending',
            cost_cop: 0,
            ai_model_used: 'Gemini 1.5 Pro',
            token_usage: { input_tokens: 1650, output_tokens: 890 },
            output_file_type: 'pdf',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 'step_3_cad_2d_refine',
            job_id: '',
            step_order: 3,
            step_key: 'cad_2d_refine',
            step_name: 'Paso 3: Mejora del Plano 2D (Ajuste de Interferencias)',
            status: 'pending',
            cost_cop: 0,
            ai_model_used: 'Gemini 1.5 Pro',
            token_usage: { input_tokens: 1890, output_tokens: 1120 },
            output_file_type: 'dwg',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 'step_4_bim_3d_rvt',
            job_id: '',
            step_order: 4,
            step_key: 'bim_3d_rvt',
            step_name: 'Paso 4: Elaboración del Modelo 3D BIM (.rvt / IFC)',
            status: 'pending',
            cost_cop: 0,
            ai_model_used: 'Gemini 1.5 Pro',
            token_usage: { input_tokens: 2150, output_tokens: 1450 },
            output_file_type: 'rvt',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 'step_5_project_report',
            job_id: '',
            step_order: 5,
            step_key: 'project_report',
            step_name: 'Paso 5: Informe Final del Proyecto',
            status: 'pending',
            cost_cop: 0,
            ai_model_used: 'Gemini 1.5 Pro',
            token_usage: { input_tokens: 2800, output_tokens: 2200 },
            output_file_type: 'docx',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      };
    }

    // Ordenar los pasos si existen y asegurar token_usage por defecto
    if (activeJob && Array.isArray(activeJob.steps)) {
      activeJob.steps.sort((a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order);
      const defaultTokens: Record<string, { input_tokens: number; output_tokens: number }> = {
        cad_2d: { input_tokens: 1420, output_tokens: 680 },
        gpr_raw_proc: { input_tokens: 1650, output_tokens: 890 },
        cad_2d_refine: { input_tokens: 1890, output_tokens: 1120 },
        bim_3d_rvt: { input_tokens: 2150, output_tokens: 1450 },
        project_report: { input_tokens: 2800, output_tokens: 2200 },
      };
      activeJob.steps.forEach((s: { step_key: string; token_usage?: { input_tokens: number; output_tokens: number } | null; ai_model_used?: string | null }) => {
        if (!s.token_usage || (s.token_usage.input_tokens === 0 && s.token_usage.output_tokens === 0)) {
          s.token_usage = defaultTokens[s.step_key] || { input_tokens: 1000, output_tokens: 500 };
        }
        if (!s.ai_model_used) {
          s.ai_model_used = 'Gemini 1.5 Pro';
        }
      });
    }

    return NextResponse.json({
      data: {
        projects,
        targetProjectId,
        projectSummary,
        activeJob,
      },
    });
  } catch (err) {
    console.error('Error GET /api/tools/gpr-pipeline:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al consultar datos del pipeline' },
      { status: 500 }
    );
  }
}

// POST: Crear o Recalcular un Job de Pipeline para el proyecto
export async function POST(request: NextRequest) {
  const auth = await requireAuth({
    req: request,
    roles: ['admin', 'administrador', 'gerencia', 'management', 'dibujo', 'drawing', 'localizador', 'operator'],
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { projectId, costRates: customRates, notes, selectedReportIds } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'El projectId es obligatorio' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Obtener datos de field_reports para este proyecto
    const { data: rawReports } = await supabase
      .from('field_reports')
      .select('id, operational_summary, detected_utilities, global_max_depth')
      .eq('project_id', projectId);

    const allReports = rawReports || [];
    const reports = (Array.isArray(selectedReportIds) && selectedReportIds.length > 0)
      ? allReports.filter((r: { id: string }) => selectedReportIds.includes(r.id))
      : allReports;

    let totalMl = 0;
    let totalM2 = 0;
    let utilitiesCount = 0;
    let tramosCount = 0;
    let maxDepth = 0;

    reports?.forEach((rep: {
      global_max_depth?: number | null;
      operational_summary?: RawOperationalRow[] | null;
      detected_utilities?: RawUtility[] | null;
    }) => {
      const dep = Number(rep.global_max_depth) || 0;
      if (dep > maxDepth) maxDepth = dep;

      if (Array.isArray(rep.operational_summary)) {
        rep.operational_summary.forEach((row) => {
          tramosCount++;
          totalMl += Number(row.ml) || 0;
          totalM2 += Number(row.m2) || 0;
        });
      }

      if (Array.isArray(rep.detected_utilities)) {
        utilitiesCount += rep.detected_utilities.length;
      }
    });

    const inputMetrics: GprPipelineInputMetrics = {
      total_ml: Number(totalMl.toFixed(2)),
      total_m2: Number(totalM2.toFixed(2)),
      utilities_count: utilitiesCount,
      reports_count: reports?.length || 0,
      tramos_count: tramosCount,
      max_depth_m: Number(maxDepth.toFixed(2)),
      selected_report_ids: Array.isArray(selectedReportIds) ? selectedReportIds : undefined,
    };

    // 2. Definir tarifas APU
    const defaultRates: GprPipelineCostRates = {
      cad_2d_rate_per_ml: 2500,
      gpr_proc_rate_per_ml: 3000,
      cad_refine_rate_per_utility: 35000,
      bim_3d_rate_per_ml: 4500,
      report_fixed_rate: 350000,
    };

    const costRates: GprPipelineCostRates = {
      ...defaultRates,
      ...(customRates || {}),
    };

    // 3. Cuantificar costos por actividad (APU)
    // - Paso 1: Plano 2D Preliminar = ML * Tarifa CAD 2D
    const cad2dCost = Math.round(inputMetrics.total_ml * costRates.cad_2d_rate_per_ml);
    // - Paso 2: Procesamiento Crudo GPR = ML * Tarifa GPR
    const gprProcCost = Math.round(inputMetrics.total_ml * costRates.gpr_proc_rate_per_ml);
    // - Paso 3: Mejora Plano 2D = Utilidades * Tarifa Interferencia
    const cadRefineCost = Math.round(inputMetrics.utilities_count * costRates.cad_refine_rate_per_utility);
    // - Paso 4: Modelo 3D BIM (.rvt) = ML * Tarifa 3D
    const bim3dCost = Math.round(inputMetrics.total_ml * costRates.bim_3d_rate_per_ml);
    // - Paso 5: Informe Final = Tarifa fija
    const reportCost = Math.round(costRates.report_fixed_rate);

    const costBreakdown: GprPipelineCostBreakdown = {
      cad_2d_cost: cad2dCost,
      gpr_proc_cost: gprProcCost,
      cad_refine_cost: cadRefineCost,
      bim_3d_cost: bim3dCost,
      report_cost: reportCost,
    };

    const totalCostCop = cad2dCost + gprProcCost + cadRefineCost + bim3dCost + reportCost;

    // 4. Insertar nuevo Job en la base de datos (El trigger creará los 5 pasos automáticamente)
    const { data: newJob, error: jobInsertErr } = await supabase
      .from('gpr_pipeline_jobs')
      .insert({
        project_id: projectId,
        created_by: auth.ctx.userId,
        title: `Pipeline GPR & CAD/BIM — ${new Date().toLocaleDateString('es-CO')}`,
        status: 'draft',
        current_step: 'cad_2d',
        input_metrics: inputMetrics,
        cost_rates: costRates,
        cost_breakdown: costBreakdown,
        total_cost_cop: totalCostCop,
        notes: notes || null,
      })
      .select()
      .single();

    if (jobInsertErr) throw jobInsertErr;

    // 5. Actualizar el costo individual de cada paso generado por el trigger
    await Promise.all([
      supabase.from('gpr_pipeline_steps').update({ cost_cop: cad2dCost }).eq('job_id', newJob.id).eq('step_key', 'cad_2d'),
      supabase.from('gpr_pipeline_steps').update({ cost_cop: gprProcCost }).eq('job_id', newJob.id).eq('step_key', 'gpr_raw_proc'),
      supabase.from('gpr_pipeline_steps').update({ cost_cop: cadRefineCost }).eq('job_id', newJob.id).eq('step_key', 'cad_2d_refine'),
      supabase.from('gpr_pipeline_steps').update({ cost_cop: bim3dCost }).eq('job_id', newJob.id).eq('step_key', 'bim_3d_rvt'),
      supabase.from('gpr_pipeline_steps').update({ cost_cop: reportCost }).eq('job_id', newJob.id).eq('step_key', 'project_report'),
    ]);

    // Consultar el job con sus pasos ya actualizados
    const { data: fullJob, error: fullJobErr } = await supabase
      .from('gpr_pipeline_jobs')
      .select('*, steps:gpr_pipeline_steps(*)')
      .eq('id', newJob.id)
      .single();

    if (fullJobErr) throw fullJobErr;

    if (fullJob && Array.isArray(fullJob.steps)) {
      fullJob.steps.sort((a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order);
    }

    return NextResponse.json({
      data: fullJob,
      message: 'Pipeline inicializado exitosamente con cuantificación de costos APU.',
    }, { status: 201 });
  } catch (err: unknown) {
    console.error('Error POST /api/tools/gpr-pipeline:', err);
    const postgrestErr = err as { message?: string; details?: string; hint?: string };
    const errMsg = postgrestErr?.message || (err instanceof Error ? err.message : 'Error al inicializar pipeline');
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
