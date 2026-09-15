import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { computeAutoLayout, getCanonicalOrgData, getCanonicalPipelineData } from '@/components/tools/org-chart/initialData';
import { DiagramEdge, DiagramNode, DiagramPayload, ViewMode } from '@/components/tools/org-chart/types';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const mode = (searchParams.get('mode') || 'org') as ViewMode;

    if (mode === 'pipeline') {
      // Dynamic pipeline construction
      const canonicalPipeline = getCanonicalPipelineData();
      return NextResponse.json({ data: canonicalPipeline });
    }

    // Mode === 'org': Build live org chart from Supabase
    const supabase = createAdminClient();

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
        divisiones: dbDivisions.length || 4,
        proyectosActivos: dbProjects.length,
      },
      tags: ['Liderazgo', 'Control General'],
    });

    // Level 1: Divisiones
    const divisionIdMap = new Map<string, string>();
    if (dbDivisions.length > 0) {
      dbDivisions.forEach((div) => {
        const divNodeId = `div-${div.id}`;
        divisionIdMap.set(div.id, divNodeId);
        rawNodes.push({
          id: divNodeId,
          type: 'division',
          title: div.name,
          subtitle: div.description || 'Área Operativa',
          category: div.name.toLowerCase().includes('gpr') ? 'gpr' : div.name.toLowerCase().includes('cad') ? 'cad' : 'hseq',
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
        // Infer by role name or string
        if (u.role === 'localizador' || u.role === 'operator') {
          parentDivId = divisionIdMap.get(Array.from(divisionIdMap.keys())[0]) || 'div-gpr';
        } else if (u.role === 'dibujo') {
          parentDivId = Array.from(divisionIdMap.values()).find((d) => d.includes('cad')) || 'div-cad';
        } else {
          parentDivId = Array.from(divisionIdMap.values())[0];
        }
      }

      rawNodes.push({
        id: userNodeId,
        type: 'user',
        title: u.full_name || u.email,
        subtitle: roleObj?.name || (u.role.toUpperCase()),
        category: u.role,
        badge: u.role,
        status: u.is_active ? (assignedProjects.length > 2 ? 'busy' : 'active') : 'idle',
        email: u.email,
        avatarUrl: u.avatar_url,
        level: 2,
        parentId: parentDivId,
        meta: {
          proyectosAsignados: assignedProjects.length,
          estado: u.is_active ? 'Activo' : 'Inactivo',
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
            category: 'project',
            badge: 'Proyecto',
            status: 'active',
            level: 3,
            parentId: userNodeId,
            meta: { cliente: proj.client || 'N/A' },
            tags: ['Obra', 'GPR/CAD'],
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
    const positionedNodes = computeAutoLayout(rawNodes, edges);

    const payload: DiagramPayload = {
      mode: 'org',
      nodes: positionedNodes,
      edges,
      lastSyncedAt: new Date().toISOString(),
      stats: {
        totalUsers: dbUsers.length,
        totalDivisions: dbDivisions.length || 4,
        totalRoles: dbRoles.length,
        totalProjects: dbProjects.length,
        activeNodes: positionedNodes.length,
      },
    };

    return NextResponse.json({ data: payload });
  } catch (error: any) {
    console.error('Error fetching org chart data:', error);
    // Graceful fallback to canonical data
    return NextResponse.json({ data: getCanonicalOrgData() });
  }
}
