/**
 * MOTOR DE GENERACIÓN VECTORIAL AUTOCAD DXF UNIVERSAL (R12 / AC1009)
 * Plataforma PROCIMEC INGENIERÍA S.A.S. — PCM CLOUD
 * Genera planos 2D vectoriales en estándar ASCII universal puro.
 * Compatible al 100% con AutoCAD (R12 hasta 2026), AutoCAD Civil 3D, Autodesk DWG TrueView,
 * Bentley MicroStation, LibreCAD, QGIS y cualquier visor CAD sin errores de sintaxis ni abortos.
 */

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

/**
 * Generador del Plano 2D Base (.DXF) - Fase 1
 */
export function generateBase2dDxf(
  project: DxfProjectMeta,
  tramos: DxfTramoInput[]
): string {
  const lines: string[] = [];

  // 1. HEADER SECTION (Estándar puro R12)
  lines.push('0', 'SECTION', '2', 'HEADER');
  lines.push('9', '$ACADVER', '1', 'AC1009');
  lines.push('0', 'ENDSEC');

  // 2. TABLES SECTION (Solo LAYER y STYLE)
  lines.push('0', 'SECTION', '2', 'TABLES');

  // Tabla LAYER (5 Capas canónicas para Base 2D)
  lines.push('0', 'TABLE', '2', 'LAYER', '70', '5');
  lines.push('0', 'LAYER', '2', '0', '70', '0', '62', '7', '6', 'CONTINUOUS');
  lines.push('0', 'LAYER', '2', 'EJE_VIA', '70', '0', '62', '1', '6', 'CONTINUOUS');
  lines.push('0', 'LAYER', '2', 'BORDE_EXPLORACION', '70', '0', '62', '8', '6', 'CONTINUOUS');
  lines.push('0', 'LAYER', '2', 'COTAS', '70', '0', '62', '7', '6', 'CONTINUOUS');
  lines.push('0', 'LAYER', '2', 'ROTULO_PROCIMEC', '70', '0', '62', '7', '6', 'CONTINUOUS');
  lines.push('0', 'ENDTAB');

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

  // Delinear cada tramo operativo
  tramosList.forEach((tramo, idx) => {
    const ml = Math.max(Number(tramo.ml) || 20, 10);
    const m2 = Number(tramo.m2) || ml * 4;
    const width = Math.min(Math.max(m2 / ml, 3.0), 12.0); // Ancho de franja
    const halfW = width / 2;

    const startX = currentX;
    const endX = currentX + ml;

    // 1. Eje de Vía
    addDxfLine(lines, 'EJE_VIA', startX, baseY, 0, endX, baseY, 0);

    // 2. Bordes de Exploración (Izquierdo y Derecho)
    addDxfLine(lines, 'BORDE_EXPLORACION', startX, baseY + halfW, 0, endX, baseY + halfW, 0);
    addDxfLine(lines, 'BORDE_EXPLORACION', startX, baseY - halfW, 0, endX, baseY - halfW, 0);

    // Cierres de tramo en extremos
    addDxfLine(lines, 'BORDE_EXPLORACION', startX, baseY - halfW, 0, startX, baseY + halfW, 0);
    addDxfLine(lines, 'BORDE_EXPLORACION', endX, baseY - halfW, 0, endX, baseY + halfW, 0);

    // 3. Abscisado cada 20m
    const stepStation = 20.0;
    for (let s = 0; s <= ml; s += stepStation) {
      const stationX = startX + s;
      // Marca de abscisa en el eje
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

    currentX = endX + 40.0; // Espaciado entre tramos
  });

  // 5. Rótulo Institucional PROCIMEC INGENIERÍA S.A.S.
  addDxfTitleBlock(lines, project, currentX > 100 ? currentX : 250, baseY);

  lines.push('0', 'ENDSEC');
  lines.push('0', 'EOF');

  return lines.join('\r\n') + '\r\n';
}

/**
 * Generador del Plano 2D Mejorado con Redes e Interferencias (.DXF) - Fase 3
 */
export function generateRefined2dDxf(
  project: DxfProjectMeta,
  tramos: DxfTramoInput[],
  utilities: DxfUtilityInput[]
): string {
  const lines: string[] = [];

  // 1. HEADER SECTION
  lines.push('0', 'SECTION', '2', 'HEADER');
  lines.push('9', '$ACADVER', '1', 'AC1009');
  lines.push('0', 'ENDSEC');

  // 2. TABLES SECTION
  lines.push('0', 'SECTION', '2', 'TABLES');

  // Layers normalizados (12 capas)
  lines.push('0', 'TABLE', '2', 'LAYER', '70', '12');
  lines.push('0', 'LAYER', '2', '0', '70', '0', '62', '7', '6', 'CONTINUOUS');
  lines.push('0', 'LAYER', '2', 'EJE_VIA', '70', '0', '62', '8', '6', 'CONTINUOUS');
  lines.push('0', 'LAYER', '2', 'BORDE_EXPLORACION', '70', '0', '62', '9', '6', 'CONTINUOUS');
  lines.push('0', 'LAYER', '2', 'COTAS', '70', '0', '62', '7', '6', 'CONTINUOUS');
  // Redes Técnicas
  lines.push('0', 'LAYER', '2', 'RED_GAS', '70', '0', '62', '2', '6', 'CONTINUOUS');             // Amarillo #2
  lines.push('0', 'LAYER', '2', 'RED_ACUEDUCTO', '70', '0', '62', '5', '6', 'CONTINUOUS');       // Azul #5
  lines.push('0', 'LAYER', '2', 'RED_ENERGIA', '70', '0', '62', '1', '6', 'CONTINUOUS');         // Rojo #1
  lines.push('0', 'LAYER', '2', 'RED_TELECOM', '70', '0', '62', '30', '6', 'CONTINUOUS');        // Naranja #30
  lines.push('0', 'LAYER', '2', 'RED_ALCANTARILLADO', '70', '0', '62', '3', '6', 'CONTINUOUS');   // Verde #3
  lines.push('0', 'LAYER', '2', 'RED_OTRAS', '70', '0', '62', '6', '6', 'CONTINUOUS');           // Magenta #6
  lines.push('0', 'LAYER', '2', 'TEXTOS_INTERFERENCIAS', '70', '0', '62', '7', '6', 'CONTINUOUS');
  lines.push('0', 'LAYER', '2', 'ROTULO_PROCIMEC', '70', '0', '62', '7', '6', 'CONTINUOUS');
  lines.push('0', 'ENDTAB');

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

  // Delinear tramos
  tramosList.forEach((tramo, idx) => {
    const ml = Math.max(Number(tramo.ml) || 20, 10);
    const m2 = Number(tramo.m2) || ml * 4;
    const width = Math.min(Math.max(m2 / ml, 3.0), 12.0);
    const halfW = width / 2;

    const startX = currentX;
    const endX = currentX + ml;

    // Eje y Bordes
    addDxfLine(lines, 'EJE_VIA', startX, baseY, 0, endX, baseY, 0);
    addDxfLine(lines, 'BORDE_EXPLORACION', startX, baseY + halfW, 0, endX, baseY + halfW, 0);
    addDxfLine(lines, 'BORDE_EXPLORACION', startX, baseY - halfW, 0, endX, baseY - halfW, 0);
    addDxfLine(lines, 'BORDE_EXPLORACION', startX, baseY - halfW, 0, startX, baseY + halfW, 0);
    addDxfLine(lines, 'BORDE_EXPLORACION', endX, baseY - halfW, 0, endX, baseY + halfW, 0);

    // Abscisas
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

  // Distribuir e incrustar las interferencias detectadas sobre los tramos
  const totalExplorationLength = tramosList.reduce((sum, t) => sum + (Number(t.ml) || 20), 0);
  const startAlignmentX = 100.0;

  utilities.forEach((util, uIdx) => {
    const layerInfo = getUtilityLayer(util.type);
    const depthZ = -Math.abs(Number(util.estimated_depth_m) || 0.8);

    // Posición a lo largo del alineamiento
    const ratio = (uIdx + 1) / (utilities.length + 1);
    const targetX = startAlignmentX + ratio * (totalExplorationLength || 100);

    // Cruce transversal o diagonal de la red subterránea
    const pipeYStart = baseY - 6.0;
    const pipeYEnd = baseY + 6.0;
    const pipeXOffset = ((uIdx % 3) - 1) * 2.5;

    // Línea de la tubería en 3D (con cota Z invert)
    addDxfLine(
      lines,
      layerInfo.layer,
      targetX - pipeXOffset,
      pipeYStart,
      depthZ,
      targetX + pipeXOffset,
      pipeYEnd,
      depthZ
    );

    // Punto/Círculo de intercepción en el eje
    addDxfCircle(lines, layerInfo.layer, targetX, baseY, depthZ, 0.35);

    // Línea directriz y etiqueta técnica
    const calloutY = uIdx % 2 === 0 ? baseY + 7.5 : baseY - 7.5;
    addDxfLine(lines, 'TEXTOS_INTERFERENCIAS', targetX, baseY + (uIdx % 2 === 0 ? 0.4 : -0.4), 0, targetX + 1.5, calloutY, 0);

    const calloutLabel1 = `[${layerInfo.label}] ${cleanDxfString(util.type)}`;
    const calloutLabel2 = `DIAM: ${cleanDxfString(util.diameter || 'N/D')} | Z = ${depthZ.toFixed(2)}m (${Math.abs(depthZ).toFixed(2)}m prof.)`;
    const calloutLabel3 = `CONF: ${cleanDxfString(util.confidence).toUpperCase()}${util.description ? ' - ' + cleanDxfString(util.description) : ''}`;

    addDxfText(lines, 'TEXTOS_INTERFERENCIAS', targetX + 1.8, calloutY + 0.8, 0, 0.7, calloutLabel1);
    addDxfText(lines, 'TEXTOS_INTERFERENCIAS', targetX + 1.8, calloutY, 0, 0.6, calloutLabel2);
    addDxfText(lines, 'TEXTOS_INTERFERENCIAS', targetX + 1.8, calloutY - 0.7, 0, 0.55, calloutLabel3);
  });

  // 4. Cuadro Consolidado de Interferencias en el Modelo CAD
  const tableX = 100.0;
  const tableY = baseY - 25.0;
  addDxfUtilitiesTable(lines, utilities, tableX, tableY);

  // 5. Rótulo Institucional PROCIMEC INGENIERÍA S.A.S.
  addDxfTitleBlock(lines, project, Math.max(currentX, 260), baseY);

  lines.push('0', 'ENDSEC');
  lines.push('0', 'EOF');

  return lines.join('\r\n') + '\r\n';
}

/**
 * Helpers auxiliares para emitir primitivas DXF limpias y robustas
 */
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

function addDxfTitleBlock(lines: string[], project: DxfProjectMeta, rightX: number, baseY: number) {
  const boxWidth = 90.0;
  const boxHeight = 40.0;
  const boxX = rightX + 15.0;
  const boxY = baseY - 15.0;

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

  addDxfText(lines, 'ROTULO_PROCIMEC', boxX + 3.0, boxY + 5.5, 0, 0.8, `FECHA: ${new Date().toISOString().slice(0, 10)} | ESCALA: 1:500`);
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
