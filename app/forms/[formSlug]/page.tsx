'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { useQuery } from '@tanstack/react-query';
import TwoStepForm, { FormConfig, Project } from '@/components/forms/TwoStepForm';
import CadRegisterFormPage from '@/app/tools/cad-register-form/page';

// --- Form catalog configurations ---
const FORM_CONFIGS: Record<string, FormConfig> = {
  'gpr-field-form': {
    name: 'Formulario de Campo GPR',
    description: 'Formulario de reporte operacional de exploración y medición en campo',
    hasAttachments: true,
    step1Fields: [
      {
        key: 'project_id',
        label: 'Proyecto',
        type: 'select',
        required: true,
      },
      {
        key: 'date',
        label: 'Fecha de inspección',
        type: 'date',
        required: true,
      },
      {
        key: 'operator_name',
        label: 'Operador / Responsable de campo',
        type: 'text',
        required: true,
        placeholder: 'Nombre completo del operador',
      },
      {
        key: 'cad_priority',
        label: 'Prioridad de elaboración CAD',
        type: 'select',
        required: true,
        options: [
          { value: 'normal', label: 'Normal' },
          { value: 'media', label: 'Media' },
          { value: 'alta', label: 'Alta' },
          { value: 'urgente', label: 'Urgente' },
        ],
      },
      {
        key: 'notes',
        label: 'Observaciones y comentarios de campo',
        type: 'textarea',
        placeholder: 'Detalles del levantamiento GPR, condiciones climáticas o hallazgos...',
      },
    ],
  },
  'cad-register-form': {
    name: 'Formulario de Registro CAD/BIM',
    description: 'Registro de actividades de modelado y dibujo técnico',
    hasAttachments: false,
    step1Fields: [
      {
        key: 'project_id',
        label: 'Proyecto',
        type: 'select',
        required: true,
      },
      {
        key: 'date',
        label: 'Fecha',
        type: 'date',
        required: true,
      },
      {
        key: 'software',
        label: 'Software utilizado',
        type: 'software-group',
        required: true,
        options: [
          { value: 'civil3d', label: 'Civil 3D' },
          { value: 'revit', label: 'Revit' },
          { value: 'autocad', label: 'AutoCAD' },
          { value: 'otro', label: 'Otro', allowCustom: true },
        ],
      },
      {
        key: 'phase',
        label: 'Fase de entrega',
        type: 'select',
        required: true,
        options: [
          { value: 'preliminar', label: 'Preliminar' },
          { value: 'intermedio', label: 'Intermedio' },
          { value: 'final', label: 'Final' },
          { value: 'revision', label: 'Revisión' },
        ],
      },
      {
        key: 'had_rework',
        label: 'Hubo reproceso',
        type: 'toggle',
      },
      {
        key: 'rework_notes',
        label: 'Observaciones de reproceso',
        type: 'textarea',
        required: true,
        placeholder: 'Describe el motivo del reproceso...',
        conditionalOn: { key: 'had_rework', truthy: true },
      },
      {
        key: 'notes',
        label: 'Notas adicionales',
        type: 'textarea',
        placeholder: 'Opcional...',
      },
    ],
  },
};

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects');
  const json = await res.json();
  return json.data ?? [];
}

// --- GPR Campo Form Selector / Redirector ---
function GprCampoFormWrapper() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') ?? undefined;
  const router = useRouter();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const [selectedProj, setSelectedProj] = useState(projectId || '');

  useEffect(() => {
    if (projectId) {
      router.replace(`/projects/${projectId}/new-report`);
    }
  }, [projectId, router]);

  const handleSelect = (pId: string) => {
    setSelectedProj(pId);
    if (pId) {
      router.push(`/projects/${pId}/new-report`);
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="page-hero">
        <div className="max-w-2xl mx-auto">
          <BackButton href="/admin/forms" label="Formularios" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3">
            📍 Formulario de Campo GPR
          </h1>
          <p className="text-white/70 text-sm mt-1">
            Reporte operacional de exploración, volumetría por tramos y medición GPR en campo
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-6 pb-20">
        <div className="card border border-border shadow-xl p-6 space-y-4 bg-white">
          <h2 className="font-bold text-text-primary text-base">
            Seleccionar Proyecto para el Reporte de Campo GPR
          </h2>
          <p className="text-xs text-text-muted leading-relaxed">
            Selecciona el proyecto correspondiente para cargar el formulario completo de 3 pasos (Volumetría por Tramo/Sector, Hallazgos Técnicos y Subida de Archivos/Adjuntos):
          </p>

          {isLoading ? (
            <div className="p-4 text-center text-text-muted animate-pulse">Cargando proyectos...</div>
          ) : (
            <div className="space-y-3">
              <select
                value={selectedProj}
                onChange={(e) => handleSelect(e.target.value)}
                className="select w-full text-sm py-2.5"
              >
                <option value="">— Seleccionar proyecto... —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.cost_center || p.code || ''} — {p.name}
                  </option>
                ))}
              </select>

              {projects.length === 0 && (
                <p className="text-xs text-text-muted">No hay proyectos registrados aún.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Inner component ---
function FormPageInner({ params }: { params: { formSlug: string } }) {
  const { formSlug } = params;
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') ?? undefined;
  const router = useRouter();

  const config = FORM_CONFIGS[formSlug] ?? {
    name: `Formulario: ${formSlug}`,
    description: 'Formulario activo del catálogo',
    hasAttachments: true,
    step1Fields: [
      { key: 'project_id', label: 'Proyecto', type: 'select', required: true },
      { key: 'date', label: 'Fecha', type: 'date', required: true },
      { key: 'operator_name', label: 'Responsable', type: 'text', required: true },
      { key: 'notes', label: 'Observaciones', type: 'textarea' },
    ],
  };

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const handleSubmit = async (data: Record<string, unknown>) => {
    const targetSlug = formSlug === 'gpr-field-form' ? 'gpr-field-form' : formSlug;
    const res = await fetch(`/api/forms/${targetSlug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, project_id: projectId ?? data.project_id }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Error al enviar formulario');
    router.push(projectId ? `/projects/${projectId}` : '/admin/forms');
  };

  const backUrl = projectId ? `/projects/${projectId}` : '/admin/forms';
  const backLabel = projectId ? 'Volver al proyecto' : 'Formularios';

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="page-hero">
        <div className="max-w-2xl mx-auto">
          <BackButton href={backUrl} label={backLabel} />
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3">
            {config.name}
          </h1>
          {config.description && (
            <p className="text-white/70 text-sm mt-1">{config.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-6 pb-20">
        <TwoStepForm
          formConfig={config}
          formSlug={formSlug}
          projectId={projectId}
          projects={projects}
          onSubmit={handleSubmit}
          backHref={backUrl}
        />
      </div>
    </div>
  );
}

// --- Main Page ---
export default function FormPage({ params }: { params: { formSlug: string } }) {
  if (params.formSlug === 'nueva-actividad') {
    return <CadRegisterFormPage />;
  }

  if (params.formSlug === 'gpr-field-form' || params.formSlug === 'gpr-report') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-surface flex items-center justify-center text-text-muted">Cargando formulario de campo...</div>}>
        <GprCampoFormWrapper />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-surface flex items-center justify-center text-text-muted">Cargando formulario...</div>}>
      <FormPageInner params={params} />
    </Suspense>
  );
}
