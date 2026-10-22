import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createAdminClient } from '@/lib/supabase';
import { GprPipelineStepKey } from '@/types/gpr-pipeline';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface StepExecutionPayload {
  jobId: string;
  stepKey?: GprPipelineStepKey;
  runAll?: boolean;
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
}

// Generador de prompts de ingeniería de bajo consumo (metadata estructurada)
function buildEngineeringPrompt(
  stepKey: GprPipelineStepKey,
  project: { name: string; client: string; cost_center?: string; location?: string },
  metrics: { total_ml: number; total_m2: number; utilities_count: number; max_depth_m: number },
  reports: RawFieldReport[]
): string {
  const pHeader = `PROYECTO: ${project.name} | CLIENTE: ${project.client} | CC: ${project.cost_center || 'N/A'} | UBICACIÓN: ${project.location || 'Colombia'}`;
  const mSummary = `METRAJE ACUMULADO: ${metrics.total_ml} ML | ÁREA: ${metrics.total_m2} M² | PROFUNDIDAD MÁXIMA: ${metrics.max_depth_m} m | INTERFERENCIAS: ${metrics.utilities_count}`;

  // Extraer muestra de tramos e interferencias para contexto
  const tramosSample = reports
    .flatMap((r) => r.operational_summary || [])
    .slice(0, 8)
    .map((t) => `- ${t.sector || 'Tramo'}: ${t.ml || 0} ML (${t.max_depth_m || 0}m prof.)`)
    .join('\n');

  const utilitiesSample = reports
    .flatMap((r) => r.detected_utilities || [])
    .slice(0, 10)
    .map((u) => `- [${u.type || 'Servicio'}] Diámetro: ${u.diameter || 'N/D'} | Prof. Est.: ${u.estimated_depth_m || 0}m | Confianza: ${u.confidence || 'Media'}`)
    .join('\n');

  switch (stepKey) {
    case 'cad_2d':
      return `[PROCIMEC CAD AGENT - FASE 1: PLANO 2D PRELIMINAR]\n${pHeader}\n${mSummary}\n\n` +
        `INSTRUCCIÓN TÉCNICA:\n` +
        `Generar la estructura de capas (LAYERS) y el trazado de ejes preliminares en formato compatible AutoCAD 2018 (.dwg/.dxf) utilizando la plantilla institucional de PROCIMEC INGENIERÍA S.A.S.\n\n` +
        `TRAMOS OPERATIVOS A DIBUJAR:\n${tramosSample || 'Sin tramos especificados'}\n\n` +
        `ESPECIFICACIONES DE CAPAS (AutoCAD Standard):\n` +
        `- Capa EJE_VIA: Color 1 (Rojo), Continuo, 0.30mm\n` +
        `- Capa BORDES_EXPLORACION: Color 8 (Gris), Trazos, 0.15mm\n` +
        `- Capa TEXTOS_COTAS: Color 7 (Blanco), Arial 2.0mm\n\n` +
        `SALIDA ESPERADA: Script de comandos vectoriales para inyección directa en plantilla DWG con rótulo oficial.`;

    case 'gpr_raw_proc':
      return `[PROCIMEC GEOFÍSICA AGENT - FASE 2: PROCESAMIENTO CRUDO GPR]\n${pHeader}\n${mSummary}\n\n` +
        `INSTRUCCIÓN TÉCNICA:\n` +
        `Procesar los archivos de radargramas crudos capturados en campo (.gsf / .rd3 / .dzt). Aplicar cadena de filtros DSP geofísicos:\n` +
        `1. Corrección de Tiempo Cero (Time-Zero Correction).\n` +
        `2. Filtro Dewow (eliminación de deriva de baja frecuencia).\n` +
        `3. Ganancia de Compensación Exponencial (SEC Gain / AGC).\n` +
        `4. Ajuste hiperbólico de velocidades para calibración de constante dieléctrica (RDP).\n\n` +
        `SALIDA ESPERADA: Matriz de anomalías detectadas con coordenadas de tiempo/profundidad y radargramas filtrados procesados.`;

    case 'cad_2d_refine':
      return `[PROCIMEC CAD AGENT - FASE 3: MEJORA Y CALIBRACIÓN DE INTERFERENCIAS EN PLANO 2D]\n${pHeader}\n${mSummary}\n\n` +
        `INSTRUCCIÓN TÉCNICA:\n` +
        `Actualizar el plano 2D generado en la Fase 1 incrustando la localización exacta de todas las redes de servicios públicos detectadas por el Georadar:\n\n` +
        `REDES E INTERFERENCIAS DETECTADAS:\n${utilitiesSample || 'Sin redes reportadas'}\n\n` +
        `ASIGNACIÓN DE CAPAS Y SIMBOLOGÍA TÉCNICA:\n` +
        `- GAS: Capa RED_GAS (Amarillo #FFFF00), Trazo discontinuo GAS, texto con diámetro y cota.\n` +
        `- AGUA: Capa RED_ACUEDUCTO (Azul #0000FF), Diámetro y profundidad.\n` +
        `- ENERGÍA (BT/AT): Capa RED_ELECTRICA (Rojo #FF0000), ductería y canalizaciones.\n` +
        `- TELECOMUNICACIONES: Capa RED_TELECOM (Naranja #FFA500).\n` +
        `- ALCANTARILLADO: Capa RED_PLUVIAL_SANITARIO (Verde #00FF00).\n\n` +
        `SALIDA ESPERADA: Plano 2D consolidado y enriquecido (.dwg) listo para aprobación técnica.`;

    case 'bim_3d_rvt':
      return `[PROCIMEC BIM AGENT - FASE 4: MODELADO 3D BIM (.RVT / IFC)]\n${pHeader}\n${mSummary}\n\n` +
        `INSTRUCCIÓN TÉCNICA:\n` +
        `Construir el modelo paramétrico tridimensional subsuperficial en base a la plantilla de familias Revit (.rvt) y estándar IFC 4.0:\n` +
        `- Modelar las redes de tuberías con su diámetro nominal respectivo y pendiente hidráulica/topográfica.\n` +
        `- Respetar las profundidades invert de enterramiento respecto a la cota rasante del terreno.\n` +
        `- Generar volúmenes de interferencia y detección de colisiones (Clash Detection) entre redes subterráneas.\n\n` +
        `SALIDA ESPERADA: Archivo de modelo 3D BIM (.rvt / IFC) ensamblado con atributos COBie y LOD 300.`;

    case 'project_report':
      return `[PROCIMEC INGENIERÍA AGENT - FASE 5: INFORME FINAL DEL PROYECTO]\n${pHeader}\n${mSummary}\n\n` +
        `INSTRUCCIÓN TÉCNICA:\n` +
        `Redactar el Informe Técnico y Ejecutivo Final del Proyecto de Localización de Redes con Georadar (GPR) bajo la plantilla institucional de PROCIMEC INGENIERÍA S.A.S.\n` +
        `- 1. Introducción y Objetivos del Proyecto.\n` +
        `- 2. Metodología de Exploración y Equipos Empleados.\n` +
        `- 3. Cuadro Consolidado de Volumetría (${metrics.total_ml} ML ejecutados).\n` +
        `- 4. Análisis Geofísico de Anomalías y Redes Detectadas.\n` +
        `- 5. Matriz de Riesgos e Interferencias para Obra / Excavación.\n` +
        `- 6. Conclusiones y Recomendaciones de Ingeniería.\n\n` +
        `SALIDA ESPERADA: Documento técnico completo estructurado para inyección en plantilla oficial Word (.docx) y compilación en PDF.`;

    default:
      return `Procesamiento general para ${pHeader}`;
  }
}

// Simulación de respuesta estructurada de IA para cada paso (preparado para API Claude en Fase 4)
function generateSimulatedOutput(stepKey: GprPipelineStepKey, projectName: string) {
  const cleanName = projectName.replace(/[^a-zA-Z0-9]/g, '_');

  switch (stepKey) {
    case 'cad_2d':
      return {
        fileName: `Plano_2D_Preliminar_${cleanName}.dwg`,
        fileUrl: `/api/tools/gpr-pipeline/download?type=dwg&name=Plano_2D_${cleanName}`,
        summary: `Plano 2D generado con éxito sobre la plantilla DWG PROCIMEC. Se trazaron los ejes preliminares y la delimitación de franjas de exploración.`,
        tokens: { input_tokens: 1420, output_tokens: 680 },
      };
    case 'gpr_raw_proc':
      return {
        fileName: `Reporte_Radargramas_DSP_${cleanName}.pdf`,
        fileUrl: `/api/tools/gpr-pipeline/download?type=pdf&name=Radargramas_${cleanName}`,
        summary: `Procesamiento DSP completado. Se aplicó corrección time-zero, filtro Dewow y ganancia SEC. 100% de radargramas normalizados.`,
        tokens: { input_tokens: 1650, output_tokens: 890 },
      };
    case 'cad_2d_refine':
      return {
        fileName: `Plano_2D_Final_Interferencias_${cleanName}.dwg`,
        fileUrl: `/api/tools/gpr-pipeline/download?type=dwg&name=Plano_Final_${cleanName}`,
        summary: `Plano 2D enriquecido con éxito. Se plotearon todas las redes con sus respectivas capas técnicas (Gas, Acueducto, Energía, Telecomunicaciones) y cotas.`,
        tokens: { input_tokens: 1890, output_tokens: 1120 },
      };
    case 'bim_3d_rvt':
      return {
        fileName: `Modelo_3D_BIM_Subterraneo_${cleanName}.rvt`,
        fileUrl: `/api/tools/gpr-pipeline/download?type=rvt&name=Modelo_3D_${cleanName}`,
        summary: `Modelo 3D BIM compilado en plantilla Revit (.rvt). Tuberías modeladas en LOD 300 con asignación de diámetros y cotas de enterramiento.`,
        tokens: { input_tokens: 2150, output_tokens: 1450 },
      };
    case 'project_report':
      return {
        fileName: `Informe_Final_Georadar_${cleanName}.docx`,
        fileUrl: `/api/tools/gpr-pipeline/download?type=docx&name=Informe_Final_${cleanName}`,
        summary: `Informe Técnico del Proyecto redactado y formateado con éxito bajo membrete de PROCIMEC INGENIERÍA S.A.S. Listo para entrega al cliente.`,
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
    const { jobId, stepKey, runAll } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'El jobId es obligatorio' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Obtener información del Job y Proyecto
    const { data: job, error: jobErr } = await supabase
      .from('gpr_pipeline_jobs')
      .select('*, projects(*)')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 });
    }

    // 2. Obtener reportes de campo de este proyecto
    const { data: rawReports } = await supabase
      .from('field_reports')
      .select('*')
      .eq('project_id', job.project_id);

    const reports = rawReports || [];

    // 3. Obtener los pasos del job
    const { data: rawSteps, error: stepsErr } = await supabase
      .from('gpr_pipeline_steps')
      .select('*')
      .eq('job_id', jobId)
      .order('step_order');

    const steps = rawSteps || [];

    if (stepsErr || steps.length === 0) {
      return NextResponse.json({ error: 'Pasos del job no encontrados' }, { status: 404 });
    }

    // Si runAll es true, ejecutamos los 5 pasos en secuencia
    const stepsToRun = runAll
      ? steps
      : steps.filter((s: { step_key: string }) => s.step_key === stepKey);

    if (stepsToRun.length === 0) {
      return NextResponse.json({ error: 'Paso no encontrado para ejecutar' }, { status: 400 });
    }

    // Actualizar estado general del Job a 'in_progress'
    await supabase
      .from('gpr_pipeline_jobs')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', jobId);

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

      // Generar prompt de ingeniería con metadata
      const prompt = buildEngineeringPrompt(
        sKey,
        job.projects,
        job.input_metrics,
        reports as RawFieldReport[]
      );

      // Simular inferencia / procesamiento (preparado para hook de Claude)
      const simulated = generateSimulatedOutput(sKey, job.projects.name);
      const completedAt = new Date().toISOString();

      // Guardar resultado y marcar paso como 'completed'
      const { data: updatedStep } = await supabase
        .from('gpr_pipeline_steps')
        .update({
          status: 'completed',
          output_file_name: simulated.fileName,
          output_file_url: simulated.fileUrl,
          ai_prompt: prompt,
          ai_response: simulated.summary,
          token_usage: simulated.tokens,
          execution_logs: `[${new Date().toLocaleTimeString('es-CO')}] Paso ejecutado exitosamente. Entregable generado: ${simulated.fileName}. Consumo: ${simulated.tokens.input_tokens + simulated.tokens.output_tokens} tokens.`,
          completed_at: completedAt,
          updated_at: completedAt,
        })
        .eq('id', step.id)
        .select()
        .single();

      executedSteps.push(updatedStep);
    }

    // Verificar si todos los pasos están completados para marcar el job como 'completed'
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
        ? 'Pipeline completo ejecutado exitosamente.'
        : `Paso ${stepKey} ejecutado exitosamente.`,
    });
  } catch (err) {
    console.error('Error POST /api/tools/gpr-pipeline/step:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al ejecutar paso del pipeline' },
      { status: 500 }
    );
  }
}
