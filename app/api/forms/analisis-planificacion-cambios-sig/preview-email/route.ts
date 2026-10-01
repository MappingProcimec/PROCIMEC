import { NextRequest } from 'next/server';
import { renderSigChangeEmailHtml } from '@/lib/sig/sigMailer';
import { SigChangeData } from '@/lib/sig-templates';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const sampleData: SigChangeData = {
    id: 'demo-preview-uuid',
    official_code: 'FOR-SIG-001',
    version: '1',
    identifier_name: searchParams.get('name') || 'Ing. Supervisor de Operaciones',
    identifier_position: 'Líder Técnico de Operaciones y GPR',
    identifier_process: 'Operaciones & Control de Calidad',
    identification_date: searchParams.get('date') || new Date().toISOString().split('T')[0],
    change_description: 'Estandarización y digitalización del proceso de control de cambios operativos SIG en la nube, garantizando trazabilidad en tiempo real, respaldo fotográfico y generación automática del formato institucional.',
    justification: 'Cumplimiento de requisitos de la norma ISO 9001:2015 / ISO 45001 / ISO 14001 para la gestión de riesgos y oportunidades operacionales, optimizando tiempos de auditoría en un 70%.',
    affected_processes: 'Operaciones, Calidad, HSEQ, Gestión Tecnológica',
    origins: ['Requisitos legales o del cliente', 'Mejora continua', 'Acciones preventivas'],
    origins_other: '',
    work_team: [
      { nombre: 'Ing. Administrador de Plataforma y TI', cargo: 'Líder de Desarrollo y Operaciones TI', proceso: 'Gestión de la Información' },
      { nombre: 'Líder HSEQ', cargo: 'Coordinador SIG y Seguridad Ocupacional', proceso: 'Gestión HSEQ' },
      { nombre: 'Director Técnico', cargo: 'Gerente de Operaciones', proceso: 'Dirección Estratégica' },
    ],
    risks: [
      {
        tipo: 'Amenaza',
        descripcion_efectos: 'Resistencia al cambio durante la adopción del nuevo flujo en campo.',
        controles_acciones: 'Capacitación presencial y manuales interactivos paso a paso en plataforma.',
      },
    ],
    activities: [
      {
        actividad: 'Socialización y capacitación a los líderes de proceso',
        responsable: 'Líder HSEQ / TI',
        fecha_limite: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        producto_esperado: 'Acta de asistencia y evaluación de entendimiento',
      },
    ],
    approval_name: 'Director General / Gerencia',
    approval_position: 'Gerencia General',
    approval_process: 'Dirección Estratégica',
    approval_signature: 'Firmado Digitalmente',
    tracking_name: 'Coordinación HSEQ',
    tracking_position: 'Líder SIG',
    tracking_process: 'Gestión HSEQ',
    tracking_signature: 'Firmado Digitalmente',
    control_risks_controlled: true,
    change_effective: true,
    effectiveness_notes_no: '',
  };

  const html = renderSigChangeEmailHtml({
    changeData: sampleData,
    submitterName: sampleData.identifier_name,
    hasPdfAttachment: true,
  });

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
