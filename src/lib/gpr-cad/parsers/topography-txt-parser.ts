/**
 * PARSER DE ARCHIVOS DE TOPOGRAFÍA Y ESTACIÓN TOTAL (.TXT / .CSV)
 * Plataforma PROCIMEC INGENIERÍA S.A.S. — PCM CLOUD
 * 
 * Soporta formatos de campo:
 * 1. 6 Columnas con prefijo de trabajo: [TAG/DISCARD] [PUNTO] [NORTE] [ESTE] [COTA] [DESCRIPCIÓN]
 *    Ejemplo real PROCIMEC: "08TP  511  104288.639  101279.584  2571.245  AP-0.90-12"
 * 2. 5 Columnas canónicas: [PUNTO] [NORTE] [ESTE] [COTA] [DESCRIPCIÓN]
 * 3. Detección automática de traslados de estación, deltas, bases GPS, perfiles GPR y redes.
 */

export type TopoCategory = 
  | 'eje' 
  | 'borde' 
  | 'gpr_profile' 
  | 'gas' 
  | 'acueducto' 
  | 'alcantarillado' 
  | 'telecom' 
  | 'energia' 
  | 'estacion_delta' 
  | 'poste' 
  | 'punto';

export interface TopoStationSetup {
  stationId: string;        // Nombre de la estación armada (e.g. "GPS-1-PLACA", "AUX-01-VIA")
  north: number;            // Coordenada Norte
  east: number;             // Coordenada Este
  elevation: number;        // Cota Z
  instrumentHeight?: number;// Altura instrumental en metros (e.g. 1.610 m)
  code: string;             // Código (e.g. "ST")
  rawLine?: string;
}

export interface TopoPoint {
  id: string;             // Identificador consecutivo real (e.g. "1", "511", "544")
  north: number;          // Norte (Coordenada Y en AutoCAD)
  east: number;           // Este (Coordenada X en AutoCAD)
  elevation: number;      // Cota / Elevación Z
  code: string;           // Código técnico original (e.g. "AP-0.90-12", "RG", "P-21-I", "GPS-01-PLA-JM")
  category: TopoCategory;
  layerName: string;
  isStationSetup: boolean; // Verdadero si corresponde a un traslado de estación / delta / base
  depth?: number;         // Profundidad extraída del código (e.g. 0.90 en AP-0.90-12)
  diameter?: string;      // Diámetro o ductos extraídos (e.g. 12" en AP-0.90-12 o 4 vías en FO-0.80-4)
  rawLine?: string;
}

export interface TopographyDataset {
  points: TopoPoint[];              // Colección principal de puntos radiados (08TP, e.g. 544 puntos)
  axisPoints: TopoPoint[];          // Puntos que definen el eje vial de exploración (VIA)
  boundaryPoints: TopoPoint[];      // Puntos de andén y borde de vía (AND, OBRA)
  gprProfilePoints: TopoPoint[];    // Pasadas de Georradar (P-01-I a P-64-I)
  stationPoints: TopoPoint[];       // Puntos de control, deltas y estaciones ocupadas
  stationSetups: TopoStationSetup[];// Traslados de estación ocupada con altura instrumental (02TP)
  utilityPoints: TopoPoint[];       // Puntos de servicios públicos e interferencias
  bounds: {
    minEast: number;
    maxEast: number;
    minNorth: number;
    maxNorth: number;
    minElev: number;
    maxElev: number;
    width: number;
    height: number;
  };
  totalAxisLength: number;
  detectedCodes: string[];
}

/**
 * Normaliza y limpia una línea de texto removiendo BOM y caracteres de control (e.g. \x02 STX)
 */
function cleanLine(line: string): string {
  return line
    .replace(/^\uFEFF/, '')
    .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, ' ')
    .trim();
}

/**
 * Determina si una línea es encabezado de columnas (e.g., "PUNTO, NORTE, ESTE, COTA, DESCRIPCION")
 */
function isHeaderLine(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    lower.includes('punto') ||
    lower.includes('point') ||
    lower.includes('norte') ||
    lower.includes('north') ||
    lower.includes('este') ||
    lower.includes('east') ||
    lower.includes('cota') ||
    lower.includes('elev') ||
    lower.includes('desc') ||
    lower.includes('code')
  );
}

/**
 * Divide una línea en tokens según delimitador común (, ; \t o espacios múltiples)
 */
function tokenizeLine(line: string): string[] {
  if (line.includes(',')) {
    return line.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
  } else if (line.includes(';')) {
    return line.split(';').map((t) => t.trim()).filter((t) => t.length > 0);
  } else if (line.includes('\t')) {
    return line.split('\t').map((t) => t.trim()).filter((t) => t.length > 0);
  }
  return line.split(/\s+/).map((t) => t.trim()).filter((t) => t.length > 0);
}

/**
 * Clasifica un código de campo en su categoría y capa técnica correspondiente
 */
function classifyCode(codeStr: string): {
  category: TopoCategory;
  layerName: string;
  isStationSetup: boolean;
  depth?: number;
  diameter?: string;
} {
  const norm = (codeStr || '').trim().toUpperCase();

  // 1. TRASLADOS DE ESTACIÓN / DELTAS / BASES GPS
  // Ejemplo: "GPS-01-PLA-JM", "GPS-2-PLA-MR", "AUX-01-VIA", "DELTA-1", "D-01", "EST-1", "BASE", "OCC", "BS", "ST"
  if (
    norm.startsWith('GPS-') ||
    norm.startsWith('EST') ||
    norm.startsWith('STN') ||
    norm.startsWith('BASE') ||
    norm.startsWith('DELTA') ||
    norm.startsWith('D-') ||
    norm.startsWith('AUX-') ||
    norm.includes('TRALADO') ||
    norm.includes('TRASLADO') ||
    norm === 'BS' ||
    norm === 'OCC' ||
    norm === 'BK' ||
    norm === 'ST'
  ) {
    return {
      category: 'estacion_delta',
      layerName: 'ESTACIONES_DELTA',
      isStationSetup: true,
    };
  }

  // 2. PERFILES / PASADAS DE GEORRADAR (GPR)
  // Ejemplo: "P-21-I", "P-20-I", "P-08-I", "P-01-I"
  if (/^P-\d+(-[A-Z0-9]+)?$/.test(norm)) {
    return {
      category: 'gpr_profile',
      layerName: 'PERFILES_GPR',
      isStationSetup: false,
    };
  }

  // 3. AGUA POTABLE / ACUEDUCTO
  // Ejemplo: "AP-0.90-12", "AP-1.10-8", "AP-0.40.-4", "AP-1.10.8", "ACUEDUCTO", "AGUA"
  if (norm.startsWith('AP-') || norm.startsWith('AP') || norm.includes('AGUA') || norm.includes('ACUEDUCTO')) {
    const match = norm.match(/^AP[-_.]?(\d+(?:\.\d+)?)[-_.]?(\d+(?:\.\d+)?)?/);
    return {
      category: 'acueducto',
      layerName: 'RED_ACUEDUCTO',
      isStationSetup: false,
      depth: match && match[1] ? parseFloat(match[1]) : undefined,
      diameter: match && match[2] ? `${match[2]}"` : undefined,
    };
  }

  // 4. ALCANTARILLADO / AGUAS LLUVIAS / REDES HÚMEDAS / POZOS
  // Ejemplo: "AR-1.20-18", "ALL-0.50-10", "MH", "ALC", "PLUVIAL", "SANITARIO"
  if (
    norm.startsWith('AR-') ||
    norm.startsWith('AR') ||
    norm.startsWith('ALL-') ||
    norm.startsWith('ALL') ||
    norm === 'MH' ||
    norm.includes('ALC') ||
    norm.includes('PLUV') ||
    norm.includes('SAN')
  ) {
    const match = norm.match(/^(?:AR|ALL)[-_.]?(\d+(?:\.\d+)?)[-_.]?(\d+(?:\.\d+)?)?/);
    return {
      category: 'alcantarillado',
      layerName: 'RED_ALCANTARILLADO',
      isStationSetup: false,
      depth: match && match[1] ? parseFloat(match[1]) : undefined,
      diameter: match && match[2] ? `${match[2]}"` : (norm === 'MH' ? 'Pozo Manhole' : undefined),
    };
  }

  // 5. RED DE GAS
  // Ejemplo: "RG", "GAS", "RED_GAS"
  if (norm === 'RG' || norm.startsWith('RG-') || norm.includes('GAS')) {
    return {
      category: 'gas',
      layerName: 'RED_GAS',
      isStationSetup: false,
    };
  }

  // 6. FIBRA ÓPTICA / TELECOMUNICACIONES / BANCADAS
  // Ejemplo: "FO-0.80-4", "FO-0.60-4-2X2", "FO-0.35-4-BAN", "BAN-0.85-4", "VAC-0.15-4", "TELECOM"
  if (
    norm.startsWith('FO-') ||
    norm.startsWith('FO') ||
    norm.startsWith('BAN-') ||
    norm.startsWith('VAC-') ||
    norm.includes('TEL') ||
    norm.includes('FIBRA') ||
    norm.includes('DATOS')
  ) {
    const match = norm.match(/^(?:FO|BAN|VAC)[-_.]?(\d+(?:\.\d+)?)[-_.]?(\d+(?:\.\d+)?)?(?:[-_.]?(.*))?$/);
    const config = match && match[3] ? ` (${match[3]})` : '';
    return {
      category: 'telecom',
      layerName: 'RED_TELECOM',
      isStationSetup: false,
      depth: match && match[1] ? parseFloat(match[1]) : undefined,
      diameter: match && match[2] ? `${match[2]} ductos${config}` : (norm.startsWith('BAN') ? 'Bancada' : undefined),
    };
  }

  // 7. ENERGÍA ELÉCTRICA
  // Ejemplo: "ELE-0.50-4", "ELE-0.65-4-3X2", "EE", "MT", "BT", "ENERGIA", "ELEC"
  if (
    norm.startsWith('ELE-') ||
    norm.startsWith('ELE') ||
    norm === 'EE' ||
    norm.includes('ENER') ||
    norm.includes('ELEC') ||
    norm === 'MT' ||
    norm === 'BT'
  ) {
    const match = norm.match(/^ELE[-_.]?(\d+(?:\.\d+)?)[-_.]?(\d+(?:\.\d+)?)?(?:[-_.]?(.*))?$/);
    const config = match && match[3] ? ` (${match[3]})` : '';
    return {
      category: 'energia',
      layerName: 'RED_ENERGIA',
      isStationSetup: false,
      depth: match && match[1] ? parseFloat(match[1]) : undefined,
      diameter: match && match[2] ? `${match[2]} ductos${config}` : undefined,
    };
  }

  // 8. ANDÉN / BORDE DE VÍA / LÍMITES DE OBRA
  // Ejemplo: "AND", "OBRA", "ANDEN", "BORDE", "SARDINEL", "IZQ", "DER"
  if (
    norm === 'AND' ||
    norm === 'OBRA' ||
    norm.includes('ANDEN') ||
    norm.includes('BORDE') ||
    norm.includes('SARD') ||
    norm.includes('IZQ') ||
    norm.includes('DER')
  ) {
    return {
      category: 'borde',
      layerName: 'BORDE_EXPLORACION',
      isStationSetup: false,
    };
  }

  // 9. VÍA / CALZADA / EJE
  // Ejemplo: "VIA", "EJE", "EJE_VIA", "CALZADA", "CL"
  if (norm === 'VIA' || norm.includes('EJE') || norm.includes('ALIN') || norm.includes('CALZADA') || norm === 'CL') {
    return {
      category: 'eje',
      layerName: 'EJE_VIA',
      isStationSetup: false,
    };
  }

  // 10. POSTES / MOBILIARIO / VÁLVULAS
  // Ejemplo: "PST", "LAMP", "POSTE", "T-V", "CAMARA", "VALVULA"
  if (norm === 'PST' || norm === 'LAMP' || norm === 'T-V' || norm.includes('POSTE')) {
    return {
      category: 'poste',
      layerName: 'POSTES_URBANISMO',
      isStationSetup: false,
    };
  }

  return {
    category: 'punto',
    layerName: 'PUNTOS_TOPOGRAFIA',
    isStationSetup: false,
  };
}

/**
 * Parsea el contenido en texto plano de un archivo de Estación Total (.TXT / SDR33 / CSV)
 */
export function parseTopographyTxt(rawText: string): TopographyDataset {
  if (!rawText || typeof rawText !== 'string') {
    return createEmptyDataset();
  }

  const rawLines = rawText.split(/\r?\n/);
  const surveyPoints: TopoPoint[] = [];
  const stationSetups: TopoStationSetup[] = [];
  const codeSet = new Set<string>();

  for (let i = 0; i < rawLines.length; i++) {
    const line = cleanLine(rawLines[i]);
    if (!line || line.startsWith('#') || line.startsWith('//')) {
      continue;
    }

    if (i === 0 && isHeaderLine(line)) {
      continue; // Omitir fila de encabezados si existe
    }

    // Omitir líneas de metadatos de instrumento / trabajo en formato SDR33 (e.g. 00NM, 10NM, 06NM, 01NM, 03NM)
    if (/^\d\dNM/i.test(line)) {
      continue;
    }

    // Omitir líneas de lectura angular de vista atrás (07TP) ya que no son coordenadas 3D de terreno
    if (/^07TP/i.test(line)) {
      continue;
    }

    const tokens = tokenizeLine(line);
    if (tokens.length < 3) {
      continue;
    }

    const tag0 = tokens[0].toUpperCase();

    // ─────────────────────────────────────────────────────────────────────────
    // CASO 1: REGISTRO 02TP — ESTACIÓN ARMADA / TRASLADO DE ESTACIÓN
    // Formato: 02TP  <STATION_ID>  <NORTE>  <ESTE>  <COTA>  <HI>  ST
    // ─────────────────────────────────────────────────────────────────────────
    if (tag0 === '02TP') {
      const stationId = tokens[1];
      const north = parseFloat(tokens[2]);
      const east = parseFloat(tokens[3]);
      const elevation = parseFloat(tokens[4]);
      const hi = tokens[5] ? parseFloat(tokens[5]) : undefined;
      const code = tokens.slice(6).join(' ') || 'ST';

      if (!isNaN(north) && !isNaN(east) && !isNaN(elevation)) {
        stationSetups.push({
          stationId,
          north,
          east,
          elevation,
          instrumentHeight: !isNaN(hi as number) ? hi : undefined,
          code,
          rawLine: line,
        });
      }
      continue;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CASO 2: REGISTRO 08TP — PUNTOS RADIADOS / LEVANTAMIENTO TOPOGRÁFICO
    // Formato real PROCIMEC: 08TP  <PUNTO_ID>  <NORTE>  <ESTE>  <COTA>  <DESCRIPCIÓN>
    // La primera columna (08TP) es el identificador del registro y NO se debe contar como punto!
    // El consecutivo real del punto es tokens[1] (e.g. 1 a 544).
    // ─────────────────────────────────────────────────────────────────────────
    if (tag0 === '08TP') {
      const pointId = tokens[1];
      const north = parseFloat(tokens[2]);
      const east = parseFloat(tokens[3]);
      const elevation = parseFloat(tokens[4]);
      const code = tokens.slice(5).join(' ').trim() || 'PUNTO';

      if (!isNaN(north) && !isNaN(east) && !isNaN(elevation)) {
        const cls = classifyCode(code);
        codeSet.add(code);
        surveyPoints.push({
          id: pointId,
          north,
          east,
          elevation,
          code,
          category: cls.category,
          layerName: cls.layerName,
          isStationSetup: cls.isStationSetup,
          depth: cls.depth,
          diameter: cls.diameter,
          rawLine: line,
        });
      }
      continue;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CASO 3: FORMATO GENERAL DE 6 O 5 COLUMNAS (Archivos exportados o CSV)
    // ─────────────────────────────────────────────────────────────────────────
    const nFromCol2 = parseFloat(tokens[2]);
    const eFromCol3 = parseFloat(tokens[3]);
    const zFromCol4 = parseFloat(tokens[4]);

    const nFromCol1 = parseFloat(tokens[1]);
    const eFromCol2 = parseFloat(tokens[2]);
    const zFromCol3 = parseFloat(tokens[3]);

    if (tokens.length >= 5 && !isNaN(nFromCol2) && !isNaN(eFromCol3) && !isNaN(zFromCol4)) {
      // 6 columnas: Primera columna de prefijo descartable, punto en col 1
      const pointId = tokens[1];
      const code = tokens.slice(5).join(' ').trim() || 'PUNTO';
      const cls = classifyCode(code);
      codeSet.add(code);

      surveyPoints.push({
        id: pointId,
        north: nFromCol2,
        east: eFromCol3,
        elevation: zFromCol4,
        code,
        category: cls.category,
        layerName: cls.layerName,
        isStationSetup: cls.isStationSetup,
        depth: cls.depth,
        diameter: cls.diameter,
        rawLine: line,
      });
    } else if (tokens.length >= 4 && !isNaN(nFromCol1) && !isNaN(eFromCol2)) {
      // 5 columnas canónico: Punto en col 0, Norte en col 1, Este en col 2
      const pointId = tokens[0];
      const code = tokens.slice(4).join(' ').trim() || 'PUNTO';
      const cls = classifyCode(code);
      codeSet.add(code);

      surveyPoints.push({
        id: pointId,
        north: nFromCol1,
        east: eFromCol2,
        elevation: !isNaN(zFromCol3) ? zFromCol3 : 0.0,
        code,
        category: cls.category,
        layerName: cls.layerName,
        isStationSetup: cls.isStationSetup,
        depth: cls.depth,
        diameter: cls.diameter,
        rawLine: line,
      });
    } else {
      // Formato numérico mínimo N, E, Z
      const num0 = parseFloat(tokens[0]);
      const num1 = parseFloat(tokens[1]);
      const num2 = parseFloat(tokens[2]);

      if (!isNaN(num0) && !isNaN(num1) && !isNaN(num2)) {
        const pointId = `${surveyPoints.length + 1}`;
        surveyPoints.push({
          id: pointId,
          north: num0,
          east: num1,
          elevation: num2,
          code: 'PUNTO',
          category: 'punto',
          layerName: 'PUNTOS_TOPOGRAFIA',
          isStationSetup: false,
          rawLine: line,
        });
      }
    }
  }

  if (surveyPoints.length === 0 && stationSetups.length === 0) {
    return createEmptyDataset();
  }

  // Clasificación en colecciones técnicas
  const axisPoints: TopoPoint[] = [];
  const boundaryPoints: TopoPoint[] = [];
  const gprProfilePoints: TopoPoint[] = [];
  const stationPoints: TopoPoint[] = [];
  const utilityPoints: TopoPoint[] = [];

  // Agregar las estaciones ocupadas (02TP) a la colección de estaciones y deltas
  stationSetups.forEach((setup) => {
    stationPoints.push({
      id: setup.stationId,
      north: setup.north,
      east: setup.east,
      elevation: setup.elevation,
      code: `ESTACION: ${setup.stationId}`,
      category: 'estacion_delta',
      layerName: 'ESTACIONES_DELTA',
      isStationSetup: true,
      rawLine: setup.rawLine,
    });
  });

  // Clasificar cada punto radiado del levantamiento
  surveyPoints.forEach((pt) => {
    if (pt.isStationSetup) {
      stationPoints.push(pt);
    } else if (pt.category === 'eje') {
      axisPoints.push(pt);
    } else if (pt.category === 'borde') {
      boundaryPoints.push(pt);
    } else if (pt.category === 'gpr_profile') {
      gprProfilePoints.push(pt);
    } else if (
      pt.category === 'gas' ||
      pt.category === 'acueducto' ||
      pt.category === 'alcantarillado' ||
      pt.category === 'telecom' ||
      pt.category === 'energia' ||
      pt.category === 'poste'
    ) {
      utilityPoints.push(pt);
    }
  });

  // El alineamiento principal vial se toma de los puntos de eje (VIA)
  // Si no existen puntos etiquetados con VIA, se toma la secuencia de perfiles GPR o los puntos no estación
  const nonStationPoints = surveyPoints.filter((p) => !p.isStationSetup);
  const activeAxis = axisPoints.length > 0 
    ? axisPoints 
    : (gprProfilePoints.length > 0 ? gprProfilePoints : nonStationPoints);

  // Calcular límites espaciales (Bounding Box)
  let minEast = Infinity;
  let maxEast = -Infinity;
  let minNorth = Infinity;
  let maxNorth = -Infinity;
  let minElev = Infinity;
  let maxElev = -Infinity;

  const allCoords = [...surveyPoints, ...stationSetups];
  allCoords.forEach((pt) => {
    if (pt.east < minEast) minEast = pt.east;
    if (pt.east > maxEast) maxEast = pt.east;
    if (pt.north < minNorth) minNorth = pt.north;
    if (pt.north > maxNorth) maxNorth = pt.north;
    if (pt.elevation < minElev) minElev = pt.elevation;
    if (pt.elevation > maxElev) maxElev = pt.elevation;
  });

  // Calcular longitud acumulada del alineamiento
  let totalAxisLength = 0;
  for (let i = 0; i < activeAxis.length - 1; i++) {
    const p1 = activeAxis[i];
    const p2 = activeAxis[i + 1];
    const dx = p2.east - p1.east;
    const dy = p2.north - p1.north;
    const dz = p2.elevation - p1.elevation;
    totalAxisLength += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  return {
    points: surveyPoints,
    axisPoints: activeAxis,
    boundaryPoints,
    gprProfilePoints,
    stationPoints,
    stationSetups,
    utilityPoints,
    bounds: {
      minEast: isFinite(minEast) ? minEast : 0,
      maxEast: isFinite(maxEast) ? maxEast : 0,
      minNorth: isFinite(minNorth) ? minNorth : 0,
      maxNorth: isFinite(maxNorth) ? maxNorth : 0,
      minElev: isFinite(minElev) ? minElev : 0,
      maxElev: isFinite(maxElev) ? maxElev : 0,
      width: isFinite(maxEast - minEast) ? maxEast - minEast : 0,
      height: isFinite(maxNorth - minNorth) ? maxNorth - minNorth : 0,
    },
    totalAxisLength: Number(totalAxisLength.toFixed(2)),
    detectedCodes: Array.from(codeSet),
  };
}

function createEmptyDataset(): TopographyDataset {
  return {
    points: [],
    axisPoints: [],
    boundaryPoints: [],
    gprProfilePoints: [],
    stationPoints: [],
    stationSetups: [],
    utilityPoints: [],
    bounds: {
      minEast: 0,
      maxEast: 0,
      minNorth: 0,
      maxNorth: 0,
      minElev: 0,
      maxElev: 0,
      width: 0,
      height: 0,
    },
    totalAxisLength: 0,
    detectedCodes: [],
  };
}
