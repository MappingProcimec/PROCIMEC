import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
  Footer,
  PageNumber,
} from 'docx';
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

export function buildReplacementMap(letterType: HrLetterType, data: HrLetterData): Record<string, string> {
  return {
    CARTA_FECHA: data.carta_fecha || new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
    CARTA_RADICADO: data.carta_radicado || 'PRC-RH-2026-0001',
    FIRMA_TEL: data.firma_tel || '300 530 6039',
    EMPRESA_EMAIL: data.empresa_email || 'ghumana@procimecingenieria.com',

    DEST_NOMBRE: data.dest_nombre || 'A QUIEN INTERESE',
    DEST_CARGO: data.dest_cargo || 'Dirección de Gestión Humana',
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
}

/**
 * Genera el documento Word (.docx) 100% nativo y compatible con Microsoft Word
 */
export async function generateHrLetterDocx(
  letterType: HrLetterType,
  data: HrLetterData
): Promise<{ docxBuffer: Buffer; renderedText: string }> {
  const meta = HR_LETTER_TYPES[letterType];
  if (!meta) {
    throw new Error(`Tipo de carta desconocido: ${letterType}`);
  }

  const r = buildReplacementMap(letterType, data);
  const paragraphsText: string[] = [];

  const children: any[] = [];

  // 1. Membrete Corporativo Superior
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'PROCIMEC INGENIERÍA SAS',
          bold: true,
          size: 24, // 12pt
          color: '1E2229',
          font: 'Calibri',
        }),
      ],
      alignment: AlignmentType.RIGHT,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'NIT: 802019658-9  |  Tel: 300 530 6039  |  ghumana@procimecingenieria.com',
          size: 18, // 9pt
          color: '64748B',
          font: 'Calibri',
        }),
      ],
      alignment: AlignmentType.RIGHT,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'Barranquilla - Bogotá D.C., Colombia',
          size: 18,
          color: '64748B',
          font: 'Calibri',
        }),
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 180 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 16, color: 'EAA023' },
      },
    })
  );

  // 2. Ciudad, Fecha y Radicado
  const ciudad = letterType === '01_certificacion_laboral' ? 'Bogotá D.C.' : 'Barranquilla';
  const fechaCompleta = `${ciudad}, ${r.CARTA_FECHA}`;
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: fechaCompleta, size: 20, font: 'Calibri' }),
      ],
      spacing: { before: 240, after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Radicado No. ${r.CARTA_RADICADO}`, bold: true, size: 20, font: 'Calibri' }),
      ],
      spacing: { after: 180 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Asunto: ${meta.title}`, bold: true, size: 22, color: '1E2229', font: 'Calibri' }),
      ],
      spacing: { after: 200 },
    })
  );

  // 3. Destinatario o Colaborador
  const hasExternalDest = ['01_certificacion_laboral', '02_presentacion_personal_obra', '07_solicitud_entidad_externa'].includes(letterType);
  const isInternalPersonal = ['03_vinculacion_a_proyecto', '04_terminacion_contrato', '06_permiso_laboral'].includes(letterType);

  if (hasExternalDest) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Señor(a):  ', bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: r.DEST_NOMBRE, size: 20, font: 'Calibri' }),
        ],
        spacing: { after: 60 },
      })
    );
    if (r.DEST_CARGO && r.DEST_CARGO !== 'N/A') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Cargo:  ', bold: true, size: 20, font: 'Calibri' }),
            new TextRun({ text: r.DEST_CARGO, size: 20, font: 'Calibri' }),
          ],
          spacing: { after: 60 },
        })
      );
    }
    if (r.DEST_EMPRESA && r.DEST_EMPRESA !== 'N/A') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Empresa / Entidad:  ', bold: true, size: 20, font: 'Calibri' }),
            new TextRun({ text: r.DEST_EMPRESA, size: 20, font: 'Calibri' }),
          ],
          spacing: { after: 60 },
        })
      );
    }
    if (r.DEST_CIUDAD) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Ciudad:  ', bold: true, size: 20, font: 'Calibri' }),
            new TextRun({ text: r.DEST_CIUDAD, size: 20, font: 'Calibri' }),
          ],
          spacing: { after: 180 },
        })
      );
    }
  } else if (isInternalPersonal) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Colaborador(a):  ', bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: `${r.EMP_NOMBRE} (C.C. ${r.EMP_DOCUMENTO})`, size: 20, font: 'Calibri' }),
        ],
        spacing: { after: 60 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Cargo:  ', bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: r.CARGO_NOMBRE, size: 20, font: 'Calibri' }),
        ],
        spacing: { after: 180 },
      })
    );
  }

  // 4. Saludo / Encabezado Central
  if (letterType === '01_certificacion_laboral') {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'CERTIFICA QUE:', bold: true, size: 24, color: '1E2229', font: 'Calibri' }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 180, after: 180 },
      })
    );
    paragraphsText.push('CERTIFICA QUE:');
  } else if (letterType === '05_paz_y_salvo') {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'PAZ Y SALVO LABORAL', bold: true, size: 24, color: '1E2229', font: 'Calibri' }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 180, after: 180 },
      })
    );
    paragraphsText.push('PAZ Y SALVO LABORAL');
  } else {
    const greeting = hasExternalDest ? 'Respetado(a) señor(a):' : 'Estimado(a) colaborador(a):';
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: greeting, bold: true, size: 20, font: 'Calibri' }),
        ],
        spacing: { after: 140 },
      })
    );
    paragraphsText.push(greeting);
  }

  const addBodyParagraph = (text: string) => {
    children.push(
      new Paragraph({
        children: [new TextRun({ text, size: 20, font: 'Calibri' })],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 140, line: 276 },
      })
    );
    paragraphsText.push(text);
  };

  // 5. Contenido Específico según la carta
  if (letterType === '01_certificacion_laboral') {
    addBodyParagraph(
      `La empresa PROCIMEC INGENIERÍA SAS, identificada con NIT 802019658-9, CERTIFICA que el(la) señor(a) ${r.EMP_NOMBRE}, identificado(a) con ${r.EMP_TIPO_DOC} No. ${r.EMP_DOCUMENTO} de ${r.EMP_CIUDAD_EXP}, labora en nuestra empresa en calidad de ${r.CARGO_NOMBRE} bajo contrato de trabajo de tipo ${r.CARGO_TIPO_CONTRATO} desde el ${r.CARGO_FECHA_INICIO} hasta la fecha de expedición del presente documento.`
    );
    addBodyParagraph(
      `Durante su vinculación ha devengado un salario mensual de ${r.CARGO_SALARIO} m/cte (${r.CARGO_SALARIO_LETRAS} pesos moneda corriente), más las prestaciones sociales de ley.`
    );
    addBodyParagraph(
      `La presente certificación se expide a solicitud del(la) interesado(a) para ser presentada ante ${r.CERT_DESTINO}.`
    );
    addBodyParagraph(
      `La presente se expide en Bogotá D.C., a los ${r.CARTA_FECHA}.`
    );
  } else if (letterType === '02_presentacion_personal_obra') {
    addBodyParagraph(
      `Por medio de la presente, PROCIMEC INGENIERÍA SAS se permite presentar al(la) señor(a) ${r.EMP_NOMBRE}, identificado(a) con C.C. No. ${r.EMP_DOCUMENTO} de ${r.EMP_CIUDAD_EXP}, quien se desempeñará como ${r.CARGO_NOMBRE} en el proyecto ${r.PROY_NOMBRE} ubicado en ${r.PROY_DIRECCION}.`
    );
    addBodyParagraph(
      `Su vinculación al proyecto será efectiva desde el ${r.CARGO_FECHA_INICIO} hasta el ${r.CARGO_FECHA_FIN}, o hasta la finalización de la etapa ${r.PROY_ETAPA} del proyecto.`
    );
    addBodyParagraph(
      `El(La) señor(a) ${r.EMP_APELLIDOS} cuenta con afiliaciones vigentes al Sistema de Seguridad Social: EPS ${r.EMP_EPS}, Pensión ${r.EMP_PENSION}, ARL ${r.EMP_ARL}.`
    );
    addBodyParagraph(
      `Agradecemos brindarle las facilidades para el cumplimiento de sus funciones.`
    );
  } else if (letterType === '03_vinculacion_a_proyecto') {
    addBodyParagraph(
      `Por medio de la presente, PROCIMEC INGENIERÍA SAS le informa que ha sido asignado(a) al proyecto ${r.PROY_NOMBRE}, contrato No. ${r.PROY_CONTRATO}, localizado en ${r.PROY_DIRECCION}.`
    );
    addBodyParagraph(
      `Su vinculación iniciará el día ${r.CARGO_FECHA_INICIO} y tendrá una duración de ${r.PROY_DURACION}, prorrogable según el avance de obra.`
    );
    addBodyParagraph(
      `Durante el proyecto reportará directamente al(la) ${r.PROY_JEFE_CARGO} señor(a) ${r.PROY_JEFE_NOMBRE}. Las condiciones salariales y prestacionales pactadas en su contrato no sufrirán modificación alguna por esta asignación.`
    );
    addBodyParagraph(
      `Deberá presentarse en la obra el ${r.CARGO_FECHA_INICIO} a las ${r.CARGO_HORA_INICIO} horas, con los Elementos de Protección Personal (EPP) requeridos.`
    );
  } else if (letterType === '04_terminacion_contrato') {
    addBodyParagraph(
      `Por medio de la presente, PROCIMEC INGENIERÍA SAS le comunica que ha tomado la decisión de dar por terminado su contrato de trabajo de manera ${r.TERM_TIPO}, a partir del día ${r.TERM_FECHA}.`
    );
    addBodyParagraph(`Causa(s) que motivan la terminación:\n${r.TERM_CAUSAS}`);
    addBodyParagraph(
      `De conformidad con el Código Sustantivo del Trabajo, la empresa ${r.TERM_INDEM_TEXTO}. Al momento de la desvinculación se liquidarán y pagarán la totalidad de los conceptos legales adeudados: salarios, cesantías, intereses, vacaciones y prima de servicios.`
    );
    addBodyParagraph(
      `Le solicitamos realizar la entrega formal del cargo, bienes y documentos a más tardar el ${r.TERM_FECHA_ENTREGA}.`
    );
  } else if (letterType === '05_paz_y_salvo') {
    addBodyParagraph(
      `PROCIMEC INGENIERÍA SAS HACE CONSTAR que el(la) señor(a) ${r.EMP_NOMBRE}, C.C. No. ${r.EMP_DOCUMENTO}, quien se desempeñó como ${r.CARGO_NOMBRE} desde el ${r.CARGO_FECHA_INICIO} hasta el ${r.CARGO_FECHA_FIN}, se encuentra a PAZ Y SALVO con la empresa en los siguientes conceptos:`
    );

    // Tabla formateada en Word para Paz y Salvo
    const tableRows = [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'CONCEPTO', bold: true, color: 'FFFFFF', size: 18 })] })],
            shading: { fill: '1E2229' },
            width: { size: 70, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'ESTADO', bold: true, color: 'FFFFFF', size: 18 })], alignment: AlignmentType.CENTER })],
            shading: { fill: '1E2229' },
            width: { size: 30, type: WidthType.PERCENTAGE },
          }),
        ],
      }),
      ...[
        ['Dotación y elementos de trabajo', r.PSV_ITEM_1],
        ['Elementos de Protección Personal (EPP)', r.PSV_ITEM_2],
        ['Equipos, herramientas y/o maquinaria', r.PSV_ITEM_3],
        ['Llaves, accesos y tarjetas de ingreso', r.PSV_ITEM_4],
        ['Documentos, planos y archivos', r.PSV_ITEM_5],
        ['Saldos de anticipos o caja menor', r.PSV_ITEM_6],
        ['Carnet corporativo y credenciales', r.PSV_ITEM_7],
      ].map(([concepto, estado]) =>
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: concepto, size: 18, font: 'Calibri' })] })],
              width: { size: 70, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: estado, bold: true, color: '15803D', size: 18, font: 'Calibri' })], alignment: AlignmentType.CENTER })],
              width: { size: 30, type: WidthType.PERCENTAGE },
            }),
          ],
        })
      ),
    ];

    children.push(
      new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    );

    addBodyParagraph(
      `La empresa se encuentra igualmente a paz y salvo con el(la) trabajador(a) en cuanto al pago de salarios, prestaciones sociales, vacaciones e indemnizaciones.`
    );
    addBodyParagraph(`Observaciones: ${r.PSV_OBSERVACIONES}`);
  } else if (letterType === '06_permiso_laboral') {
    addBodyParagraph(
      `En respuesta a su solicitud de permiso laboral radicada el ${r.PERM_FECHA_SOLICITUD}, PROCIMEC INGENIERÍA SAS le ${r.PERM_DECISION} el permiso bajo las siguientes condiciones:`
    );
    addBodyParagraph(
      `• Tipo de permiso: ${r.PERM_TIPO}\n` +
      `• Motivo: ${r.PERM_MOTIVO}\n` +
      `• Fecha inicio: ${r.PERM_FECHA_INICIO} | Fecha fin: ${r.PERM_FECHA_FIN}\n` +
      `• Horario: De ${r.PERM_HORA_INICIO} a ${r.PERM_HORA_FIN} horas (Total: ${r.PERM_TOTAL})\n` +
      `• Condiciones: ${r.PERM_COMPENSACION}.`
    );
    addBodyParagraph(
      `Le recordamos dejar cubierto su puesto de trabajo antes de ausentarse. En caso de permiso por incapacidad, deberá anexar el soporte médico a su regreso.`
    );
  } else if (letterType === '07_solicitud_entidad_externa') {
    addBodyParagraph(`PROCIMEC INGENIERÍA SAS se dirige a usted con el fin de ${r.SOL_OBJETO}.`);
    addBodyParagraph(`Referencia: ${r.SOL_REFERENCIA}`);
    addBodyParagraph(
      `Adjuntamos a la presente los siguientes documentos:\n1. RUT actualizado de la empresa\n2. Cámara de Comercio vigente\n3. Estados financieros (último período)\n4. Certificado de existencia y representación legal\n5. ${r.SOL_DOC_ADICIONAL}`
    );
    addBodyParagraph(
      `El representante legal es el(la) señor(a) Alberto Mario Florez Castro, C.C. No. 72000000, con plenas facultades para suscribir el presente documento.`
    );
    addBodyParagraph(
      `Agradecemos la atención a nuestra solicitud. Puede contactarnos al ${r.FIRMA_TEL} o al correo ${r.EMPRESA_EMAIL}. Nota: ${r.SOL_NOTA}`
    );
  }

  // 6. Firmas Institucionales
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Cordialmente,', size: 20, font: 'Calibri' })],
      spacing: { before: 240, after: 180 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Alberto Mario Florez Castro', bold: true, size: 20, font: 'Calibri' })],
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Representante Legal', size: 18, color: '64748B', font: 'Calibri' })],
      spacing: { after: 20 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'PROCIMEC INGENIERÍA SAS', size: 18, color: '64748B', font: 'Calibri' })],
      spacing: { after: 20 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'C.C. No. 72.000.000 de Barranquilla', size: 18, color: '64748B', font: 'Calibri' })],
      spacing: { after: 20 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Cel. ${r.FIRMA_TEL}`, size: 18, color: '64748B', font: 'Calibri' })],
      spacing: { after: 180 },
    })
  );

  // Segunda firma si es recibí conforme o vinculación
  if (['03_vinculacion_a_proyecto', '04_terminacion_contrato', '05_paz_y_salvo'].includes(letterType)) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Acepto las condiciones / Recibí conforme:', bold: true, size: 18, color: '1E2229', font: 'Calibri' }),
        ],
        spacing: { before: 180, after: 60 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `${r.EMP_NOMBRE}  –  C.C. ${r.EMP_DOCUMENTO}`, size: 18, font: 'Calibri' }),
        ],
        spacing: { after: 40 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Fecha de aceptación: ${r.CARTA_FECHA}`, size: 18, color: '64748B', font: 'Calibri' }),
        ],
        spacing: { after: 120 },
      })
    );
  }

  // Cc
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Cc: Archivo laboral – Departamento de Gestión Humana', size: 16, color: '94A3B8', font: 'Calibri' }),
      ],
      spacing: { before: 180 },
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `DOC-ID: ${r.CARTA_RADICADO} | PROCIMEC INGENIERÍA SAS | Página `,
                    size: 16,
                    color: '94A3B8',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: '94A3B8',
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
      },
    ],
  });

  const docxBuffer = await Packer.toBuffer(doc);
  const renderedText = [
    fechaCompleta,
    `Radicado No. ${r.CARTA_RADICADO}`,
    `Asunto: ${meta.title}`,
    hasExternalDest ? `Señor(a): ${r.DEST_NOMBRE}\nCargo: ${r.DEST_CARGO}\nEmpresa: ${r.DEST_EMPRESA}\nCiudad: ${r.DEST_CIUDAD}` : `Colaborador(a): ${r.EMP_NOMBRE} (C.C. ${r.EMP_DOCUMENTO})\nCargo: ${r.CARGO_NOMBRE}`,
    ...paragraphsText,
    'Cordialmente,\nAlberto Mario Florez Castro\nRepresentante Legal\nPROCIMEC INGENIERÍA SAS\nC.C. No. 72000000\nCel. ' + r.FIRMA_TEL,
  ].join('\n\n');

  return { docxBuffer, renderedText };
}
