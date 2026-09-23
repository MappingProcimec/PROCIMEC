import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { HrLetterType, HrLetterData } from '@/types';

export interface LetterTypeMeta {
  id: HrLetterType;
  title: string;
  templateFile: string;
  description: string;
  badge: string;
}

export const HR_LETTER_TYPES: Record<HrLetterType, LetterTypeMeta> = {
  '01_certificacion_laboral': {
    id: '01_certificacion_laboral',
    title: 'Certificación Laboral',
    templateFile: '01_Certificacion_Laboral.docx',
    description: 'Acreditación formal de vínculo laboral, cargo, salario devengado, antigüedad y tipo de contrato.',
    badge: 'Laboral / Nómina',
  },
  '02_presentacion_personal_obra': {
    id: '02_presentacion_personal_obra',
    title: 'Presentación de Personal en Obra',
    templateFile: '02_Presentacion_Personal_Obra.docx',
    description: 'Presentación formal de colaboradores ante clientes o interventoría con afiliaciones SST (EPS, ARL, AFP).',
    badge: 'Operación / Campo',
  },
  '03_vinculacion_a_proyecto': {
    id: '03_vinculacion_a_proyecto',
    title: 'Vinculación a Proyecto / Obra',
    templateFile: '03_Vinculacion_a_Proyecto.docx',
    description: 'Asignación oficial a frente de trabajo, condiciones del contrato, jefe inmediato y entrega de EPP.',
    badge: 'Proyectos / Operaciones',
  },
  '04_terminacion_contrato': {
    id: '04_terminacion_contrato',
    title: 'Terminación de Contrato de Trabajo',
    templateFile: '04_Terminacion_Contrato.docx',
    description: 'Comunicación de desvinculación laboral, causas legales, liquidación de prestaciones y entrega de cargo.',
    badge: 'Jurídico / RRHH',
  },
  '05_paz_y_salvo': {
    id: '05_paz_y_salvo',
    title: 'Paz y Salvo Laboral',
    templateFile: '05_Paz_y_Salvo.docx',
    description: 'Constancia de entrega de dotación, EPP, equipos técnicos, herramientas, caja menor y carnet.',
    badge: 'Liquidación / RRHH',
  },
  '06_permiso_laboral': {
    id: '06_permiso_laboral',
    title: 'Permiso Laboral',
    templateFile: '06_Permiso_Laboral.docx',
    description: 'Autorización y registro de ausencias laborales, citas médicas, calamidad o licencias temporales.',
    badge: 'Gestión / Personal',
  },
  '07_solicitud_entidad_externa': {
    id: '07_solicitud_entidad_externa',
    title: 'Solicitud a Entidad Externa',
    templateFile: '07_Solicitud_Entidad_Externa.docx',
    description: 'Oficio formal corporativo dirigido a entidades públicas, clientes o proveedores con representación legal.',
    badge: 'Corporativo / Externo',
  },
};

/**
 * Escapa caracteres especiales XML para no corromper el documento Word
 */
function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Mapea los valores del formulario a los marcadores canónicos {{KEY}} de cada plantilla
 */
export function buildReplacementMap(letterType: HrLetterType, data: HrLetterData): Record<string, string> {
  const map: Record<string, string> = {
    CARTA_FECHA: data.carta_fecha || new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
    CARTA_RADICADO: data.carta_radicado || 'PRC-RH-PENDIENTE',
    FIRMA_TEL: data.firma_tel || '300 530 6039',
    EMPRESA_EMAIL: data.empresa_email || 'ghumana@procimecingenieria.com',

    DEST_NOMBRE: data.dest_nombre || 'A QUIEN INTERESE',
    DEST_CARGO: data.dest_cargo || 'Gestión Humana / Dirección',
    DEST_EMPRESA: data.dest_empresa || 'Entidad Solicitante',
    DEST_CIUDAD: data.dest_ciudad || 'Barranquilla / Bogotá D.C.',

    EMP_NOMBRE: data.emp_nombre || '',
    EMP_APELLIDOS: data.emp_apellidos || (data.emp_nombre ? data.emp_nombre.split(' ').slice(1).join(' ') : ''),
    EMP_TIPO_DOC: data.emp_tipo_doc || 'C.C.',
    EMP_DOCUMENTO: data.emp_documento || '',
    EMP_CIUDAD_EXP: data.emp_ciudad_exp || 'Colombia',
    EMP_EPS: data.emp_eps || 'EPS Vigente',
    EMP_PENSION: data.emp_pension || 'Fondo de Pensiones Vigente',
    EMP_ARL: data.emp_arl || 'Seguros Bolívar / Sura (Riesgo V)',

    CARGO_NOMBRE: data.cargo_nombre || 'Localizador Técnico de Utilidades',
    CARGO_TIPO_CONTRATO: data.cargo_tipo_contrato || 'Término Fijo',
    CARGO_FECHA_INICIO: data.cargo_fecha_inicio || data.carta_fecha,
    CARGO_FECHA_FIN: data.cargo_fecha_fin || 'la finalización de las labores contratadas',
    CARGO_HORA_INICIO: data.cargo_hora_inicio || '07:00',
    CARGO_SALARIO: data.cargo_salario || '$ 0.00',
    CARGO_SALARIO_LETRAS: data.cargo_salario_letras || 'Cero',
    CERT_DESTINO: data.cert_destino || 'fines personales y laborales pertinentes',

    PROY_NOMBRE: data.proy_nombre || 'Proyecto PROCIMEC',
    PROY_DIRECCION: data.proy_direccion || 'Zona de Influencia del Proyecto',
    PROY_ETAPA: data.proy_etapa || 'Fase de Exploración GPR',
    PROY_CONTRATO: data.proy_contrato || 'PRC-OP-01',
    PROY_DURACION: data.proy_duracion || 'el tiempo estipulado en la orden de servicio',
    PROY_JEFE_CARGO: data.proy_jefe_cargo || 'Director de Proyectos',
    PROY_JEFE_NOMBRE: data.proy_jefe_nombre || 'Ing. Responsable de Obra',
    CARTA_FECHA_ACEPTA: data.carta_fecha_acepta || data.carta_fecha,

    TERM_TIPO: data.term_tipo || 'con justa causa',
    TERM_FECHA: data.term_fecha || data.carta_fecha,
    TERM_CAUSAS: data.term_causas || 'Finalización del objeto contractual y cronograma operativo.',
    TERM_INDEM_TEXTO: data.term_indem_texto || 'liquidará y pagará la totalidad de salarios y prestaciones de ley',
    TERM_FECHA_ENTREGA: data.term_fecha_entrega || data.carta_fecha,

    PSV_ITEM_1: data.psv_item_1 || 'PAZ Y SALVO',
    PSV_ITEM_2: data.psv_item_2 || 'PAZ Y SALVO',
    PSV_ITEM_3: data.psv_item_3 || 'PAZ Y SALVO',
    PSV_ITEM_4: data.psv_item_4 || 'PAZ Y SALVO',
    PSV_ITEM_5: data.psv_item_5 || 'PAZ Y SALVO',
    PSV_ITEM_6: data.psv_item_6 || 'PAZ Y SALVO',
    PSV_ITEM_7: data.psv_item_7 || 'PAZ Y SALVO',
    PSV_OBSERVACIONES: data.psv_observaciones || 'Sin novedades pendientes a la fecha de corte.',

    PERM_FECHA_SOLICITUD: data.perm_fecha_solicitud || data.carta_fecha,
    PERM_DECISION: data.perm_decision || 'autoriza',
    PERM_TIPO: data.perm_tipo || 'Personal',
    PERM_MOTIVO: data.perm_motivo || 'Motivos personales justificados ante la jefatura inmediata.',
    PERM_FECHA_INICIO: data.perm_fecha_inicio || data.carta_fecha,
    PERM_FECHA_FIN: data.perm_fecha_fin || data.carta_fecha,
    PERM_HORA_INICIO: data.perm_hora_inicio || '08:00',
    PERM_HORA_FIN: data.perm_hora_fin || '17:00',
    PERM_TOTAL: data.perm_total || '1 jornada laboral',
    PERM_COMPENSACION: data.perm_compensacion || 'El permiso se concede bajo las condiciones laborales acordadas',

    SOL_OBJETO: data.sol_objeto || 'presentar documentación técnica y solicitud formal',
    SOL_REFERENCIA: data.sol_referencia || 'Gestión Operacional y Comercial PROCIMEC',
    SOL_DOC_ADICIONAL: data.sol_doc_adicional || 'Pólizas de cumplimiento y RSE',
    SOL_NOTA: data.sol_nota || 'Cualquier verificación adicional será atendida por nuestros canales oficiales.',
  };

  return map;
}

/**
 * Genera el documento Word (.docx) procesado con reemplazos completos
 */
export async function generateHrLetterDocx(
  letterType: HrLetterType,
  data: HrLetterData
): Promise<{ docxBuffer: Buffer; renderedText: string }> {
  const meta = HR_LETTER_TYPES[letterType];
  if (!meta) {
    throw new Error(`Tipo de carta desconocido: ${letterType}`);
  }

  // Rutas posibles de la plantilla
  const localTemplatePath = path.join(process.cwd(), 'public', 'templates', 'letters', meta.templateFile);
  if (!fs.existsSync(localTemplatePath)) {
    throw new Error(`Plantilla no encontrada en: ${localTemplatePath}`);
  }

  const templateBuffer = fs.readFileSync(localTemplatePath);
  const zip = await JSZip.loadAsync(templateBuffer);

  const replacements = buildReplacementMap(letterType, data);

  // 1. Reemplazar en word/document.xml
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) {
    throw new Error('El archivo word/document.xml no existe en la plantilla docx.');
  }

  let docXml = await docXmlFile.async('string');

  for (const [key, rawVal] of Object.entries(replacements)) {
    const escapedVal = escapeXml(rawVal);
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    docXml = docXml.replace(regex, escapedVal);
  }

  zip.file('word/document.xml', docXml);

  // 2. Extraer texto renderizado limpio para almacenamiento en BD y auditoría
  const renderedParagraphs: string[] = [];
  const pRegex = /<w:p(?: [^>]*)?>([\s\S]*?)<\/w:p>/g;
  let pMatch;
  while ((pMatch = pRegex.exec(docXml)) !== null) {
    const tRegex = /<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g;
    let tMatch;
    let pText = '';
    while ((tMatch = tRegex.exec(pMatch[1])) !== null) {
      pText += tMatch[1];
    }
    if (pText.trim()) {
      renderedParagraphs.push(pText.trim());
    }
  }
  const renderedText = renderedParagraphs.join('\n\n');

  // 3. Empaquetar y retornar buffer
  const outputBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  return {
    docxBuffer: outputBuffer,
    renderedText,
  };
}
