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
  HeadingLevel,
  BorderStyle,
  ShadingType,
  ImageRun,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  UnderlineType,
  convertInchesToTwip,
  PageBreak,
} from 'docx';
import { FieldReport, Project, ReportFile, AppUser } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Color Palette ─────────────────────────────────────────────────────────────
const COLORS = {
  PRIMARY: '1B3A5C',
  ACCENT: 'F5A623',
  WHITE: 'FFFFFF',
  LIGHT_GRAY: 'F0F4F8',
  DARK_GRAY: '2D3748',
  BORDER: 'CBD5E0',
};

// ─── Helper: Bold text run ────────────────────────────────────────────────────
function boldRun(text: string, size = 22, color = COLORS.DARK_GRAY): TextRun {
  return new TextRun({ text, bold: true, size, color });
}

function normalRun(text: string, size = 20, color = COLORS.DARK_GRAY): TextRun {
  return new TextRun({ text, size, color });
}

// ─── Helper: Section heading ──────────────────────────────────────────────────
function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: `  ${text}  `,
        bold: true,
        size: 24,
        color: COLORS.WHITE,
      }),
    ],
    shading: { type: ShadingType.CLEAR, fill: COLORS.PRIMARY },
    spacing: { before: 300, after: 200 },
    indent: { left: 0 },
  });
}

// ─── Helper: 2-column table cell ─────────────────────────────────────────────
function labelCell(text: string): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [boldRun(text, 20)] })],
    shading: { type: ShadingType.CLEAR, fill: COLORS.LIGHT_GRAY },
    width: { size: 35, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER },
      left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER },
      right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER },
    },
  });
}

function valueCell(text: string): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [normalRun(text || '—', 20)] })],
    width: { size: 65, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER },
      left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER },
      right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER },
    },
  });
}

function twoColRow(label: string, value: string): TableRow {
  return new TableRow({ children: [labelCell(label), valueCell(value)] });
}

// ─── Header cell for tables ───────────────────────────────────────────────────
function headerCell(text: string, widthPct: number): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [boldRun(text, 18, COLORS.WHITE)], alignment: AlignmentType.CENTER })],
    shading: { type: ShadingType.CLEAR, fill: COLORS.PRIMARY },
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.WHITE },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.WHITE },
      left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.WHITE },
      right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.WHITE },
    },
  });
}

function dataCell(text: string, widthPct: number, shade = false): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [normalRun(text || '—', 18)], alignment: AlignmentType.CENTER })],
    shading: shade ? { type: ShadingType.CLEAR, fill: COLORS.LIGHT_GRAY } : undefined,
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER },
      left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER },
      right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER },
    },
  });
}

// ─── Main Generator ──────────────────────────────────────────────────────────
export interface DocxGeneratorInput {
  report: FieldReport;
  project: Project;
  files: ReportFile[];
  user: AppUser;
  photoBuffers?: { file: ReportFile; buffer: Buffer }[];
}

export async function generateFieldReportDocx(input: DocxGeneratorInput): Promise<Buffer> {
  const { report, project, files, photoBuffers = [] } = input;

  const reportDate = report.report_date
    ? format(new Date(report.report_date + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })
    : '—';

  const now = new Date();
  const generatedAt = format(now, "dd/MM/yyyy HH:mm", { locale: es });

  const rawGprFiles = files.filter(f => f.file_type === 'raw_gpr');
  const gpsFiles = files.filter(f => f.file_type === 'gps');
  const photoFiles = files.filter(f => f.file_type === 'photo');

  const operationalSummaryTyped = (Array.isArray(report.operational_summary) ? report.operational_summary : []) as { ml?: number; m2?: number }[];
  const detectedUtilities = Array.isArray(report.detected_utilities) ? report.detected_utilities : [];

  const totalML = operationalSummaryTyped.reduce((sum, r) => sum + (Number(r.ml) || 0), 0);
  const totalM2 = operationalSummaryTyped.reduce((sum, r) => sum + (Number(r.m2) || 0), 0);

  // ─── PORTADA ────────────────────────────────────────────────────────────────
  const coverPage = [
    new Paragraph({ children: [new TextRun({ text: '', size: 40 })] }),
    new Paragraph({ children: [new TextRun({ text: '', size: 40 })] }),
    // PROCIMEC Title Block
    new Paragraph({
      children: [boldRun('PROCIMEC', 72, COLORS.PRIMARY)],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [normalRun('Procesamiento de Imágenes y Ciencias de la Medición', 24, COLORS.DARK_GRAY)],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    // Accent line
    new Paragraph({
      children: [new TextRun({ text: '━'.repeat(60), color: COLORS.ACCENT, size: 20 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      children: [boldRun('REPORTE TÉCNICO PRELIMINAR DE CAMPO', 36, COLORS.PRIMARY)],
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [normalRun('Control de Cantidades y Soporte de Facturación', 26, COLORS.DARK_GRAY)],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    // Info table
    new Table({
      width: { size: 80, type: WidthType.PERCENTAGE },
      rows: [
        twoColRow('Código de Control', project.code),
        twoColRow('Fecha del Levantamiento', reportDate),
        twoColRow('Hora de Inicio', report.report_time || '—'),
        twoColRow('Cliente', project.client),
        twoColRow('Proyecto', project.name),
        twoColRow('Ubicación / Tramo', project.location),
        twoColRow('Número de Contrato', project.contract_number || '—'),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // ─── SECCIÓN 1: Especificaciones Técnicas ────────────────────────────────────
  const section1 = [
    sectionHeading('SECCIÓN 1 — ESPECIFICACIONES TÉCNICAS Y EQUIPAMIENTO'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        twoColRow('Operador Responsable', report.operator_name || '—'),
        twoColRow('Equipo GPR Utilizado', report.gpr_equipment || '—'),
        twoColRow('Frecuencia de Antena', report.antenna_frequency || '—'),
        twoColRow('Método de Captura', report.capture_method || '—'),
        twoColRow('Equipo de Posicionamiento', report.positioning_equipment || '—'),
        twoColRow('Condiciones de Terreno', report.terrain_conditions || '—'),
        twoColRow('Condiciones Climáticas', report.weather_conditions || '—'),
      ],
    }),
    new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 300 } }),
  ];

  // ─── SECCIÓN 2: Resumen Operativo ────────────────────────────────────────────
  const section2Rows: TableRow[] = [
    new TableRow({
      children: [
        headerCell('Tramo / Sector', 20),
        headerCell('ML', 10),
        headerCell('M²', 10),
        headerCell('Prof. Máx. (m)', 15),
        headerCell('Tipo Superficie', 20),
        headerCell('Observaciones', 25),
      ],
      tableHeader: true,
    }),
    ...(operationalSummaryTyped as { sector?: string; ml?: number; m2?: number; max_depth_m?: number; surface_type?: string; observations?: string }[]).map((row, idx: number) =>
      new TableRow({
        children: [
          dataCell(String(row.sector || ''), 20, idx % 2 === 1),
          dataCell(String(row.ml ?? ''), 10, idx % 2 === 1),
          dataCell(String(row.m2 ?? ''), 10, idx % 2 === 1),
          dataCell(String(row.max_depth_m ?? ''), 15, idx % 2 === 1),
          dataCell(String(row.surface_type || ''), 20, idx % 2 === 1),
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
          children: [new Paragraph({ children: [boldRun(totalML.toFixed(2), 20)], alignment: AlignmentType.CENTER })],
          shading: { type: ShadingType.CLEAR, fill: COLORS.ACCENT },
          borders: { top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER }, bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER }, left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER }, right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER } },
        }),
        new TableCell({
          children: [new Paragraph({ children: [boldRun(totalM2.toFixed(2), 20)], alignment: AlignmentType.CENTER })],
          shading: { type: ShadingType.CLEAR, fill: COLORS.ACCENT },
          borders: { top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER }, bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER }, left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER }, right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER } },
        }),
        new TableCell({
          children: [new Paragraph({ children: [normalRun('—', 20)], alignment: AlignmentType.CENTER })],
          shading: { type: ShadingType.CLEAR, fill: COLORS.ACCENT },
          columnSpan: 3,
          borders: { top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER }, bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER }, left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER }, right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER } },
        }),
      ],
    }),
  ];

  const section2 = [
    sectionHeading('SECCIÓN 2 — RESUMEN OPERATIVO Y VOLUMETRÍA (SOPORTE DE FACTURACIÓN)'),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: section2Rows }),
    new Paragraph({
      children: [
        boldRun('Profundidad máxima global estimada: ', 22),
        normalRun(`${report.global_max_depth ?? '—'} m`, 22, COLORS.PRIMARY),
      ],
      spacing: { before: 200, after: 300 },
    }),
  ];

  // ─── SECCIÓN 3: Hallazgos ────────────────────────────────────────────────────
  const section3UtilityRows: TableRow[] = [
    new TableRow({
      children: [
        headerCell('Tipo de Servicio', 30),
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
          dataCell(String(u.estimated_depth_m ?? ''), 15, idx % 2 === 1),
          dataCell(String(u.confidence || ''), 15, idx % 2 === 1),
          dataCell(String(u.description || ''), 40, idx % 2 === 1),
        ],
      })
    ),
  ];

  const section3 = [
    sectionHeading('SECCIÓN 3 — HALLAZGOS Y ANOMALÍAS PRELIMINARES'),
    new Paragraph({ children: [boldRun('Servicios / Interferencias Detectadas:', 22)], spacing: { after: 120 } }),
    detectedUtilities.length > 0
      ? new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: section3UtilityRows })
      : new Paragraph({ children: [normalRun('No se detectaron servicios en este levantamiento.', 20)], spacing: { after: 200 } }),
    new Paragraph({ children: [boldRun('Anomalías Destacadas (sujeto a posprocesamiento):', 22)], spacing: { before: 200, after: 100 } }),
    new Paragraph({ children: [normalRun(report.anomalies_notes || '—', 20)], spacing: { after: 200 } }),
    new Paragraph({ children: [boldRun('Restricciones o Limitaciones Encontradas en Sitio:', 22)], spacing: { after: 100 } }),
    new Paragraph({ children: [normalRun(report.site_restrictions || '—', 20)], spacing: { after: 300 } }),
  ];

  // ─── SECCIÓN 4: Archivos ─────────────────────────────────────────────────────
  const section4 = [
    sectionHeading('SECCIÓN 4 — REGISTRO DE ARCHIVOS DE CAMPO'),
    new Paragraph({
      children: [
        boldRun('Enlace a Carpeta Drive: ', 20),
        new TextRun({
          text: report.drive_session_folder_url || '—',
          size: 20,
          color: '2563EB',
          underline: { type: UnderlineType.SINGLE, color: '2563EB' },
        }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({ children: [boldRun('Archivos RAW GPR:', 22)], spacing: { after: 100 } }),
    ...rawGprFiles.map((f, i) =>
      new Paragraph({ children: [normalRun(`${i + 1}. ${f.original_name}`, 20)], bullet: { level: 0 } })
    ),
    ...(rawGprFiles.length === 0 ? [new Paragraph({ children: [normalRun('Sin archivos RAW GPR.', 20)] })] : []),
    new Paragraph({ children: [boldRun('Archivos de Posicionamiento:', 22)], spacing: { before: 200, after: 100 } }),
    ...gpsFiles.map((f, i) =>
      new Paragraph({ children: [normalRun(`${i + 1}. ${f.original_name}`, 20)], bullet: { level: 0 } })
    ),
    ...(gpsFiles.length === 0 ? [new Paragraph({ children: [normalRun('Sin archivos de posicionamiento.', 20)] })] : []),
    new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 200 } }),
  ];

  // ─── SECCIÓN 5: Fotografías ──────────────────────────────────────────────────
  const photoRows: Paragraph[] = [];
  const photosToEmbed = photoBuffers.slice(0, 4);

  if (photosToEmbed.length > 0) {
    for (let i = 0; i < photosToEmbed.length; i += 2) {
      const pair = photosToEmbed.slice(i, i + 2);
      const imageRuns = pair.map(({ file, buffer }) => {
        let ext = file.original_name.split('.').pop()?.toLowerCase() || 'jpg';
        if (ext === 'jpeg') ext = 'jpg';
        const type = (ext === 'png' ? 'png' : 'jpg') as 'png' | 'jpg';

        return [
          new Paragraph({
            children: [new ImageRun({ data: buffer, transformation: { width: 280, height: 200 }, type })],
            alignment: i % 2 === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
          }),
          new Paragraph({
            children: [normalRun(file.caption || `Foto ${i + 1}`, 18, '6B7280')],
            alignment: AlignmentType.CENTER,
            spacing: { after: 150 },
          }),
        ];
      });
      imageRuns.flat().forEach(p => photoRows.push(p));
    }
  }

  if (photoFiles.length > 4) {
    photoRows.push(
      new Paragraph({
        children: [
          normalRun(`Ver galería completa en carpeta Drive: `, 20),
          new TextRun({
            text: report.drive_session_folder_url || 'Ver Drive',
            size: 20,
            color: '2563EB',
            underline: { type: UnderlineType.SINGLE, color: '2563EB' },
          }),
        ],
        spacing: { after: 200 },
      })
    );
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
    new Paragraph({ children: [boldRun('Recomendaciones de Filtrado/Ganancia:', 22)], spacing: { after: 100 } }),
    new Paragraph({ children: [normalRun(report.filter_gain_notes || '—', 20)], spacing: { after: 200 } }),
    new Paragraph({ children: [boldRun('Observaciones Adicionales para Posprocesamiento:', 22)], spacing: { after: 100 } }),
    new Paragraph({ children: [normalRun(report.additional_notes || '—', 20)], spacing: { after: 300 } }),
  ];

  // ─── SECCIÓN 7: Firmas ───────────────────────────────────────────────────────
  const section7 = [
    sectionHeading('SECCIÓN 7 — VALIDACIÓN Y FIRMAS'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({ children: [boldRun('Elaborado por:', 22)], spacing: { after: 60 } }),
                new Paragraph({ children: [normalRun(report.elaborated_by || '—', 20)] }),
                new Paragraph({ children: [normalRun('', 20)], spacing: { after: 300 } }),
                new Paragraph({ children: [normalRun('Firma: ________________________________', 20)] }),
                new Paragraph({ children: [normalRun(`Fecha: ${reportDate}`, 20)], spacing: { after: 200 } }),
              ],
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: { top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER }, bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER }, left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER }, right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER } },
            }),
            new TableCell({
              children: [
                new Paragraph({ children: [boldRun('Revisado por:', 22)], spacing: { after: 60 } }),
                new Paragraph({ children: [normalRun(report.reviewed_by || '—', 20)] }),
                new Paragraph({ children: [normalRun('', 20)], spacing: { after: 300 } }),
                new Paragraph({ children: [normalRun('Firma: ________________________________', 20)] }),
                new Paragraph({ children: [normalRun(`Fecha: ______/______/______`, 20)], spacing: { after: 200 } }),
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
          normalRun(` | ${project.code} | Generado: ${generatedAt} | Página `, 16),
          new TextRun({ children: [PageNumber.CURRENT], size: 16 }),
          normalRun(' de ', 16),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16 }),
        ],
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.BORDER } },
      }),
    ],
  });

  // ─── Assemble Document ────────────────────────────────────────────────────────
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'bullet-list',
          levels: [{ level: 0, format: NumberFormat.BULLET, text: '•', alignment: AlignmentType.LEFT }],
        },
      ],
    },
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

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}
