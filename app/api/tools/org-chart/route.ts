import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { computeAutoLayout, getCanonicalOrgData, buildDynamicPipelineData } from '@/components/tools/org-chart/initialData';
import { DiagramDivisionItem, DiagramEdge, DiagramNode, DiagramPayload, ViewMode } from '@/components/tools/org-chart/types';

function resolveDivisionCategory(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('gpr') || lower.includes('geof')) return 'gpr';
  if (lower.includes('cad') || lower.includes('bim') || lower.includes('dibujo')) return 'cad';
  if (lower.includes('almacen') || lower.includes('bodega') || lower.includes('inventario') || lower.includes('logistica') || lower.includes('warehouse')) return 'warehouse';
  if (lower.includes('compra') || lower.includes('adquisic') || lower.includes('purchas') || lower.includes('abastec')) return 'purchasing';
  if (lower.includes('comercial') || lower.includes('ventas') || lower.includes('licitac') || lower.includes('propuesta')) return 'commercial';
  if (lower.includes('finanz') || lower.includes('tesorer') || lower.includes('finance') || lower.includes('caja')) return 'finance';
  if (lower.includes('contab') || lower.includes('tribut') || lower.includes('impuest') || lower.includes('accounting')) return 'accounting';
  if (lower.includes('hseq') || lower.includes('sst') || lower.includes('seguridad')) return 'hseq';
  if (lower.includes('rrhh') || lower.includes('humana') || lower.includes('personal') || lower.includes('recursos')) return 'rrhh';
  if (lower.includes('gerenc') || lower.includes('direct') || lower.includes('management')) return 'direction';
  if (lower.includes('ti') || lower.includes('sistemas') || lower.includes('tecnolog')) return 'admin';
  return 'admin';
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const mode = (searchParams.get('mode') || 'org') as ViewMode;
    const supabase = createAdminClient();

    if (mode === 'pipeline') {
      // Dynamic pipeline construction backed by tools table in Supabase
      const { data: dbTools } = await supabase
        .from('tools')
        .select('slug, name, category, description')
        .order('name');

      const pipelineData = buildDynamicPipelineData(dbTools || undefined);
      return NextResponse.json({ data: pipelineData });
    }

    // Mode === 'org': Build live org chart from Supabase
    // Fetch users, roles, divisions, projects in parallel
    const [usersRes, rolesRes, divisionsRes, projectsRes, userProjectsRes] = await Promise.all([
      supabase.from('users').select('id, full_name, email, role, is_active, avatar_url, role_id').order('created_at', { ascending: true }),
      supabase.from('roles').select('id, name, division_id').order('name', { ascending: true }),
      supabase.from('divisions').select('id, name, description').order('name', { ascending: true }),
      supabase.from('projects').select('id, name, code, client, is_active').eq('is_active', true).limit(10),
      supabase.from('user_projects').select('user_id, project_id'),
    ]);

    const dbUsers = usersRes.data || [];
    const dbRoles = rolesRes.data || [];
    const dbDivisions = divisionsRes.data || [];
    const dbProjects = projectsRes.data || [];
    const dbUserProjects = userProjectsRes.data || [];

    // If database has very few users, fallback to canonical to avoid empty state
    if (dbUsers.length === 0) {
      return NextResponse.json({ data: getCanonicalOrgData() });
    }

    // Construct live dynamic nodes
    const rawNodes: Omit<DiagramNode, 'x' | 'y' | 'width' | 'height'>[] = [];
    const edges: DiagramEdge[] = [];

    // Root: Dirección General
    const rootId = 'dir-general';
    const adminUsers = dbUsers.filter((u) => u.role === 'admin');
    rawNodes.push({
      id: rootId,
      type: 'direction',
      title: 'Dirección General & Operativa',
      subtitle: adminUsers.length > 0 ? `${adminUsers.length} Administradores` : 'Gerencia Técnica',
      category: 'direction',
      badge: 'Gerencia',
      status: 'active',
      level: 0,
      meta: {
        totalUsuarios: dbUsers.length,
        divisiones: dbDivisions.length || 5,
        proyectosActivos: dbProjects.length,
      },
      tags: ['Liderazgo', 'Control General'],
    });

    // Level 1: Divisiones
    const divisionIdMap = new Map<string, string>();
    if (dbDivisions.length > 0) {
      dbDivisions.forEach((div) => {
        const divNodeId = `div-${div.id}`;
        const cat = resolveDivisionCategory(div.name);
        divisionIdMap.set(div.id, divNodeId);
        rawNodes.push({
          id: divNodeId,
          type: 'division',
          title: div.name,
          subtitle: div.description || 'Área Operativa',
          category: cat,
          badge: 'División',
          status: 'active',
          level: 1,
          parentId: rootId,
          tags: ['Departamento', 'Operación'],
        });

        edges.push({
          id: `e-${rootId}-${divNodeId}`,
          source: rootId,
          target: divNodeId,
          animated: true,
        });
      });
    } else {
      // Fallback divisions if table is empty
      const defaultDivs = [
        { id: 'div-gpr', name: 'División Geofísica & GPR', cat: 'gpr' },
        { id: 'div-cad', name: 'Oficina Técnica CAD / BIM', cat: 'cad' },
        { id: 'div-hseq', name: 'Coordinación HSEQ', cat: 'hseq' },
        { id: 'div-rrhh', name: 'División Gestión Humana & RRHH', cat: 'rrhh' },
        { id: 'div-ti', name: 'Tecnología & Plataforma', cat: 'admin' },
      ];
      defaultDivs.forEach((d) => {
        divisionIdMap.set(d.id, d.id);
        rawNodes.push({
          id: d.id,
          type: 'division',
          title: d.name,
          category: d.cat,
          badge: 'División',
          status: 'active',
          level: 1,
          parentId: rootId,
        });
        edges.push({
          id: `e-${rootId}-${d.id}`,
          source: rootId,
          target: d.id,
          animated: true,
        });
      });
    }

    // Check if there are RRHH users but no RRHH division in DB
    const hasRrhhUsers = dbUsers.some((u) => u.role === 'rrhh');
    const hasRrhhDivision = rawNodes.some((n) => n.type === 'division' && n.category === 'rrhh');
    if (hasRrhhUsers && !hasRrhhDivision) {
      const rrhhNodeId = 'div-rrhh-auto';
      divisionIdMap.set('rrhh-auto', rrhhNodeId);
      rawNodes.push({
        id: rrhhNodeId,
        type: 'division',
        title: 'División Gestión Humana & RRHH',
        subtitle: 'Administración de Personal, Cartas y Nómina',
        category: 'rrhh',
        badge: 'RRHH',
        status: 'active',
        level: 1,
        parentId: rootId,
        tags: ['Talento Humano', 'Cartas', 'Asistencia'],
      });

      edges.push({
        id: `e-${rootId}-${rrhhNodeId}`,
        source: rootId,
        target: rrhhNodeId,
        animated: true,
      });
    }

    // Level 2: Usuarios / Especialistas
    const userProjectsMap = new Map<string, string[]>();
    dbUserProjects.forEach((up) => {
      const list = userProjectsMap.get(up.user_id) || [];
      list.push(up.project_id);
      userProjectsMap.set(up.user_id, list);
    });

    const rolesMap = new Map(dbRoles.map((r) => [r.id, r]));

    dbUsers.forEach((u) => {
      const userNodeId = `user-${u.id}`;
      const roleObj = u.role_id ? rolesMap.get(u.role_id) : null;
      const assignedProjects = userProjectsMap.get(u.id) || [];

      // Find parent division
      let parentDivId = roleObj?.division_id ? divisionIdMap.get(roleObj.division_id) : undefined;
      if (!parentDivId) {
        if (u.role === 'admin') {
          // Direct reports to Gerencia
          parentDivId = rootId;
        } else if (u.role === 'rrhh') {
          const rrhhDiv = rawNodes.find((n) => n.type === 'division' && n.category === 'rrhh');
          parentDivId = rrhhDiv ? rrhhDiv.id : rootId;
        } else if (u.role === 'localizador' || u.role === 'operator') {
          const gprDiv = rawNodes.find((n) => n.type === 'division' && n.category === 'gpr');
          parentDivId = gprDiv ? gprDiv.id : Array.from(divisionIdMap.values())[0];
        } else if (u.role === 'dibujo') {
          const cadDiv = rawNodes.find((n) => n.type === 'division' && n.category === 'cad');
          parentDivId = cadDiv ? cadDiv.id : Array.from(divisionIdMap.values())[0];
        } else if (u.role === 'hseq') {
          const hseqDiv = rawNodes.find((n) => n.type === 'division' && n.category === 'hseq');
          parentDivId = hseqDiv ? hseqDiv.id : Array.from(divisionIdMap.values())[0];
        } else {
          parentDivId = Array.from(divisionIdMap.values())[0] || rootId;
        }
      }

      // Inherit parent category for smooth visual filtering
      const parentNode = rawNodes.find((n) => n.id === parentDivId);
      const userCategory = parentNode?.category || (u.role === 'admin' ? 'direction' : u.role);

      rawNodes.push({
        id: userNodeId,
        type: 'user',
        title: u.full_name || u.email,
        subtitle: roleObj?.name || u.role.toUpperCase(),
        category: userCategory,
        badge: u.role,
        status: u.is_active ? (assignedProjects.length > 2 ? 'busy' : 'active') : 'idle',
        email: u.email,
        avatarUrl: u.avatar_url,
        level: parentDivId === rootId ? 1 : 2,
        parentId: parentDivId,
        divisionId: parentDivId,
        meta: {
          proyectosAsignados: assignedProjects.length,
          estado: u.is_active ? 'Activo' : 'Inactivo',
          rol: u.role,
        },
        tags: [u.role, u.is_active ? 'Disponible' : 'Inactivo'],
      });

      if (parentDivId) {
        edges.push({
          id: `e-${parentDivId}-${userNodeId}`,
          source: parentDivId,
          target: userNodeId,
          animated: u.is_active,
        });
      }

      // Level 3: Proyectos conectados a este usuario
      assignedProjects.slice(0, 2).forEach((projId) => {
        const proj = dbProjects.find((p) => p.id === projId);
        if (proj) {
          const projNodeId = `proj-${proj.id}-${u.id}`;
          rawNodes.push({
            id: projNodeId,
            type: 'project',
            title: proj.name,
            subtitle: proj.code || proj.client || 'Frente Activo',
            category: userCategory,
            badge: 'Proyecto',
            status: 'active',
            level: 3,
            parentId: userNodeId,
            divisionId: parentDivId,
            meta: { cliente: proj.client || 'N/A' },
            tags: ['Obra', 'Frente'],
          });

          edges.push({
            id: `e-${userNodeId}-${projNodeId}`,
            source: userNodeId,
            target: projNodeId,
            animated: true,
          });
        }
      });
    });

    // Auto-layout
    const positionedNodes = computeAutoLayout(rawNodes);

    // Build dynamic divisions list for frontend filter selector
    const divisionsList: DiagramDivisionItem[] = [
      { id: 'all', name: 'Todas las divisiones / áreas', category: 'all' },
      { id: 'direction', name: 'Dirección General', category: 'direction' },
      ...rawNodes
        .filter((n) => n.type === 'division')
        .map((d) => ({
          id: d.id,
          name: d.title,
          category: d.category || 'admin',
        })),
    ];

    const payload: DiagramPayload = {
      mode: 'org',
      nodes: positionedNodes,
      edges,
      divisionsList,
      lastSyncedAt: new Date().toISOString(),
      stats: {
        totalUsers: dbUsers.length,
        totalDivisions: rawNodes.filter((n) => n.type === 'division').length,
        totalRoles: dbRoles.length,
        totalProjects: dbProjects.length,
        activeNodes: positionedNodes.length,
      },
    };

    return NextResponse.json({ data: payload });
  } catch (error: unknown) {
    console.error('Error fetching org chart data:', error);
    // Graceful fallback to canonical data
    return NextResponse.json({ data: getCanonicalOrgData() });
  }
}
