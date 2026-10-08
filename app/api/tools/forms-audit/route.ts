import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface FormAuditFile {
  id: string;
  name: string;
  type: 'pdf' | 'xlsx' | 'docx' | 'image' | 'drive' | 'receipt' | 'other';
  download_url: string;
  view_url?: string;
  is_official_generation: boolean;
}

export interface FormAuditSignature {
  role_title: string;
  signee_name: string;
  signee_position?: string;
  signee_process?: string;
  signature_data: string;
  signed_at?: string;
}

export interface FormAuditRecord {
  id: string;
  form_slug: string;
  form_name: string;
  form_category: string;
  official_code: string;
  project_id: string | null;
  project_name: string;
  project_code: string;
  user_id: string;
  user_name: string;
  user_email: string;
  created_at: string;
  submission_date: string;
  status: string;
  status_label: string;
  summary: string;
  files: FormAuditFile[];
  signatures: FormAuditSignature[];
  raw_data: Record<string, unknown>;
}

const STATUS_MAP: Record<string, string> = {
  submitted: 'Enviado',
  approved: 'Aprobado',
  under_review: 'En Revisión',
  rejected: 'Rechazado',
  closed: 'Cerrado',
  pending: 'Pendiente',
  issued: 'Emitido',
  paid: 'Pagado',
  draft: 'Borrador',
  open: 'Abierto',
  won: 'Ganado',
  lost: 'Perdido',
  audited: 'Auditado',
  radicada: 'Radicada',
  causada: 'Causada',
  pagada: 'Pagada',
  anulada: 'Anulada',
};

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Validar usuario
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, email, full_name, role, role_id')
      .eq('email', session.user.email)
      .single();

    if (!dbUser || dbUser.role === 'pending') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const filterFormSlug = searchParams.get('form_slug') || 'all';
    const filterProjectId = searchParams.get('project_id') || 'all';
    const filterUserId = searchParams.get('user_id') || 'all';
    const filterStatus = searchParams.get('status') || 'all';
    const filterDateFrom = searchParams.get('date_from') || '';
    const filterDateTo = searchParams.get('date_to') || '';
    const filterHasFiles = searchParams.get('has_files') || 'all';
    const searchQuery = (searchParams.get('search') || '').trim().toLowerCase();

    // 0. Determinar alcance de permisos del usuario autenticado (user_forms prioritario)
    const isAdmin = dbUser.role === 'admin';
    const allowedFormSlugs = new Set<string>();

    if (!isAdmin) {
      // Prioridad 1: Asignaciones específicas directas en user_forms (individual por usuario)
      const { data: userFormsData, error: ufError } = await supabase
        .from('user_forms')
        .select('form_id, forms(id, slug, name)')
        .eq('user_id', dbUser.id);

      const formIds: string[] = [];
      if (!ufError && userFormsData && userFormsData.length > 0) {
        for (const uf of userFormsData) {
          if (uf.form_id) formIds.push(uf.form_id);
          const formObj = (uf as unknown as { forms?: { slug?: string } })?.forms;
          if (formObj?.slug) {
            allowedFormSlugs.add(formObj.slug);
          }
        }

        // Si algún formulario no trajo slug en el join, resolver directamente por IDs en forms
        if (allowedFormSlugs.size < userFormsData.length && formIds.length > 0) {
          const { data: directForms } = await supabase
            .from('forms')
            .select('id, slug')
            .in('id', formIds);
          for (const df of directForms ?? []) {
            if (df.slug) allowedFormSlugs.add(df.slug);
          }
        }
      } else {
        // Fallback: Si el usuario no tiene registros en user_forms (usuario no editado individualmente),
        // consultar role_forms según su role_id
        if (dbUser.role_id) {
          const { data: roleFormsData } = await supabase
            .from('role_forms')
            .select('forms(slug)')
            .eq('role_id', dbUser.role_id);
          for (const rf of roleFormsData ?? []) {
            const slug = (rf as unknown as { forms?: { slug?: string } })?.forms?.slug;
            if (slug) allowedFormSlugs.add(slug);
          }
        }

        // Si aún está vacío, recurrir a la matriz canónica por defecto del rol
        if (allowedFormSlugs.size === 0 && dbUser.role) {
          const CANONICAL_ROLE_FORMS: Record<string, string[]> = {
            hseq: ['hseq-report', 'analisis-planificacion-cambios-sig'],
            operator: ['gpr-field-form'],
            localizador: ['gpr-field-form'],
            dibujo: ['cad-register-form'],
            drawing: ['cad-register-form'],
            warehouse: ['registro-equipo'],
            almacen: ['registro-equipo'],
            purchasing: ['requerimiento-compra', 'orden-compra', 'evaluacion-proveedor', 'registro-proveedor'],
            compras: ['requerimiento-compra', 'orden-compra', 'evaluacion-proveedor', 'registro-proveedor'],
            commercial: ['registro-oportunidad', 'cotizacion-comercial', 'cierre-comercial'],
            comercial: ['registro-oportunidad', 'cotizacion-comercial', 'cierre-comercial'],
            finance: ['solicitud-viaticos', 'legalizacion-gastos', 'registro-pago'],
            finanzas: ['solicitud-viaticos', 'legalizacion-gastos', 'registro-pago'],
            accounting: ['radicacion-factura', 'soporte-cobro'],
            contabilidad: ['radicacion-factura', 'soporte-cobro'],
            hr: ['elaboracion-cartas'],
            rrhh: ['elaboracion-cartas'],
          };
          const defaults = CANONICAL_ROLE_FORMS[dbUser.role.toLowerCase()] ?? [];
          defaults.forEach((s) => allowedFormSlugs.add(s));
        }
      }
    }

    const isAllowedForm = (slug: string) => {
      if (isAdmin) return true;
      return allowedFormSlugs.has(slug);
    };

    const shouldFetchForm = (slug: string) => {
      if (!isAllowedForm(slug)) return false;
      if (filterFormSlug === 'all') return true;
      return filterFormSlug === slug;
    };

    // 1. Cargar Proyectos y Usuarios para cruce O(1)
    const [projectsRes, usersRes] = await Promise.all([
      supabase.from('projects').select('id, cost_center, name, client').order('name'),
      supabase.from('users').select('id, email, full_name, role').order('full_name'),
    ]);

    const projectsMap = new Map<string, { cost_center: string; name: string; client: string }>();
    for (const p of projectsRes.data ?? []) {
      projectsMap.set(p.id, {
        cost_center: p.cost_center || 'CC-S/N',
        name: p.name || 'Sin Asignar',
        client: p.client || 'PROCIMEC',
      });
    }

    const usersMap = new Map<string, { email: string; full_name: string }>();
    for (const u of usersRes.data ?? []) {
      usersMap.set(u.id, {
        email: u.email || '',
        full_name: u.full_name || u.email || 'Usuario',
      });
    }

    const allRecords: FormAuditRecord[] = [];

    // Helper para resolver usuario
    const resolveUser = (userId: string, fallbackName?: string) => {
      const found = usersMap.get(userId);
      return {
        user_name: found?.full_name || fallbackName || 'Usuario Desconocido',
        user_email: found?.email || '',
      };
    };

    // Helper para resolver proyecto
    const resolveProject = (projectId: string | null) => {
      if (!projectId) return { project_name: 'Proyecto General / Corporativo', project_code: 'S/N' };
      const found = projectsMap.get(projectId);
      return {
        project_name: found?.name || 'Proyecto no registrado',
        project_code: found?.cost_center || 'CC-S/N',
      };
    };

    // 2. Consultas concurrentes seguras
    const tasks: Promise<void>[] = [];

    // A) SIG - Análisis y Planificación de Cambios (FOR-SIG-001)
    if (shouldFetchForm('analisis-planificacion-cambios-sig')) {
      tasks.push(
        (async () => {
          try {
            const { data } = await supabase
              .from('sig_management_changes')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(100);

            for (const r of data ?? []) {
              const u = resolveUser(r.user_id, r.identifier_name);
              const p = resolveProject(r.project_id);

              const files: FormAuditFile[] = [
                {
                  id: `sig-pdf-${r.id}`,
                  name: `${r.official_code || 'FOR-SIG-001'}_Analisis_Cambio_${(r.identifier_name || 'SIG').substring(0, 15)}.pdf`,
                  type: 'pdf',
                  download_url: `/api/forms/analisis-planificacion-cambios-sig/export?id=${r.id}&format=pdf`,
                  is_official_generation: true,
                },
                {
                  id: `sig-xlsx-${r.id}`,
                  name: `${r.official_code || 'FOR-SIG-001'}_Plantilla_Oficial.xlsx`,
                  type: 'xlsx',
                  download_url: `/api/forms/analisis-planificacion-cambios-sig/export?id=${r.id}&format=xlsx`,
                  is_official_generation: true,
                },
              ];

              if (r.cloud_drive_file_id) {
                files.push({
                  id: `sig-drive-${r.id}`,
                  name: 'Plantilla Viva en Google Drive',
                  type: 'drive',
                  download_url: `https://drive.google.com/open?id=${r.cloud_drive_file_id}`,
                  view_url: `https://drive.google.com/file/d/${r.cloud_drive_file_id}/view`,
                  is_official_generation: false,
                });
              }

              const signatures: FormAuditSignature[] = [];
              if (r.approval_signature) {
                signatures.push({
                  role_title: 'Aprobación del Cambio',
                  signee_name: r.approval_name || 'Aprobador SIG',
                  signee_position: r.approval_position || '',
                  signee_process: r.approval_process || '',
                  signature_data: r.approval_signature,
                });
              }
              if (r.tracking_signature) {
                signatures.push({
                  role_title: 'Seguimiento y Cierre',
                  signee_name: r.tracking_name || 'Responsable Seguimiento',
                  signee_position: r.tracking_position || '',
                  signee_process: r.tracking_process || '',
                  signature_data: r.tracking_signature,
                });
              }

              allRecords.push({
                id: r.id,
                form_slug: 'analisis-planificacion-cambios-sig',
                form_name: 'Análisis y Planificación de Cambios SIG',
                form_category: 'hseq',
                official_code: r.official_code || 'FOR-SIG-001',
                project_id: r.project_id,
                project_name: p.project_name,
                project_code: p.project_code,
                user_id: r.user_id,
                user_name: u.user_name,
                user_email: u.user_email,
                created_at: r.created_at,
                submission_date: r.identification_date || r.created_at.split('T')[0],
                status: r.status || 'submitted',
                status_label: STATUS_MAP[r.status] || r.status,
                summary: r.change_description || r.justification || 'Sin descripción',
                files,
                signatures,
                raw_data: r,
              });
            }
          } catch (e) {
            console.error('Error cargando sig_management_changes:', e);
          }
        })()
      );
    }

    // B) HSEQ - Inspecciones Pre-operacionales y de Campo
    if (shouldFetchForm('hseq-report')) {
      tasks.push(
        (async () => {
          try {
            const { data } = await supabase
              .from('hseq_inspections')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(100);

            for (const r of data ?? []) {
              const u = resolveUser(r.user_id, r.operator_name);
              const p = resolveProject(r.project_id);

              const files: FormAuditFile[] = [];
              if (r.pdf_url) {
                files.push({
                  id: `hseq-pdf-${r.id}`,
                  name: r.pdf_filename || `${r.format_code || 'FOR-HSEQ'}_Reporte.pdf`,
                  type: 'pdf',
                  download_url: r.pdf_url,
                  is_official_generation: true,
                });
              }
              if (r.excel_url) {
                files.push({
                  id: `hseq-xlsx-${r.id}`,
                  name: r.excel_filename || `${r.format_code || 'FOR-HSEQ'}_Inspeccion.xlsx`,
                  type: 'xlsx',
                  download_url: r.excel_url,
                  is_official_generation: true,
                });
              }
              if (r.drive_web_view_link) {
                files.push({
                  id: `hseq-drive-${r.id}`,
                  name: 'Expediente Oficial Google Drive',
                  type: 'drive',
                  download_url: r.drive_web_view_link,
                  view_url: r.drive_web_view_link,
                  is_official_generation: false,
                });
              }

              const signatures: FormAuditSignature[] = [];
              if (r.operator_signature_data) {
                signatures.push({
                  role_title: 'Operador / Inspector',
                  signee_name: r.operator_name || 'Operador',
                  signature_data: r.operator_signature_data,
                });
              }
              if (r.ssta_signature_data) {
                signatures.push({
                  role_title: 'Responsable SSTA',
                  signee_name: r.ssta_name || 'Coordinador SSTA',
                  signature_data: r.ssta_signature_data,
                });
              }

              allRecords.push({
                id: r.id,
                form_slug: 'hseq-report',
                form_name: r.format_title || 'Inspección Pre-operacional HSEQ',
                form_category: 'hseq',
                official_code: r.format_code || 'FOR-HSEQ-024',
                project_id: r.project_id,
                project_name: p.project_name,
                project_code: p.project_code,
                user_id: r.user_id,
                user_name: u.user_name,
                user_email: u.user_email,
                created_at: r.created_at,
                submission_date: r.inspection_date || r.created_at.split('T')[0],
                status: r.status || 'submitted',
                status_label: STATUS_MAP[r.status] || r.status,
                summary: r.equipment_brand_model
                  ? `Equipo: ${r.equipment_brand_model} (S/N: ${r.equipment_serial || 'N/A'}) - ${r.location || 'En campo'}`
                  : (r.general_observations || 'Inspección registrada en campo'),
                files,
                signatures,
                raw_data: r,
              });
            }
          } catch (e) {
            console.error('Error cargando hseq_inspections:', e);
          }
        })()
      );
    }

    // C) GPR - Reportes de Campo
    if (shouldFetchForm('gpr-field-form')) {
      tasks.push(
        (async () => {
          try {
            const { data } = await supabase
              .from('field_reports')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(100);

            for (const r of data ?? []) {
              const u = resolveUser(r.user_id);
              const p = resolveProject(r.project_id);

              const files: FormAuditFile[] = [
                {
                  id: `gpr-pdf-${r.id}`,
                  name: `Reporte_Diario_GPR_${r.report_date || 'Campo'}.pdf`,
                  type: 'pdf',
                  download_url: `/api/reports?id=${r.id}&format=pdf`,
                  is_official_generation: true,
                },
              ];

              allRecords.push({
                id: r.id,
                form_slug: 'gpr-field-form',
                form_name: 'Reporte Diario de Campo GPR',
                form_category: 'gpr',
                official_code: `GPR-${String(r.id).substring(0, 8).toUpperCase()}`,
                project_id: r.project_id,
                project_name: p.project_name,
                project_code: p.project_code,
                user_id: r.user_id,
                user_name: u.user_name,
                user_email: u.user_email,
                created_at: r.created_at,
                submission_date: r.report_date || r.created_at.split('T')[0],
                status: r.status || 'submitted',
                status_label: STATUS_MAP[r.status] || r.status,
                summary: `Metros lineales: ${r.total_linear_meters || 0}m - Antena: ${r.radar_equipment || 'Georradar'}`,
                files,
                signatures: [],
                raw_data: r,
              });
            }
          } catch (e) {
            console.error('Error cargando field_reports:', e);
          }
        })()
      );
    }

    // D) RRHH - Cartas y Certificaciones Laborales
    if (shouldFetchForm('elaboracion-cartas')) {
      tasks.push(
        (async () => {
          try {
            const { data } = await supabase
              .from('generated_letters')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(100);

            for (const r of data ?? []) {
              const u = resolveUser(r.user_id);
              const p = resolveProject(r.project_id);

              const files: FormAuditFile[] = [];
              if (r.file_url) {
                files.push({
                  id: `letter-file-${r.id}`,
                  name: `Certificacion_${(r.recipient_name || 'Colaborador').replace(/\s+/g, '_')}.docx`,
                  type: 'docx',
                  download_url: r.file_url,
                  is_official_generation: true,
                });
              }

              allRecords.push({
                id: r.id,
                form_slug: 'elaboracion-cartas',
                form_name: 'Elaboración de Cartas y Certificaciones',
                form_category: 'rrhh',
                official_code: `RRHH-DOC-${String(r.id).substring(0, 8).toUpperCase()}`,
                project_id: r.project_id,
                project_name: p.project_name,
                project_code: p.project_code,
                user_id: r.user_id,
                user_name: u.user_name,
                user_email: u.user_email,
                created_at: r.created_at,
                submission_date: r.created_at.split('T')[0],
                status: r.status || 'issued',
                status_label: STATUS_MAP[r.status] || 'Emitido',
                summary: `Destinatario: ${r.recipient_name || 'N/A'} (ID: ${r.recipient_id || 'N/A'}) - Formato: ${r.template_id || 'General'}`,
                files,
                signatures: [],
                raw_data: r,
              });
            }
          } catch (e) {
            console.error('Error cargando generated_letters:', e);
          }
        })()
      );
    }

    // E) CAD / BIM - Bitácora de Actividades de Dibujo
    if (shouldFetchForm('cad-register-form')) {
      tasks.push(
        (async () => {
          try {
            const { data } = await supabase
              .from('drawing_activities')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(100);

            for (const r of data ?? []) {
              const u = resolveUser(r.user_id, r.responsible);
              const p = resolveProject(r.project_id);

              allRecords.push({
                id: r.id,
                form_slug: 'cad-register-form',
                form_name: 'Bitácora de Dibujo y Modelado CAD',
                form_category: 'cad',
                official_code: `CAD-${String(r.id).substring(0, 8).toUpperCase()}`,
                project_id: r.project_id,
                project_name: p.project_name,
                project_code: p.project_code,
                user_id: r.user_id,
                user_name: u.user_name,
                user_email: u.user_email,
                created_at: r.created_at,
                submission_date: r.activity_date || r.created_at.split('T')[0],
                status: r.status || 'submitted',
                status_label: STATUS_MAP[r.status] || r.status,
                summary: `Software: ${r.software || 'AutoCAD'} - Horas: ${r.hours_worked || 0}h ${r.is_rework ? '(Reproceso)' : ''}`,
                files: [],
                signatures: [],
                raw_data: r,
              });
            }
          } catch (e) {
            console.error('Error cargando drawing_activities:', e);
          }
        })()
      );
    }

    // F) COMPRAS - Requerimientos de Compra
    if (shouldFetchForm('requerimiento-compra')) {
      tasks.push(
        (async () => {
          try {
            const { data } = await supabase
              .from('purchase_requests')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(100);

            for (const r of data ?? []) {
              const u = resolveUser(r.user_id);
              const p = resolveProject(r.project_id);

              allRecords.push({
                id: r.id,
                form_slug: 'requerimiento-compra',
                form_name: 'Solicitud de Requerimiento',
                form_category: 'purchasing',
                official_code: `REQ-${String(r.id).substring(0, 8).toUpperCase()}`,
                project_id: r.project_id,
                project_name: p.project_name,
                project_code: p.project_code,
                user_id: r.user_id,
                user_name: u.user_name,
                user_email: u.user_email,
                created_at: r.created_at,
                submission_date: r.required_date || r.created_at.split('T')[0],
                status: r.status || 'pending',
                status_label: STATUS_MAP[r.status] || r.status,
                summary: `${r.title || 'Requerimiento'} - Prioridad: ${r.priority || 'Media'} - Justificación: ${(r.justification || '').substring(0, 50)}`,
                files: [],
                signatures: [],
                raw_data: r,
              });
            }
          } catch (e) {
            console.error('Error cargando purchase_requests:', e);
          }
        })()
      );
    }

    // G) COMPRAS - Órdenes de Compra
    if (shouldFetchForm('orden-compra')) {
      tasks.push(
        (async () => {
          try {
            const { data } = await supabase
              .from('purchase_orders')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(100);

            for (const r of data ?? []) {
              const u = resolveUser(r.user_id);
              const p = resolveProject(r.project_id);

              allRecords.push({
                id: r.id,
                form_slug: 'orden-compra',
                form_name: 'Orden de Compra y Adjudicación',
                form_category: 'purchasing',
                official_code: r.order_code || `OC-${String(r.id).substring(0, 8).toUpperCase()}`,
                project_id: r.project_id,
                project_name: p.project_name,
                project_code: p.project_code,
                user_id: r.user_id,
                user_name: u.user_name,
                user_email: u.user_email,
                created_at: r.created_at,
                submission_date: r.created_at.split('T')[0],
                status: r.status || 'issued',
                status_label: STATUS_MAP[r.status] || r.status,
                summary: `Proveedor: ${r.supplier_name || 'N/A'} - Monto: $${Number(r.total_amount || 0).toLocaleString('es-CO')} COP`,
                files: [],
                signatures: [],
                raw_data: r,
              });
            }
          } catch (e) {
            console.error('Error cargando purchase_orders:', e);
          }
        })()
      );
    }

    // H) FINANZAS - Solicitud de Viáticos
    if (shouldFetchForm('solicitud-viaticos')) {
      tasks.push(
        (async () => {
          try {
            const { data } = await supabase
              .from('per_diem_requests')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(100);

            for (const r of data ?? []) {
              const u = resolveUser(r.user_id);
              const p = resolveProject(r.project_id);

              allRecords.push({
                id: r.id,
                form_slug: 'solicitud-viaticos',
                form_name: 'Solicitud de Viáticos y Anticipos',
                form_category: 'finance',
                official_code: `VIAT-${String(r.id).substring(0, 8).toUpperCase()}`,
                project_id: r.project_id,
                project_name: p.project_name,
                project_code: p.project_code,
                user_id: r.user_id,
                user_name: u.user_name,
                user_email: u.user_email,
                created_at: r.created_at,
                submission_date: r.departure_date || r.created_at.split('T')[0],
                status: r.status || 'submitted',
                status_label: STATUS_MAP[r.status] || r.status,
                summary: `Beneficiario: ${r.beneficiary_name} - Destino: ${r.destination || 'Campo'} - Total: $${Number(r.estimated_total || 0).toLocaleString('es-CO')} COP`,
                files: [],
                signatures: [],
                raw_data: r,
              });
            }
          } catch (e) {
            console.error('Error cargando per_diem_requests:', e);
          }
        })()
      );
    }

    // I) FINANZAS - Legalización de Gastos
    if (shouldFetchForm('legalizacion-gastos')) {
      tasks.push(
        (async () => {
          try {
            const { data } = await supabase
              .from('expense_legalizations')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(100);

            for (const r of data ?? []) {
              const u = resolveUser(r.user_id);
              const p = resolveProject(r.project_id);

              const files: FormAuditFile[] = [];
              if (Array.isArray(r.expense_receipts)) {
                r.expense_receipts.forEach((rc: { url?: string; name?: string }, idx: number) => {
                  if (rc.url) {
                    files.push({
                      id: `receipt-${r.id}-${idx}`,
                      name: rc.name || `Soporte_Factura_${idx + 1}`,
                      type: 'receipt',
                      download_url: rc.url,
                      is_official_generation: false,
                    });
                  }
                });
              }

              allRecords.push({
                id: r.id,
                form_slug: 'legalizacion-gastos',
                form_name: 'Legalización y Rendición de Gastos',
                form_category: 'finance',
                official_code: `LEG-${String(r.id).substring(0, 8).toUpperCase()}`,
                project_id: r.project_id,
                project_name: p.project_name,
                project_code: p.project_code,
                user_id: r.user_id,
                user_name: u.user_name,
                user_email: u.user_email,
                created_at: r.created_at,
                submission_date: r.created_at.split('T')[0],
                status: r.status || 'submitted',
                status_label: STATUS_MAP[r.status] || r.status,
                summary: `Anticipo: $${Number(r.advancement_amount || 0).toLocaleString('es-CO')} - Gastado: $${Number(r.total_spent || 0).toLocaleString('es-CO')} - Saldo: $${Number(r.balance || 0).toLocaleString('es-CO')}`,
                files,
                signatures: [],
                raw_data: r,
              });
            }
          } catch (e) {
            console.error('Error cargando expense_legalizations:', e);
          }
        })()
      );
    }

    // J) CONTABILIDAD - Radicación de Facturas
    if (shouldFetchForm('radicacion-factura')) {
      tasks.push(
        (async () => {
          try {
            interface InvoiceRow {
              id: string;
              user_id: string;
              project_id: string;
              invoice_number?: string;
              supplier_name?: string;
              created_at: string;
              due_date?: string;
              issue_date?: string;
              status?: string;
              total_amount?: number;
              amount?: number;
              [key: string]: unknown;
            }
            let data: InvoiceRow[] | null = null;
            const resFilings = await supabase
              .from('invoice_filings')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(100);

            if (!resFilings.error && resFilings.data && resFilings.data.length > 0) {
              data = resFilings.data;
            } else {
              const resPayable = await supabase
                .from('invoices_payable')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);
              data = resPayable.data ?? resFilings.data;
            }

            for (const r of data ?? []) {
              const u = resolveUser(r.user_id);
              const p = resolveProject(r.project_id);
              const amount = r.total_amount ?? r.amount ?? 0;

              allRecords.push({
                id: r.id,
                form_slug: 'radicacion-factura',
                form_name: 'Radicación de Factura Proveedor',
                form_category: 'accounting',
                official_code: r.invoice_number || `FAC-${String(r.id).substring(0, 8).toUpperCase()}`,
                project_id: r.project_id,
                project_name: p.project_name,
                project_code: p.project_code,
                user_id: r.user_id,
                user_name: u.user_name,
                user_email: u.user_email,
                created_at: r.created_at,
                submission_date: r.due_date || r.issue_date || r.created_at.split('T')[0],
                status: r.status || 'pending',
                status_label: (r.status && STATUS_MAP[r.status]) || r.status || 'Pendiente',
                summary: `Proveedor: ${r.supplier_name || 'N/A'} - Factura N°: ${r.invoice_number || 'N/A'} - Monto: $${Number(amount).toLocaleString('es-CO')} COP`,
                files: [],
                signatures: [],
                raw_data: r,
              });
            }
          } catch (e) {
            console.error('Error cargando invoice_filings:', e);
          }
        })()
      );
    }

    // Ejecutar todas las lecturas de forma segura y concurrente
    await Promise.allSettled(tasks);

    // 3. Aplicar Filtros Universales (Comunes a todos los formularios)
    let filtered = allRecords;

    // Filtro por Proyecto
    if (filterProjectId !== 'all') {
      filtered = filtered.filter((r) => r.project_id === filterProjectId);
    }

    // Filtro por Usuario
    if (filterUserId !== 'all') {
      filtered = filtered.filter((r) => r.user_id === filterUserId);
    }

    // Filtro por Estado
    if (filterStatus !== 'all') {
      filtered = filtered.filter((r) => r.status.toLowerCase() === filterStatus.toLowerCase());
    }

    // Filtro por Rango de Fechas
    if (filterDateFrom) {
      filtered = filtered.filter((r) => r.submission_date >= filterDateFrom);
    }
    if (filterDateTo) {
      filtered = filtered.filter((r) => r.submission_date <= filterDateTo);
    }

    // Filtro por Presencia de Archivos
    if (filterHasFiles === 'yes') {
      filtered = filtered.filter((r) => r.files.length > 0);
    } else if (filterHasFiles === 'no') {
      filtered = filtered.filter((r) => r.files.length === 0);
    } else if (filterHasFiles === 'signatures') {
      filtered = filtered.filter((r) => r.signatures.length > 0);
    }

    // Búsqueda de Texto Libre (código, nombre del formulario, usuario, proyecto, resumen)
    if (searchQuery) {
      filtered = filtered.filter(
        (r) =>
          r.official_code.toLowerCase().includes(searchQuery) ||
          r.form_name.toLowerCase().includes(searchQuery) ||
          r.user_name.toLowerCase().includes(searchQuery) ||
          r.project_name.toLowerCase().includes(searchQuery) ||
          r.project_code.toLowerCase().includes(searchQuery) ||
          r.summary.toLowerCase().includes(searchQuery) ||
          r.id.toLowerCase().includes(searchQuery)
      );
    }

    // Ordenar cronológicamente descendente
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // 4. Calcular KPIs Consolidados
    const stats = {
      total_submissions: filtered.length,
      with_official_files: filtered.filter((r) => r.files.length > 0).length,
      with_signatures: filtered.filter((r) => r.signatures.length > 0).length,
      approved_or_issued: filtered.filter((r) => ['approved', 'issued', 'closed'].includes(r.status)).length,
      pending_review: filtered.filter((r) => ['submitted', 'pending', 'under_review', 'open'].includes(r.status)).length,
    };

    // 5. Catálogo consolidado de formularios disponibles
    const formsCatalog = [
      { slug: 'analisis-planificacion-cambios-sig', name: 'Análisis y Planificación de Cambios SIG (FOR-SIG-001)', category: 'hseq' },
      { slug: 'hseq-report', name: 'Inspección Pre-operacional HSEQ (FOR-HSEQ-024)', category: 'hseq' },
      { slug: 'gpr-field-form', name: 'Reporte Diario de Campo GPR', category: 'gpr' },
      { slug: 'cad-register-form', name: 'Bitácora de Dibujo CAD / BIM', category: 'cad' },
      { slug: 'elaboracion-cartas', name: 'Elaboración de Cartas y Certificaciones', category: 'rrhh' },
      { slug: 'requerimiento-compra', name: 'Solicitud de Requerimiento', category: 'purchasing' },
      { slug: 'orden-compra', name: 'Orden de Compra y Adjudicación', category: 'purchasing' },
      { slug: 'registro-proveedor', name: 'Registro y Homologación de Proveedores (FOR-COM-004)', category: 'purchasing' },
      { slug: 'solicitud-viaticos', name: 'Solicitud de Viáticos y Anticipos', category: 'finance' },
      { slug: 'legalizacion-gastos', name: 'Legalización y Rendición de Gastos', category: 'finance' },
      { slug: 'radicacion-factura', name: 'Radicación de Factura Proveedor', category: 'accounting' },
    ];

    const effectiveFormsCatalog = isAdmin
      ? formsCatalog
      : formsCatalog.filter((f) => allowedFormSlugs.has(f.slug));

    // Proyectos activos para dropdown
    const projectsCatalog = Array.from(projectsMap.entries()).map(([id, p]) => ({
      id,
      code: p.cost_center,
      name: `${p.cost_center} - ${p.name}`,
    }));

    // Usuarios para dropdown
    const usersCatalog = Array.from(usersMap.entries()).map(([id, u]) => ({
      id,
      email: u.email,
      name: u.full_name,
    }));

    return NextResponse.json({
      data: filtered,
      stats,
      forms_catalog: effectiveFormsCatalog,
      projects_catalog: projectsCatalog,
      users_catalog: usersCatalog,
    });
  } catch (err: unknown) {
    console.error('Error en /api/tools/forms-audit:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno al consultar auditoría' },
      { status: 500 }
    );
  }
}
