/**
 * MOTOR DE GENERACIÓN VECTORIAL AUTOCAD DXF R2018 / AC1027
 * Plataforma PROCIMEC INGENIERÍA S.A.S. — PCM CLOUD
 * Genera planos 2D vectoriales en texto plano ASCII estándar (abrible directamente en AutoCAD, Civil 3D y QGIS)
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
 * Mapeo de capas técnicas normalizadas de servicios públicos según norma PROCIMEC
 */
export function getUtilityLayer(type: string): { layer: string; color: number; label: string } {
  const norm = (type || '').toLowerCase();
  if (norm.includes('gas')) {
    return { layer: 'RED_GAS', color: 2, label: 'GAS' }; // Amarillo
  } else if (norm.includes('agua') || norm.includes('acueducto') || norm.includes('hidr') || norm.includes('potable')) {
    return { layer: 'RED_ACUEDUCTO', color: 5, label: 'ACUEDUCTO' }; // Azul
  } else if (norm.includes('electr') || norm.includes('energ') || norm.includes('bt') || norm.includes('mt') || norm.includes('at')) {
    return { layer: 'RED_ENERGIA', color: 1, label: 'ENERGIA' }; // Rojo
  } else if (norm.includes('telecom') || norm.includes('fibra') || norm.includes('datos') || norm.includes('telefon')) {
    return { layer: 'RED_TELECOM', color: 30, label: 'TELECOM' }; // Naranja
  } else if (norm.includes('alcantarill') || norm.includes('sanitari') || norm.includes('pluvial') || norm.includes('drenaje')) {
    return { layer: 'RED_ALCANTARILLADO', color: 3, label: 'ALCANTARILLADO' }; // Verde
  }
  return { layer: 'RED_OTRAS', color: 6, label: 'INTERFERENCIA' }; // Magenta
}

/**
 * Generador del Plano 2D Base (.DXF) - Fase 1
 */
export function generateBase2dDxf(
  project: DxfProjectMeta,
  tramos: DxfTramoInput[]
): string {
  const lines: string[] = [];

  // 1. HEADER SECTION
  lines.push('0', 'SECTION', '2', 'HEADER');
  lines.push('9', '$ACADVER', '1', 'AC1027'); // AutoCAD 2013-2018+ format
  lines.push('9', '$INSUNITS', '70', '6');    // 6 = Metros
  lines.push('9', '$MEASUREMENT', '70', '1'); // 1 = Métrico
  lines.push('0', 'ENDSEC');

  // 2. TABLES SECTION (Linetypes & Layers)
  lines.push('0', 'SECTION', '2', 'TABLES');

  // Tabla LTYPE
  lines.push('0', 'TABLE', '2', 'LTYPE', '70', '3');
  // Continuous
  lines.push('0', 'LTYPE', '2', 'CONTINUOUS', '70', '0', '3', 'Solid line', '72', '65', '73', '0', '40', '0.0');
  // Center
  lines.push('0', 'LTYPE', '2', 'CENTER', '70', '0', '3', 'Center ____ _ ____', '72', '65', '73', '4', '40', '2.0', '49', '1.25', '49', '-0.25', '49', '0.25', '49', '-0.25');
  // Dashed
  lines.push('0', 'LTYPE', '2', 'DASHED', '70', '0', '3', 'Dashed __ __ __', '72', '65', '73', '2', '40', '1.0', '49', '0.75', '49', '-0.25');
  lines.push('0', 'ENDTAB');

  // Tabla LAYER
  lines.push('0', 'TABLE', '2', 'LAYER', '70', '5');
  // Capa 0
  lines.push('0', 'LAYER', '2', '0', '70', '0', '62', '7', '6', 'CONTINUOUS');
  // EJE_VIA (Color 1 - Rojo, Ejes viales)
  lines.push('0', 'LAYER', '2', 'EJE_VIA', '70', '0', '62', '1', '6', 'CENTER', '370', '30');
  // BORDE_EXPLORACION (Color 8 - Gris, Franja de rastreo)
  lines.push('0', 'LAYER', '2', 'BORDE_EXPLORACION', '70', '0', '62', '8', '6', 'DASHED', '370', '15');
  // COTAS (Color 7 - Blanco)
  lines.push('0', 'LAYER', '2', 'COTAS', '70', '0', '62', '7', '6', 'CONTINUOUS', '370', '18');
  // ROTULO_PROCIMEC
  lines.push('0', 'LAYER', '2', 'ROTULO_PROCIMEC', '70', '0', '62', '7', '6', 'CONTINUOUS', '370', '25');
  lines.push('0', 'ENDTAB');

  lines.push('0', 'ENDSEC');

  // 3. ENTITIES SECTION
  lines.push('0', 'SECTION', '2', 'ENTITIES');

  let currentX = 100.0;
  const baseY = 100.0;

  // Delinear cada tramo operativo
  tramos.forEach((tramo, idx) => {
    const ml = Math.max(tramo.ml || 20, 10);
    const m2 = tramo.m2 || ml * 4;
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
    const labelTitle = `TRAMO ${idx + 1}: ${tramo.sector.toUpperCase()}`;
    const labelSub = `LONGITUD: ${ml.toFixed(2)} ML | ANCHO: ${width.toFixed(2)} m | AREA: ${m2.toFixed(2)} M2 | PROF. MAX: ${tramo.max_depth_m.toFixed(2)} m`;
    addDxfText(lines, 'COTAS', startX, baseY + halfW + 1.8, 0, 1.2, labelTitle);
    addDxfText(lines, 'COTAS', startX, baseY + halfW + 0.6, 0, 0.8, labelSub);

    currentX = endX + 40.0; // Espaciado entre tramos
  });

  // 4. Rótulo Institucional PROCIMEC INGENIERÍA S.A.S.
  addDxfTitleBlock(lines, project, currentX > 100 ? currentX : 250, baseY);

  lines.push('0', 'ENDSEC');
  lines.push('0', 'EOF');

  return lines.join('\n');
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
  lines.push('9', '$ACADVER', '1', 'AC1027');
  lines.push('9', '$INSUNITS', '70', '6'); // Metros
  lines.push('9', '$MEASUREMENT', '70', '1');
  lines.push('0', 'ENDSEC');

  // 2. TABLES SECTION
  lines.push('0', 'SECTION', '2', 'TABLES');

  // Linetypes
  lines.push('0', 'TABLE', '2', 'LTYPE', '70', '4');
  lines.push('0', 'LTYPE', '2', 'CONTINUOUS', '70', '0', '3', 'Solid line', '72', '65', '73', '0', '40', '0.0');
  lines.push('0', 'LTYPE', '2', 'CENTER', '70', '0', '3', 'Center ____ _ ____', '72', '65', '73', '4', '40', '2.0', '49', '1.25', '49', '-0.25', '49', '0.25', '49', '-0.25');
  lines.push('0', 'LTYPE', '2', 'DASHED', '70', '0', '3', 'Dashed __ __ __', '72', '65', '73', '2', '40', '1.0', '49', '0.75', '49', '-0.25');
  lines.push('0', 'LTYPE', '2', 'HIDDEN', '70', '0', '3', 'Hidden _ _ _', '72', '65', '73', '2', '40', '0.5', '49', '0.35', '49', '-0.15');
  lines.push('0', 'ENDTAB');

  // Layers normalizados
  lines.push('0', 'TABLE', '2', 'LAYER', '70', '12');
  lines.push('0', 'LAYER', '2', '0', '70', '0', '62', '7', '6', 'CONTINUOUS');
  lines.push('0', 'LAYER', '2', 'EJE_VIA', '70', '0', '62', '8', '6', 'CENTER', '370', '25');
  lines.push('0', 'LAYER', '2', 'BORDE_EXPLORACION', '70', '0', '62', '9', '6', 'DASHED', '370', '15');
  lines.push('0', 'LAYER', '2', 'COTAS', '70', '0', '62', '7', '6', 'CONTINUOUS', '370', '18');
  // Redes Técnicas
  lines.push('0', 'LAYER', '2', 'RED_GAS', '70', '0', '62', '2', '6', 'HIDDEN', '370', '50');             // Amarillo
  lines.push('0', 'LAYER', '2', 'RED_ACUEDUCTO', '70', '0', '62', '5', '6', 'CONTINUOUS', '370', '50');     // Azul
  lines.push('0', 'LAYER', '2', 'RED_ENERGIA', '70', '0', '62', '1', '6', 'CONTINUOUS', '370', '50');       // Rojo
  lines.push('0', 'LAYER', '2', 'RED_TELECOM', '70', '0', '62', '30', '6', 'DASHED', '370', '40');          // Naranja
  lines.push('0', 'LAYER', '2', 'RED_ALCANTARILLADO', '70', '0', '62', '3', '6', 'CONTINUOUS', '370', '60'); // Verde
  lines.push('0', 'LAYER', '2', 'RED_OTRAS', '70', '0', '62', '6', '6', 'HIDDEN', '370', '40');             // Magenta
  lines.push('0', 'LAYER', '2', 'TEXTOS_INTERFERENCIAS', '70', '0', '62', '7', '6', 'CONTINUOUS', '370', '20');
  lines.push('0', 'LAYER', '2', 'ROTULO_PROCIMEC', '70', '0', '62', '7', '6', 'CONTINUOUS', '370', '25');
  lines.push('0', 'ENDTAB');

  lines.push('0', 'ENDSEC');

  // 3. ENTITIES SECTION
  lines.push('0', 'SECTION', '2', 'ENTITIES');

  let currentX = 100.0;
  const baseY = 100.0;

  // Delinear tramos
  tramos.forEach((tramo, idx) => {
    const ml = Math.max(tramo.ml || 20, 10);
    const m2 = tramo.m2 || ml * 4;
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

    addDxfText(lines, 'COTAS', startX, baseY + halfW + 1.8, 0, 1.1, `TRAMO ${idx + 1}: ${tramo.sector.toUpperCase()}`);

    currentX = endX + 40.0;
  });

  // Distribuir e incrustar las interferencias detectadas sobre los tramos
  const totalExplorationLength = tramos.reduce((sum, t) => sum + (t.ml || 20), 0);
  const startAlignmentX = 100.0;

  utilities.forEach((util, uIdx) => {
    const layerInfo = getUtilityLayer(util.type);
    const depthZ = -Math.abs(util.estimated_depth_m || 0.8);

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

    const calloutLabel1 = `[${layerInfo.label}] ${util.type}`;
    const calloutLabel2 = `DIAM: ${util.diameter || 'N/D'} | Z = ${depthZ.toFixed(2)}m (${Math.abs(depthZ).toFixed(2)}m prof.)`;
    const calloutLabel3 = `CONF: ${util.confidence.toUpperCase()}${util.description ? ' - ' + util.description : ''}`;

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

  return lines.join('\n');
}

/**
 * Helpers auxiliares para emitir primitivas DXF limpias
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
  lines.push('10', x1.toFixed(4));
  lines.push('20', y1.toFixed(4));
  lines.push('30', z1.toFixed(4));
  lines.push('11', x2.toFixed(4));
  lines.push('21', y2.toFixed(4));
  lines.push('31', z2.toFixed(4));
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
  lines.push('10', cx.toFixed(4));
  lines.push('20', cy.toFixed(4));
  lines.push('30', cz.toFixed(4));
  lines.push('40', radius.toFixed(4));
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
  lines.push('10', x.toFixed(4));
  lines.push('20', y.toFixed(4));
  lines.push('30', z.toFixed(4));
  lines.push('40', height.toFixed(4));
  lines.push('1', text.replace(/[\n\r]/g, ' '));
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

  addDxfText(lines, 'ROTULO_PROCIMEC', boxX + 3.0, boxY + 25.5, 0, 0.9, `PROYECTO: ${(project.name || 'GPR PROJECT').toUpperCase()}`);
  addDxfText(lines, 'ROTULO_PROCIMEC', boxX + 3.0, boxY + 22.0, 0, 0.8, `CLIENTE: ${(project.client || 'CLIENTE').toUpperCase()}`);

  addDxfText(lines, 'ROTULO_PROCIMEC', boxX + 3.0, boxY + 15.5, 0, 0.8, `UBICACION: ${(project.location || 'COLOMBIA').toUpperCase()}`);
  addDxfText(lines, 'ROTULO_PROCIMEC', boxX + 3.0, boxY + 12.0, 0, 0.8, `CENTRO DE COSTOS: ${project.cost_center || 'N/A'}`);

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
    addDxfText(lines, 'COTAS', x + 2.0, curY, 0, 0.65, `${idx + 1}`);
    addDxfText(lines, 'COTAS', x + 12.0, curY, 0, 0.65, u.type.slice(0, 20));
    addDxfText(lines, 'COTAS', x + 45.0, curY, 0, 0.65, u.diameter || 'N/D');
    addDxfText(lines, 'COTAS', x + 65.0, curY, 0, 0.65, `${u.estimated_depth_m.toFixed(2)} m`);
    addDxfText(lines, 'COTAS', x + 85.0, curY, 0, 0.65, u.confidence);
    addDxfText(lines, 'COTAS', x + 105.0, curY, 0, 0.65, u.report_date || '—');
    addDxfLine(lines, 'BORDE_EXPLORACION', x, y - (idx + 3) * rowH, 0, x + w, y - (idx + 3) * rowH, 0);
  });
}
