import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HrLetterType, HrLetterData } from '@/types';
import { HR_LETTER_TYPES, buildReplacementMap } from './docxTemplateEngine';
import { CORPORATE_LOGO_BASE64 } from '@/lib/gpr/logoBase64';

export async function generateHrLetterPdf(
  letterType: HrLetterType,
  data: HrLetterData
): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const meta = HR_LETTER_TYPES[letterType];
  const replacements = buildReplacementMap(letterType, data);

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 25;
  const contentWidth = pageWidth - marginX * 2; // 160mm
  let cursorY = 20;

  // ─── 1. Encabezado Corporativo ──────────────────────────────────────────────
  try {
    doc.addImage(CORPORATE_LOGO_BASE64, 'PNG', marginX, cursorY - 3, 42, 14);
  } catch (err) {
    console.warn('No se pudo incrustar el logo en el PDF:', err);
  }

  // Texto membrete derecho
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 34, 41); // #1E2229
  doc.text('PROCIMEC INGENIERÍA SAS', pageWidth - marginX, cursorY, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // #64748B
  doc.text('NIT: 802019658-9', pageWidth - marginX, cursorY + 4.5, { align: 'right' });
  doc.text('Tel: 300 530 6039  |  ghumana@procimecingenieria.com', pageWidth - marginX, cursorY + 8.5, { align: 'right' });
  doc.text('Barranquilla - Bogotá D.C., Colombia', pageWidth - marginX, cursorY + 12.5, { align: 'right' });

  cursorY += 18;

  // Línea divisoria técnica
  doc.setDrawColor(234, 160, 35); // #EAA023 (Ámbar Geofísico)
  doc.setLineWidth(0.8);
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY);

  doc.setDrawColor(30, 34, 41); // #1E2229
  doc.setLineWidth(0.2);
  doc.line(marginX, cursorY + 1.2, pageWidth - marginX, cursorY + 1.2);

  cursorY += 10;

  // ─── 2. Ciudad, Fecha y Radicado ─────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 34, 41);

  const ciudadPrefijo = letterType === '01_certificacion_laboral' ? 'Bogotá D.C., ' : 'Barranquilla, ';
  doc.text(`${ciudadPrefijo}${replacements.CARTA_FECHA}`, marginX, cursorY);

  // Radicado
  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 34, 41);
  doc.text(`Radicado No. ${replacements.CARTA_RADICADO}`, pageWidth - marginX, cursorY, { align: 'right' });

  cursorY += 9;

  // ─── 3. Asunto ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Asunto: ${meta.title}`, marginX, cursorY);
  cursorY += 8;

  // ─── 4. Bloque de Destinatario (si aplica) ───────────────────────────────────
  const hasExternalDest = ['01_certificacion_laboral', '02_presentacion_personal_obra', '07_solicitud_entidad_externa'].includes(letterType);
  const isInternalPersonal = ['03_vinculacion_a_proyecto', '04_terminacion_contrato', '06_permiso_laboral'].includes(letterType);

  if (hasExternalDest) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('Señor(a):', marginX, cursorY);
    doc.setFont('helvetica', 'normal');
    doc.text(replacements.DEST_NOMBRE, marginX + 18, cursorY);
    cursorY += 5;

    if (replacements.DEST_CARGO && replacements.DEST_CARGO !== 'N/A') {
      doc.setFont('helvetica', 'bold');
      doc.text('Cargo:', marginX, cursorY);
      doc.setFont('helvetica', 'normal');
      doc.text(replacements.DEST_CARGO, marginX + 18, cursorY);
      cursorY += 5;
    }

    if (replacements.DEST_EMPRESA && replacements.DEST_EMPRESA !== 'N/A') {
      doc.setFont('helvetica', 'bold');
      doc.text('Entidad:', marginX, cursorY);
      doc.setFont('helvetica', 'normal');
      doc.text(replacements.DEST_EMPRESA, marginX + 18, cursorY);
      cursorY += 5;
    }

    if (replacements.DEST_CIUDAD) {
      doc.setFont('helvetica', 'bold');
      doc.text('Ciudad:', marginX, cursorY);
      doc.setFont('helvetica', 'normal');
      doc.text(replacements.DEST_CIUDAD, marginX + 18, cursorY);
      cursorY += 5;
    }
    cursorY += 3;
  } else if (isInternalPersonal) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('Colaborador(a):', marginX, cursorY);
    doc.setFont('helvetica', 'normal');
    doc.text(`${replacements.EMP_NOMBRE} — C.C. ${replacements.EMP_DOCUMENTO}`, marginX + 28, cursorY);
    cursorY += 5;

    doc.setFont('helvetica', 'bold');
    doc.text('Cargo:', marginX, cursorY);
    doc.setFont('helvetica', 'normal');
    doc.text(replacements.CARGO_NOMBRE, marginX + 28, cursorY);
    cursorY += 7;
  }

  // ─── 5. Saludo / Encabezado Central ──────────────────────────────────────────
  if (letterType === '01_certificacion_laboral') {
    cursorY += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 34, 41);
    doc.text('CERTIFICA QUE:', pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 9;
  } else if (letterType === '05_paz_y_salvo') {
    cursorY += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 34, 41);
    doc.text('PAZ Y SALVO LABORAL', pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 9;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 34, 41);
    doc.text(hasExternalDest ? 'Respetado(a) señor(a):' : 'Estimado(a) colaborador(a):', marginX, cursorY);
    cursorY += 7;
  }

  // ─── 6. Cuerpo Dinámico de la Carta ──────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42); // #0F172A

  const printParagraph = (text: string, spacing = 5.5) => {
    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, marginX, cursorY);
    cursorY += lines.length * spacing + 3.5;
  };

  if (letterType === '01_certificacion_laboral') {
    printParagraph(
      `La empresa PROCIMEC INGENIERÍA SAS, identificada con NIT 802019658-9, CERTIFICA que el(la) señor(a) ${replacements.EMP_NOMBRE}, identificado(a) con ${replacements.EMP_TIPO_DOC} No. ${replacements.EMP_DOCUMENTO} de ${replacements.EMP_CIUDAD_EXP}, labora en nuestra empresa en calidad de ${replacements.CARGO_NOMBRE} bajo contrato de trabajo de tipo ${replacements.CARGO_TIPO_CONTRATO} desde el ${replacements.CARGO_FECHA_INICIO} hasta la fecha de expedición del presente documento.`
    );
    printParagraph(
      `Durante su vinculación ha devengado un salario mensual de ${replacements.CARGO_SALARIO} m/cte (${replacements.CARGO_SALARIO_LETRAS} pesos moneda corriente), más las prestaciones sociales de ley.`
    );
    printParagraph(
      `La presente certificación se expide a solicitud del(la) interesado(a) para ser presentada ante ${replacements.CERT_DESTINO}.`
    );
    printParagraph(
      `La presente se expide en Bogotá D.C., a los ${replacements.CARTA_FECHA}.`
    );
  } else if (letterType === '02_presentacion_personal_obra') {
    printParagraph(
      `Por medio de la presente, PROCIMEC INGENIERÍA SAS se permite presentar al(la) señor(a) ${replacements.EMP_NOMBRE}, identificado(a) con C.C. No. ${replacements.EMP_DOCUMENTO} de ${replacements.EMP_CIUDAD_EXP}, quien se desempeñará como ${replacements.CARGO_NOMBRE} en el proyecto ${replacements.PROY_NOMBRE} ubicado en ${replacements.PROY_DIRECCION}.`
    );
    printParagraph(
      `Su vinculación al proyecto será efectiva desde el ${replacements.CARGO_FECHA_INICIO} hasta el ${replacements.CARGO_FECHA_FIN}, o hasta la finalización de la etapa ${replacements.PROY_ETAPA} del proyecto.`
    );
    printParagraph(
      `El(La) señor(a) ${replacements.EMP_APELLIDOS} cuenta con afiliaciones vigentes al Sistema de Seguridad Social Integral: EPS ${replacements.EMP_EPS}, Pensión ${replacements.EMP_PENSION}, ARL ${replacements.EMP_ARL}.`
    );
    printParagraph(
      `Agradecemos de antemano brindarle las facilidades y acceso al área de obra para el estricto cumplimiento de sus funciones operativas.`
    );
  } else if (letterType === '03_vinculacion_a_proyecto') {
    printParagraph(
      `Por medio de la presente, PROCIMEC INGENIERÍA SAS le informa que ha sido asignado(a) formalmente al proyecto ${replacements.PROY_NOMBRE}, contrato No. ${replacements.PROY_CONTRATO}, localizado en ${replacements.PROY_DIRECCION}.`
    );
    printParagraph(
      `Su vinculación iniciará el día ${replacements.CARGO_FECHA_INICIO} y tendrá una duración de ${replacements.PROY_DURACION}, prorrogable según el avance técnico de obra.`
    );
    printParagraph(
      `Durante el proyecto reportará directamente al(la) ${replacements.PROY_JEFE_CARGO} señor(a) ${replacements.PROY_JEFE_NOMBRE}. Las condiciones salariales y prestacionales pactadas en su contrato no sufrirán modificación alguna por esta asignación.`
    );
    printParagraph(
      `Deberá presentarse en la obra el ${replacements.CARGO_FECHA_INICIO} a las ${replacements.CARGO_HORA_INICIO} horas, portando la totalidad de los Elementos de Protección Personal (EPP) y documentación SST requerida.`
    );
  } else if (letterType === '04_terminacion_contrato') {
    printParagraph(
      `Por medio de la presente, PROCIMEC INGENIERÍA SAS le comunica que ha tomado la decisión de dar por terminado su contrato de trabajo de manera ${replacements.TERM_TIPO}, a partir del día ${replacements.TERM_FECHA}.`
    );
    printParagraph(
      `Causa(s) que motivan la terminación:\n${replacements.TERM_CAUSAS}`
    );
    printParagraph(
      `De conformidad con el Código Sustantivo del Trabajo, la empresa ${replacements.TERM_INDEM_TEXTO}. Al momento de la desvinculación se liquidarán y pagarán la totalidad de los conceptos legales adeudados: salarios, cesantías, intereses sobre cesantías, vacaciones y prima de servicios.`
    );
    printParagraph(
      `Le solicitamos realizar la entrega formal del cargo, herramientas, equipos y documentos a su cargo a más tardar el ${replacements.TERM_FECHA_ENTREGA}.`
    );
  } else if (letterType === '05_paz_y_salvo') {
    printParagraph(
      `PROCIMEC INGENIERÍA SAS HACE CONSTAR que el(la) señor(a) ${replacements.EMP_NOMBRE}, C.C. No. ${replacements.EMP_DOCUMENTO}, quien se desempeñó como ${replacements.CARGO_NOMBRE} desde el ${replacements.CARGO_FECHA_INICIO} hasta el ${replacements.CARGO_FECHA_FIN}, se encuentra a PAZ Y SALVO con la empresa en los siguientes conceptos:`
    );

    // Tabla de Paz y Salvo con autoTable
    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: marginX },
      head: [['CONCEPTO DE ENTREGA / REVISIÓN', 'ESTADO']],
      body: [
        ['Dotación y elementos de trabajo', replacements.PSV_ITEM_1],
        ['Elementos de Protección Personal (EPP)', replacements.PSV_ITEM_2],
        ['Equipos técnicos, herramientas y maquinaria GPR', replacements.PSV_ITEM_3],
        ['Llaves, accesos físicos y tarjetas de ingreso', replacements.PSV_ITEM_4],
        ['Documentos de proyecto, planos DWG y archivos', replacements.PSV_ITEM_5],
        ['Saldos de anticipos, viáticos o caja menor', replacements.PSV_ITEM_6],
        ['Carnet corporativo y credenciales de identificación', replacements.PSV_ITEM_7],
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [30, 34, 41], // #1E2229
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.2,
        textColor: [30, 41, 59],
      },
      columnStyles: {
        0: { cellWidth: 110 },
        1: { cellWidth: 50, halign: 'center', fontStyle: 'bold', textColor: [20, 83, 45] },
      },
    });

    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
    cursorY = (finalY || cursorY + 45) + 6;

    printParagraph(
      `La empresa se encuentra igualmente a paz y salvo con el(la) trabajador(a) en cuanto al pago de salarios devengados, prestaciones sociales de ley, vacaciones consolidadas e indemnizaciones correspondientes.`
    );
    printParagraph(
      `Observaciones adicionales: ${replacements.PSV_OBSERVACIONES}`
    );
  } else if (letterType === '06_permiso_laboral') {
    printParagraph(
      `En respuesta a su solicitud de permiso laboral radicada el ${replacements.PERM_FECHA_SOLICITUD}, PROCIMEC INGENIERÍA SAS le ${replacements.PERM_DECISION} el permiso bajo las siguientes condiciones estipuladas:`
    );
    printParagraph(
      `• Tipo de permiso: ${replacements.PERM_TIPO}\n` +
      `• Motivo: ${replacements.PERM_MOTIVO}\n` +
      `• Período de ausencia: Del ${replacements.PERM_FECHA_INICIO} al ${replacements.PERM_FECHA_FIN}\n` +
      `• Horario: De ${replacements.PERM_HORA_INICIO} a ${replacements.PERM_HORA_FIN} horas (Total: ${replacements.PERM_TOTAL})\n` +
      `• Condiciones: ${replacements.PERM_COMPENSACION}.`
    );
    printParagraph(
      `Le recordamos dejar cubierto su puesto de trabajo antes de ausentarse. En caso de permiso por incapacidad o cita médica, deberá anexar el soporte correspondiente al departamento de gestión humana.`
    );
  } else if (letterType === '07_solicitud_entidad_externa') {
    printParagraph(
      `PROCIMEC INGENIERÍA SAS se dirige a usted con el fin de ${replacements.SOL_OBJETO}.`
    );
    printParagraph(`Referencia: ${replacements.SOL_REFERENCIA}`);
    printParagraph(
      `Adjuntamos a la presente comunicación los siguientes documentos soporte:\n` +
      `1. RUT actualizado de la empresa (NIT 802019658-9)\n` +
      `2. Certificado de Cámara de Comercio vigente\n` +
      `3. Estados financieros del último período contable\n` +
      `4. Certificado de existencia y representación legal\n` +
      `5. ${replacements.SOL_DOC_ADICIONAL}`
    );
    printParagraph(
      `El representante legal es el señor Alberto Mario Florez Castro, identificado con C.C. No. 72.000.000, con plenas facultades para suscribir el presente documento.`
    );
    printParagraph(
      `Agradecemos de antemano la atención prestada. Para cualquier confirmación puede contactarnos al ${replacements.FIRMA_TEL} o al correo ${replacements.EMPRESA_EMAIL}. Nota: ${replacements.SOL_NOTA}`
    );
  }

  // ─── 7. Firmas de Cierre ───────────────────────────────────────────────────
  if (cursorY > pageHeight - 65) {
    doc.addPage();
    cursorY = 25;
  } else {
    cursorY = Math.max(cursorY + 6, pageHeight - 68);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 34, 41);
  doc.text('Cordialmente,', marginX, cursorY);
  cursorY += 12;

  // Firma Representante Legal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Alberto Mario Florez Castro', marginX, cursorY);
  cursorY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // #475569
  doc.text('Representante Legal', marginX, cursorY);
  cursorY += 4;
  doc.text('PROCIMEC INGENIERÍA SAS', marginX, cursorY);
  cursorY += 4;
  doc.text('C.C. No. 72.000.000 de Barranquilla', marginX, cursorY);
  cursorY += 4;
  doc.text(`Contacto: Cel. ${replacements.FIRMA_TEL}`, marginX, cursorY);

  // Firma Colaborador / Recibí (si aplica a la derecha)
  if (['03_vinculacion_a_proyecto', '04_terminacion_contrato', '05_paz_y_salvo'].includes(letterType)) {
    const colRightX = pageWidth / 2 + 10;
    let rightY = cursorY - 16.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 34, 41);
    doc.text('Recibí Conforme / Trabajador(a):', colRightX, rightY);
    rightY += 12;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(replacements.EMP_NOMBRE, colRightX, rightY);
    rightY += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`C.C. No. ${replacements.EMP_DOCUMENTO}`, colRightX, rightY);
    rightY += 4;
    doc.text(`Fecha: ${replacements.CARTA_FECHA}`, colRightX, rightY);
  }

  // ─── 8. Pie de Página de Auditoría ──────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    doc.setDrawColor(226, 232, 240); // #E2E8F0
    doc.setLineWidth(0.4);
    doc.line(marginX, pageHeight - 16, pageWidth - marginX, pageHeight - 16);

    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // #94A3B8
    doc.text(
      `DOC-ID: ${replacements.CARTA_RADICADO} | PROCIMEC INGENIERÍA SAS | AUDITORÍA RRHH`,
      marginX,
      pageHeight - 11
    );

    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 11,
      { align: 'right' }
    );
  }

  const pdfArrayBuffer = doc.output('arraybuffer');
  return Buffer.from(pdfArrayBuffer);
}
