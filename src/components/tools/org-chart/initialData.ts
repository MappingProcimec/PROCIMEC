import { DiagramEdge, DiagramNode, DiagramPayload } from './types';

// Layout Constants
export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 100;
export const HORIZONTAL_SPACING = 50;
export const VERTICAL_SPACING = 90;

/**
 * Deterministic DAG Layout algorithm:
 * Distributes nodes into levels and evenly centers horizontal positions.
 */
export function computeAutoLayout(
  nodes: Omit<DiagramNode, 'x' | 'y' | 'width' | 'height'>[]
): DiagramNode[] {
  if (nodes.length === 0) return [];

  // Group nodes by level
  const levelsMap = new Map<number, typeof nodes>();
  nodes.forEach((n) => {
    const list = levelsMap.get(n.level) || [];
    list.push(n);
    levelsMap.set(n.level, list);
  });

  const sortedLevels = Array.from(levelsMap.keys()).sort((a, b) => a - b);

  // Determine max row width for visual centering
  let maxNodesInRow = 1;
  sortedLevels.forEach((lvl) => {
    const count = levelsMap.get(lvl)?.length || 0;
    if (count > maxNodesInRow) maxNodesInRow = count;
  });

  const totalMaxWidth = maxNodesInRow * (NODE_WIDTH + HORIZONTAL_SPACING);

  const positionedNodes: DiagramNode[] = [];

  sortedLevels.forEach((lvl) => {
    const rowNodes = levelsMap.get(lvl) || [];
    const rowWidth = rowNodes.length * (NODE_WIDTH + HORIZONTAL_SPACING) - HORIZONTAL_SPACING;
    const startX = Math.max(40, (totalMaxWidth - rowWidth) / 2);
    const startY = 60 + lvl * (NODE_HEIGHT + VERTICAL_SPACING);

    rowNodes.forEach((node, idx) => {
      positionedNodes.push({
        ...node,
        x: Math.round(startX + idx * (NODE_WIDTH + HORIZONTAL_SPACING)),
        y: Math.round(startY),
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });
    });
  });

  return positionedNodes;
}

/**
 * Fallback / Canonical PROCIMEC Operational Org Data
 */
export function getCanonicalOrgData(): DiagramPayload {
  const rawNodes: Omit<DiagramNode, 'x' | 'y' | 'width' | 'height'>[] = [
    // Level 0: Dirección
    {
      id: 'dir-general',
      type: 'direction',
      title: 'Dirección General & Operativa',
      subtitle: 'Gerencia y Control de Calidad',
      category: 'direction',
      badge: 'Gerencia',
      status: 'active',
      email: 'direccion@procimec.com',
      level: 0,
      meta: { proyectos: 14, rol: 'Administrador General' },
      tags: ['Liderazgo', 'Estrategia', 'Gobernanza'],
    },
    // Level 1: Divisiones Clave
    {
      id: 'div-geofisica',
      type: 'division',
      title: 'División Geofísica & GPR',
      subtitle: 'Prospección y Ensayos No Destructivos',
      category: 'gpr',
      badge: 'Geofísica',
      status: 'active',
      level: 1,
      parentId: 'dir-general',
      meta: { frentes: 6, equipos: 'GPR Mala & GSSI' },
      tags: ['Georradar', 'Localización', 'Subsuelo'],
    },
    {
      id: 'div-cad-bim',
      type: 'division',
      title: 'Oficina Técnica CAD / BIM',
      subtitle: 'Post-procesamiento y Delineación',
      category: 'cad',
      badge: 'CAD / BIM',
      status: 'busy',
      level: 1,
      parentId: 'dir-general',
      meta: { frentes: 5, entregasPendientes: 3 },
      tags: ['Civil 3D', 'AutoCAD', 'Topografía'],
    },
    {
      id: 'div-hseq',
      type: 'division',
      title: 'Coordinación HSEQ & SST',
      subtitle: 'Seguridad, Salud y Medio Ambiente',
      category: 'hseq',
      badge: 'HSEQ',
      status: 'active',
      level: 1,
      parentId: 'dir-general',
      meta: { inspeccionesMes: 42, incidentes: 0 },
      tags: ['Seguridad', 'ATS', 'Inspección'],
    },
    {
      id: 'div-rrhh',
      type: 'division',
      title: 'División Gestión Humana & RRHH',
      subtitle: 'Administración de Personal, Cartas y Nómina',
      category: 'rrhh',
      badge: 'RRHH',
      status: 'active',
      level: 1,
      parentId: 'dir-general',
      meta: { cartasGestionadas: 24, auditorias: 'Al Día' },
      tags: ['Talento Humano', 'Cartas Laborales', 'Asistencia'],
    },
    {
      id: 'div-ti',
      type: 'division',
      title: 'Tecnología & Plataforma Digital',
      subtitle: 'Desarrollo, Automatización y Datos',
      category: 'admin',
      badge: 'TI / Plataforma',
      status: 'active',
      level: 1,
      parentId: 'dir-general',
      meta: { uptime: '99.9%', apis: 'Supabase + Gemini' },
      tags: ['Next.js', 'PostgreSQL', 'WhatsApp Bot'],
    },
    // Level 2: Especialistas y Cuadrillas
    {
      id: 'spec-localizador-1',
      type: 'user',
      title: 'Especialista Localizador GPR',
      subtitle: 'Operación en Terreno & Antenas',
      category: 'gpr',
      badge: 'Localizador',
      status: 'busy',
      email: 'campo.gpr@procimec.com',
      level: 2,
      parentId: 'div-geofisica',
      divisionId: 'div-geofisica',
      meta: { carga: '8.5h/día', proyectoActual: 'Línea Metro / Calle 72' },
      tags: ['Campo', 'GPR 400MHz', 'GPS Diferencial'],
    },
    {
      id: 'spec-operador-1',
      type: 'user',
      title: 'Técnico Operador de Campo',
      subtitle: 'Levantamiento & Topografía',
      category: 'gpr',
      badge: 'Operador',
      status: 'active',
      email: 'operaciones@procimec.com',
      level: 2,
      parentId: 'div-geofisica',
      divisionId: 'div-geofisica',
      meta: { proyectos: 2, estado: 'En Frente Activo' },
      tags: ['Estación Total', 'Prisma', 'Drone'],
    },
    {
      id: 'spec-delineante-1',
      type: 'user',
      title: 'Delineante Proyectista CAD',
      subtitle: 'Vectorización & Radargramas',
      category: 'cad',
      badge: 'Dibujo CAD',
      status: 'busy',
      email: 'cad.bim@procimec.com',
      level: 2,
      parentId: 'div-cad-bim',
      divisionId: 'div-cad-bim',
      meta: { planosEnCola: 4, horasPromedio: '8.5h' },
      tags: ['DWG', 'Perfiles', 'Redes de Servicios'],
    },
    {
      id: 'spec-auditor-hseq',
      type: 'user',
      title: 'Supervisor HSEQ Campo',
      subtitle: 'Auditoría Preoperacional & EPP',
      category: 'hseq',
      badge: 'HSEQ Campo',
      status: 'active',
      level: 2,
      parentId: 'div-hseq',
      divisionId: 'div-hseq',
      meta: { chequeosHoy: 8, reportes: 'Al Día' },
      tags: ['Protocolos', 'Matriz de Riesgo'],
    },
    {
      id: 'spec-rrhh-1',
      type: 'user',
      title: 'Coordinador Gestión Humana & RRHH',
      subtitle: 'Cartas Laborales, Retiro & Asistencia',
      category: 'rrhh',
      badge: 'RRHH',
      status: 'active',
      email: 'rrhh@procimec.com',
      level: 2,
      parentId: 'div-rrhh',
      divisionId: 'div-rrhh',
      meta: { cartasEmitidas: 18, controlAsistencia: 'Activo' },
      tags: ['Certificaciones', 'Nómina', 'Auditoría Cartas'],
    },
    // Level 3: Proyectos & Frentes de Trabajo
    {
      id: 'proj-metro-72',
      type: 'project',
      title: 'Proyecto Metro - Calle 72',
      subtitle: 'Detección de Redes Críticas 1.2km',
      category: 'gpr',
      badge: 'Obra Activa',
      status: 'active',
      level: 3,
      parentId: 'spec-localizador-1',
      meta: { metrajeLineal: '1,240 ml', avance: '78%' },
      tags: ['Acueducto', 'Gas', 'Alta Tensión'],
    },
    {
      id: 'proj-subestacion-norte',
      type: 'project',
      title: 'Subestación Eléctrica Norte',
      subtitle: 'Mapeo Subterráneo y Malla de Puesta a Tierra',
      category: 'cad',
      badge: 'En Delineación',
      status: 'warning',
      level: 3,
      parentId: 'spec-delineante-1',
      meta: { entregable: 'Plano As-Built 3D', prioridad: 'Alta' },
      tags: ['Energía', 'BIM LOD 350'],
    },
  ];

  const edges: DiagramEdge[] = [
    { id: 'e-dir-gpr', source: 'dir-general', target: 'div-geofisica', animated: true },
    { id: 'e-dir-cad', source: 'dir-general', target: 'div-cad-bim', animated: true },
    { id: 'e-dir-hseq', source: 'dir-general', target: 'div-hseq', animated: false },
    { id: 'e-dir-rrhh', source: 'dir-general', target: 'div-rrhh', animated: true },
    { id: 'e-dir-ti', source: 'dir-general', target: 'div-ti', animated: false },
    { id: 'e-gpr-loc', source: 'div-geofisica', target: 'spec-localizador-1', animated: true },
    { id: 'e-gpr-op', source: 'div-geofisica', target: 'spec-operador-1', animated: false },
    { id: 'e-cad-del', source: 'div-cad-bim', target: 'spec-delineante-1', animated: true },
    { id: 'e-hseq-aud', source: 'div-hseq', target: 'spec-auditor-hseq', animated: false },
    { id: 'e-rrhh-coord', source: 'div-rrhh', target: 'spec-rrhh-1', animated: true },
    { id: 'e-loc-pmetro', source: 'spec-localizador-1', target: 'proj-metro-72', animated: true },
    { id: 'e-del-psub', source: 'spec-delineante-1', target: 'proj-subestacion-norte', animated: true },
  ];

  return {
    mode: 'org',
    nodes: computeAutoLayout(rawNodes),
    edges,
    divisionsList: [
      { id: 'div-geofisica', name: 'División Geofísica & GPR', category: 'gpr' },
      { id: 'div-cad-bim', name: 'Oficina Técnica CAD / BIM', category: 'cad' },
      { id: 'div-hseq', name: 'Coordinación HSEQ & SST', category: 'hseq' },
      { id: 'div-rrhh', name: 'División Gestión Humana & RRHH', category: 'rrhh' },
      { id: 'div-ti', name: 'Tecnología & Plataforma Digital', category: 'admin' },
    ],
    lastSyncedAt: new Date().toISOString(),
    stats: {
      totalUsers: 5,
      totalDivisions: 5,
      totalRoles: 7,
      totalProjects: 2,
      activeNodes: rawNodes.length,
    },
  };
}

/**
 * Architecture & Operational Pipeline Data (Process Flow)
 */
export function getCanonicalPipelineData(): DiagramPayload {
  return buildDynamicPipelineData();
}

/**
 * Builds dynamic or canonical pipeline from platform tools
 */
export function buildDynamicPipelineData(
  dbTools?: Array<{ slug: string; name: string; category: string; description?: string | null }>
): DiagramPayload {
  const rawNodes: Omit<DiagramNode, 'x' | 'y' | 'width' | 'height'>[] = [
    // Level 0: Ingesta y Captura
    {
      id: 'pipe-field',
      type: 'client',
      title: 'Cuadrilla de Terreno & GPR',
      subtitle: 'Sensores GSSI, Mala y GPS Diferencial',
      category: 'gpr',
      badge: 'Ingesta Campo',
      status: 'active',
      level: 0,
      meta: { frecuencia: '400MHz / 900MHz', latencia: '< 15min' },
      tags: ['Georradar', 'Topografía', 'Operadores'],
    },
    {
      id: 'pipe-bot',
      type: 'system-service',
      title: 'Bot WhatsApp (Baileys + Gemini)',
      subtitle: 'Captura Automatizada de Reportes y HSEQ',
      category: 'admin',
      badge: 'Microservicio IA',
      status: 'active',
      level: 0,
      meta: { protocolo: 'Multi-device WS', modelo: 'Gemini 2.5 Flash' },
      tags: ['WhatsApp', 'NLP', 'Extracción'],
    },
    {
      id: 'pipe-portal-web',
      type: 'client',
      title: 'Portal Web PROCIMEC (App Router)',
      subtitle: 'Formularios Operativos y Paneles de Control',
      category: 'admin',
      badge: 'Web App',
      status: 'active',
      level: 0,
      meta: { framework: 'Next.js 14', pwa: 'Instalable' },
      tags: ['Portal', 'Gestión', 'PWA'],
    },

    // Level 1: Validación, API Core y Almacenamiento
    {
      id: 'pipe-api',
      type: 'system-service',
      title: 'Backend API & Next.js 14',
      subtitle: 'Validación Canónica & Control RLS',
      category: 'admin',
      badge: 'Core Engine',
      status: 'active',
      level: 1,
      meta: { framework: 'App Router', auth: 'NextAuth + JWT' },
      tags: ['REST', 'Seguridad', 'Audit Log'],
    },
    {
      id: 'pipe-db',
      type: 'database',
      title: 'Supabase PostgreSQL & Storage',
      subtitle: 'Base Relacional de Alta Integridad y Google Drive',
      category: 'admin',
      badge: 'PostgreSQL 15',
      status: 'active',
      level: 1,
      meta: { tablas: 'users, projects, reports, hr_letters', constraints: 'CHECK + FK' },
      tags: ['SQL', 'Realtime', 'Google Drive'],
    },

    // Level 2: Módulos Operativos por Especialidad
    {
      id: 'pipe-radargrama',
      type: 'system-service',
      title: 'Visor de Radargramas & GSF',
      subtitle: 'Procesamiento de Ecos y Filtro Dieléctrico',
      category: 'gpr',
      badge: 'GPR Tool',
      status: 'active',
      level: 2,
      meta: { formato: 'GSF / DZT', filtros: 'Background Removal' },
      tags: ['Capa Dieléctrica', 'Hipérbolas'],
    },
    {
      id: 'pipe-cad-board',
      type: 'system-service',
      title: 'Tablero de Producción CAD / BIM',
      subtitle: 'Control de Horas, Planos y Visor TXT/DWG',
      category: 'cad',
      badge: 'CAD / BIM',
      status: 'busy',
      level: 2,
      meta: { jornadaBase: '8.5h', metricas: 'ml dibujados' },
      tags: ['Civil 3D', 'AutoCAD', 'DWG Export'],
    },
    {
      id: 'pipe-hseq-board',
      type: 'system-service',
      title: 'Tablero Evidencias HSEQ',
      subtitle: 'Inspecciones Preoperacionales, ATS y Drive',
      category: 'hseq',
      badge: 'Calidad SST',
      status: 'active',
      level: 2,
      meta: { reportesMes: 64, cumplimiento: '98.5%' },
      tags: ['Inspecciones', 'Fotos Georreferenciadas'],
    },
    {
      id: 'pipe-rrhh-cartas',
      type: 'system-service',
      title: 'Módulo RRHH: Cartas Laborales',
      subtitle: 'Generación Word/PDF, Auditoría y Envío por Correo',
      category: 'rrhh',
      badge: 'RRHH & Legal',
      status: 'active',
      level: 2,
      meta: { tipos: 'Laboral, Retiro, Cesantías', auditoria: 'hr_letters' },
      tags: ['DOCX / PDF', 'Nodemailer', 'Auditoría'],
    },
    {
      id: 'pipe-attendance',
      type: 'system-service',
      title: 'Control de Asistencia & Jornada',
      subtitle: 'Geolocalización, Verificación Oficina/Campo y Salidas',
      category: 'rrhh',
      badge: 'Universal / RRHH',
      status: 'active',
      level: 2,
      meta: { geocerca: 'Activa', export: 'PDF Mensual' },
      tags: ['GPS', 'Marcación', 'Turnos'],
    },
    {
      id: 'pipe-chat-ai',
      type: 'system-service',
      title: 'Chat Interno & Transcriptor IA',
      subtitle: 'Mensajería Interna, Actas y Conversión a Tareas',
      category: 'admin',
      badge: 'Productividad IA',
      status: 'active',
      level: 2,
      meta: { motor: 'Gemini Audio Transcribe', tareas: 'Vinculadas' },
      tags: ['Colaboración', 'Reuniones', 'Tareas'],
    },

    // Level 3: Salida, Entregables y Clientes
    {
      id: 'pipe-export',
      type: 'client',
      title: 'Dossier Técnico & Planos As-Built',
      subtitle: 'Planos DWG, Informes Geofísicos y Reportes Técnicos',
      category: 'cad',
      badge: 'Cliente Final',
      status: 'active',
      level: 3,
      meta: { formatos: 'DWG + PDF + DOCX', trazabilidad: '100%' },
      tags: ['As-Built', 'Garantía Técnica', 'Cliente'],
    },
    {
      id: 'pipe-dispatch',
      type: 'client',
      title: 'Despacho Automatizado & Correo',
      subtitle: 'Envío de Cartas Laborales, Alertas y Respaldos',
      category: 'rrhh',
      badge: 'Notificaciones',
      status: 'active',
      level: 3,
      meta: { protocolo: 'SMTP Seguro', backup: 'Google Drive' },
      tags: ['Notificación', 'Trabajadores', 'Auditoría'],
    },
  ];

  const edges: DiagramEdge[] = [
    // Entrada a API
    { id: 'pe-field-bot', source: 'pipe-field', target: 'pipe-bot', animated: true },
    { id: 'pe-field-api', source: 'pipe-field', target: 'pipe-api', animated: true },
    { id: 'pe-portal-api', source: 'pipe-portal-web', target: 'pipe-api', animated: true },
    { id: 'pe-bot-api', source: 'pipe-bot', target: 'pipe-api', animated: true },
    // API a Base de Datos
    { id: 'pe-api-db', source: 'pipe-api', target: 'pipe-db', animated: true },
    // DB a Módulos Operativos
    { id: 'pe-db-radar', source: 'pipe-db', target: 'pipe-radargrama', animated: true },
    { id: 'pe-db-cad', source: 'pipe-db', target: 'pipe-cad-board', animated: true },
    { id: 'pe-db-hseq', source: 'pipe-db', target: 'pipe-hseq-board', animated: true },
    { id: 'pe-db-rrhh', source: 'pipe-db', target: 'pipe-rrhh-cartas', animated: true },
    { id: 'pe-db-attend', source: 'pipe-db', target: 'pipe-attendance', animated: true },
    { id: 'pe-db-chat', source: 'pipe-db', target: 'pipe-chat-ai', animated: false },
    // Módulos a Entregables Finales
    { id: 'pe-radar-export', source: 'pipe-radargrama', target: 'pipe-export', animated: true },
    { id: 'pe-cad-export', source: 'pipe-cad-board', target: 'pipe-export', animated: true },
    { id: 'pe-hseq-export', source: 'pipe-hseq-board', target: 'pipe-export', animated: false },
    { id: 'pe-rrhh-dispatch', source: 'pipe-rrhh-cartas', target: 'pipe-dispatch', animated: true },
    { id: 'pe-attend-dispatch', source: 'pipe-attendance', target: 'pipe-dispatch', animated: false },
  ];

  return {
    mode: 'pipeline',
    nodes: computeAutoLayout(rawNodes),
    edges,
    divisionsList: [
      { id: 'all', name: 'Todas las áreas', category: 'all' },
      { id: 'gpr', name: 'Geofísica & GPR', category: 'gpr' },
      { id: 'cad', name: 'Oficina Técnica CAD / BIM', category: 'cad' },
      { id: 'hseq', name: 'Seguridad HSEQ & SST', category: 'hseq' },
      { id: 'rrhh', name: 'Recursos Humanos (RRHH)', category: 'rrhh' },
      { id: 'admin', name: 'Administración & TI', category: 'admin' },
    ],
    lastSyncedAt: new Date().toISOString(),
    stats: {
      totalUsers: 0,
      totalDivisions: 5,
      totalRoles: 0,
      totalProjects: dbTools?.length || 16,
      activeNodes: rawNodes.length,
    },
  };
}
