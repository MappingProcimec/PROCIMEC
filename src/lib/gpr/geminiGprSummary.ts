export interface ProjectContext {
  id?: string;
  name: string;
  client: string;
  code?: string;
  location?: string;
  cost_center?: string;
}

export interface GprReportContext {
  report_date: string;
  report_time?: string | null;
  localizador_name: string;
  gpr_equipment?: string | null;
  antenna_frequency?: string | null;
  positioning_equipment?: string | null;
  terrain_conditions?: string | null;
  weather_conditions?: string | null;
  capture_method?: string | null;
  operational_summary?: Array<{
    axis?: string;
    start_abs?: string;
    end_abs?: string;
    road_side?: string;
    ml?: number;
    m2?: number;
    surface_type?: string;
  }>;
  global_max_depth?: number | string | null;
  detected_utilities?: Array<{
    utility_type?: string;
    material?: string;
    estimated_depth_m?: number | string;
    detection_method?: string;
    cad_priority?: string;
    notes?: string;
  }>;
  anomalies_notes?: string | null;
  site_restrictions?: string | null;
  cad_priority?: string | null;
  processing_recommendations?: string | null;
}

/**
 * Generador determinista de respaldo cuando la API de Gemini no está disponible o no responde.
 * Garantiza un informe técnico ejecutivo impecable siempre considerando el proyecto y cliente.
 */
function buildDeterministicSummary(project: ProjectContext, report: GprReportContext): string {
  const totalMl = (report.operational_summary || []).reduce((acc, row) => acc + (Number(row.ml) || 0), 0);
  const totalM2 = (report.operational_summary || []).reduce((acc, row) => acc + (Number(row.m2) || 0), 0);
  const utilitiesCount = (report.detected_utilities || []).length;
  const utilityTypes = Array.from(
    new Set((report.detected_utilities || []).map(u => u.utility_type).filter(Boolean))
  ).join(', ');

  const projectIdent = project.name ? `${project.name} (${project.client || 'Cliente'})` : 'el proyecto asignado';
  const locationText = project.location ? ` en la localización ${project.location}` : '';

  let summary = `Durante la jornada operativa del ${report.report_date} en ${projectIdent}${locationText}, la cuadrilla de georadar liderada por ${report.localizador_name} ejecutó el barrido geofísico empleando ${report.gpr_equipment || 'sistema GPR'}. `;

  if (totalMl > 0) {
    summary += `Se consolidó un avance volumétrico efectivo de ${totalMl.toFixed(1)} metros lineales (${totalM2.toFixed(1)} m²) de exploración subsuperficial, alcanzando una profundidad de investigación de hasta ${report.global_max_depth || '1.5'} m bajo condiciones de terreno catalogadas como ${report.terrain_conditions || 'estándar'}. `;
  } else {
    summary += `Se llevaron a cabo verificaciones electromagnéticas y de georadar bajo condiciones de terreno ${report.terrain_conditions || 'estándar'}. `;
  }

  if (utilitiesCount > 0) {
    summary += `Se identificaron y georreferenciaron ${utilitiesCount} alineamientos de servicios subterráneos correspondientes a: ${utilityTypes || 'redes de servicio público'}. `;
  } else {
    summary += `No se evidenciaron interferencias anómalas críticas que comprometan la traza evaluada. `;
  }

  if (report.anomalies_notes && report.anomalies_notes.trim().length > 0) {
    summary += `Hallazgos notables en campo: ${report.anomalies_notes.trim()}. `;
  }

  if (report.cad_priority) {
    summary += `El reporte se clasifica con prioridad CAD/BIM ${report.cad_priority.toUpperCase()}`;
    if (report.processing_recommendations) {
      summary += `, recomendándose para gabinete: ${report.processing_recommendations.trim()}.`;
    } else {
      summary += ` para su oportuna incorporación en los planos técnicos oficiales.`;
    }
  }

  return summary.trim();
}

/**
 * Consulta a Google Gemini para sintetizar un párrafo técnico ejecutivo del día,
 * siempre tomando en cuenta el proyecto, el cliente, la volumetría y los hallazgos.
 */
export async function generateGprExecutiveSummary(
  project: ProjectContext,
  report: GprReportContext
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return buildDeterministicSummary(project, report);
  }

  const totalMl = (report.operational_summary || []).reduce((acc, row) => acc + (Number(row.ml) || 0), 0);
  const totalM2 = (report.operational_summary || []).reduce((acc, row) => acc + (Number(row.m2) || 0), 0);

  const prompt = `Actúa como Ingeniero Geofísico Senior y Director de Operaciones en PROCIMEC Mapping e Ingeniería.
Genera una síntesis técnica ejecutiva y formal (de 1 a 2 párrafos de alto nivel, entre 70 y 130 palabras en español técnico neutro) para el Reporte Diario de Operación de Georadar (GPR).
Este reporte será enviado a la interventoría y al cliente oficial del proyecto.

DATOS DEL PROYECTO:
- Proyecto: ${project.name}
- Cliente: ${project.client}
- Código / Centro de Costos: ${project.code || project.cost_center || 'N/A'}
- Ubicación / Frente de obra: ${project.location || 'Frente asignado'}

DATOS DE LA OPERACIÓN EN CAMPO:
- Fecha de inspección: ${report.report_date}
- Responsable / Localizador: ${report.localizador_name}
- Equipo GPR: ${report.gpr_equipment || 'Georadar'} | Frecuencia: ${report.antenna_frequency || 'No especificada'}
- Posicionamiento: ${report.positioning_equipment || 'GPS GNSS'}
- Condiciones de terreno: ${report.terrain_conditions || 'Normal'} | Clima: ${report.weather_conditions || 'Despejado'}
- Profundidad máxima explorada: ${report.global_max_depth || '1.5'} metros
- Volumetría registrada: ${totalMl.toFixed(1)} metros lineales (${totalM2.toFixed(1)} m²) en ${(report.operational_summary || []).length} tramos
- Redes/Servicios detectados: ${JSON.stringify(report.detected_utilities || [])}
- Observaciones de anomalías: ${report.anomalies_notes || 'Sin anomalías registradas'}
- Restricciones en sitio: ${report.site_restrictions || 'Sin restricciones'}
- Prioridad CAD: ${report.cad_priority || 'Media'}
- Recomendaciones de procesamiento: ${report.processing_recommendations || 'Tratamiento estándar'}

DIRECTRICES OBLIGATORIAS:
1. Menciona explícitamente el nombre del proyecto (${project.name}) y/o el cliente (${project.client}).
2. Comunica con precisión ingenieril el avance lineal/superficial logrado y la certidumbre de los servicios detectados.
3. Cero emojis, sin saludos ni despedidas, mantén una redacción concisa, directa y rigurosa en tercera persona.`;

  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 350,
          },
        }),
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text && text.length > 50) {
          return text.replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
        }
      }
    } catch (err) {
      console.warn(`Error llamando a Gemini (${model}) para reporte GPR:`, err);
    }
  }

  // Fallback si la API no respondió oportunamente
  return buildDeterministicSummary(project, report);
}
