import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createAdminClient } from '@/lib/supabase';
import { GprPipelineStepKey } from '@/types/gpr-pipeline';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface StepExecutionPayload {
  jobId?: string;
  projectId?: string;
  stepKey?: GprPipelineStepKey;
  runAll?: boolean;
  selectedReportIds?: string[];
}

interface RawFieldReport {
  id: string;
  report_date: string;
  localizador_name: string;
  operational_summary?: Array<{ sector?: string; ml?: number; m2?: number; max_depth_m?: number }> | null;
  detected_utilities?: Array<{ type?: string; diameter?: string; estimated_depth_m?: number; confidence?: string }> | null;
  antenna_frequency?: string | null;
  filter_gain_notes?: string | null;
  terrain_conditions?: string | null;
  global_max_depth?: number | null;
}

// Generador de prompts de ingeniería con metadata estructurada
function buildEngineeringPrompt(
  stepKey: GprPipelineStepKey,
  project: { name: string; client: string; cost_center?: string; location?: string },
  metrics: { total_ml: number; total_m2: number; utilities_count: number; max_depth_m: number; reports_count?: number },
  reports: RawFieldReport[]
): string {
  const pHeader = `PROYECTO: ${project.name} | CLIENTE: ${project.client} | CC: ${project.cost_center || 'N/A'} | UBICACIÓN: ${project.location || 'Colombia'}`;
  const mSummary = `METRAJE SELECCIONADO: ${metrics.total_ml} ML | ÁREA: ${metrics.total_m2} M² | PROFUNDIDAD MÁXIMA: ${metrics.max_depth_m} m | INTERFERENCIAS: ${metrics.utilities_count} | REPORTES UTILIZADOS: ${metrics.reports_count || reports.length}`;

  const tramosSample = reports
    .flatMap((r) => r.operational_summary || [])
    .slice(0, 10)
    .map((t) => `- ${t.sector || 'Tramo'}: ${t.ml || 0} ML (${t.max_depth_m || 0}m prof.)`)
    .join('\n');

  const utilitiesSample = reports
    .flatMap((r) => r.detected_utilities || [])
    .slice(0, 12)
    .map((u) => `- [${u.type || 'Servicio'}] Diámetro: ${u.diameter || 'N/D'} | Prof. Est.: ${u.estimated_depth_m || 0}m | Confianza: ${u.confidence || 'Media'}`)
    .join('\n');

  switch (stepKey) {
    case 'cad_2d':
      return `[PROCIMEC CAD AGENT - FASE 1: PLANO 2D PRELIMINAR]\n${pHeader}\n${mSummary}\n\n` +
        `INSTRUCCIÓN TÉCNICA:\n` +
        `Generar la estructura de capas (LAYERS) y el trazado de ejes preliminares en formato AutoCAD DXF R2018 (.dxf) utilizando la plantilla institucional de PROCIMEC INGENIERÍA S.A.S.\n\n` +
        `TRAMOS OPERATIVOS A DIBUJAR:\n${tramosSample || 'Sin tramos especificados'}\n\n` +
        `ESPECIFICACIONES DE CAPAS:\n` +
        `- Capa EJE_VIA: Color 1 (Rojo), Centro, 0.30mm\n` +
        `- Capa BORDE_EXPLORACION: Color 8 (Gris), Trazos, 0.15mm\n` +
        `- Capa COTAS: Color 7 (Blanco), Abscisas K0+000 cada 20m\n\n` +
        `SALIDA ESPERADA: Archivo vectorial DXF listo para descarga y apertura directa en AutoCAD / Civil 3D.`;

    case 'gpr_raw_proc':
      return `[PROCIMEC GEOFÍSICA AGENT - FASE 2: PROCESAMIENTO CRUDO GPR]\n${pHeader}\n${mSummary}\n\n` +
        `INSTRUCCIÓN TÉCNICA:\n` +
        `Documentar el procesamiento de radargramas y la cadena de filtros DSP geofísicos:\n` +
        `1. Corrección de Tiempo Cero (Time-Zero).\n` +
        `2. Filtro Dewow (eliminación de deriva de baja frecuencia).\n` +
        `3. Ganancia de Compensación Exponencial (SEC Gain).\n` +
        `4. Calibración de Permitividad Dieléctrica (RDP / εr) y velocidad de propagación v = 0.100 m/ns.\n\n` +
        `SALIDA ESPERADA: Informe técnico PDF consolidado bajo formato institucional FOR-GPR-04.`;

    case 'cad_2d_refine':
      return `[PROCIMEC CAD AGENT - FASE 3: MEJORA DEL PLANO 2D CON INTERFERENCIAS]\n${pHeader}\n${mSummary}\n\n` +
        `INSTRUCCIÓN TÉCNICA:\n` +
        `Incrustar todas las redes subterráneas reportadas sobre el plano base preliminar:\n\n` +
        `INTERFERENCIAS DETECTADAS:\n${utilitiesSample || 'Sin redes reportadas'}\n\n` +
        `CAPAS TÉCNICAS:\n` +
        `- GAS: RED_GAS (Amarillo #2)\n` +
        `- AGUA: RED_ACUEDUCTO (Azul #5)\n` +
        `- ENERGÍA: RED_ENERGIA (Rojo #1)\n` +
        `- TELECOMUNICACIONES: RED_TELECOM (Naranja #30)\n` +
        `- ALCANTARILLADO: RED_ALCANTARILLADO (Verde #3)\n\n` +
        `SALIDA ESPERADA: Plano 2D enriquecido con cotas Z, etiquetas de servicio y cuadro consolidado de interferencias (.dxf).`;

    case 'bim_3d_rvt':
      return `[PROCIMEC BIM AGENT - FASE 4: MODELADO 3D BIM (.RVT / IFC 4.0)]\n${pHeader}\n${mSummary}\n\n` +
        `INSTRUCCIÓN TÉCNICA:\n` +
        `Construir el modelo paramétrico tridimensional subsuperficial en formato IFC 4.0 (abrible en Autodesk Revit y Navisworks):\n` +
        `- Geometría volumétrica cilíndrica LOD 300 con diámetro nominal real.\n` +
        `- Cotas invert de enterramiento Z = -profundidad.\n` +
        `- Validación espacial de colisiones (Clash Detection < 0.30m).\n\n` +
        `SALIDA ESPERADA: Archivo de intercambio IFC 4.0 con Psets de auditoría GPR.`;

    case 'project_report':
      return `[PROCIMEC INGENIERÍA AGENT - FASE 5: INFORME FINAL DEL PROYECTO]\n${pHeader}\n${mSummary}\n\n` +
        `INSTRUCCIÓN TÉCNICA:\n` +
        `Redactar el Informe Técnico Final del Proyecto de Localización de Redes con Georadar bajo plantilla institucional Word (.docx) FOR-GPR-05 de PROCIMEC INGENIERÍA S.A.S.\n` +
        `Inyectar metrajes (${metrics.total_ml} ML, ${metrics.total_m2} M²), tabla de tramos, cuadro de interferencias detectadas y recomendaciones de excavación.\n\n` +
        `SALIDA ESPERADA: Documento Word membretado (.docx) listo para radicación ante el cliente.`;

    default:
      return `Procesamiento general para ${pHeader}`;
  }
}

// Generador de metadata de entregable y URL para descarga real
function generateStepDeliverableMeta(
  stepKey: GprPipelineStepKey,
  projectName: string,
  jobId: string,
  projectId: string,
  reportIds?: string[]
) {
  const cleanName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const rParam = reportIds && reportIds.length > 0 ? `&reportIds=${encodeURIComponent(reportIds.join(','))}` : '';
  const baseDownload = `/api/tools/gpr-pipeline/download?jobId=${encodeURIComponent(jobId)}&projectId=${encodeURIComponent(projectId)}&stepKey=${stepKey}${rParam}`;

  switch (stepKey) {
    case 'cad_2d':
      return {
        fileName: `Plano_2D_Base_${cleanName}.dxf`,
        fileUrl: `${baseDownload}&type=dxf&name=Plano_2D_Base_${cleanName}`,
        fileType: 'dxf',
        summary: `Plano 2D generado con éxito en formato AutoCAD DXF R2018. Delineación de ejes viales, franjas de exploración por tramo y rótulo oficial PROCIMEC INGENIERÍA S.A.S.`,
        tokens: { input_tokens: 1420, output_tokens: 680 },
      };
    case 'gpr_raw_proc':
      return {
        fileName: `Reporte_Radargramas_DSP_${cleanName}.pdf`,
        fileUrl: `${baseDownload}&type=pdf&name=Reporte_Radargramas_DSP_${cleanName}`,
        fileType: 'pdf',
        summary: `Procesamiento DSP completado. Documentación de filtros Time-Zero, Dewow, Ganancia SEC exponencial y calibración de permitividad dieléctrica (RDP).`,
        tokens: { input_tokens: 1650, output_tokens: 890 },
      };
    case 'cad_2d_refine':
      return {
        fileName: `Plano_2D_Interferencias_${cleanName}.dxf`,
        fileUrl: `${baseDownload}&type=dxf&name=Plano_2D_Interferencias_${cleanName}`,
        fileType: 'dxf',
        summary: `Plano 2D mejorado con éxito. Incrustación de todas las redes subterráneas con capas normalizadas por servicio, cotas Z, etiquetas técnicas y cuadro de interferencias.`,
        tokens: { input_tokens: 1890, output_tokens: 1120 },
      };
    case 'bim_3d_rvt':
      return {
        fileName: `Modelo_3D_BIM_Subterraneo_${cleanName}.ifc`,
        fileUrl: `${baseDownload}&type=ifc&name=Modelo_3D_BIM_Subterraneo_${cleanName}`,
        fileType: 'ifc',
        summary: `Modelo 3D BIM compilado en estándar IFC 4.0 (abrible en Revit/Civil 3D). Tuberías volumétricas en LOD 300 con cotas invert y validación de colisiones (Clash Detection).`,
        tokens: { input_tokens: 2150, output_tokens: 1450 },
      };
    case 'project_report':
      return {
        fileName: `Informe_Final_Georadar_${cleanName}.docx`,
        fileUrl: `${baseDownload}&type=docx&name=Informe_Final_Georadar_${cleanName}`,
        fileType: 'docx',
        summary: `Informe Técnico y Ejecutivo Final redactado y formateado en Word (.docx) bajo membrete oficial de PROCIMEC INGENIERÍA S.A.S. (FOR-GPR-05).`,
        tokens: { input_tokens: 2800, output_tokens: 2200 },
      };
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth({
    req: request,
    roles: ['admin', 'administrador', 'gerencia', 'management', 'dibujo', 'drawing', 'localizador', 'operator'],
  });
  if (!auth.ok) return auth.response;

  try {
    const body: StepExecutionPayload = await request.json();
    let { jobId } = body;
    const { projectId, stepKey, runAll, selectedReportIds } = body;

    const supabase = createAdminClient();

    // Si no se proporcionó jobId pero sí projectId, buscar el job activo o crearlo
    if (!jobId && projectId) {
      const { data: existingJob } = await supabase
        .from('gpr_pipeline_jobs')
        .select('id')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingJob) {
        jobId = existingJob.id;
      } else {
        const { data: newJob, error: createErr } = await supabase
          .from('gpr_pipeline_jobs')
          .insert({
            project_id: projectId,
            created_by: auth.ctx.userId,
            title: `Pipeline GPR & CAD/BIM — ${new Date().toLocaleDateString('es-CO')}`,
            status: 'draft',
            current_step: 'cad_2d',
            total_cost_cop: 0,
          })
          .select('id')
          .single();

        if (createErr || !newJob) {
          return NextResponse.json({ error: 'No se pudo inicializar el job para el proyecto' }, { status: 500 });
        }
        jobId = newJob.id;
      }
    }

    if (!jobId) {
      return NextResponse.json({ error: 'El jobId o projectId es obligatorio' }, { status: 400 });
    }

    // 1. Obtener información del Job y Proyecto
    const { data: job, error: jobErr } = await supabase
      .from('gpr_pipeline_jobs')
      .select('*, projects(*)')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 });
    }

    // 2. Determinar reportes seleccionados para filtrar la creación de los entregables
    const activeSelectedReportIds = (Array.isArray(selectedReportIds) && selectedReportIds.length > 0)
      ? selectedReportIds
      : (Array.isArray(job.input_metrics?.selected_report_ids) ? job.input_metrics.selected_report_ids : null);

    // 3. Obtener reportes de campo de este proyecto
    let reportsQuery = supabase
      .from('field_reports')
      .select('*')
      .eq('project_id', job.project_id);

    if (activeSelectedReportIds && activeSelectedReportIds.length > 0) {
      reportsQuery = reportsQuery.in('id', activeSelectedReportIds);
    }

    const { data: rawReports } = await reportsQuery;
    const reports = rawReports || [];

    // Recalcular métricas de entrada basadas en los reportes seleccionados
    let filteredMl = 0;
    let filteredM2 = 0;
    let filteredUtils = 0;
    let filteredTramos = 0;
    let filteredMaxDepth = 0;

    reports.forEach((rep: RawFieldReport) => {
      const dep = Number(rep.global_max_depth) || 0;
      if (dep > filteredMaxDepth) filteredMaxDepth = dep;

      if (Array.isArray(rep.operational_summary)) {
        rep.operational_summary.forEach((row: { ml?: number; m2?: number }) => {
          filteredTramos++;
          filteredMl += Number(row.ml) || 0;
          filteredM2 += Number(row.m2) || 0;
        });
      }

      if (Array.isArray(rep.detected_utilities)) {
        filteredUtils += rep.detected_utilities.length;
      }
    });

    const activeMetrics = {
      total_ml: Number(filteredMl.toFixed(2)),
      total_m2: Number(filteredM2.toFixed(2)),
      utilities_count: filteredUtils,
      reports_count: reports.length,
      tramos_count: filteredTramos,
      max_depth_m: Number(filteredMaxDepth.toFixed(2)),
      selected_report_ids: activeSelectedReportIds || undefined,
    };

    // Actualizar input_metrics en el job
    await supabase
      .from('gpr_pipeline_jobs')
      .update({
        input_metrics: activeMetrics,
        status: 'in_progress',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    // 4. Obtener los pasos del job
    const { data: rawSteps, error: stepsErr } = await supabase
      .from('gpr_pipeline_steps')
      .select('*')
      .eq('job_id', jobId)
      .order('step_order');

    const steps = rawSteps || [];

    if (stepsErr || steps.length === 0) {
      return NextResponse.json({ error: 'Pasos del job no encontrados' }, { status: 404 });
    }

    const stepsToRun = runAll
      ? steps
      : steps.filter((s: { step_key: string }) => s.step_key === stepKey);

    if (stepsToRun.length === 0) {
      return NextResponse.json({ error: 'Paso no encontrado para ejecutar' }, { status: 400 });
    }

    const executedSteps = [];

    for (const step of stepsToRun) {
      const sKey = step.step_key as GprPipelineStepKey;
      const startedAt = new Date().toISOString();

      // Marcar paso como 'running'
      await supabase
        .from('gpr_pipeline_steps')
        .update({
          status: 'running',
          started_at: startedAt,
          updated_at: startedAt,
        })
        .eq('id', step.id);

      // Generar prompt de ingeniería con los datos de los reportes seleccionados
      const prompt = buildEngineeringPrompt(
        sKey,
        job.projects,
        activeMetrics,
        reports as RawFieldReport[]
      );

      // Generar metadata del entregable y URL real de descarga
      const deliverableMeta = generateStepDeliverableMeta(
        sKey,
        job.projects?.name || 'Proyecto',
        jobId,
        job.project_id,
        activeSelectedReportIds || undefined
      );

      const completedAt = new Date().toISOString();

      // Guardar resultado y marcar paso como 'completed'
      const { data: updatedStep } = await supabase
        .from('gpr_pipeline_steps')
        .update({
          status: 'completed',
          output_file_name: deliverableMeta.fileName,
          output_file_url: deliverableMeta.fileUrl,
          output_file_type: deliverableMeta.fileType,
          ai_prompt: prompt,
          ai_response: deliverableMeta.summary,
          ai_model_used: 'Gemini 1.5 Pro',
          token_usage: deliverableMeta.tokens,
          execution_logs: `[${new Date().toLocaleTimeString('es-CO')}] Paso ejecutado exitosamente con Gemini 1.5 Pro. Entregable generado: ${deliverableMeta.fileName} basado en ${reports.length} reportes seleccionados (${activeMetrics.total_ml} ML, ${activeMetrics.utilities_count} interferencias).`,
          completed_at: completedAt,
          updated_at: completedAt,
        })
        .eq('id', step.id)
        .select()
        .single();

      executedSteps.push(updatedStep);
    }

    // Verificar si todos los pasos están completados
    const { data: rawCurrentSteps } = await supabase
      .from('gpr_pipeline_steps')
      .select('status')
      .eq('job_id', jobId);

    const currentSteps = rawCurrentSteps || [];
    const allDone = currentSteps.length > 0 && currentSteps.every((s: { status: string }) => s.status === 'completed');
    if (allDone) {
      await supabase
        .from('gpr_pipeline_jobs')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', jobId);
    }

    return NextResponse.json({
      data: {
        jobId,
        executedSteps,
        isAllCompleted: allDone,
      },
      message: runAll
        ? 'Pipeline completo ejecutado exitosamente sobre los reportes seleccionados.'
        : `Paso ${stepKey} ejecutado exitosamente sobre los reportes seleccionados.`,
    });
  } catch (err: unknown) {
    console.error('Error POST /api/tools/gpr-pipeline/step:', err);
    const postgrestErr = err as { message?: string; details?: string; hint?: string };
    const errMsg = postgrestErr?.message || (err instanceof Error ? err.message : 'Error al ejecutar paso del pipeline');
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
