/**
 * MOTOR DE GENERACIÓN VECTORIAL AUTOCAD DXF UNIVERSAL (R12 / AC1009)
 * Plataforma PROCIMEC INGENIERÍA S.A.S. — PCM CLOUD
 * Genera planos 2D vectoriales en estándar ASCII universal puro.
 * Compatible al 100% con AutoCAD (R12 hasta 2026), AutoCAD Civil 3D, Autodesk DWG TrueView,
 * Bentley MicroStation, LibreCAD, QGIS y cualquier visor CAD sin errores de sintaxis ni abortos.
 * Soporta Georreferenciación Real desde archivos .txt de Estación Total (P, N, E, Z, D).
 */

import { TopographyDataset } from '../parsers/topography-txt-parser';

export interface DxfTramoInput {
  sector: string;
  ml: number;
  m2: number;
  max_depth_m: number;
  observations?: string;
  report_date?: string;
  localizador_name?: string;
}

export interface DxfUtilityInput {
  id?: string;
  type: string;
  diameter?: string;
  estimated_depth_m: number;
  confidence: string;
  description?: string;
  report_date?: string;
}

export interface DxfProjectMeta {
  name: string;
  client: string;
  cost_center?: string;
  location?: string;
}

/**
 * Limpieza estricta de cadenas de texto para compatibilidad ASCII AutoCAD DXF
 * - Elimina tildes y caracteres especiales no ASCII
 * - Reemplaza retornos de carro y saltos de línea por espacios
 * - Garantiza que nunca retorne una cadena vacía (mínimo un espacio ' ')
 *   para evitar errores de "Null string in group 1" o líneas huérfanas en parsers C/C++.
 */
export function cleanDxfString(str: string): string {
  if (!str) return ' ';
  const cleaned = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar tildes y diacríticos
    .replace(/[\r\n\t]/g, ' ')       // Eliminar saltos y tabulaciones
    .replace(/[^\x20-\x7E]/g, ' ')   // Mantener únicamente caracteres imprimibles ASCII
    .replace(/\s+/g, ' ')           // Colapsar espacios consecutivos
    .trim();
  return cleaned.length > 0 ? cleaned : ' ';
}

/**
 * Formateo seguro de números y coordenadas en DXF
 * Previene valores NaN, undefined, null o infinitos que corrompen el parser de AutoCAD.
 */
function formatDxfCoord(num: number | undefined | null, fallback = 0.0): string {
  if (num === undefined || num === null || isNaN(num) || !isFinite(num)) {
    return fallback.toFixed(4);
  }
  return num.toFixed(4);
}

/**
 * Mapeo de capas técnicas normalizadas de servicios públicos según norma PROCIMEC y colores CTB
 */
export function getUtilityLayer(type: string): { layer: string; color: number; label: string } {
  const norm = (type || '').toLowerCase();
  if (norm.includes('gas')) {
    return { layer: 'RED_GAS', color: 2, label: 'GAS' }; // Amarillo #2
  } else if (norm.includes('agua') || norm.includes('acueducto') || norm.includes('hidr') || norm.includes('potable')) {
    return { layer: 'RED_ACUEDUCTO', color: 5, label: 'ACUEDUCTO' }; // Azul #5
  } else if (norm.includes('electr') || norm.includes('energ') || norm.includes('bt') || norm.includes('mt') || norm.includes('at')) {
    return { layer: 'RED_ENERGIA', color: 1, label: 'ENERGIA' }; // Rojo #1
  } else if (norm.includes('telecom') || norm.includes('fibra') || norm.includes('datos') || norm.includes('telefon')) {
    return { layer: 'RED_TELECOM', color: 30, label: 'TELECOM' }; // Naranja #30
  } else if (norm.includes('alcantarill') || norm.includes('sanitari') || norm.includes('pluvial') || norm.includes('drenaje')) {
    return { layer: 'RED_ALCANTARILLADO', color: 3, label: 'ALCANTARILLADO' }; // Verde #3
  }
  return { layer: 'RED_OTRAS', color: 6, label: 'INTERFERENCIA' }; // Magenta #6
}

// 18 Capas técnicas normalizadas PROCIMEC (AutoCAD / Civil 3D R12 AC1009)
export const CANONICAL_CAD_LAYERS = [
  { name: '0', color: 7 },
  { name: 'EJE_VIA', color: 1 },                 // Rojo #1
  { name: 'BORDE_EXPLORACION', color: 8 },        // Gris #8
  { name: 'COTAS', color: 7 },                    // Blanco #7
  { name: 'ROTULO_PROCIMEC', color: 7 },          // Blanco #7
  { name: 'PUNTOS_TOPOGRAFIA', color: 7 },        // Blanco #7
  { name: 'TEXTOS_TOPOGRAFIA', color: 8 },        // Gris #8
  { name: 'ESTACIONES_DELTA', color: 6 },         // Magenta #6
  { name: 'TEXTOS_ESTACIONES', color: 6 },        // Magenta #6
  { name: 'PERFILES_GPR', color: 4 },             // Cian #4
  { name: 'RED_GAS', color: 2 },                  // Amarillo #2
  { name: 'RED_ACUEDUCTO', color: 5 },            // Azul #5
  { name: 'RED_ENERGIA', color: 1 },              // Rojo #1
  { name: 'RED_TELECOM', color: 30 },             // Naranja #30
  { name: 'RED_ALCANTARILLADO', color: 3 },       // Verde #3
  { name: 'RED_OTRAS', color: 6 },                // Magenta #6
  { name: 'POSTES_URBANISMO', color: 9 },         // Gris claro #9
  { name: 'TEXTOS_INTERFERENCIAS', color: 7 },    // Blanco #7
];

function addDxfLayersTable(lines: string[]) {
  lines.push('0', 'TABLE', '2', 'LAYER', '70', `${CANONICAL_CAD_LAYERS.length}`);
  CANONICAL_CAD_LAYERS.forEach((lyr) => {
    lines.push('0', 'LAYER', '2', lyr.name, '70', '0', '62', `${lyr.color}`, '6', 'CONTINUOUS');
  });
  lines.push('0', 'ENDTAB');
}

/**
 * Generador del Plano 2D Base (.DXF) - Fase 1
 * Soporta georreferenciación nativa si se proporciona un TopographyDataset (.txt de Estación Total).
 */
export function generateBase2dDxf(
  project: DxfProjectMeta,
  tramos: DxfTramoInput[],
  topography?: TopographyDataset | null
): string {
  const lines: string[] = [];
  const hasTopo = Boolean(topography && topography.points && topography.points.length > 0);

  // 1. HEADER SECTION (Estándar puro R12)
  lines.push('0', 'SECTION', '2', 'HEADER');
  lines.push('9', '$ACADVER', '1', 'AC1009');
  lines.push('0', 'ENDSEC');

  // 2. TABLES SECTION (LAYER y STYLE)
  lines.push('0', 'SECTION', '2', 'TABLES');
  addDxfLayersTable(lines);

  // Tabla STYLE (Estilo de texto STANDARD universal)
  lines.push('0', 'TABLE', '2', 'STYLE', '70', '1');
  lines.push('0', 'STYLE', '2', 'STANDARD', '70', '0', '40', '0.0', '41', '1.0', '50', '0.0', '71', '0', '42', '2.5', '3', 'txt');
  lines.push('0', 'ENDTAB');

  lines.push('0', 'ENDSEC');

  // 3. BLOCKS SECTION
  lines.push('0', 'SECTION', '2', 'BLOCKS');
  lines.push('0', 'ENDSEC');

  // 4. ENTITIES SECTION
  lines.push('0', 'SECTION', '2', 'ENTITIES');

  if (hasTopo && topography) {
    // ═════════════════════════════════════════════════════════════════════════
    // MODO GEORREFERENCIADO REAL (Puntos y Alineamiento de Estación Total)
    // ═════════════════════════════════════════════════════════════════════════
    const pts = topography.points;
    const axis = topography.axisPoints.length > 0 ? topography.axisPoints : pts;
    const bounds = topography.bounds;

    // 1. Dibujar traslados de estación armada (02TP) con símbolo delta triangular
    if (topography.stationSetups && topography.stationSetups.length > 0) {
      topography.stationSetups.forEach((setup) => {
        addDxfStationDelta(lines, 'ESTACIONES_DELTA', setup.east, setup.north, setup.elevation, 1.2);
        addDxfText(lines, 'TEXTOS_ESTACIONES', setup.east + 0.8, setup.north + 0.6, setup.elevation, 0.6, `ESTACION: ${setup.stationId}`);
        if (setup.instrumentHeight) {
          addDxfText(lines, 'TEXTOS_ESTACIONES', setup.east + 0.8, setup.north - 0.2, setup.elevation, 0.45, `HI = ${setup.instrumentHeight.toFixed(3)} m`);
        }
        addDxfText(lines, 'TEXTOS_ESTACIONES', setup.east + 0.8, setup.north - 0.7, setup.elevation, 0.45, `Z = ${setup.elevation.toFixed(2)} m`);
      });
    }

    // 2. Dibujar cada punto del levantamiento (08TP) en su capa técnica respectiva
    pts.forEach((pt) => {
      // Deltas o puntos de amarre en 08TP (e.g. GPS-01-PLA-JM, AUX-01-VIA)
      if (pt.isStationSetup) {
        addDxfStationDelta(lines, 'ESTACIONES_DELTA', pt.east, pt.north, pt.elevation, 0.9);
        addDxfText(lines, 'TEXTOS_ESTACIONES', pt.east + 0.6, pt.north + 0.5, pt.elevation, 0.5, `DELTA: ${pt.code}`);
        addDxfText(lines, 'TEXTOS_ESTACIONES', pt.east + 0.6, pt.north - 0.3, pt.elevation, 0.4, `Pto ${pt.id} | Z = ${pt.elevation.toFixed(2)}m`);
        return;
      }

      const layer = pt.layerName || 'PUNTOS_TOPOGRAFIA';
      addDxfPoint(lines, layer, pt.east, pt.north, pt.elevation);
      addDxfCircle(lines, layer, pt.east, pt.north, pt.elevation, 0.25);

      // Decodificación de profundidad y diámetro en etiquetas
      let labelDesc = pt.code;
      if (pt.depth !== undefined && pt.diameter) {
        labelDesc = `${pt.code} (Prof: ${pt.depth.toFixed(2)}m | ${pt.diameter})`;
      } else if (pt.depth !== undefined) {
        labelDesc = `${pt.code} (Prof: ${pt.depth.toFixed(2)}m)`;
      }

      const textLayer = pt.category === 'gas' || pt.category === 'acueducto' || pt.category === 'telecom' || pt.category === 'energia' || pt.category === 'alcantarillado'
        ? 'TEXTOS_INTERFERENCIAS'
        : 'TEXTOS_TOPOGRAFIA';

      addDxfText(lines, textLayer, pt.east + 0.4, pt.north + 0.35, pt.elevation, 0.45, pt.id);
      addDxfText(lines, textLayer, pt.east + 0.4, pt.north - 0.2, pt.elevation, 0.35, `${pt.elevation.toFixed(2)} m`);
      addDxfText(lines, textLayer, pt.east + 0.4, pt.north - 0.7, pt.elevation, 0.35, labelDesc);
    });

    // 3. Delinear el Eje de Vía en 3D uniendo los puntos del alineamiento
    let accumDist = 0;
    const stepStation = 20.0;
    let nextStation = 0;

    for (let i = 0; i < axis.length - 1; i++) {
      const p1 = axis[i];
      const p2 = axis[i + 1];

      // Segmento 3D de eje
      addDxfLine(lines, 'EJE_VIA', p1.east, p1.north, p1.elevation, p2.east, p2.north, p2.elevation);

      const dx = p2.east - p1.east;
      const dy = p2.north - p1.north;
      const segLen = Math.sqrt(dx * dx + dy * dy);

      if (segLen > 0.001) {
        const ux = dx / segLen;
        const uy = dy / segLen;
        const perpX = -uy;
        const perpY = ux;

        // Franja de exploración a 2.5m a cada lado del eje
        const halfW = 2.5;
        addDxfLine(
          lines,
          'BORDE_EXPLORACION',
          p1.east - perpX * halfW,
          p1.north - perpY * halfW,
          p1.elevation,
          p2.east - perpX * halfW,
          p2.north - perpY * halfW,
          p2.elevation
        );
        addDxfLine(
          lines,
          'BORDE_EXPLORACION',
          p1.east + perpX * halfW,
          p1.north + perpY * halfW,
          p1.elevation,
          p2.east + perpX * halfW,
          p2.north + perpY * halfW,
          p2.elevation
        );

        // Abscisado cada 20m a lo largo del alineamiento real
        while (nextStation <= accumDist + segLen) {
          const distAlong = nextStation - accumDist;
          const stX = p1.east + ux * distAlong;
          const stY = p1.north + uy * distAlong;
          const stZ = p1.elevation + ((p2.elevation - p1.elevation) * (distAlong / segLen));

          // Marca perpendicular en la abscisa
          addDxfLine(
            lines,
            'COTAS',
            stX - perpX * 0.75,
            stY - perpY * 0.75,
            stZ,
            stX + perpX * 0.75,
            stY + perpY * 0.75,
            stZ
          );

          const stationKm = Math.floor(nextStation / 1000);
          const stationM = Math.floor(nextStation % 1000);
          const stationText = `K${stationKm}+${stationM.toString().padStart(3, '0')}`;
          addDxfText(lines, 'COTAS', stX - perpX * 1.8, stY - perpY * 1.8, stZ, 0.65, stationText);

          nextStation += stepStation;
        }
      }

      accumDist += segLen;
    }

    // Cierre inicial y final de la franja de exploración
    if (axis.length >= 2) {
      const pFirst = axis[0];
      const pNext = axis[1];
      const dxF = pNext.east - pFirst.east;
      const dyF = pNext.north - pFirst.north;
      const lenF = Math.sqrt(dxF * dxF + dyF * dyF) || 1;
      const perpF_X = -dyF / lenF;
      const perpF_Y = dxF / lenF;

      addDxfLine(
        lines,
        'BORDE_EXPLORACION',
        pFirst.east - perpF_X * 2.5,
        pFirst.north - perpF_Y * 2.5,
        pFirst.elevation,
        pFirst.east + perpF_X * 2.5,
        pFirst.north + perpF_Y * 2.5,
        pFirst.elevation
      );

      const pLast = axis[axis.length - 1];
      const pPrev = axis[axis.length - 2];
      const dxL = pLast.east - pPrev.east;
      const dyL = pLast.north - pPrev.north;
      const lenL = Math.sqrt(dxL * dxL + dyL * dyL) || 1;
      const perpL_X = -dyL / lenL;
      const perpL_Y = dxL / lenL;

      addDxfLine(
        lines,
        'BORDE_EXPLORACION',
        pLast.east - perpL_X * 2.5,
        pLast.north - perpL_Y * 2.5,
        pLast.elevation,
        pLast.east + perpL_X * 2.5,
        pLast.north + perpL_Y * 2.5,
        pLast.elevation
      );
    }

    // 4. Etiqueta informativa del alineamiento georreferenciado
    const titleX = axis[0].east;
    const titleY = axis[0].north + 6.0;
    const titleZ = axis[0].elevation;
    addDxfText(lines, 'COTAS', titleX, titleY + 1.8, titleZ, 1.3, `ALINEAMIENTO GPR GEORREFERENCIADO (${axis.length} PUNTOS EJE)`);
    addDxfText(lines, 'COTAS', titleX, titleY + 0.6, titleZ, 0.85, `LONGITUD TOTAL: ${topography.totalAxisLength.toFixed(2)} ML | SISTEMA DE COORDENADAS DE CAMPO`);

    // 5. Rótulo Oficial PROCIMEC ubicado junto a las coordenadas del proyecto
    const titleBoxX = bounds.maxEast + 25.0;
    const titleBoxY = bounds.minNorth;
    const setupsCount = topography.stationSetups ? topography.stationSetups.length : 0;
    addDxfTitleBlock(lines, project, titleBoxX, titleBoxY, `ESTACION TOTAL: ${pts.length} PTS | ${setupsCount} ESTACIONES`);

  } else {
    // ═════════════════════════════════════════════════════════════════════════
    // MODO PARAMÉTRICO LOCAL (Fallback cuando no hay archivo de topografía .txt)
    // ═════════════════════════════════════════════════════════════════════════
    let currentX = 100.0;
    const baseY = 100.0;

    const tramosList = tramos && tramos.length > 0 ? tramos : [
      {
        sector: 'Sector 1 - Exploracion General',
        ml: 50.0,
        m2: 200.0,
        max_depth_m: 2.0,
      }
    ];

    tramosList.forEach((tramo, idx) => {
      const ml = Math.max(Number(tramo.ml) || 20, 10);
      const m2 = Number(tramo.m2) || ml * 4;
      const width = Math.min(Math.max(m2 / ml, 3.0), 12.0);
      const halfW = width / 2;

      const startX = currentX;
      const endX = currentX + ml;

      // 1. Eje de Vía
      addDxfLine(lines, 'EJE_VIA', startX, baseY, 0, endX, baseY, 0);

      // 2. Bordes de Exploración
      addDxfLine(lines, 'BORDE_EXPLORACION', startX, baseY + halfW, 0, endX, baseY + halfW, 0);
      addDxfLine(lines, 'BORDE_EXPLORACION', startX, baseY - halfW, 0, endX, baseY - halfW, 0);
      addDxfLine(lines, 'BORDE_EXPLORACION', startX, baseY - halfW, 0, startX, baseY + halfW, 0);
      addDxfLine(lines, 'BORDE_EXPLORACION', endX, baseY - halfW, 0, endX, baseY + halfW, 0);

      // 3. Abscisado cada 20m
      for (let s = 0; s <= ml; s += 20.0) {
        const stationX = startX + s;
        addDxfLine(lines, 'COTAS', stationX, baseY - 0.6, 0, stationX, baseY + 0.6, 0);
        const stationKm = Math.floor(s / 1000);
        const stationM = Math.floor(s % 1000);
        const stationText = `K${stationKm}+${stationM.toString().padStart(3, '0')}`;
        addDxfText(lines, 'COTAS', stationX, baseY - 1.8, 0, 0.7, stationText);
      }

      // 4. Etiqueta del Tramo
      const sectorName = cleanDxfString(tramo.sector || `Sector ${idx + 1}`).toUpperCase();
      const maxDepth = Number(tramo.max_depth_m) || 2.0;
      const labelTitle = `TRAMO ${idx + 1}: ${sectorName}`;
      const labelSub = `LONGITUD: ${ml.toFixed(2)} ML | ANCHO: ${width.toFixed(2)} m | AREA: ${m2.toFixed(2)} M2 | PROF. MAX: ${maxDepth.toFixed(2)} m`;
      addDxfText(lines, 'COTAS', startX, baseY + halfW + 1.8, 0, 1.2, labelTitle);
      addDxfText(lines, 'COTAS', startX, baseY + halfW + 0.6, 0, 0.8, labelSub);

      currentX = endX + 40.0;
    });

    addDxfTitleBlock(lines, project, currentX > 100 ? currentX : 250, baseY, 'ESQUEMATICO LOCAL');
  }

  lines.push('0', 'ENDSEC');
  lines.push('0', 'EOF');

  return lines.join('\r\n') + '\r\n';
}

/**
 * Generador del Plano 2D Mejorado con Redes e Interferencias (.DXF) - Fase 3
 * Incrusta servicios sobre las coordenadas georreferenciadas reales.
 */
export function generateRefined2dDxf(
  project: DxfProjectMeta,
  tramos: DxfTramoInput[],
  utilities: DxfUtilityInput[],
  topography?: TopographyDataset | null
): string {
  const lines: string[] = [];
  const hasTopo = Boolean(topography && topography.points && topography.points.length > 0);

  // 1. HEADER SECTION
  lines.push('0', 'SECTION', '2', 'HEADER');
  lines.push('9', '$ACADVER', '1', 'AC1009');
  lines.push('0', 'ENDSEC');

  // 2. TABLES SECTION
  lines.push('0', 'SECTION', '2', 'TABLES');
  addDxfLayersTable(lines);

  // Tabla STYLE
  lines.push('0', 'TABLE', '2', 'STYLE', '70', '1');
  lines.push('0', 'STYLE', '2', 'STANDARD', '70', '0', '40', '0.0', '41', '1.0', '50', '0.0', '71', '0', '42', '2.5', '3', 'txt');
  lines.push('0', 'ENDTAB');

  lines.push('0', 'ENDSEC');

  // 3. BLOCKS SECTION
  lines.push('0', 'SECTION', '2', 'BLOCKS');
  lines.push('0', 'ENDSEC');

  // 4. ENTITIES SECTION
  lines.push('0', 'SECTION', '2', 'ENTITIES');

  if (hasTopo && topography) {
    // Modo Georreferenciado Real con Redes
    const pts = topography.points;
    const axis = topography.axisPoints.length > 0 ? topography.axisPoints : pts;
    const bounds = topography.bounds;

    // 1. Dibujar traslados de estación armada (02TP) con símbolo delta triangular
    if (topography.stationSetups && topography.stationSetups.length > 0) {
      topography.stationSetups.forEach((setup) => {
        addDxfStationDelta(lines, 'ESTACIONES_DELTA', setup.east, setup.north, setup.elevation, 1.2);
        addDxfText(lines, 'TEXTOS_ESTACIONES', setup.east + 0.8, setup.north + 0.6, setup.elevation, 0.6, `ESTACION: ${setup.stationId}`);
        if (setup.instrumentHeight) {
          addDxfText(lines, 'TEXTOS_ESTACIONES', setup.east + 0.8, setup.north - 0.2, setup.elevation, 0.45, `HI = ${setup.instrumentHeight.toFixed(3)} m`);
        }
        addDxfText(lines, 'TEXTOS_ESTACIONES', setup.east + 0.8, setup.north - 0.7, setup.elevation, 0.45, `Z = ${setup.elevation.toFixed(2)} m`);
      });
    }

    // 2. Dibujar cada punto del levantamiento (08TP) clasificado en su capa técnica
    pts.forEach((pt) => {
      if (pt.isStationSetup) {
        addDxfStationDelta(lines, 'ESTACIONES_DELTA', pt.east, pt.north, pt.elevation, 0.9);
        addDxfText(lines, 'TEXTOS_ESTACIONES', pt.east + 0.6, pt.north + 0.5, pt.elevation, 0.5, `DELTA: ${pt.code}`);
        addDxfText(lines, 'TEXTOS_ESTACIONES', pt.east + 0.6, pt.north - 0.3, pt.elevation, 0.4, `Pto ${pt.id} | Z = ${pt.elevation.toFixed(2)}m`);
        return;
      }

      const layer = pt.layerName || 'PUNTOS_TOPOGRAFIA';
      addDxfPoint(lines, layer, pt.east, pt.north, pt.elevation);
      addDxfCircle(lines, layer, pt.east, pt.north, pt.elevation, 0.25);

      let labelDesc = pt.code;
      if (pt.depth !== undefined && pt.diameter) {
        labelDesc = `${pt.code} (Prof: ${pt.depth.toFixed(2)}m | ${pt.diameter})`;
      } else if (pt.depth !== undefined) {
        labelDesc = `${pt.code} (Prof: ${pt.depth.toFixed(2)}m)`;
      }

      const textLayer = pt.category === 'gas' || pt.category === 'acueducto' || pt.category === 'telecom' || pt.category === 'energia' || pt.category === 'alcantarillado'
        ? 'TEXTOS_INTERFERENCIAS'
        : 'TEXTOS_TOPOGRAFIA';

      addDxfText(lines, textLayer, pt.east + 0.4, pt.north + 0.35, pt.elevation, 0.45, pt.id);
      addDxfText(lines, textLayer, pt.east + 0.4, pt.north - 0.2, pt.elevation, 0.35, `${pt.elevation.toFixed(2)} m`);
      addDxfText(lines, textLayer, pt.east + 0.4, pt.north - 0.7, pt.elevation, 0.35, labelDesc);
    });

    // 3. Delinear Eje y Franjas
    for (let i = 0; i < axis.length - 1; i++) {
      const p1 = axis[i];
      const p2 = axis[i + 1];
      addDxfLine(lines, 'EJE_VIA', p1.east, p1.north, p1.elevation, p2.east, p2.north, p2.elevation);

      const dx = p2.east - p1.east;
      const dy = p2.north - p1.north;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (segLen > 0.001) {
        const perpX = -dy / segLen;
        const perpY = dx / segLen;
        addDxfLine(lines, 'BORDE_EXPLORACION', p1.east - perpX * 2.5, p1.north - perpY * 2.5, p1.elevation, p2.east - perpX * 2.5, p2.north - perpY * 2.5, p2.elevation);
        addDxfLine(lines, 'BORDE_EXPLORACION', p1.east + perpX * 2.5, p1.north + perpY * 2.5, p1.elevation, p2.east + perpX * 2.5, p2.north + perpY * 2.5, p2.elevation);
      }
    }

    // 4. Incrustar Redes en las Coordenadas del Eje Real
    const totalLen = Math.max(topography.totalAxisLength, 20.0);
    utilities.forEach((util, uIdx) => {
      const layerInfo = getUtilityLayer(util.type);
      const depthZ = -Math.abs(Number(util.estimated_depth_m) || 0.8);

      const ratio = (uIdx + 1) / (utilities.length + 1);
      const targetDist = ratio * totalLen;

      // Localizar el punto 3D sobre la polilínea del eje
      const axisPos = getPointAtDistanceAlongAxis(axis, targetDist);
      const ptEast = axisPos.east;
      const ptNorth = axisPos.north;
      const ptElev = axisPos.elevation + depthZ; // Cota invert real

      const perpX = axisPos.perpX;
      const perpY = axisPos.perpY;

      // Línea transversal de la tubería (10m de ancho de cruce)
      addDxfLine(
        lines,
        layerInfo.layer,
        ptEast - perpX * 5.0,
        ptNorth - perpY * 5.0,
        ptElev,
        ptEast + perpX * 5.0,
        ptNorth + perpY * 5.0,
        ptElev
      );

      // Círculo indicador en el eje
      addDxfCircle(lines, layerInfo.layer, ptEast, ptNorth, ptElev, 0.35);

      // Línea directriz y etiqueta técnica
      const calloutX = ptEast + perpX * 6.5;
      const calloutY = ptNorth + perpY * 6.5;
      addDxfLine(lines, 'TEXTOS_INTERFERENCIAS', ptEast, ptNorth, ptElev, calloutX, calloutY, ptElev);

      const calloutLabel1 = `[${layerInfo.label}] ${cleanDxfString(util.type)}`;
      const calloutLabel2 = `DIAM: ${cleanDxfString(util.diameter || 'N/D')} | COTA Z = ${ptElev.toFixed(2)}m (${Math.abs(depthZ).toFixed(2)}m prof.)`;
      const calloutLabel3 = `CONF: ${cleanDxfString(util.confidence).toUpperCase()}${util.description ? ' - ' + cleanDxfString(util.description) : ''}`;

      addDxfText(lines, 'TEXTOS_INTERFERENCIAS', calloutX + 0.8, calloutY + 0.8, ptElev, 0.7, calloutLabel1);
      addDxfText(lines, 'TEXTOS_INTERFERENCIAS', calloutX + 0.8, calloutY, ptElev, 0.6, calloutLabel2);
      addDxfText(lines, 'TEXTOS_INTERFERENCIAS', calloutX + 0.8, calloutY - 0.7, ptElev, 0.55, calloutLabel3);
    });

    // Cuadro de interferencias posicionado cerca al área del levantamiento
    const tableX = bounds.minEast;
    const tableY = bounds.minNorth - 15.0;
    addDxfUtilitiesTable(lines, utilities, tableX, tableY);

    // Rótulo oficial posicionado
    const titleBoxX = bounds.maxEast + 25.0;
    const titleBoxY = bounds.minNorth;
    const setupsCount = topography.stationSetups ? topography.stationSetups.length : 0;
    addDxfTitleBlock(lines, project, titleBoxX, titleBoxY, `ESTACION TOTAL: ${pts.length} PTS | ${setupsCount} ESTACIONES`);

  } else {
    // Modo Paramétrico Local (Fallback)
    let currentX = 100.0;
    const baseY = 100.0;

    const tramosList = tramos && tramos.length > 0 ? tramos : [
      {
        sector: 'Sector 1 - Exploracion General',
        ml: 50.0,
        m2: 200.0,
        max_depth_m: 2.0,
      }
    ];

    tramosList.forEach((tramo, idx) => {
      const ml = Math.max(Number(tramo.ml) || 20, 10);
      const m2 = Number(tramo.m2) || ml * 4;
      const width = Math.min(Math.max(m2 / ml, 3.0), 12.0);
      const halfW = width / 2;

      const startX = currentX;
      const endX = currentX + ml;

      addDxfLine(lines, 'EJE_VIA', startX, baseY, 0, endX, baseY, 0);
      addDxfLine(lines, 'BORDE_EXPLORACION', startX, baseY + halfW, 0, endX, baseY + halfW, 0);
      addDxfLine(lines, 'BORDE_EXPLORACION', startX, baseY - halfW, 0, endX, baseY - halfW, 0);
      addDxfLine(lines, 'BORDE_EXPLORACION', startX, baseY - halfW, 0, startX, baseY + halfW, 0);
      addDxfLine(lines, 'BORDE_EXPLORACION', endX, baseY - halfW, 0, endX, baseY + halfW, 0);

      for (let s = 0; s <= ml; s += 20.0) {
        const stationX = startX + s;
        addDxfLine(lines, 'COTAS', stationX, baseY - 0.5, 0, stationX, baseY + 0.5, 0);
        const stationKm = Math.floor(s / 1000);
        const stationM = Math.floor(s % 1000);
        addDxfText(lines, 'COTAS', stationX, baseY - 1.6, 0, 0.6, `K${stationKm}+${stationM.toString().padStart(3, '0')}`);
      }

      const sectorName = cleanDxfString(tramo.sector || `Sector ${idx + 1}`).toUpperCase();
      addDxfText(lines, 'COTAS', startX, baseY + halfW + 1.8, 0, 1.1, `TRAMO ${idx + 1}: ${sectorName}`);

      currentX = endX + 40.0;
    });

    const totalExplorationLength = tramosList.reduce((sum, t) => sum + (Number(t.ml) || 20), 0);
    const startAlignmentX = 100.0;

    utilities.forEach((util, uIdx) => {
      const layerInfo = getUtilityLayer(util.type);
      const depthZ = -Math.abs(Number(util.estimated_depth_m) || 0.8);

      const ratio = (uIdx + 1) / (utilities.length + 1);
      const targetX = startAlignmentX + ratio * (totalExplorationLength || 100);

      const pipeYStart = baseY - 6.0;
      const pipeYEnd = baseY + 6.0;
      const pipeXOffset = ((uIdx % 3) - 1) * 2.5;

      addDxfLine(lines, layerInfo.layer, targetX - pipeXOffset, pipeYStart, depthZ, targetX + pipeXOffset, pipeYEnd, depthZ);
      addDxfCircle(lines, layerInfo.layer, targetX, baseY, depthZ, 0.35);

      const calloutY = uIdx % 2 === 0 ? baseY + 7.5 : baseY - 7.5;
      addDxfLine(lines, 'TEXTOS_INTERFERENCIAS', targetX, baseY + (uIdx % 2 === 0 ? 0.4 : -0.4), 0, targetX + 1.5, calloutY, 0);

      const calloutLabel1 = `[${layerInfo.label}] ${cleanDxfString(util.type)}`;
      const calloutLabel2 = `DIAM: ${cleanDxfString(util.diameter || 'N/D')} | Z = ${depthZ.toFixed(2)}m (${Math.abs(depthZ).toFixed(2)}m prof.)`;
      const calloutLabel3 = `CONF: ${cleanDxfString(util.confidence).toUpperCase()}${util.description ? ' - ' + cleanDxfString(util.description) : ''}`;

      addDxfText(lines, 'TEXTOS_INTERFERENCIAS', targetX + 1.8, calloutY + 0.8, 0, 0.7, calloutLabel1);
      addDxfText(lines, 'TEXTOS_INTERFERENCIAS', targetX + 1.8, calloutY, 0, 0.6, calloutLabel2);
      addDxfText(lines, 'TEXTOS_INTERFERENCIAS', targetX + 1.8, calloutY - 0.7, 0, 0.55, calloutLabel3);
    });

    const tableX = 100.0;
    const tableY = baseY - 25.0;
    addDxfUtilitiesTable(lines, utilities, tableX, tableY);

    addDxfTitleBlock(lines, project, Math.max(currentX, 260), baseY, 'ESQUEMATICO LOCAL');
  }

  lines.push('0', 'ENDSEC');
  lines.push('0', 'EOF');

  return lines.join('\r\n') + '\r\n';
}

/**
 * Helpers auxiliares para interpolación a lo largo de un eje 3D
 */
function getPointAtDistanceAlongAxis(
  axis: Array<{ east: number; north: number; elevation: number }>,
  targetDist: number
): { east: number; north: number; elevation: number; perpX: number; perpY: number } {
  if (axis.length === 0) {
    return { east: 100, north: 100, elevation: 0, perpX: 0, perpY: 1 };
  }
  if (axis.length === 1) {
    return { east: axis[0].east, north: axis[0].north, elevation: axis[0].elevation, perpX: 0, perpY: 1 };
  }

  let accum = 0;
  for (let i = 0; i < axis.length - 1; i++) {
    const p1 = axis[i];
    const p2 = axis[i + 1];
    const dx = p2.east - p1.east;
    const dy = p2.north - p1.north;
    const segLen = Math.sqrt(dx * dx + dy * dy);

    if (accum + segLen >= targetDist || i === axis.length - 2) {
      const remain = Math.max(targetDist - accum, 0);
      const frac = segLen > 0.001 ? Math.min(remain / segLen, 1.0) : 0;
      const perpX = segLen > 0.001 ? -dy / segLen : 0;
      const perpY = segLen > 0.001 ? dx / segLen : 1;

      return {
        east: p1.east + dx * frac,
        north: p1.north + dy * frac,
        elevation: p1.elevation + (p2.elevation - p1.elevation) * frac,
        perpX,
        perpY,
      };
    }

    accum += segLen;
  }

  const pLast = axis[axis.length - 1];
  return { east: pLast.east, north: pLast.north, elevation: pLast.elevation, perpX: 0, perpY: 1 };
}

/**
 * Primitivas DXF universales (AutoCAD R12 AC1009)
 */
function addDxfPoint(
  lines: string[],
  layer: string,
  x: number,
  y: number,
  z: number
) {
  lines.push('0', 'POINT');
  lines.push('8', layer);
  lines.push('10', formatDxfCoord(x));
  lines.push('20', formatDxfCoord(y));
  lines.push('30', formatDxfCoord(z));
}

function addDxfLine(
  lines: string[],
  layer: string,
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number
) {
  lines.push('0', 'LINE');
  lines.push('8', layer);
  lines.push('10', formatDxfCoord(x1));
  lines.push('20', formatDxfCoord(y1));
  lines.push('30', formatDxfCoord(z1));
  lines.push('11', formatDxfCoord(x2));
  lines.push('21', formatDxfCoord(y2));
  lines.push('31', formatDxfCoord(z2));
}

function addDxfCircle(
  lines: string[],
  layer: string,
  cx: number,
  cy: number,
  cz: number,
  radius: number
) {
  lines.push('0', 'CIRCLE');
  lines.push('8', layer);
  lines.push('10', formatDxfCoord(cx));
  lines.push('20', formatDxfCoord(cy));
  lines.push('30', formatDxfCoord(cz));
  lines.push('40', formatDxfCoord(Math.max(radius, 0.01), 0.1));
}

/**
 * Dibuja el símbolo topográfico convencional de Estación Armada / Punto Delta de Control:
 * Un triángulo equilátero centrado con un punto y círculo interior.
 */
function addDxfStationDelta(
  lines: string[],
  layer: string,
  east: number,
  north: number,
  elevation: number,
  size = 0.9
) {
  const h = size;
  const halfB = size * 0.57735;
  const v1 = { x: east, y: north + (2 / 3) * h };
  const v2 = { x: east - halfB, y: north - (1 / 3) * h };
  const v3 = { x: east + halfB, y: north - (1 / 3) * h };

  addDxfLine(lines, layer, v1.x, v1.y, elevation, v2.x, v2.y, elevation);
  addDxfLine(lines, layer, v2.x, v2.y, elevation, v3.x, v3.y, elevation);
  addDxfLine(lines, layer, v3.x, v3.y, elevation, v1.x, v1.y, elevation);
  addDxfPoint(lines, layer, east, north, elevation);
  addDxfCircle(lines, layer, east, north, elevation, 0.15);
}

function addDxfText(
  lines: string[],
  layer: string,
  x: number,
  y: number,
  z: number,
  height: number,
  text: string
) {
  lines.push('0', 'TEXT');
  lines.push('8', layer);
  lines.push('10', formatDxfCoord(x));
  lines.push('20', formatDxfCoord(y));
  lines.push('30', formatDxfCoord(z));
  lines.push('40', formatDxfCoord(Math.max(height, 0.1), 1.0));
  lines.push('1', cleanDxfString(text));
  lines.push('7', 'STANDARD');
}

function addDxfTitleBlock(
  lines: string[],
  project: DxfProjectMeta,
  boxX: number,
  boxY: number,
  scaleInfo = 'ESCALA 1:500'
) {
  const boxWidth = 90.0;
  const boxHeight = 40.0;

  // Cuadro perimetral
  addDxfLine(lines, 'ROTULO_PROCIMEC', boxX, boxY, 0, boxX + boxWidth, boxY, 0);
  addDxfLine(lines, 'ROTULO_PROCIMEC', boxX + boxWidth, boxY, 0, boxX + boxWidth, boxY + boxHeight, 0);
  addDxfLine(lines, 'ROTULO_PROCIMEC', boxX + boxWidth, boxY + boxHeight, 0, boxX, boxY + boxHeight, 0);
  addDxfLine(lines, 'ROTULO_PROCIMEC', boxX, boxY + boxHeight, 0, boxX, boxY, 0);

  // Sub-divisiones
  addDxfLine(lines, 'ROTULO_PROCIMEC', boxX, boxY + 30.0, 0, boxX + boxWidth, boxY + 30.0, 0);
  addDxfLine(lines, 'ROTULO_PROCIMEC', boxX, boxY + 20.0, 0, boxX + boxWidth, boxY + 20.0, 0);
  addDxfLine(lines, 'ROTULO_PROCIMEC', boxX, boxY + 10.0, 0, boxX + boxWidth, boxY + 10.0, 0);

  // Textos del Rótulo Institucional
  addDxfText(lines, 'ROTULO_PROCIMEC', boxX + 3.0, boxY + 35.0, 0, 1.8, 'PROCIMEC INGENIERIA S.A.S.');
  addDxfText(lines, 'ROTULO_PROCIMEC', boxX + 3.0, boxY + 32.0, 0, 1.0, 'PCM CLOUD - GPR & CAD/BIM AUTOMATION STUDIO');

  addDxfText(lines, 'ROTULO_PROCIMEC', boxX + 3.0, boxY + 25.5, 0, 0.9, `PROYECTO: ${cleanDxfString(project.name || 'GPR PROJECT').toUpperCase()}`);
  addDxfText(lines, 'ROTULO_PROCIMEC', boxX + 3.0, boxY + 22.0, 0, 0.8, `CLIENTE: ${cleanDxfString(project.client || 'CLIENTE').toUpperCase()}`);

  addDxfText(lines, 'ROTULO_PROCIMEC', boxX + 3.0, boxY + 15.5, 0, 0.8, `UBICACION: ${cleanDxfString(project.location || 'COLOMBIA').toUpperCase()}`);
  addDxfText(lines, 'ROTULO_PROCIMEC', boxX + 3.0, boxY + 12.0, 0, 0.8, `CENTRO DE COSTOS: ${cleanDxfString(project.cost_center || 'N/A')}`);

  addDxfText(lines, 'ROTULO_PROCIMEC', boxX + 3.0, boxY + 5.5, 0, 0.8, `FECHA: ${new Date().toISOString().slice(0, 10)} | ${scaleInfo}`);
  addDxfText(lines, 'ROTULO_PROCIMEC', boxX + 3.0, boxY + 2.5, 0, 0.7, 'SISTEMA DE GESTION INTEGRAL HSEQ - FOR-GPR-03');
}

function addDxfUtilitiesTable(lines: string[], utilities: DxfUtilityInput[], x: number, y: number) {
  if (!utilities || utilities.length === 0) return;

  const w = 120.0;
  const rowH = 3.5;
  const totalH = (utilities.length + 2) * rowH;

  // Marco exterior
  addDxfLine(lines, 'ROTULO_PROCIMEC', x, y, 0, x + w, y, 0);
  addDxfLine(lines, 'ROTULO_PROCIMEC', x + w, y, 0, x + w, y - totalH, 0);
  addDxfLine(lines, 'ROTULO_PROCIMEC', x + w, y - totalH, 0, x, y - totalH, 0);
  addDxfLine(lines, 'ROTULO_PROCIMEC', x, y - totalH, 0, x, y, 0);

  // Encabezado
  addDxfText(lines, 'ROTULO_PROCIMEC', x + 3.0, y - 2.5, 0, 1.1, 'CUADRO CONSOLIDADO DE INTERFERENCIAS DETECTADAS (GPR)');
  addDxfLine(lines, 'ROTULO_PROCIMEC', x, y - rowH, 0, x + w, y - rowH, 0);

  // Columnas header
  const headerY = y - rowH - 2.3;
  addDxfText(lines, 'ROTULO_PROCIMEC', x + 2.0, headerY, 0, 0.7, 'ITEM');
  addDxfText(lines, 'ROTULO_PROCIMEC', x + 12.0, headerY, 0, 0.7, 'SERVICIO');
  addDxfText(lines, 'ROTULO_PROCIMEC', x + 45.0, headerY, 0, 0.7, 'DIAMETRO');
  addDxfText(lines, 'ROTULO_PROCIMEC', x + 65.0, headerY, 0, 0.7, 'PROF. (m)');
  addDxfText(lines, 'ROTULO_PROCIMEC', x + 85.0, headerY, 0, 0.7, 'CONFIANZA');
  addDxfText(lines, 'ROTULO_PROCIMEC', x + 105.0, headerY, 0, 0.7, 'FECHA');
  addDxfLine(lines, 'ROTULO_PROCIMEC', x, y - rowH * 2, 0, x + w, y - rowH * 2, 0);

  // Filas
  utilities.forEach((u, idx) => {
    const curY = y - (idx + 3) * rowH + 0.9;
    const depthVal = Number(u.estimated_depth_m) || 0.8;
    addDxfText(lines, 'COTAS', x + 2.0, curY, 0, 0.65, `${idx + 1}`);
    addDxfText(lines, 'COTAS', x + 12.0, curY, 0, 0.65, cleanDxfString(u.type).slice(0, 20));
    addDxfText(lines, 'COTAS', x + 45.0, curY, 0, 0.65, cleanDxfString(u.diameter || 'N/D'));
    addDxfText(lines, 'COTAS', x + 65.0, curY, 0, 0.65, `${depthVal.toFixed(2)} m`);
    addDxfText(lines, 'COTAS', x + 85.0, curY, 0, 0.65, cleanDxfString(u.confidence));
    addDxfText(lines, 'COTAS', x + 105.0, curY, 0, 0.65, cleanDxfString(u.report_date || '-'));
    addDxfLine(lines, 'BORDE_EXPLORACION', x, y - (idx + 3) * rowH, 0, x + w, y - (idx + 3) * rowH, 0);
  });
}
