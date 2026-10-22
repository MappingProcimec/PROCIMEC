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
  Footer,
  PageNumber,
  convertInchesToTwip,
} from 'docx';

export interface ProjectReportOptions {
  project: {
    name: string;
    client: string;
    cost_center?: string;
    location?: string;
  };
  metrics: {
    total_ml: number;
    total_m2: number;
    max_depth_m: number;
    reports_count: number;
    utilities_count: number;
  };
  tramos: Array<{
    sector: string;
    ml: number;
    m2: number;
    max_depth_m: number;
    observations?: string;
    report_date?: string;
    localizador_name?: string;
  }>;
  utilities: Array<{
    type: string;
    diameter?: string;
    estimated_depth_m: number;
    confidence: string;
    description?: string;
    report_date?: string;
  }>;
}

const COLORS = {
  CHARCOAL: '1E2229',
  AMBER: 'EAA023',
  SLATE: '475569',
  LIGHT_BG: 'F8FAFC',
  WHITE: 'FFFFFF',
  BORDER: 'E2E8F0',
};

function sectionHeading(num: string, title: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${num}. `, bold: true, size: 22, color: COLORS.AMBER, font: 'Calibri' }),
      new TextRun({ text: title, bold: true, size: 22, color: COLORS.CHARCOAL, font: 'Calibri' }),
    ],
    spacing: { before: 260, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 8, color: COLORS.AMBER },
    },
  });
}

function bodyParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 20, color: '334155', font: 'Calibri' })],
    spacing: { after: 140, line: 280 },
  });
}

function tableHeaderCell(text: string, widthPercent: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 18, color: COLORS.WHITE, font: 'Calibri' })],
        alignment: AlignmentType.CENTER,
      }),
    ],
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: COLORS.CHARCOAL },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.CHARCOAL },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.CHARCOAL },
      left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER },
      right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER },
    },
  });
}

function tableDataCell(
  text: string,
  widthPercent: number,
  isEven = false,
  align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT
): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 18, color: COLORS.CHARCOAL, font: 'Calibri' })],
        alignment: align,
      }),
    ],
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: isEven ? 'F1F5F9' : COLORS.WHITE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER },
      left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER },
      right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER },
    },
  });
}

export async function generateProjectReportDocx(options: ProjectReportOptions): Promise<Buffer> {
  const { project, metrics, tramos, utilities } = options;
  const todayFormatted = new Date().toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

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
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'PROCIMEC INGENIERÍA S.A.S. — PCM CLOUD | Código: FOR-GPR-05 | Página ', size: 16, color: COLORS.SLATE }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: COLORS.SLATE }),
                  new TextRun({ text: ' de ', size: 16, color: COLORS.SLATE }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: COLORS.SLATE }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: [
          // ENCABEZADO INSTITUCIONAL
          new Paragraph({
            children: [
              new TextRun({ text: 'PROCIMEC INGENIERÍA S.A.S.', bold: true, size: 30, color: COLORS.CHARCOAL, font: 'Calibri' }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'LÍNEA DE GEOFÍSICA APLICADA, DETECCIÓN SUBTERRÁNEA Y AUTOMATIZACIÓN CAD/BIM', bold: true, size: 18, color: COLORS.AMBER, font: 'Calibri' }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'SISTEMA INTEGRADO DE GESTIÓN HSEQ | ISO 9001:2015 & ISO 45001:2018 | CÓDIGO: FOR-GPR-05 v2', size: 16, color: COLORS.SLATE, font: 'Calibri' }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
          }),

          // TÍTULO DEL INFORME
          new Paragraph({
            children: [
              new TextRun({ text: 'INFORME FINAL TÉCNICO Y EJECUTIVO DE LOCALIZACIÓN DE REDES SUBTERRÁNEAS (GPR)', bold: true, size: 24, color: COLORS.CHARCOAL, font: 'Calibri' }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),

          // CUADRO DE METADATOS DEL PROYECTO
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  tableHeaderCell('FICHA TÉCNICA DEL PROYECTO', 100),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: `PROYECTO: `, bold: true }), new TextRun(project.name.toUpperCase())] }),
                      new Paragraph({ children: [new TextRun({ text: `CLIENTE / CONTRATANTE: `, bold: true }), new TextRun(project.client.toUpperCase())] }),
                      new Paragraph({ children: [new TextRun({ text: `CENTRO DE COSTOS: `, bold: true }), new TextRun(project.cost_center || 'N/A')] }),
                      new Paragraph({ children: [new TextRun({ text: `UBICACIÓN GEOGRÁFICA: `, bold: true }), new TextRun(project.location || 'Colombia')] }),
                      new Paragraph({ children: [new TextRun({ text: `FECHA DE EMISIÓN: `, bold: true }), new TextRun(todayFormatted)] }),
                      new Paragraph({ children: [new TextRun({ text: `VOLUMETRÍA EJECUTADA: `, bold: true }), new TextRun(`${metrics.total_ml} ML | ${metrics.total_m2} M² | Prof. Máx: ${metrics.max_depth_m} m`)] }),
                    ],
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: COLORS.LIGHT_BG },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER },
                      bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER },
                      left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER },
                      right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.BORDER },
                    },
                  }),
                ],
              }),
            ],
          }),

          // SECCIÓN 1: OBJETIVO Y ALCANCE
          sectionHeading('1', 'OBJETIVOS Y ALCANCE DE LA EXPLORACIÓN'),
          bodyParagraph(
            `El presente documento consolida los resultados técnicos del estudio de prospección no destructiva mediante Georadar de Penetración Terrestre (GPR) y radiodetección electromagnética para el proyecto "${project.name}", con el objetivo prioritario de cartografiar las redes subterráneas de servicios públicos existentes y mitigar riesgos de rotura durante las fases de excavación mecánica y civil.`
          ),
          bodyParagraph(
            `El alcance comprendió la exploración continua de ${metrics.total_ml} Metros Lineales (ML) equivalentes a ${metrics.total_m2} Metros Cuadrados (M²) de franja de servidumbre vial y peatonal, alcanzando una profundidad máxima de detección de ${metrics.max_depth_m} metros.`
          ),

          // SECCIÓN 2: METODOLOGÍA Y EQUIPOS
          sectionHeading('2', 'METODOLOGÍA GEOFÍSICA Y EQUIPOS EMPLEADOS'),
          bodyParagraph(
            'Se implementó un protocolo geofísico de alta resolución sustentado en los siguientes sistemas instrumentales:'
          ),
          bodyParagraph(
            '• Georadar multi-frecuencia blindado de 400 MHz a 500 MHz (MALA HDR / GPR ProEx) acoplado a odómetro de precisión para registro continuo de radargramas.\n' +
            '• Receptor de radiodetección electromagnética RD8100 y generador de inducción Tx-10 (detección de cables de energía activos y conductores metálicos energizados).\n' +
            '• Cadena de filtrado digital DSP: Corrección de tiempo cero (Time-Zero), Filtro Dewow, ganancia SEC exponencial y calibración dieléctrica de velocidad (v ≈ 0.100 m/ns).'
          ),

          // SECCIÓN 3: CONSOLIDADO DE VOLUMETRÍA Y TRAMOS
          sectionHeading('3', 'CONSOLIDADO DE VOLUMETRÍA OPERATIVA Y TRAMOS'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  tableHeaderCell('ÍTEM', 10),
                  tableHeaderCell('TRAMO / SECTOR', 40),
                  tableHeaderCell('LONGITUD (ML)', 18),
                  tableHeaderCell('ÁREA (M²)', 16),
                  tableHeaderCell('PROF. MÁX (m)', 16),
                ],
              }),
              ...tramos.map((t, i) =>
                new TableRow({
                  children: [
                    tableDataCell(`${i + 1}`, 10, i % 2 === 1, AlignmentType.CENTER),
                    tableDataCell(t.sector || `Sector ${i + 1}`, 40, i % 2 === 1),
                    tableDataCell(`${(t.ml || 0).toFixed(2)}`, 18, i % 2 === 1, AlignmentType.RIGHT),
                    tableDataCell(`${(t.m2 || 0).toFixed(2)}`, 16, i % 2 === 1, AlignmentType.RIGHT),
                    tableDataCell(`${(t.max_depth_m || 0).toFixed(2)} m`, 16, i % 2 === 1, AlignmentType.CENTER),
                  ],
                })
              ),
              new TableRow({
                children: [
                  tableDataCell('TOTAL', 10, false, AlignmentType.CENTER),
                  tableDataCell('METRAJE CONSOLIDADO DEL PROYECTO', 40, false),
                  tableDataCell(`${metrics.total_ml.toFixed(2)} ML`, 18, false, AlignmentType.RIGHT),
                  tableDataCell(`${metrics.total_m2.toFixed(2)} M²`, 16, false, AlignmentType.RIGHT),
                  tableDataCell(`${metrics.max_depth_m.toFixed(2)} m`, 16, false, AlignmentType.CENTER),
                ],
              }),
            ],
          }),

          // SECCIÓN 4: INVENTARIO DE INTERFERENCIAS DETECTADAS
          sectionHeading('4', 'INVENTARIO Y CARACTERIZACIÓN DE INTERFERENCIAS DETECTADAS'),
          bodyParagraph(
            `A continuación se presenta el cuadro técnico de las ${utilities.length} anomalías subterráneas detectadas e interpretadas en el subsuelo:`
          ),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  tableHeaderCell('#', 8),
                  tableHeaderCell('SERVICIO', 26),
                  tableHeaderCell('DIÁMETRO', 16),
                  tableHeaderCell('PROF. EST. (m)', 18),
                  tableHeaderCell('CONFIANZA', 16),
                  tableHeaderCell('OBSERVACIONES', 16),
                ],
              }),
              ...utilities.map((u, i) =>
                new TableRow({
                  children: [
                    tableDataCell(`${i + 1}`, 8, i % 2 === 1, AlignmentType.CENTER),
                    tableDataCell(u.type, 26, i % 2 === 1),
                    tableDataCell(u.diameter || 'N/D', 16, i % 2 === 1, AlignmentType.CENTER),
                    tableDataCell(`${u.estimated_depth_m.toFixed(2)} m`, 18, i % 2 === 1, AlignmentType.CENTER),
                    tableDataCell(u.confidence, 16, i % 2 === 1, AlignmentType.CENTER),
                    tableDataCell(u.description || '—', 16, i % 2 === 1),
                  ],
                })
              ),
            ],
          }),

          // SECCIÓN 5: MATRIZ DE RIESGO Y RECOMENDACIONES DE EXCAVACIÓN
          sectionHeading('5', 'MATRIZ DE RIESGO EN EXCAVACIÓN Y CLASH DETECTION'),
          bodyParagraph(
            '1. Todo cruce perpendicular con redes de Gas Natural y Energía Eléctrica debe ser validado previamente mediante calicata exploratoria manual (apique no destructivo a mano) antes del ingreso de retroexcavadoras.'
          ),
          bodyParagraph(
            '2. Se debe mantener una distancia de seguridad mínima de 0.30 metros entre redes de gas y canalizaciones de energía/acueducto conforme a la normativa técnica vigente (RETIE y RAS).'
          ),
          bodyParagraph(
            '3. Las cotas Z informadas corresponden a profundidades invert estimadas mediante análisis de velocidad de onda (v = 0.10 m/ns), las cuales pueden presentar tolerancias inherentes a la compactación litológica local (± 10%).'
          ),

          // SECCIÓN 6: CONCLUSIONES
          sectionHeading('6', 'CONCLUSIONES Y APROBACIÓN TÉCNICA'),
          bodyParagraph(
            `Se cumplió satisfactoriamente con la exploración no destructiva de ${metrics.total_ml} ML, generando los entregables vectoriales 2D (.DXF), procesamiento crudo (.PDF), modelo 3D BIM (.IFC) e informe final para el proyecto "${project.name}".`
          ),

          // CUADRO DE FIRMAS
          new Paragraph({ spacing: { before: 300 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: '_______________________________', color: COLORS.CHARCOAL })] }),
                      new Paragraph({ children: [new TextRun({ text: 'ESPECIALISTA GEOFÍSICO GPR', bold: true, size: 18 })] }),
                      new Paragraph({ children: [new TextRun({ text: 'PROCIMEC INGENIERÍA S.A.S.', size: 16, color: COLORS.SLATE })] }),
                    ],
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({ children: [new TextRun({ text: '_______________________________', color: COLORS.CHARCOAL })] }),
                      new Paragraph({ children: [new TextRun({ text: 'DIRECTOR TÉCNICO DE PROYECTO', bold: true, size: 18 })] }),
                      new Paragraph({ children: [new TextRun({ text: 'PROCIMEC INGENIERÍA S.A.S.', size: 16, color: COLORS.SLATE })] }),
                    ],
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
