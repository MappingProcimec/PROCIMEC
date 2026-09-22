export interface ProjectContext {
  id?: string;
  name: string;
  client: string;
  code?: string;
  location?: string;
  cost_center?: string;
  description?: string;
  contract_number?: string;
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
    id?: string;
    sector?: string;
    axis?: string;
    start_abs?: string;
    end_abs?: string;
    road_side?: string;
    ml?: number | '';
    m2?: number | '';
    max_depth_m?: number | '';
    surface_type?: string;
    observations?: string;
  }>;
  global_max_depth?: number | string | null;
  detected_utilities?: Array<{
    id?: string;
    type?: string;
    utility_type?: string;
    diameter?: string;
    material?: string;
    estimated_depth_m?: number | string | '';
    confidence?: string;
    description?: string;
    notes?: string;
  }>;
  anomalies_notes?: string | null;
  site_restrictions?: string | null;
  cad_priority?: string | null;
  processing_recommendations?: string | null;
}

/**
 * Parsea y limpia de forma elegante la descripción del proyecto,
 * extrayendo metadatos como metas en ML y M2 y generando una redacción
 * técnica impecable en prosa natural (sin etiquetas HTML, comentarios ni JSON).
 */
export function parseProjectDescriptionAndTargets(rawDescription?: string | null): {
  cleanDescription: string;
  targetMl?: number;
  targetM2?: number;
  formattedTargetText: string;
  scopeProse: string;
} {
  if (!rawDescription) {
    return { cleanDescription: '', formattedTargetText: '', scopeProse: '' };
  }

  const raw = String(rawDescription);
  // Eliminar cualquier residuo de etiquetas de metas en comentarios HTML
  const clean = raw.replace(/\n?<!--PROJECT_TARGETS:\{.*?\}-->/g, '').trim();

  let targetMl: number | undefined;
  let targetM2: number | undefined;

  const match = raw.match(/<!--PROJECT_TARGETS:(\{.*?\})-->/);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.target_ml) targetMl = Number(parsed.target_ml);
      if (parsed.target_m2) targetM2 = Number(parsed.target_m2);
    } catch {}
  }

  let formattedTargetText = '';
  if (targetMl && targetM2) {
    formattedTargetText = `con una meta contractual programada de ${targetMl.toLocaleString('es-CO')} ML y ${targetM2.toLocaleString('es-CO')} m² de área de exploración subsuperficial`;
  } else if (targetMl) {
    formattedTargetText = `con una meta contractual programada de ${targetMl.toLocaleString('es-CO')} ML`;
  } else if (targetM2) {
    formattedTargetText = `con una meta de ${targetM2.toLocaleString('es-CO')} m² de área de exploración subsuperficial`;
  }

  // Redacción fluida en prosa formal de ingeniería para integrar en la síntesis
  let scopeProse = '';
  if (clean && formattedTargetText) {
    const descPrefix = clean.toLowerCase().startsWith('proyecto') ? clean : `proyecto "${clean}"`;
    scopeProse = `, en el marco del ${descPrefix} (${formattedTargetText})`;
  } else if (clean) {
    const descPrefix = clean.toLowerCase().startsWith('proyecto') ? clean : `proyecto "${clean}"`;
    scopeProse = `, en el marco del ${descPrefix}`;
  } else if (formattedTargetText) {
    scopeProse = `, ${formattedTargetText}`;
  }

  return {
    cleanDescription: clean,
    targetMl,
    targetM2,
    formattedTargetText,
    scopeProse,
  };
}

/**
 * Formatea un diámetro asegurando símbolo y unidades estándar (ej: "3" -> "Ø 3\"")
 */
export function formatDiameter(rawDiameter?: string | null): string {
  if (!rawDiameter || !rawDiameter.trim()) return '';
  const d = rawDiameter.trim();
  if (/^\d+(\.\d+)?$/.test(d)) {
    return `Ø ${d}"`;
  }
  if (!d.startsWith('Ø') && !d.toLowerCase().includes('mm') && !d.includes('"')) {
    return `Ø ${d}"`;
  }
  return d;
}

/**
 * Generador determinista de respaldo cuando la API de Gemini no está disponible o no responde.
 * Garantiza un informe técnico ejecutivo impecable siempre considerando el proyecto, cliente,
 * área de exploración, redes específicas con diámetro y descripción del proyecto en prosa natural.
 */
function buildDeterministicSummary(project: ProjectContext, report: GprReportContext): string {
  const totalMl = (report.operational_summary || []).reduce((acc, row) => acc + (Number(row.ml) || 0), 0);
  const totalM2 = (report.operational_summary || []).reduce((acc, row) => acc + (Number(row.m2) || 0), 0);

  const { scopeProse } = parseProjectDescriptionAndTargets(project.description);

  const utilities = report.detected_utilities || [];
  const utilitiesDetails = utilities
    .filter(u => (u.type || u.utility_type) && (u.type || u.utility_type) !== 'Sin identificar')
    .map(u => {
      const type = u.type || u.utility_type || 'Servicio';
      const formattedDiam = formatDiameter(u.diameter);
      const diam = formattedDiam ? ` de ${formattedDiam}` : '';
      const prof = u.estimated_depth_m ? ` a ${Number(u.estimated_depth_m).toFixed(2)} m de profundidad` : '';
      const conf = u.confidence ? ` (Confianza ${u.confidence})` : '';
      const desc = (u.description || u.notes) ? ` - ${u.description || u.notes}` : '';
      return `${type}${diam}${prof}${conf}${desc}`;
    });

  const projectIdent = project.name ? `${project.name} (${project.client || 'Cliente'})` : 'el proyecto asignado';
  const locationText = project.location ? ` en la localización ${project.location}` : '';

  let summary = `Durante la jornada operativa del ${report.report_date} en ${projectIdent}${locationText}${scopeProse}, la cuadrilla de georadar liderada por ${report.localizador_name} ejecutó el barrido geofísico subsuperficial empleando ${report.gpr_equipment || 'sistema GPR'}. `;

  if (totalMl > 0) {
    summary += `Se consolidó un avance volumétrico de ${totalMl.toFixed(1)} metros lineales (ML) correspondientes a ${totalM2.toFixed(1)} m² de área de exploración subsuperficial, alcanzando una profundidad de investigación de hasta ${report.global_max_depth ? Number(report.global_max_depth).toFixed(2) : '1.50'} m bajo condiciones de terreno catalogadas como ${report.terrain_conditions || 'estándar'}${report.weather_conditions ? ` y clima ${report.weather_conditions}` : ''}. `;
  } else {
    summary += `Se llevaron a cabo verificaciones electromagnéticas y de georadar bajo condiciones de terreno ${report.terrain_conditions || 'estándar'}. `;
  }

  if (utilitiesDetails.length > 0) {
    summary += `En el subsuelo se identificaron y georreferenciaron ${utilitiesDetails.length} alineamiento(s) de servicios públicos subterráneos: ${utilitiesDetails.join('; ')}. `;
  } else if (utilities.length > 0) {
    summary += `Se registraron ${utilities.length} alineamiento(s) de servicios e interferencias en el subsuelo conforme al levantamiento en campo. `;
  } else {
    summary += `No se evidenciaron interferencias anómalas críticas que comprometan la traza evaluada. `;
  }

  if (report.anomalies_notes && report.anomalies_notes.trim().length > 0) {
    summary += `Observaciones de campo: ${report.anomalies_notes.trim()}. `;
  }

  if (report.cad_priority) {
    summary += `El registro se clasifica con prioridad CAD/BIM ${report.cad_priority.toUpperCase()}`;
    if (report.processing_recommendations) {
      summary += `, recomendándose para procesamiento en gabinete: ${report.processing_recommendations.trim()}.`;
    } else {
      summary += ` para su oportuna incorporación en los planos técnicos oficiales.`;
    }
  }

  return summary.trim();
}

/**
 * Consulta a Google Gemini para sintetizar un párrafo técnico ejecutivo del día,
 * siempre tomando en cuenta el proyecto, cliente, descripción limpia, metas en prosa natural,
 * área de exploración y los servicios públicos detectados con su diámetro y características.
 */
export async function generateGprExecutiveSummary(
  project: ProjectContext,
  report: GprReportContext
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return buildDeterministicSummary(project, report);
  }

  const { cleanDescription, targetMl, formattedTargetText } = parseProjectDescriptionAndTargets(project.description);

  const totalMl = (report.operational_summary || []).reduce((acc, row) => acc + (Number(row.ml) || 0), 0);
  const totalM2 = (report.operational_summary || []).reduce((acc, row) => acc + (Number(row.m2) || 0), 0);

  const formattedUtilities = (report.detected_utilities || []).map((u, i) => {
    const type = u.type || u.utility_type || 'Servicio';
    const formattedDiam = formatDiameter(u.diameter);
    const diam = formattedDiam ? `Diámetro: ${formattedDiam}` : 'Diámetro: No especificado';
    const prof = u.estimated_depth_m ? `Profundidad: ${u.estimated_depth_m}m` : 'Profundidad: No especificada';
    const conf = u.confidence ? `Confianza: ${u.confidence}` : '';
    const desc = (u.description || u.notes) ? `Notas: ${u.description || u.notes}` : '';
    return `[Hallazgo ${i + 1}] ${type} | ${diam} | ${prof} | ${conf} | ${desc}`.trim();
  }).join('\n');

  const prompt = `Actúa como Ingeniero Geofísico Senior y Director de Operaciones en PROCIMEC Mapping e Ingeniería S.A.S.
Genera una síntesis técnica ejecutiva, concisa y de alto nivel formal (entre 80 y 140 palabras en un solo párrafo sólido en español técnico de ingeniería) para el Reporte Diario de Operación de Georadar (GPR).
Este reporte será entregado a la interventoría y a la supervisión del cliente.

INFORMACIÓN DEL PROYECTO:
- Nombre del Proyecto: ${project.name}
- Cliente: ${project.client}
- Código / Centro de Costos: ${project.code || project.cost_center || 'N/A'}
- Ubicación / Ciudad / Tramo: ${project.location || 'Localización no especificada'}
- Descripción / Objeto del Proyecto: ${cleanDescription || 'Exploración y detección de interferencias subterráneas'}
- Metas Contractuales Globales: ${formattedTargetText || (targetMl ? `Meta de ${targetMl} ML` : 'Sin meta definida')}

INFORMACIÓN OPERATIVA DE CAMPO:
- Fecha de la jornada: ${report.report_date} ${report.report_time ? `(${report.report_time})` : ''}
- Localizador / Responsable: ${report.localizador_name}
- Equipo empleado: ${report.gpr_equipment || 'Georadar GPR'} (Frecuencia: ${report.antenna_frequency || 'No especificada'})
- Posicionamiento: ${report.positioning_equipment || 'GPS GNSS'} | Método: ${report.capture_method || 'Perfil continuo'}
- Condiciones de terreno: ${report.terrain_conditions || 'Normal'} | Clima: ${report.weather_conditions || 'Despejado'}
- Profundidad máxima explorada: ${report.global_max_depth || '1.50'} metros
- Volumetría registrada hoy: ${totalMl.toFixed(1)} metros lineales (ML) correspondientes a ${totalM2.toFixed(1)} m² de área de exploración subsuperficial en ${(report.operational_summary || []).length} sector(es)
- Redes y Servicios Públicos Detectados:
${formattedUtilities || 'Sin servicios subterráneos reportados en la jornada'}
- Observaciones y anomalías: ${report.anomalies_notes || 'Sin anomalías registradas'}
- Restricciones en sitio: ${report.site_restrictions || 'Sin restricciones'}
- Prioridad CAD/BIM: ${report.cad_priority || 'Media'}
- Recomendaciones de procesamiento: ${report.processing_recommendations || 'Tratamiento estándar en gabinete'}

REGLAS DE REDACCIÓN OBLIGATORIAS:
1. Menciona obligatoriamente el nombre del proyecto (${project.name}), el cliente (${project.client}), la ubicación (${project.location || 'sitio'}) y la descripción limpia del proyecto en prosa natural (ej: "en el marco del proyecto de apoyo...").
2. Si existen metas globales (${formattedTargetText}), intégralas de manera fluida y elegante en la redacción (ej: "...con una meta global de ${targetMl || 'X'} ML...").
3. NUNCA incluyas etiquetas técnicas como <!--PROJECT_TARGETS:...--> ni código JSON en el texto final.
4. IMPORTANTE: Cuando menciones la volumetría (${totalM2.toFixed(1)} m²), aclara expresamente que corresponden a "área de exploración subsuperficial".
5. IMPORTANTE: Menciona explícitamente a qué servicios públicos específicos se refiere el levantamiento (ej: Telecomunicaciones, Tubería Agua, Gas, etc.) indicando su diámetro y profundidad estimada.
6. Cero emojis, sin saludos ni despedidas, mantén una redacción concisa, rigurosa y asertiva en tercera persona.`;

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
            temperature: 0.2,
            maxOutputTokens: 350,
          },
        }),
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text && text.length > 50) {
          // Limpiar por seguridad cualquier residuo de comentarios HTML o JSON
          return text
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/\{"target_ml":[\s\S]*?\}/g, '')
            .replace(/\r?\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
      }
    } catch (err) {
      console.warn(`Error llamando a Gemini (${model}) para reporte GPR:`, err);
    }
  }

  // Fallback si la API no respondió oportunamente
  return buildDeterministicSummary(project, report);
}
