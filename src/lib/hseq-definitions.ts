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

export function getOptimalResponses(formatType: 'drone' | 'estacion_total' | 'generic' = 'drone'): Record<string, 'SI' | 'NO' | 'NA'> {
  const items = formatType === 'estacion_total' ? ESTACION_TOTAL_ITEMS : DRONE_INSPECTION_ITEMS;
  const map: Record<string, 'SI' | 'NO' | 'NA'> = {};
  for (const item of items) {
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
  equipmentLabel: string;
  defaultEquipment: string;
  defaultSerial: string;
  sections: readonly string[];
  items: DroneInspectionItemDef[];
}

export function getHseqFormatConfig(formatIdentifier = ''): HseqFormatConfig {
  const norm = formatIdentifier.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (norm.includes('estacion') || norm.includes('total') || norm.includes('025') || norm.includes('ts')) {
    return {
      id: 'hseq-estacion-total',
      formatType: 'estacion_total',
      code: 'FOR-HSEQ-025',
      title: 'Inspección Pre-operacional de Estación Total',
      pdfTitle: 'INSPECCIÓN PRE-OPERACIONAL ESTACIÓN TOTAL',
      version: '01',
      equipmentLabel: 'Estación Total',
      defaultEquipment: 'Leica FlexLine TS07',
      defaultSerial: 'PROC-ET-001',
      sections: ESTACION_TOTAL_SECTIONS,
      items: ESTACION_TOTAL_ITEMS,
    };
  }

  // Por defecto / Drone
  return {
    id: 'hseq-drone-preoperational',
    formatType: 'drone',
    code: 'FOR-HSEQ-024',
    title: 'Inspección Pre-operacional de Drone',
    pdfTitle: 'INSPECCIÓN PRE-OPERACIONAL DRONE',
    version: '02',
    equipmentLabel: 'Drone',
    defaultEquipment: 'DJI Mavic 3 Enterprise',
    defaultSerial: 'PROC-DRN-001',
    sections: DRONE_INSPECTION_SECTIONS,
    items: DRONE_INSPECTION_ITEMS,
  };
}

export interface HseqPdfGenerationPayload {
  formatTitle?: string;
  formatCode?: string;
  version?: string;
  equipmentLabel?: string;
  projectName: string;
  costCenter: string;
  location: string;
  inspectionDate: string;
  droneBrandModel?: string;
  droneSerial?: string;
  equipmentBrandModel?: string;
  equipmentSerial?: string;
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
