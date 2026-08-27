'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { useQuery } from '@tanstack/react-query';
import TwoStepForm, { FormConfig, Project } from '@/components/forms/TwoStepForm';
import CadRegisterFormPage from '@/app/tools/cad-register-form/page';

// --- Form catalog ---
const FORM_CONFIGS: Record<string, FormConfig> = {
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

// --- Inner component (uses useSearchParams, must be inside Suspense) ---
function FormPageInner({ params }: { params: { formSlug: string } }) {
  const { formSlug } = params;
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') ?? undefined;
  const router = useRouter();

  if (formSlug === 'cad-register-form') {
    return <CadRegisterFormPage />;
  }

  const config = FORM_CONFIGS[formSlug];

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const handleSubmit = async (data: Record<string, unknown>) => {
    const res = await fetch(`/api/forms/${formSlug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, project_id: projectId ?? data.project_id }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Error al enviar formulario');
    router.push(projectId ? `/projects/${projectId}` : '/projects');
  };

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="page-hero">
        <div className="max-w-2xl mx-auto">
          <BackButton href="/projects" label="Proyectos" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3">
            {config?.name ?? 'Formulario'}
          </h1>
          {config?.description && (
            <p className="text-white/70 text-sm mt-1">{config.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-6 pb-20">
        {!config ? (
          <div className="card p-10 text-center space-y-3">
            <p className="text-text-muted text-sm">
              Formulario no disponible: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{formSlug}</code>
            </p>
            <button onClick={() => router.push('/projects')} className="text-primary text-sm hover:underline">
              Volver a proyectos
            </button>
          </div>
        ) : (
          <TwoStepForm
            formConfig={config}
            formSlug={formSlug}
            projectId={projectId}
            projects={projects}
            onSubmit={handleSubmit}
            backHref="/projects"
          />
        )}
      </div>
    </div>
  );
}

// --- Page (wraps in Suspense for useSearchParams) ---
export default function FormPage({ params }: { params: { formSlug: string } }) {
  return (
    <Suspense fallback={null}>
      <FormPageInner params={params} />
    </Suspense>
  );
}
