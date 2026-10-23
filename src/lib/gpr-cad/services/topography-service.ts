/**
 * SERVICIO DE GEORREFERENCIACIÓN Y TOPOGRAFÍA PARA EL PIPELINE GPR/CAD
 * Plataforma PROCIMEC INGENIERÍA S.A.S. — PCM CLOUD
 * Obtiene y procesa archivos .txt de Estación Total desde base de datos, Storage o input directo.
 */

import { createAdminClient } from '@/lib/supabase';
import { parseTopographyTxt, TopographyDataset } from '../parsers/topography-txt-parser';

export async function getTopographyForPipeline(params: {
  jobId?: string | null;
  projectId?: string | null;
  reportIds?: string[] | null;
  customTxt?: string | null;
}): Promise<TopographyDataset | null> {
  const { jobId, projectId, reportIds, customTxt } = params;

  // 1. Si se pasó texto directo en la llamada
  if (customTxt && typeof customTxt === 'string' && customTxt.trim().length > 0) {
    const parsed = parseTopographyTxt(customTxt);
    if (parsed.points.length > 0) return parsed;
  }

  const supabase = createAdminClient();

  // 2. Si hay jobId, consultar input_metrics.topography_txt
  if (jobId) {
    const { data: job } = await supabase
      .from('gpr_pipeline_jobs')
      .select('input_metrics')
      .eq('id', jobId)
      .maybeSingle();

    const jobMetrics = job?.input_metrics as { topography_txt?: string } | undefined;
    if (jobMetrics?.topography_txt) {
      const parsed = parseTopographyTxt(jobMetrics.topography_txt);
      if (parsed.points.length > 0) return parsed;
    }
  }

  // 3. Buscar archivos .txt en report_files de los reportes seleccionados (o del proyecto)
  let targetReportIds = reportIds || [];
  if (targetReportIds.length === 0 && projectId) {
    const { data: reports } = await supabase
      .from('field_reports')
      .select('id')
      .eq('project_id', projectId);
    targetReportIds = (reports || []).map((r) => r.id);
  }

  if (targetReportIds.length > 0) {
    const { data: files } = await supabase
      .from('report_files')
      .select('id, original_name, storage_url, storage_path, file_type')
      .in('field_report_id', targetReportIds)
      .or('file_type.eq.gps,original_name.ilike.%.txt');

    if (files && files.length > 0) {
      // Priorizar archivos que terminen en .txt
      const txtFile = files.find((f) => f.original_name?.toLowerCase().endsWith('.txt')) || files[0];

      if (txtFile) {
        let fileContent = '';

        // Intento A: Descargar desde Supabase Storage
        if (txtFile.storage_path) {
          const buckets = ['evidencias', 'reports', 'project-files'];
          for (const b of buckets) {
            const { data: blob } = await supabase.storage.from(b).download(txtFile.storage_path);
            if (blob) {
              fileContent = await blob.text();
              break;
            }
          }
        }

        // Intento B: Si storage_path falló, probar con la URL pública
        if (!fileContent && txtFile.storage_url) {
          try {
            const res = await fetch(txtFile.storage_url);
            if (res.ok) {
              fileContent = await res.text();
            }
          } catch {
            // Ignorar y continuar
          }
        }

        if (fileContent && fileContent.trim().length > 0) {
          const parsed = parseTopographyTxt(fileContent);
          if (parsed.points.length > 0) {
            return parsed;
          }
        }
      }
    }
  }

  return null;
}
