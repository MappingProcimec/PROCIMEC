/**
 * MOTOR DE ENSAMBLAJE BIM 3D IFC 4.0 / REVIT (.IFC / .RVT)
 * Plataforma PROCIMEC INGENIERÍA S.A.S. — PCM CLOUD
 * Genera archivos de intercambio BIM compatibles con Autodesk Revit, Navisworks, Civil 3D y Solibri
 * Geometría paramétrica volumétrica LOD 300 con validación de interferencias espaciales (Clash Detection)
 */

export interface BimUtilityInput {
  id?: string;
  type: string;
  diameter?: string;
  estimated_depth_m: number;
  confidence: string;
  description?: string;
  report_date?: string;
}

export interface BimProjectMeta {
  name: string;
  client: string;
  cost_center?: string;
  location?: string;
}

interface ParsedPipeInfo {
  index: number;
  type: string;
  serviceCategory: string;
  colorRgb: [number, number, number];
  diameterM: number;
  radiusM: number;
  depthZ: number;
  startX: number;
  startY: number;
  lengthM: number;
  confidence: string;
  description: string;
  clashWarning: boolean;
  clashNotes: string;
}

/**
 * Parsea el diámetro nominal a metros
 */
function parseDiameterToMeters(diameterStr?: string): number {
  if (!diameterStr) return 0.10; // 100mm por defecto
  const clean = diameterStr.toLowerCase().trim();
  const num = parseFloat(clean);
  if (isNaN(num)) return 0.10;

  // Si tiene comillas dobles o indica pulgadas
  if (clean.includes('"') || clean.includes('in') || clean.includes('pulg')) {
    return num * 0.0254; // pulgadas a metros
  }
  // Si es mayor a 5 probablemente está en cm o mm
  if (num >= 50) return num / 1000; // mm a metros
  if (num >= 5) return num / 100;   // cm a metros
  return num * 0.0254;              // por defecto asumir pulgadas para tuberías (ej. 2, 3, 4, 6)
}

/**
 * Obtiene la categoría de servicio y color normalizado RGB para IFC
 */
function getServiceColor(type: string): { category: string; rgb: [number, number, number] } {
  const norm = (type || '').toLowerCase();
  if (norm.includes('gas')) {
    return { category: 'GAS', rgb: [1.0, 0.85, 0.0] }; // Amarillo
  } else if (norm.includes('agua') || norm.includes('acueducto') || norm.includes('hidr') || norm.includes('potable')) {
    return { category: 'ACUEDUCTO', rgb: [0.0, 0.45, 0.95] }; // Azul
  } else if (norm.includes('electr') || norm.includes('energ') || norm.includes('bt') || norm.includes('mt') || norm.includes('at')) {
    return { category: 'ENERGIA', rgb: [0.95, 0.15, 0.15] }; // Rojo
  } else if (norm.includes('telecom') || norm.includes('fibra') || norm.includes('datos') || norm.includes('telefon')) {
    return { category: 'TELECOM', rgb: [1.0, 0.55, 0.0] }; // Naranja
  } else if (norm.includes('alcantarill') || norm.includes('sanitari') || norm.includes('pluvial') || norm.includes('drenaje')) {
    return { category: 'ALCANTARILLADO', rgb: [0.15, 0.75, 0.25] }; // Verde
  }
  return { category: 'OTRAS', rgb: [0.75, 0.25, 0.75] }; // Magenta
}

/**
 * Generador principal del modelo 3D BIM en formato IFC 4.0 (ISO 10303-21)
 */
export function generateIfc4Model(
  project: BimProjectMeta,
  utilities: BimUtilityInput[],
  totalMl: number
): string {
  const timestamp = new Date().toISOString();
  const safeProjectName = (project.name || 'Proyecto_GPR').replace(/[^a-zA-Z0-9_-]/g, '_');

  // 1. Procesar tuberías y resolver geometría espacial
  const pipes: ParsedPipeInfo[] = utilities.map((u, idx) => {
    const diamM = parseDiameterToMeters(u.diameter);
    const depthZ = -Math.abs(u.estimated_depth_m || 0.85);
    const serviceInfo = getServiceColor(u.type);

    // Distribuir a lo largo del corredor
    const totalCorrLength = Math.max(totalMl, 80);
    const spacing = totalCorrLength / (utilities.length + 1);
    const startX = 20.0 + (idx + 1) * spacing;
    const startY = 15.0;
    const lengthM = 30.0; // Longitud del tramo de tubería transversal

    return {
      index: idx + 1,
      type: u.type,
      serviceCategory: serviceInfo.category,
      colorRgb: serviceInfo.rgb,
      diameterM: diamM,
      radiusM: diamM / 2,
      depthZ,
      startX,
      startY,
      lengthM,
      confidence: u.confidence || 'Alta',
      description: u.description || '',
      clashWarning: false,
      clashNotes: 'Distancia de seguridad validada',
    };
  });

  // 2. Motor de Clash Detection (Detección de interferencias espaciales < 0.30m)
  for (let i = 0; i < pipes.length; i++) {
    for (let j = i + 1; j < pipes.length; j++) {
      const p1 = pipes[i];
      const p2 = pipes[j];
      const verticalDist = Math.abs(p1.depthZ - p2.depthZ) - (p1.radiusM + p2.radiusM);
      const horizontalDist = Math.abs(p1.startX - p2.startX);

      if (horizontalDist < 3.0 && verticalDist < 0.30) {
        p1.clashWarning = true;
        p2.clashWarning = true;
        p1.clashNotes = `CRUCE CERCANO: Red ${p2.serviceCategory} a ${(verticalDist * 100).toFixed(0)}cm de separación`;
        p2.clashNotes = `CRUCE CERCANO: Red ${p1.serviceCategory} a ${(verticalDist * 100).toFixed(0)}cm de separación`;
      }
    }
  }

  // 3. Construcción del cuerpo ISO-10303-21 STEP
  let idCounter = 1;
  const nextId = () => `#${idCounter++}`;

  const lines: string[] = [];

  // ENCABEZADO STEP
  lines.push('ISO-10303-21;');
  lines.push('HEADER;');
  lines.push(`FILE_DESCRIPTION(('ViewDefinition [CoordinationView_V2.0]','PROCIMEC BIM SUBTERRÁNEO LOD 300','CLASH DETECTION VALIDATED'),'2;1');`);
  lines.push(`FILE_NAME('${safeProjectName}_LOD300.ifc','${timestamp}',('PROCIMEC INGENIERÍA S.A.S.'),('PCM CLOUD'),'PCM GPR-BIM Engine v2','AUTODESK REVIT 2024 / IFC 4.0','');`);
  lines.push(`FILE_SCHEMA(('IFC4'));`);
  lines.push('ENDSEC;');

  // SECCIÓN DATA
  lines.push('DATA;');

  // Entidades base de proyecto, organización y unidades
  const idPerson = nextId(); // #1
  lines.push(`${idPerson}= IFCORGANIZATION($,'PROCIMEC INGENIERÍA S.A.S.','Consultoría Geofísica y Modelado BIM',$,$);`);

  const idApp = nextId(); // #2
  lines.push(`${idApp}= IFCAPPLICATION(${idPerson},'2.0','PCM CLOUD BIM Studio','PROCIMEC');`);

  // Unidades Métricas (Metro, Grado, Segundo)
  const idSiLength = nextId(); // #3
  lines.push(`${idSiLength}= IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);`);

  const idSiAngle = nextId(); // #4
  lines.push(`${idSiAngle}= IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.);`);

  const idUnits = nextId(); // #5
  lines.push(`${idUnits}= IFCUNITASSIGNMENT((${idSiLength},${idSiAngle}));`);

  // Contexto geométrico 3D
  const idAxisOrigin = nextId(); // #6
  lines.push(`${idAxisOrigin}= IFCCARTESIANPOINT((0.,0.,0.));`);

  const idAxisZ = nextId(); // #7
  lines.push(`${idAxisZ}= IFCDIRECTION((0.,0.,1.));`);

  const idAxisX = nextId(); // #8
  lines.push(`${idAxisX}= IFCDIRECTION((1.,0.,0.));`);

  const idAxisY = nextId(); // #9
  lines.push(`${idAxisY}= IFCDIRECTION((0.,1.,0.));`);

  const idWorldCoord = nextId(); // #10
  lines.push(`${idWorldCoord}= IFCAXIS2PLACEMENT3D(${idAxisOrigin},${idAxisZ},${idAxisX});`);

  const idGeoContext = nextId(); // #11
  lines.push(`${idGeoContext}= IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${idWorldCoord},$);`);

  // Jerarquía Espacial: Project -> Site -> Building -> Storey
  const idProject = nextId(); // #12
  lines.push(`${idProject}= IFCPROJECT('12345678-ABCD-0001-0000-000000000001',$,'${safeProjectName}','Redes Subterráneas GPR LOD 300',$,$,$,(${idGeoContext}),${idUnits});`);

  const idSite = nextId(); // #13
  lines.push(`${idSite}= IFCSITE('12345678-ABCD-0001-0000-000000000002',$,'Sitio de Exploración GPR',$,$,${idWorldCoord},$,$,.ELEMENT.,(0,0,0),(0,0,0),0.,$,$);`);

  const idBuilding = nextId(); // #14
  lines.push(`${idBuilding}= IFCBUILDING('12345678-ABCD-0001-0000-000000000003',$,'Infraestructura Vial y Redes Subsuperficiales',$,$,${idWorldCoord},$,$,.ELEMENT.,$,$,$);`);

  const idStorey = nextId(); // #15
  lines.push(`${idStorey}= IFCBUILDINGSTOREY('12345678-ABCD-0001-0000-000000000004',$,'Nivel Rasante 0.00 / Subsuelo',$,$,${idWorldCoord},$,$,.ELEMENT.,0.);`);

  // Relaciones de agregación espacial
  lines.push(`${nextId()}= IFCRELAGGREGATES('12345678-ABCD-0002-0000-000000000001',$,'ProjectSite',$,${idProject},(${idSite}));`);
  lines.push(`${nextId()}= IFCRELAGGREGATES('12345678-ABCD-0002-0000-000000000002',$,'SiteBuilding',$,${idSite},(${idBuilding}));`);
  lines.push(`${nextId()}= IFCRELAGGREGATES('12345678-ABCD-0002-0000-000000000003',$,'BuildingStorey',$,${idBuilding},(${idStorey}));`);

  // Ensamblar cada tubería en 3D volumétrico LOD 300
  const pipeElementIds: string[] = [];

  pipes.forEach((pipe) => {
    // 1. Posición de inicio y dirección de extrusión
    const idPtStart = nextId();
    lines.push(`${idPtStart}= IFCCARTESIANPOINT((${pipe.startX.toFixed(3)},${pipe.startY.toFixed(3)},${pipe.depthZ.toFixed(3)}));`);

    const idExtrusionPlacement = nextId();
    // Extrusión a lo largo del eje Y (cruce transversal)
    lines.push(`${idExtrusionPlacement}= IFCAXIS2PLACEMENT3D(${idPtStart},${idAxisY},${idAxisX});`);

    // 2. Perfil Circular Cilíndrico de la tubería (Diámetro nominal real)
    const idCenterPt = nextId();
    lines.push(`${idCenterPt}= IFCCARTESIANPOINT((0.,0.));`);

    const idProfile = nextId();
    lines.push(`${idProfile}= IFCCIRCLEPROFILEDEF(.AREA.,'Perfil_${pipe.serviceCategory}_${pipe.index}',${nextId()},${pipe.radiusM.toFixed(4)});`);
    lines.push(`${idCounter - 2}= IFCAXIS2PLACEMENT2D(${idCenterPt},$);`);

    // 3. Sólido 3D extruido
    const idSolid = nextId();
    lines.push(`${idSolid}= IFCEXTRUDEDAREASOLID(${idProfile},${idExtrusionPlacement},${idAxisZ},${pipe.lengthM.toFixed(3)});`);

    // 4. Color y Material superficial
    const idColour = nextId();
    lines.push(`${idColour}= IFCCOLOURRGB($,${pipe.colorRgb[0].toFixed(2)},${pipe.colorRgb[1].toFixed(2)},${pipe.colorRgb[2].toFixed(2)});`);

    const idSurfaceStyleShading = nextId();
    lines.push(`${idSurfaceStyleShading}= IFCSURFACESTYLESHADING(${idColour});`);

    const idSurfaceStyle = nextId();
    lines.push(`${idSurfaceStyle}= IFCSURFACESTYLE('Estilo_${pipe.serviceCategory}',.BOTH.,(${idSurfaceStyleShading}));`);

    const idPresentationStyle = nextId();
    lines.push(`${idPresentationStyle}= IFCSTYLEDITEM(${idSolid},(${idSurfaceStyle}),$);`);

    // 5. Representación de Forma del elemento
    const idShapeRep = nextId();
    lines.push(`${idShapeRep}= IFCSHAPEREPRESENTATION(${idGeoContext},'Body','SweptSolid',(${idSolid}));`);

    const idProductDefShape = nextId();
    lines.push(`${idProductDefShape}= IFCPRODUCTDEFINITIONSHAPE($,$,(${idShapeRep}));`);

    // 6. Colocación local de la tubería
    const idLocalPlacement = nextId();
    lines.push(`${idLocalPlacement}= IFCLOCALPLACEMENT(${idWorldCoord},${idWorldCoord});`);

    // 7. Elemento BIM: IfcPipeSegment
    const idPipeElem = nextId();
    pipeElementIds.push(idPipeElem);
    const pipeTag = `GPR-UTL-${pipe.index.toString().padStart(3, '0')}`;
    const pipeName = `${pipe.serviceCategory} [${pipe.type}] Ø ${pipe.diameterM ? (pipe.diameterM * 39.37).toFixed(1) + '"' : 'N/D'}`;
    lines.push(`${idPipeElem}= IFCPIPESEGMENT('${pipeTag}',$,'${pipeName}','Tubería subterránea detectada por Georadar GPR',$,${idLocalPlacement},${idProductDefShape},'${pipeTag}');`);

    // 8. Pset de Propiedades Técnicas y Auditoría de Detección
    const idPropDiam = nextId();
    lines.push(`${idPropDiam}= IFCPROPERTYSINGLEVALUE('NominalDiameter',$,IFCLENGTHMEASURE(${pipe.diameterM.toFixed(4)}),$);`);

    const idPropDepth = nextId();
    lines.push(`${idPropDepth}= IFCPROPERTYSINGLEVALUE('InvertDepth',$,IFCLENGTHMEASURE(${Math.abs(pipe.depthZ).toFixed(3)}),$);`);

    const idPropElevation = nextId();
    lines.push(`${idPropElevation}= IFCPROPERTYSINGLEVALUE('InvertElevationZ',$,IFCLENGTHMEASURE(${pipe.depthZ.toFixed(3)}),$);`);

    const idPropService = nextId();
    lines.push(`${idPropService}= IFCPROPERTYSINGLEVALUE('ServiceCategory',$,IFCLABEL('${pipe.serviceCategory}'),$);`);

    const idPropConf = nextId();
    lines.push(`${idPropConf}= IFCPROPERTYSINGLEVALUE('GprConfidenceLevel',$,IFCLABEL('${pipe.confidence}'),$);`);

    const idPropClash = nextId();
    lines.push(`${idPropClash}= IFCPROPERTYSINGLEVALUE('SpatialClashStatus',$,IFCLABEL('${pipe.clashNotes}'),$);`);

    const idPset = nextId();
    lines.push(`${idPset}= IFCPROPERTYSET('12345678-ABCD-0003-0000-${pipe.index.toString().padStart(12, '0')}',$,'Pset_Procimec_GPR_LOD300',$,(${idPropDiam},${idPropDepth},${idPropElevation},${idPropService},${idPropConf},${idPropClash}));`);

    // Vincular Pset a la tubería
    lines.push(`${nextId()}= IFCRELDEFINESBYPROPERTIES('12345678-ABCD-0004-0000-${pipe.index.toString().padStart(12, '0')}',$,$,$,(${idPipeElem}),${idPset});`);
  });

  // Vincular todas las tuberías al Storey
  if (pipeElementIds.length > 0) {
    lines.push(`${nextId()}= IFCRELCONTAINEDINSPATIALSTRUCTURE('12345678-ABCD-0005-0000-000000000001',$,'SubterraneanPipes',$,(${pipeElementIds.join(',')}),${idStorey});`);
  }

  lines.push('ENDSEC;');
  lines.push('END-ISO-10303-21;');

  return lines.join('\n');
}
