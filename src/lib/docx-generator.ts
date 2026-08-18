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
  ShadingType,
  ImageRun,
  Footer,
  PageNumber,
  convertInchesToTwip,
  PageBreak,
} from 'docx';
import { FieldReport, Project, ReportFile, AppUser } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface GenerateDocxParams {
  report: FieldReport;
  project: Project;
  files: ReportFile[];
  user?: AppUser;
  photoBuffers?: { file: ReportFile; buffer: Buffer }[];
}

const COLORS = {
  PRIMARY: '1B3A5C',   // Azul Oscuro PROCIMEC
  ACCENT: 'D97706',    // Ámbar Corporativo
  SECONDARY: '475569', // Gris Slate
  LIGHT_BG: 'F8FAFC',  // Fondo claro
  WHITE: 'FFFFFF',
  BORDER: 'CBD5E1',
};

function sectionHeading(title: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 24, // 12pt
        color: COLORS.PRIMARY,
        font: 'Calibri',
      }),
    ],
    spacing: { before: 240, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 12, color: COLORS.ACCENT },
    },
  });
}

function boldRun(text: string, size = 20, color = COLORS.PRIMARY): TextRun {
  return new TextRun({ text, bold: true, size, color, font: 'Calibri' });
}

function normalRun(text: string, size = 20, color = '1E293B'): TextRun {
  return new TextRun({ text, size, color, font: 'Calibri' });
}

function twoColRow(label: string, value: string, isEven = false): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [boldRun(label, 20, COLORS.PRIMARY)] })],
        width: { size: 35, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: isEven ? 'F1F5F9' : COLORS.WHITE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER },
          left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER },
          right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER },
        },
      }),
      new TableCell({
        children: [new Paragraph({ children: [normalRun(value, 20)] })],
        width: { size: 65, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: isEven ? 'F1F5F9' : COLORS.WHITE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER },
          left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER },
          right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER },
        },
      }),
    ],
  });
}

function headerCell(text: string, widthPercent: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 18, color: COLORS.WHITE, font: 'Calibri' })],
        alignment: AlignmentType.CENTER,
      }),
    ],
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: COLORS.PRIMARY },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.PRIMARY },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.PRIMARY },
      left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.PRIMARY },
      right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.PRIMARY },
    },
  });
}

function dataCell(text: string, widthPercent: number, isEven = false, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [normalRun(text, 18)],
        alignment: align,
      }),
    ],
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: isEven ? 'F8FAFC' : COLORS.WHITE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER },
      left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER },
      right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER },
    },
  });
}

export async function generateFieldReportDocx({
  report,
  project,
  files,
  photoBuffers = [],
}: GenerateDocxParams): Promise<Buffer> {
  const reportDate = report.report_date
    ? format(new Date(report.report_date + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })
    : '—';

  const rawGprFiles = files.filter(f => f.file_type === 'raw_gpr');
  const gpsFiles = files.filter(f => f.file_type === 'gps');
  const photoFiles = files.filter(f => f.file_type === 'photo');

  const operationalSummaryTyped = (Array.isArray(report.operational_summary) ? report.operational_summary : []) as { sector?: string; ml?: number; m2?: number; max_depth_m?: number; observations?: string }[];
  const detectedUtilities = Array.isArray(report.detected_utilities) ? report.detected_utilities : [];

  const totalML = operationalSummaryTyped.reduce((sum, r) => sum + (Number(r.ml) || 0), 0);
  const totalM2 = operationalSummaryTyped.reduce((sum, r) => sum + (Number(r.m2) || 0), 0);

  // ─── PORTADA ────────────────────────────────────────────────────────────────
  const coverPage = [
    new Paragraph({ children: [new TextRun({ text: '', size: 40 })] }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'PROCIMEC',
          bold: true,
          size: 48,
          color: COLORS.PRIMARY,
          font: 'Calibri',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'INGENIERÍA Y GEORRADAR DE PENETRACIÓN TERRESTRE',
          size: 20,
          color: COLORS.ACCENT,
          bold: true,
          font: 'Calibri',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'INFORME TÉCNICO DE CAMPO — GPR FIELD REPORT',
          bold: true,
          size: 32,
          color: COLORS.PRIMARY,
          font: 'Calibri',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
    }),

    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        twoColRow('Código del Proyecto', project.code),
        twoColRow('Proyecto', project.name),
        twoColRow('Cliente', project.client),
        twoColRow('Ubicación / Tramo', project.location),
        twoColRow('Fecha de Levantamiento', reportDate),
        twoColRow('Hora de Inicio', report.report_time || '—'),
        twoColRow('Hora Final', report.report_end_time || '—'),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // ─── SECCIÓN 1: Especificaciones Técnicas ────────────────────────────────────
  const equipmentsText = report.equipments_used && report.equipments_used.length > 0
    ? report.equipments_used.join(', ')
    : (report.gpr_equipment || 'GPR');

  const section1 = [
    sectionHeading('SECCIÓN 1 — ESPECIFICACIONES TÉCNICAS Y EQUIPAMIENTO'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        twoColRow('Operador Responsable', report.operator_name || '—'),
        twoColRow('Equipos Utilizados', equipmentsText),
        twoColRow('Equipo de Posicionamiento', report.positioning_equipment || '—'),
        twoColRow('Método de Captura', report.capture_method || '—'),
        twoColRow('Condiciones de Terreno', report.terrain_conditions || '—'),
        twoColRow('Condiciones Climáticas', report.weather_conditions || '—'),
        twoColRow('Frecuencia de Antena', report.antenna_frequency || '—'),
        twoColRow('RDP / Constante Dieléctrica', report.rdp_value || '—'),
        twoColRow('Trazas por metro (Scans/m)', report.scans_per_meter || '—'),
        twoColRow('Filtros / Ganancia recomendada', report.filter_gain_notes || '—'),
        ...(report.rd_data_notes ? [twoColRow('Configuración RD (Electromagnético)', report.rd_data_notes)] : []),
      ],
    }),
    new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 300 } }),
  ];

  // ─── SECCIÓN 2: Resumen Operativo (Sin columna superficie) ────────────────────
  const section2Rows: TableRow[] = [
    new TableRow({
      children: [
        headerCell('Tramo / Sector', 30),
        headerCell('ML', 15),
        headerCell('M²', 15),
        headerCell('Prof. Máx. (m)', 15),
        headerCell('Observaciones', 25),
      ],
      tableHeader: true,
    }),
    ...operationalSummaryTyped.map((row, idx: number) =>
      new TableRow({
        children: [
          dataCell(String(row.sector || ''), 30, idx % 2 === 1),
          dataCell(String(row.ml ?? ''), 15, idx % 2 === 1, AlignmentType.CENTER),
          dataCell(String(row.m2 ?? ''), 15, idx % 2 === 1, AlignmentType.CENTER),
          dataCell(String(row.max_depth_m ?? ''), 15, idx % 2 === 1, AlignmentType.CENTER),
          dataCell(String(row.observations || ''), 25, idx % 2 === 1),
        ],
      })
    ),
    // Totals row
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [boldRun('TOTALES', 20, COLORS.WHITE)], alignment: AlignmentType.RIGHT })],
          shading: { type: ShadingType.CLEAR, fill: COLORS.ACCENT },
          columnSpan: 1,
          borders: { top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER }, bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER }, left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER }, right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER } },
        }),
        new TableCell({
          children: [new Paragraph({ children: [boldRun(totalML.toFixed(2), 20, COLORS.WHITE)], alignment: AlignmentType.CENTER })],
          shading: { type: ShadingType.CLEAR, fill: COLORS.ACCENT },
          borders: { top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER }, bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER }, left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER }, right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER } },
        }),
        new TableCell({
          children: [new Paragraph({ children: [boldRun(totalM2.toFixed(2), 20, COLORS.WHITE)], alignment: AlignmentType.CENTER })],
          shading: { type: ShadingType.CLEAR, fill: COLORS.ACCENT },
          borders: { top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER }, bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER }, left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER }, right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER } },
        }),
        new TableCell({
          children: [new Paragraph({ children: [boldRun(report.global_max_depth ? `${report.global_max_depth} m` : '—', 20, COLORS.WHITE)], alignment: AlignmentType.CENTER })],
          shading: { type: ShadingType.CLEAR, fill: COLORS.ACCENT },
          columnSpan: 2,
          borders: { top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER }, bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER }, left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER }, right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER } },
        }),
      ],
    }),
  ];

  const section2 = [
    sectionHeading('SECCIÓN 2 — RESUMEN OPERATIVO (SOPORTE FACTURACIÓN)'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: section2Rows,
    }),
    new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 300 } }),
  ];

  // ─── SECCIÓN 3: Hallazgos y Anomalías ───────────────────────────────────────
  const section3Rows: TableRow[] = [
    new TableRow({
      children: [
        headerCell('Tipo de Servicio / Anomalía', 30),
        headerCell('Prof. Est. (m)', 15),
        headerCell('Confianza', 15),
        headerCell('Descripción', 40),
      ],
      tableHeader: true,
    }),
    ...(detectedUtilities as { type?: string; estimated_depth_m?: number | string; confidence?: string; description?: string }[]).map((u, idx: number) =>
      new TableRow({
        children: [
          dataCell(String(u.type || ''), 30, idx % 2 === 1),
          dataCell(String(u.estimated_depth_m ?? ''), 15, idx % 2 === 1, AlignmentType.CENTER),
          dataCell(String(u.confidence || ''), 15, idx % 2 === 1, AlignmentType.CENTER),
          dataCell(String(u.description || ''), 40, idx % 2 === 1),
        ],
      })
    ),
  ];

  const section3 = [
    sectionHeading('SECCIÓN 3 — HALLAZGOS E INTERFERENCIAS DETECTADAS'),
    ...(detectedUtilities.length > 0
      ? [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: section3Rows })]
      : [new Paragraph({ children: [normalRun('Sin interferencias específicas declaradas.', 20)], spacing: { after: 150 } })]),
    new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 150 } }),
    new Paragraph({ children: [boldRun('Anomalías Destacadas:', 22)], spacing: { after: 60 } }),
    new Paragraph({ children: [normalRun(report.anomalies_notes || 'Sin observaciones.', 20)], spacing: { after: 150 } }),
    new Paragraph({ children: [boldRun('Restricciones o Limitaciones en Sitio:', 22)], spacing: { after: 60 } }),
    new Paragraph({ children: [normalRun(report.site_restrictions || 'Sin restricciones declaradas.', 20)], spacing: { after: 300 } }),
  ];

  // ─── SECCIÓN 4: Archivos ─────────────────────────────────────────────────────
  const section4 = [
    sectionHeading('SECCIÓN 4 — REGISTRO DE ARCHIVOS SUBIDOS A DRIVE'),
    new Paragraph({ children: [boldRun('Archivos RAW / Procesados / Presentaciones GPR:', 22)], spacing: { after: 60 } }),
    ...rawGprFiles.map(f =>
      new Paragraph({
        children: [normalRun(` • ${f.original_name}`, 20)],
        spacing: { after: 40 },
      })
    ),
    ...(rawGprFiles.length === 0 ? [new Paragraph({ children: [normalRun('Sin archivos GPR adjuntos.', 20)], spacing: { after: 60 } })] : []),
    new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 150 } }),
    new Paragraph({ children: [boldRun('Archivos de Posicionamiento (GPS / Estación / DWG):', 22)], spacing: { after: 60 } }),
    ...gpsFiles.map(f =>
      new Paragraph({
        children: [normalRun(` • ${f.original_name}`, 20)],
        spacing: { after: 40 },
      })
    ),
    ...(gpsFiles.length === 0 ? [new Paragraph({ children: [normalRun('Sin archivos de posicionamiento adjuntos.', 20)], spacing: { after: 60 } })] : []),
    new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 300 } }),
  ];

  // ─── SECCIÓN 5: Fotografías ──────────────────────────────────────────────────
  const photoRows: Paragraph[] = [];
  if (photoBuffers.length > 0) {
    for (let i = 0; i < photoBuffers.length; i += 2) {
      const pair = photoBuffers.slice(i, i + 2);
      pair.forEach(({ file, buffer }) => {
        let ext = file.original_name.split('.').pop()?.toLowerCase() || 'jpg';
        if (ext === 'jpeg') ext = 'jpg';
        const type = (ext === 'png' ? 'png' : 'jpg') as 'png' | 'jpg';

        photoRows.push(
          new Paragraph({
            children: [new ImageRun({ data: buffer, transformation: { width: 280, height: 200 }, type })],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [normalRun(file.caption || `Foto ${i + 1}`, 18, '6B7280')],
            alignment: AlignmentType.CENTER,
            spacing: { after: 150 },
          })
        );
      });
    }
  }

  const section5 = [
    sectionHeading('SECCIÓN 5 — REGISTRO FOTOGRÁFICO'),
    ...photoRows,
    ...(photoFiles.length === 0 ? [new Paragraph({ children: [normalRun('Sin fotografías registradas.', 20)], spacing: { after: 200 } })] : []),
  ];

  // ─── SECCIÓN 6: Notas CAD ────────────────────────────────────────────────────
  const section6 = [
    sectionHeading('SECCIÓN 6 — NOTAS PARA POSPROCESAMIENTO Y CAD'),
    new Paragraph({
      children: [boldRun('Prioridad de Digitalización: ', 22), normalRun(report.cad_priority || '—', 22, COLORS.PRIMARY)],
      spacing: { after: 150 },
    }),
    new Paragraph({ children: [boldRun('Observaciones / Recomendaciones para Posprocesamiento y CAD:', 22)], spacing: { after: 100 } }),
    new Paragraph({ children: [normalRun(report.processing_recommendations || '—', 20)], spacing: { after: 300 } }),
  ];

  // ─── SECCIÓN 7: Validaciones ─────────────────────────────────────────────────
  const section7 = [
    sectionHeading('SECCIÓN 7 — VALIDACIÓN DE CAMPO'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({ children: [boldRun('Operador Responsable:', 22)], spacing: { after: 60 } }),
                new Paragraph({ children: [normalRun(report.operator_name || '—', 20)] }),
                new Paragraph({ children: [normalRun('', 20)], spacing: { after: 250 } }),
                new Paragraph({ children: [normalRun('Firma: ________________________________', 20)] }),
                new Paragraph({ children: [normalRun(`Fecha: ${reportDate}`, 20)], spacing: { after: 150 } }),
              ],
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: { top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER }, bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER }, left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER }, right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER } },
            }),
            new TableCell({
              children: [
                new Paragraph({ children: [boldRun('Supervisión / Recibido:', 22)], spacing: { after: 60 } }),
                new Paragraph({ children: [normalRun('PROCIMEC Oficina / CAD', 20)] }),
                new Paragraph({ children: [normalRun('', 20)], spacing: { after: 250 } }),
                new Paragraph({ children: [normalRun('Firma: ________________________________', 20)] }),
                new Paragraph({ children: [normalRun(`Fecha: ______/______/______`, 20)], spacing: { after: 150 } }),
              ],
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: { top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER }, bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER }, left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER }, right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER } },
            }),
          ],
        }),
      ],
    }),
  ];

  // ─── FOOTER ──────────────────────────────────────────────────────────────────
  const footer = new Footer({
    children: [
      new Paragraph({
        children: [
          boldRun('PROCIMEC', 16, COLORS.PRIMARY),
          normalRun(' — Reporte Técnico de Campo GPR | Página ', 16, COLORS.SECONDARY),
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 16,
            color: COLORS.SECONDARY,
            font: 'Calibri',
          }),
          normalRun(' de ', 16, COLORS.SECONDARY),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            size: 16,
            color: COLORS.SECONDARY,
            font: 'Calibri',
          }),
        ],
        alignment: AlignmentType.RIGHT,
      }),
    ],
  });

  // ─── CONSTRUCT DOCUMENT ──────────────────────────────────────────────────────
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.8),
              bottom: convertInchesToTwip(0.8),
              left: convertInchesToTwip(0.8),
              right: convertInchesToTwip(0.8),
            },
          },
        },
        footers: { default: footer },
        children: [
          ...coverPage,
          ...section1,
          ...section2,
          ...section3,
          ...section4,
          ...section5,
          ...section6,
          ...section7,
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
