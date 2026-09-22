export interface DroneInspectionItemDef {
  code: string;
  section: string;
  description: string;
  optimal: 'SI' | 'NO' | 'NA';
}

export const DRONE_INSPECTION_SECTIONS = [
  '1. DRONE',
  '2. CONTROL REMOTO',
  '3. CABLES',
  '4. CARGADOR',
  '5. BATERÍAS',
  '6. ACCESORIOS Y HÉLICES',
] as const;

export const DRONE_INSPECTION_ITEMS: DroneInspectionItemDef[] = [
  // 1. DRONE
  {
    code: '1.1',
    section: '1. DRONE',
    description: 'Estado general del drone todos los sensores y luces funcionan',
    optimal: 'SI',
  },
  {
    code: '1.2',
    section: '1. DRONE',
    description: 'Carcasa del drone presenta golpes o grietas',
    optimal: 'NO',
  },
  {
    code: '1.3',
    section: '1. DRONE',
    description: 'Se ajustan las frecuencias y se verifica el funcionamiento de la señal del drone',
    optimal: 'SI',
  },
  {
    code: '1.4',
    section: '1. DRONE',
    description: 'Motores del drone presentan corrosión',
    optimal: 'NO',
  },
  {
    code: '1.5',
    section: '1. DRONE',
    description: 'Sistemas de conexión (puertos) del drone están en buen estado',
    optimal: 'SI',
  },
  {
    code: '1.6',
    section: '1. DRONE',
    description: 'Drone se encuentra limpio',
    optimal: 'SI',
  },
  {
    code: '1.7',
    section: '1. DRONE',
    description: 'Gimbal del drone se encuentra en buen estado y funcional',
    optimal: 'SI',
  },
  {
    code: '1.8',
    section: '1. DRONE',
    description: 'Cámara del drone se encuentra limpia, sin rayones en el lente',
    optimal: 'SI',
  },

  // 2. CONTROL REMOTO
  {
    code: '2.1',
    section: '2. CONTROL REMOTO',
    description: 'Estado general del control y todos los botones funcionan',
    optimal: 'SI',
  },
  {
    code: '2.2',
    section: '2. CONTROL REMOTO',
    description: 'Carcasa del control presenta golpes o grietas',
    optimal: 'NO',
  },
  {
    code: '2.3',
    section: '2. CONTROL REMOTO',
    description: 'Se ajustan las frecuencias y se verifica el funcionamiento de la señal del control',
    optimal: 'SI',
  },
  {
    code: '2.4',
    section: '2. CONTROL REMOTO',
    description: 'Antenas del control se encuentran en buen estado y funcionales',
    optimal: 'SI',
  },
  {
    code: '2.5',
    section: '2. CONTROL REMOTO',
    description: 'Batería del control cuenta con suficiente nivel de carga',
    optimal: 'SI',
  },
  {
    code: '2.6',
    section: '2. CONTROL REMOTO',
    description: 'Soporte de celular o tablet del control se encuentra limpio',
    optimal: 'SI',
  },

  // 3. CABLES
  {
    code: '3.1',
    section: '3. CABLES',
    description: 'Cables de datos se encuentran en buen estado sin empalmes, sin grietas',
    optimal: 'SI',
  },
  {
    code: '3.2',
    section: '3. CABLES',
    description: 'Los pines de los cables se encuentran en buen estado',
    optimal: 'SI',
  },

  // 4. CARGADOR
  {
    code: '4.1',
    section: '4. CARGADOR',
    description: 'Cargador se encuentra en buen estado',
    optimal: 'SI',
  },
  {
    code: '4.2',
    section: '4. CARGADOR',
    description: 'Cable del cargador se encuentra en buen estado sin empalmes o fisuras',
    optimal: 'SI',
  },
  {
    code: '4.3',
    section: '4. CARGADOR',
    description: 'Pines de carga del cargador están en buen estado',
    optimal: 'SI',
  },

  // 5. BATERÍAS
  {
    code: '5.1',
    section: '5. BATERÍAS',
    description: 'Batería 1 en buen estado sin grietas o fisuras',
    optimal: 'SI',
  },
  {
    code: '5.2',
    section: '5. BATERÍAS',
    description: 'Batería 2 en buen estado sin grietas o fisuras',
    optimal: 'SI',
  },
  {
    code: '5.3',
    section: '5. BATERÍAS',
    description: 'Batería 3 en buen estado sin grietas o fisuras',
    optimal: 'SI',
  },

  // 6. ACCESORIOS Y HÉLICES
  {
    code: '6.1',
    section: '6. ACCESORIOS Y HÉLICES',
    description: 'Micro SD y adaptador en funcionamiento',
    optimal: 'SI',
  },
  {
    code: '6.2',
    section: '6. ACCESORIOS Y HÉLICES',
    description: 'Soportes de cámara y del drone se encuentran en buen estado',
    optimal: 'SI',
  },
  {
    code: '6.3',
    section: '6. ACCESORIOS Y HÉLICES',
    description: 'Cable convertidor USB a Micro USB en buen estado y funcional',
    optimal: 'SI',
  },
  {
    code: '6.4',
    section: '6. ACCESORIOS Y HÉLICES',
    description: 'Hélices en buen estado y funcionales',
    optimal: 'SI',
  },
];

export const ESTACION_TOTAL_SECTIONS = [
  '1. ESTACIÓN TOTAL',
  '2. CARGADOR Y BATERÍAS',
  '3. ACCESORIOS',
] as const;

export const ESTACION_TOTAL_ITEMS: DroneInspectionItemDef[] = [
  // 1. ESTACION TOTAL
  { code: '1.1', section: '1. ESTACIÓN TOTAL', description: 'Estado general del equipo: todos los componentes funcionan', optimal: 'SI' },
  { code: '1.2', section: '1. ESTACIÓN TOTAL', description: 'La carcasa presenta golpes o grietas', optimal: 'NO' },
  { code: '1.3', section: '1. ESTACIÓN TOTAL', description: 'Los lentes se encuentran limpios y sin rayones', optimal: 'SI' },
  { code: '1.4', section: '1. ESTACIÓN TOTAL', description: 'Los tornillos de giro se encuentran suaves y funcionales', optimal: 'SI' },
  { code: '1.5', section: '1. ESTACIÓN TOTAL', description: 'Sistemas de conexión (puertos) están en buen estado', optimal: 'SI' },
  { code: '1.6', section: '1. ESTACIÓN TOTAL', description: 'El equipo se encuentra limpio', optimal: 'SI' },
  { code: '1.7', section: '1. ESTACIÓN TOTAL', description: 'El display se encuentra en buen estado', optimal: 'SI' },
  { code: '1.8', section: '1. ESTACIÓN TOTAL', description: 'La base nivelante limpia y en buen estado', optimal: 'SI' },

  // 2. CARGADOR Y BATERIAS
  { code: '2.1', section: '2. CARGADOR Y BATERÍAS', description: 'Cable se encuentra en buen estado sin empalmes o fisuras', optimal: 'SI' },
  { code: '2.2', section: '2. CARGADOR Y BATERÍAS', description: 'El enchufe del cable está en buen estado', optimal: 'SI' },
  { code: '2.3', section: '2. CARGADOR Y BATERÍAS', description: 'La batería está en buen estado', optimal: 'SI' },

  // 3. ACCESORIOS
  { code: '3.1', section: '3. ACCESORIOS', description: 'Trípode en buen estado', optimal: 'SI' },
  { code: '3.2', section: '3. ACCESORIOS', description: 'Bastón en buen estado', optimal: 'SI' },
  { code: '3.3', section: '3. ACCESORIOS', description: 'Prisma en buen estado', optimal: 'SI' },
  { code: '3.4', section: '3. ACCESORIOS', description: 'Fundas y maletas en buen estado', optimal: 'SI' },
];

/**
 * Clasificador lingüístico de condiciones seguras HSEQ:
 * - Si la pregunta evalúa operatividad, limpieza, suavidad o buen estado -> Condición segura y óptima es 'SI'.
 * - Si la pregunta contiene frases preposicionales como 'sin daños', 'sin fisuras', 'sin empalmes' -> Condición segura y óptima es 'SI'.
 * - Solo si la pregunta indaga directamente por la presencia o existencia de defectos ('presenta golpes', 'presenta fisuras', 'presenta corrosión') -> Condición segura y óptima es 'NO'.
 */
export function inferOptimalResponse(itemDescription: string): 'SI' | 'NO' {
  const norm = itemDescription
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 1. Detección de descriptores de operatividad y buen estado (siempre 'SI')
  const positiveWords = [
    'buen estado', 'funciona', 'funcional', 'limpio', 'limpia',
    'operativo', 'operativa', 'suave', 'suaves', 'adecuado', 'adecuada',
    'suficiente', 'completo', 'completa', 'ajustado', 'ajustada',
    'alineado', 'alineada', 'calibrado', 'calibrada', 'legible', 'intacto', 'intacta'
  ];

  for (const pw of positiveWords) {
    if (norm.includes(pw)) {
      return 'SI';
    }
  }

  // 2. Detección de ausencia de fallas (ej. "sin empalmes o fisuras", "sin rayones", "libre de")
  if (
    norm.includes('sin ') ||
    norm.includes('libre de') ||
    norm.includes('no presenta') ||
    norm.includes('sin signos')
  ) {
    return 'SI';
  }

  // 3. Consultas directas de presencia de fallas, averías o daños ('NO')
  const defectKeywords = [
    'corrosi', 'oxid', 'golpe', 'grieta', 'fisur', 'fuga', 'averi', 'holgur',
    'calentamient', 'derram', 'rotur', 'cortocircuit', 'deformaci',
    'dañado', 'dañada', 'dañados', 'averiado', 'averiada', 'defectuoso', 'defectuosa',
    'piezas rotas', 'cables rotos'
  ];

  for (const dw of defectKeywords) {
    if (norm.includes(dw)) {
      return 'NO';
    }
  }

  const defectPhrases = [
    'presenta', 'presentan', 'presenten', 'presencia de', 'se evidencia', 'se evidencian'
  ];

  for (const dp of defectPhrases) {
    if (norm.includes(dp)) {
      return 'NO';
    }
  }

  return 'SI';
}

export function getOptimalResponses(
  formatTypeOrCodeOrItems: string | DroneInspectionItemDef[] = 'drone'
): Record<string, 'SI' | 'NO' | 'NA'> {
  if (Array.isArray(formatTypeOrCodeOrItems)) {
    const map: Record<string, 'SI' | 'NO' | 'NA'> = {};
    for (const item of formatTypeOrCodeOrItems) {
      map[item.code] = item.optimal || 'SI';
    }
    return map;
  }

  const norm = String(formatTypeOrCodeOrItems || '').toLowerCase();

  // 1. Estación Total (FOR-HSEQ-025)
  if (norm.includes('025') || norm.includes('estacion')) {
    const map: Record<string, 'SI' | 'NO' | 'NA'> = {};
    for (const item of ESTACION_TOTAL_ITEMS) {
      map[item.code] = item.optimal;
    }
    return map;
  }

  // 2. Georadar / GPR (FOR-HSEQ-027) -> En Georadar GPR todas las respuestas óptimas son estrictamente 'SI'
  if (norm.includes('027') || norm.includes('gpr') || norm.includes('georadar')) {
    const map: Record<string, 'SI' | 'NO' | 'NA'> = {};
    for (let sec = 1; sec <= 10; sec++) {
      for (let item = 1; item <= 20; item++) {
        map[`${sec}.${item}`] = 'SI';
      }
    }
    return map;
  }

  // 3. GPS Diferencial GNSS (FOR-HSEQ-026) -> 1.4 es 'SI', 3.1 es 'NO', 1.2 es 'NO', 2.2 es 'NO', resto 'SI'
  if (norm.includes('026') || norm.includes('gps') || norm.includes('gnss')) {
    const map: Record<string, 'SI' | 'NO' | 'NA'> = {};
    for (let sec = 1; sec <= 10; sec++) {
      for (let item = 1; item <= 20; item++) {
        map[`${sec}.${item}`] = 'SI';
      }
    }
    map['1.2'] = 'NO';
    map['1.4'] = 'SI';
    map['2.2'] = 'NO';
    map['3.1'] = 'NO';
    return map;
  }

  // 4. Localizador de Tuberías (FOR-HSEQ-028)
  if (norm.includes('028') || norm.includes('localizador')) {
    const map: Record<string, 'SI' | 'NO' | 'NA'> = {};
    for (let sec = 1; sec <= 10; sec++) {
      for (let item = 1; item <= 20; item++) {
        map[`${sec}.${item}`] = 'SI';
      }
    }
    map['1.2'] = 'NO';
    map['2.2'] = 'NO';
    return map;
  }

  // 5. Drone (FOR-HSEQ-024)
  const map: Record<string, 'SI' | 'NO' | 'NA'> = {};
  for (const item of DRONE_INSPECTION_ITEMS) {
    map[item.code] = item.optimal;
  }
  return map;
}

export interface HseqFormatConfig {
  id: string;
  formatType: 'drone' | 'estacion_total' | 'generic';
  code: string;
  title: string;
  pdfTitle: string;
  version: string;
  division: 'Mapping' | 'Ingeniería';
  equipmentName: string;
  equipmentLabel: string;
  defaultEquipment: string;
  defaultSerial: string;
  sections: readonly string[];
  items: DroneInspectionItemDef[];
  isDynamic?: boolean;
  templateDate?: string;
}

export function getHseqFormatConfig(formatIdentifier = ''): HseqFormatConfig {
  const norm = formatIdentifier.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (norm.includes('estacion') || norm.includes('total') || norm.includes('025') || norm.includes('ts')) {
    return {
      id: 'hseq-estacion-total',
      formatType: 'estacion_total',
      code: 'FOR-HSEQ-025',
      title: 'INSPECCIÓN PRE-OPERACIONAL DE ESTACIÓN TOTAL',
      pdfTitle: 'INSPECCIÓN PRE-OPERACIONAL ESTACIÓN TOTAL',
      version: '01',
      division: 'Ingeniería',
      equipmentName: 'Estación Total',
      templateDate: '10-sep-2026',
      equipmentLabel: 'Estación Total',
      defaultEquipment: 'Leica FlexLine TS07',
      defaultSerial: '',
      sections: ESTACION_TOTAL_SECTIONS,
      items: ESTACION_TOTAL_ITEMS,
    };
  }

  if (norm.includes('gpr') || norm.includes('georadar') || norm.includes('027')) {
    return {
      id: 'hseq-georadar',
      formatType: 'generic',
      code: 'FOR-HSEQ-027',
      title: 'INSPECCIÓN PRE-OPERACIONAL DE GEORADAR (GPR)',
      pdfTitle: 'INSPECCIÓN PRE-OPERACIONAL GEORADAR GPR',
      version: '01',
      division: 'Mapping',
      equipmentName: 'Georadar (GPR)',
      templateDate: '10-sep-2026',
      equipmentLabel: 'Georadar GPR',
      defaultEquipment: 'Sensors & Software Noggin',
      defaultSerial: '',
      sections: ['1. ESTRUCTURA Y RUEDAS', '2. ANTENA Y AKULA', '3. COMPUTADORA Y CONTROL'],
      items: [
        { code: '1.1', section: '1. ESTRUCTURA Y RUEDAS', description: 'Chasis y estructura en buen estado general', optimal: 'SI' },
        { code: '1.2', section: '1. ESTRUCTURA Y RUEDAS', description: 'Ruedas giran suavemente y odómetro funciona', optimal: 'SI' },
        { code: '2.1', section: '2. ANTENA Y AKULA', description: 'Antena GPR limpia y sin roturas en la base', optimal: 'SI' },
        { code: '2.2', section: '2. ANTENA Y AKULA', description: 'Unidad Akula enciende y conecta correctamente', optimal: 'SI' },
        { code: '3.1', section: '3. COMPUTADORA Y CONTROL', description: 'Computador o tablet operativa con suficiente carga', optimal: 'SI' },
        { code: '3.2', section: '3. COMPUTADORA Y CONTROL', description: 'Cables de datos sin empalmes o fisuras', optimal: 'SI' },
      ],
    };
  }

  if (norm.includes('gps') || norm.includes('gnss') || norm.includes('026')) {
    return {
      id: 'hseq-gps-diferencial',
      formatType: 'generic',
      code: 'FOR-HSEQ-026',
      title: 'INSPECCIÓN PRE-OPERACIONAL DE GPS',
      pdfTitle: 'INSPECCIÓN PRE-OPERACIONAL GPS DIFERENCIAL GNSS',
      version: '01',
      division: 'Ingeniería',
      equipmentName: 'GPS Diferencial (GNSS)',
      templateDate: '10-sep-2026',
      equipmentLabel: 'GPS Diferencial',
      defaultEquipment: 'Trimble R12 / R10',
      defaultSerial: '',
      sections: ['1. RECEPTOR BASE Y ROVER', '2. COLECTORA DE DATOS', '3. BATERÍAS Y ACCESORIOS'],
      items: [
        { code: '1.1', section: '1. RECEPTOR BASE Y ROVER', description: 'Receptores encienden y reciben señal satelital', optimal: 'SI' },
        { code: '1.2', section: '1. RECEPTOR BASE Y ROVER', description: 'Carcasa presenta golpes o fisuras', optimal: 'NO' },
        { code: '2.1', section: '2. COLECTORA DE DATOS', description: 'Colectora en buen estado y software operativo', optimal: 'SI' },
        { code: '3.1', section: '3. BATERÍAS Y ACCESORIOS', description: 'Baterías cargadas y en buen estado', optimal: 'SI' },
        { code: '3.2', section: '3. BATERÍAS Y ACCESORIOS', description: 'Trípode y bastón firmes y funcionales', optimal: 'SI' },
      ],
    };
  }

  if (norm.includes('localizador') || norm.includes('tuber') || norm.includes('028') || norm.includes('rd8100')) {
    return {
      id: 'hseq-localizador-tuberias',
      formatType: 'generic',
      code: 'FOR-HSEQ-028',
      title: 'INSPECCIÓN PRE-OPERACIONAL DE LOCALIZADOR ELECTROMAGNÉTICO',
      pdfTitle: 'INSPECCIÓN PRE-OPERACIONAL LOCALIZADOR DE TUBERÍAS',
      version: '01',
      division: 'Ingeniería',
      equipmentName: 'Localizador de Tuberías (RD8100)',
      templateDate: '10-sep-2026',
      equipmentLabel: 'Localizador de Tuberías',
      defaultEquipment: 'Radiodetection RD8100',
      defaultSerial: '',
      sections: ['1. TRANSMISOR (TX)', '2. RECEPTOR (RX)', '3. CABLES Y ACCESORIOS'],
      items: [
        { code: '1.1', section: '1. TRANSMISOR (TX)', description: 'Transmisor enciende y modula frecuencias correctamente', optimal: 'SI' },
        { code: '1.2', section: '1. TRANSMISOR (TX)', description: 'Carcasa presenta golpes o roturas', optimal: 'NO' },
        { code: '2.1', section: '2. RECEPTOR (RX)', description: 'Receptor enciende, pantalla legible y altavoz funciona', optimal: 'SI' },
        { code: '2.2', section: '2. RECEPTOR (RX)', description: 'Receptor presenta golpes, fisuras o anomalías', optimal: 'NO' },
        { code: '3.1', section: '3. CABLES Y ACCESORIOS', description: 'Pinzas de conexión y cables en buen estado', optimal: 'SI' },
      ],
    };
  }

  // Por defecto / Drone
  return {
    id: 'hseq-drone-preoperational',
    formatType: 'drone',
    code: 'FOR-HSEQ-024',
    title: 'INSPECCIÓN PRE-OPERACIONAL DE DRONE',
    pdfTitle: 'INSPECCIÓN PRE-OPERACIONAL DRONE',
    version: '2',
    division: 'Mapping',
    equipmentName: 'Drone',
    templateDate: '16-sep-2026',
    equipmentLabel: 'Drone',
    defaultEquipment: 'DJI Mavic 3 Enterprise',
    defaultSerial: '',
    sections: DRONE_INSPECTION_SECTIONS,
    items: DRONE_INSPECTION_ITEMS,
  };
}

export interface HseqPdfGenerationPayload {
  formatTitle?: string;
  formatCode?: string;
  version?: string;
  templateVersion?: string;
  templateDate?: string;
  equipmentLabel?: string;
  equipmentName?: string;

  projectName: string;
  costCenter: string;
  location: string;
  inspectionDate: string;
  droneBrandModel?: string;
  droneSerial?: string;
  equipmentBrandModel?: string;
  equipmentSerial?: string;
  serialAkula?: string;
  serialComputadora?: string;
  items?: DroneInspectionItemDef[];
  itemsResponses: Record<string, 'SI' | 'NO' | 'NA'>;
  criticalPoint?: string;
  generalObservations?: string;
  operatorName: string;
  operatorSignatureDataUrl: string;
  sstaName: string;
  sstaSignatureDataUrl: string;
}

export type DronePdfGenerationPayload = HseqPdfGenerationPayload;

