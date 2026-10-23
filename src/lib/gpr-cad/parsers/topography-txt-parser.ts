/**
 * PARSER DE ARCHIVOS DE TOPOGRAFÍA Y ESTACIÓN TOTAL (.TXT / .CSV)
 * Plataforma PROCIMEC INGENIERÍA S.A.S. — PCM CLOUD
 * Formato canónico: Punto, Norte, Este, Cota, Descripción (P, N, E, Z, D)
 * Delimitadores soportados: Coma (,), Punto y coma (;), Tabulación (\t), Espacios múltiples (\s+)
 */

export interface TopoPoint {
  id: string;             // Identificador de punto (e.g., "1", "101", "P-01")
  north: number;          // Norte (Coordenada Y en AutoCAD)
  east: number;           // Este (Coordenada X en AutoCAD)
  elevation: number;      // Cota / Elevación Z
  code: string;           // Código o descripción técnica (e.g., "EJE", "BORDE_IZQ", "GAS", "AGUA")
  rawLine?: string;
}

export interface TopographyDataset {
  points: TopoPoint[];
  axisPoints: TopoPoint[];
  boundaryPoints: TopoPoint[];
  utilityPoints: TopoPoint[];
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
 * Normaliza y limpia una línea de texto removiendo BOM y caracteres no imprimibles
 */
function cleanLine(line: string): string {
  return line
    .replace(/^\uFEFF/, '') // Quitar BOM de Windows Notepad
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
 * Divide una línea en tokens según delimitador común (, ; \t o espacios)
 */
function tokenizeLine(line: string): string[] {
  if (line.includes(',')) {
    return line.split(',').map((t) => t.trim());
  } else if (line.includes(';')) {
    return line.split(';').map((t) => t.trim());
  } else if (line.includes('\t')) {
    return line.split('\t').map((t) => t.trim());
  }
  // Espacios múltiples o sencillos
  return line.split(/\s+/).map((t) => t.trim());
}

/**
 * Parsea el contenido en texto plano de un archivo de Estación Total
 */
export function parseTopographyTxt(rawText: string): TopographyDataset {
  if (!rawText || typeof rawText !== 'string') {
    return createEmptyDataset();
  }

  const rawLines = rawText.split(/\r?\n/);
  const parsedPoints: TopoPoint[] = [];
  const codeSet = new Set<string>();

  for (let i = 0; i < rawLines.length; i++) {
    const line = cleanLine(rawLines[i]);
    if (!line || line.startsWith('#') || line.startsWith('//')) {
      continue;
    }

    if (i === 0 && isHeaderLine(line)) {
      continue; // Omitir fila de encabezados si existe
    }

    const tokens = tokenizeLine(line);
    if (tokens.length < 3) {
      continue; // Fila incompleta
    }

    let pointId = '';
    let north = 0;
    let east = 0;
    let elevation = 0;
    let code = 'PUNTO';

    if (tokens.length >= 4) {
      // Formato típico: P, N, E, Z [, D]
      pointId = tokens[0] || `${parsedPoints.length + 1}`;
      const val1 = parseFloat(tokens[1]);
      const val2 = parseFloat(tokens[2]);
      const val3 = parseFloat(tokens[3]);
      const val4 = tokens.slice(4).join(' ').trim();

      if (isNaN(val1) || isNaN(val2)) {
        continue;
      }

      north = val1;
      east = val2;
      elevation = isNaN(val3) ? 0.0 : val3;
      code = val4 ? val4.toUpperCase() : 'PUNTO';
    } else if (tokens.length === 3) {
      // Formato: N, E, Z o P, N, E
      const num0 = parseFloat(tokens[0]);
      const num1 = parseFloat(tokens[1]);
      const num2 = parseFloat(tokens[2]);

      if (!isNaN(num0) && !isNaN(num1) && !isNaN(num2)) {
        pointId = `${parsedPoints.length + 1}`;
        north = num0;
        east = num1;
        elevation = num2;
        code = 'PUNTO';
      } else {
        continue;
      }
    }

    codeSet.add(code);
    parsedPoints.push({
      id: pointId,
      north,
      east,
      elevation,
      code,
      rawLine: line,
    });
  }

  if (parsedPoints.length === 0) {
    return createEmptyDataset();
  }

  // Clasificación inteligente de puntos por código técnico
  const axisPoints: TopoPoint[] = [];
  const boundaryPoints: TopoPoint[] = [];
  const utilityPoints: TopoPoint[] = [];

  parsedPoints.forEach((pt) => {
    const c = pt.code.toUpperCase();
    if (
      c.includes('EJE') ||
      c.includes('ALIN') ||
      c.includes('CENTER') ||
      c.includes('TRAMO') ||
      c === 'CL' ||
      c === 'VIA'
    ) {
      axisPoints.push(pt);
    } else if (
      c.includes('BORDE') ||
      c.includes('BORD') ||
      c.includes('IZQ') ||
      c.includes('DER') ||
      c.includes('ANDEN') ||
      c.includes('SARD') ||
      c.includes('LIMITE')
    ) {
      boundaryPoints.push(pt);
    } else if (
      c.includes('GAS') ||
      c.includes('AGUA') ||
      c.includes('ACU') ||
      c.includes('ENER') ||
      c.includes('ELEC') ||
      c.includes('TEL') ||
      c.includes('ALC') ||
      c.includes('SAN') ||
      c.includes('PLUV') ||
      c.includes('RED')
    ) {
      utilityPoints.push(pt);
    }
  });

  // Si no se asignaron puntos explícitos de eje con la palabra EJE, asumir que todos los puntos representan el alineamiento en secuencia
  const activeAxis = axisPoints.length > 0 ? axisPoints : [...parsedPoints];

  // Calcular límites espaciales (Bounding Box)
  let minEast = Infinity;
  let maxEast = -Infinity;
  let minNorth = Infinity;
  let maxNorth = -Infinity;
  let minElev = Infinity;
  let maxElev = -Infinity;

  parsedPoints.forEach((pt) => {
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
    points: parsedPoints,
    axisPoints: activeAxis,
    boundaryPoints,
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
