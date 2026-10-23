import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createAdminClient } from '@/lib/supabase';
import { GprPipelineStepKey } from '@/types/gpr-pipeline';
import { generateBase2dDxf, generateRefined2dDxf } from '@/lib/gpr-cad/generators/dxf-generator';
import { getTopographyForPipeline } from '@/lib/gpr-cad/services/topography-service';
import { generateGprDspReportPdf } from '@/lib/gpr-cad/generators/gpr-dsp-report-generator';
import { generateIfc4Model } from '@/lib/gpr-cad/generators/ifc-bim-generator';
import { generateProjectReportDocx } from '@/lib/gpr-cad/generators/project-report-generator';

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

interface JobWithProject {
  id: string;
  project_id: string;
  input_metrics?: { selected_report_ids?: string[] } | null;
  projects?: {
    name?: string;
    client?: string;
    cost_center?: string;
    location?: string;
  } | null;
}

interface RawReportData {
  id: string;
  report_date: string;
  localizador_name?: string;
  antenna_frequency?: string | null;
  gpr_equipment?: string | null;
  global_max_depth?: number | null;
  operational_summary?: RawOperationalRow[] | null;
  detected_utilities?: RawUtility[] | null;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth({ req: request });
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    let projectId = searchParams.get('projectId');
    let stepKey = searchParams.get('stepKey') as GprPipelineStepKey | null;
    const type = (searchParams.get('type') || '').toLowerCase();
    const rawReportIds = searchParams.get('reportIds');
    const requestedName = searchParams.get('name');

    const supabase = createAdminClient();

    let job: JobWithProject | null = null;
    let selectedReportIds: string[] | null = rawReportIds
      ? rawReportIds.split(',').filter(Boolean)
      : null;

    if (jobId) {
      const { data: foundJob } = await supabase
        .from('gpr_pipeline_jobs')
        .select('*, projects(*)')
        .eq('id', jobId)
        .maybeSingle();

      if (foundJob) {
        job = foundJob;
        if (!projectId) projectId = foundJob.project_id;
        if (!selectedReportIds && Array.isArray(foundJob.input_metrics?.selected_report_ids)) {
          selectedReportIds = foundJob.input_metrics.selected_report_ids;
        }
      }
    }

    if (!projectId && !jobId) {
      return NextResponse.json({ error: 'Se requiere jobId o projectId para descargar el entregable' }, { status: 400 });
    }

    // 1. Obtener metadatos del proyecto
    let projectMeta = {
      name: job?.projects?.name || 'Proyecto GPR',
      client: job?.projects?.client || 'Cliente PROCIMEC',
      cost_center: job?.projects?.cost_center || '',
      location: job?.projects?.location || 'Colombia',
    };

    if (projectId && (!job || !job.projects)) {
      const { data: projData } = await supabase
        .from('projects')
        .select('name, client, cost_center, location')
        .eq('id', projectId)
        .maybeSingle();

      if (projData) {
        projectMeta = {
          name: projData.name || 'Proyecto GPR',
          client: projData.client || 'Cliente PROCIMEC',
          cost_center: projData.cost_center || '',
          location: projData.location || 'Colombia',
        };
      }
    }

    // 2. Consultar reportes de campo (GPR) filtrando por los seleccionados si existen
    let reportsQuery = supabase
      .from('field_reports')
      .select('id, report_date, localizador_name, operational_summary, detected_utilities, global_max_depth, antenna_frequency, gpr_equipment')
      .eq('project_id', projectId)
      .order('report_date', { ascending: false });

    if (selectedReportIds && selectedReportIds.length > 0) {
      reportsQuery = reportsQuery.in('id', selectedReportIds);
    }

    const { data: rawReports } = await reportsQuery;
    const reports = rawReports || [];

    // 3. Consolidar tramos e interferencias de los reportes seleccionados
    let totalMl = 0;
    let totalM2 = 0;
    let maxDepth = 0;
    const tramosList: Array<{
      sector: string;
      ml: number;
      m2: number;
      max_depth_m: number;
      observations?: string;
      report_date?: string;
      localizador_name?: string;
    }> = [];

    const utilitiesList: Array<{
      type: string;
      diameter?: string;
      estimated_depth_m: number;
      confidence: string;
      description?: string;
      report_date?: string;
    }> = [];

    let detectedAntenna = '400 MHz';
    let detectedEquipment = 'GPR ProEx';

    reports.forEach((rep: RawReportData) => {
      if (rep.antenna_frequency) detectedAntenna = rep.antenna_frequency;
      if (rep.gpr_equipment) detectedEquipment = rep.gpr_equipment;

      const d = Number(rep.global_max_depth) || 0;
      if (d > maxDepth) maxDepth = d;

      if (Array.isArray(rep.operational_summary)) {
        rep.operational_summary.forEach((row: RawOperationalRow) => {
          const ml = Number(row.ml) || 0;
          const m2 = Number(row.m2) || 0;
          const dep = Number(row.max_depth_m) || 0;
          totalMl += ml;
          totalM2 += m2;
          if (dep > maxDepth) maxDepth = dep;

          tramosList.push({
            sector: row.sector || `Sector ${tramosList.length + 1}`,
            ml,
            m2,
            max_depth_m: dep,
            observations: row.observations || '',
            report_date: rep.report_date,
            localizador_name: rep.localizador_name,
          });
        });
      }

      if (Array.isArray(rep.detected_utilities)) {
        rep.detected_utilities.forEach((u: RawUtility) => {
          utilitiesList.push({
            type: u.type || 'Interferencia de Servicio',
            diameter: u.diameter || 'N/D',
            estimated_depth_m: Number(u.estimated_depth_m) || 0.8,
            confidence: u.confidence || 'Media',
            description: u.description || '',
            report_date: rep.report_date,
          });
        });
      }
    });

    const metrics = {
      total_ml: Number(totalMl.toFixed(2)),
      total_m2: Number(totalM2.toFixed(2)),
      max_depth_m: Number(maxDepth.toFixed(2)),
      reports_count: reports.length,
      utilities_count: utilitiesList.length,
    };

    // Si no se especificó stepKey, inferirlo del type
    if (!stepKey) {
      if (type === 'pdf') stepKey = 'gpr_raw_proc';
      else if (type === 'rvt' || type === 'ifc') stepKey = 'bim_3d_rvt';
      else if (type === 'docx') stepKey = 'project_report';
      else if (type === 'dwg' || type === 'dxf') {
        stepKey = requestedName && requestedName.includes('Final') ? 'cad_2d_refine' : 'cad_2d';
      } else {
        stepKey = 'cad_2d';
      }
    }

    const cleanProjectName = projectMeta.name.replace(/[^a-zA-Z0-9_-]/g, '_');

    // 4. Obtener topografía georreferenciada de Estación Total si existe
    const topography = await getTopographyForPipeline({
      jobId,
      projectId,
      reportIds: selectedReportIds,
    });

    // 5. Despacho según el entregable
    switch (stepKey) {
      case 'cad_2d': {
        // Paso 1: Plano 2D Base (.DXF R12 Universal con Georreferenciación)
        const dxfContent = generateBase2dDxf(projectMeta, tramosList, topography);
        const fileName = requestedName
          ? (requestedName.endsWith('.dxf') ? requestedName : `${requestedName}.dxf`)
          : `Plano_2D_Base_${cleanProjectName}.dxf`;

        return new NextResponse(dxfContent, {
          headers: {
            'Content-Type': 'application/dxf',
            'Content-Disposition': `attachment; filename="${fileName}"`,
          },
        });
      }

      case 'gpr_raw_proc': {
        // Paso 2: Informe de Radargramas y Filtros DSP (.PDF)
        const pdfBuffer = await generateGprDspReportPdf({
          project: projectMeta,
          metrics,
          tramos: tramosList,
          antennaFrequency: detectedAntenna,
          gprEquipment: detectedEquipment,
        });

        const fileName = requestedName
          ? (requestedName.endsWith('.pdf') ? requestedName : `${requestedName}.pdf`)
          : `Reporte_Radargramas_DSP_${cleanProjectName}.pdf`;

        return new NextResponse(new Uint8Array(pdfBuffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName}"`,
          },
        });
      }

      case 'cad_2d_refine': {
        // Paso 3: Plano 2D Mejorado con Interferencias y Cotas Z Georreferenciadas (.DXF R12 Universal)
        const dxfRefined = generateRefined2dDxf(projectMeta, tramosList, utilitiesList, topography);
        const fileName = requestedName
          ? (requestedName.endsWith('.dxf') ? requestedName : `${requestedName}.dxf`)
          : `Plano_2D_Interferencias_${cleanProjectName}.dxf`;

        return new NextResponse(dxfRefined, {
          headers: {
            'Content-Type': 'application/dxf',
            'Content-Disposition': `attachment; filename="${fileName}"`,
          },
        });
      }

      case 'bim_3d_rvt': {
        // Paso 4: Modelo 3D BIM (.IFC 4.0 / Revit LOD 300)
        const ifcContent = generateIfc4Model(projectMeta, utilitiesList, metrics.total_ml);
        const fileName = requestedName
          ? (requestedName.endsWith('.ifc') ? requestedName : `${requestedName}.ifc`)
          : `Modelo_3D_BIM_Subterraneo_${cleanProjectName}.ifc`;

        return new NextResponse(ifcContent, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${fileName}"`,
          },
        });
      }

      case 'project_report': {
        // Paso 5: Informe Final del Proyecto (.DOCX)
        const docxBuffer = await generateProjectReportDocx({
          project: projectMeta,
          metrics,
          tramos: tramosList,
          utilities: utilitiesList,
        });

        const fileName = requestedName
          ? (requestedName.endsWith('.docx') ? requestedName : `${requestedName}.docx`)
          : `Informe_Final_Georadar_${cleanProjectName}.docx`;

        return new NextResponse(new Uint8Array(docxBuffer), {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${fileName}"`,
          },
        });
      }

      default:
        return NextResponse.json({ error: 'Entregable no reconocido' }, { status: 400 });
    }
  } catch (err) {
    console.error('Error GET /api/tools/gpr-pipeline/download:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al generar entregable para descarga' },
      { status: 500 }
    );
  }
}
