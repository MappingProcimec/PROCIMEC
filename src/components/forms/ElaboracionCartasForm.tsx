'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { HrLetterType, HrLetterData } from '@/types';
import { HR_LETTER_TYPES } from '@/lib/letters/docxTemplateEngine';
import {
  FileText,
  Download,
  Mail,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  Building2,
  User,
  Calendar,
  Briefcase,
  FileCheck2,
  ShieldAlert,
  HelpCircle,
  Eye,
  Check,
  Send,
} from 'lucide-react';

interface ProjectOption {
  id: string;
  name: string;
  code?: string;
  location?: string;
  contract_number?: string;
}

interface UserOption {
  id: string;
  full_name: string;
  email: string;
  role?: string;
}

const DEFAULT_ITEMS_STATE = 'PAZ Y SALVO';

export default function ElaboracionCartasForm() {
  const { data: session } = useSession();
  const router = useRouter();

  // Estados del flujo
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState<HrLetterType>('01_certificacion_laboral');
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [collaborators, setCollaborators] = useState<UserOption[]>([]);
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Resultado de generación
  const [generationResult, setGenerationResult] = useState<{
    letterId?: string;
    radicado: string;
    letterTitle: string;
    docxBase64: string;
    pdfBase64: string;
    emailSent: boolean;
    emailMessage?: string;
    userEmail: string;
    date: string;
    renderedText: string;
  } | null>(null);

  // Datos del Formulario
  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  const [formData, setFormData] = useState<HrLetterData>({
    carta_fecha: todayStr,
    carta_radicado: '',
    firma_tel: '300 530 6039',
    empresa_email: 'ghumana@procimecingenieria.com',

    dest_nombre: 'A QUIEN INTERESE',
    dest_cargo: 'Dirección de Gestión Humana',
    dest_empresa: 'Entidad Solicitante',
    dest_ciudad: 'Barranquilla',

    emp_nombre: '',
    emp_apellidos: '',
    emp_tipo_doc: 'C.C.',
    emp_documento: '',
    emp_ciudad_exp: 'Barranquilla',
    emp_eps: 'Sura EPS',
    emp_pension: 'Porvenir',
    emp_arl: 'Seguros Bolívar (Riesgo V)',

    cargo_nombre: 'Localizador Técnico de Utilidades',
    cargo_tipo_contrato: 'Término Fijo',
    cargo_fecha_inicio: todayStr,
    cargo_fecha_fin: 'la finalización de la etapa contractual',
    cargo_hora_inicio: '07:00',
    cargo_salario: '$ 2.800.000',
    cargo_salario_letras: 'Dos millones ochocientos mil',
    cert_destino: 'fines personales y laborales pertinentes',

    project_id: '',
    proy_nombre: '',
    proy_direccion: '',
    proy_etapa: 'Fase de Exploración GPR',
    proy_contrato: 'PRC-CONTRATO-01',
    proy_duracion: '3 meses prorrogables',
    proy_jefe_cargo: 'Director de Proyectos',
    proy_jefe_nombre: 'Ing. Alberto Florez',
    carta_fecha_acepta: todayStr,

    term_tipo: 'con justa causa',
    term_fecha: todayStr,
    term_causas: 'Cumplimiento del plazo pactado en el contrato de trabajo.',
    term_indem_texto: 'liquidará y cancelará oportunamente la totalidad de prestaciones sociales de ley',
    term_fecha_entrega: todayStr,

    psv_item_1: DEFAULT_ITEMS_STATE,
    psv_item_2: DEFAULT_ITEMS_STATE,
    psv_item_3: DEFAULT_ITEMS_STATE,
    psv_item_4: DEFAULT_ITEMS_STATE,
    psv_item_5: DEFAULT_ITEMS_STATE,
    psv_item_6: DEFAULT_ITEMS_STATE,
    psv_item_7: DEFAULT_ITEMS_STATE,
    psv_observaciones: 'El colaborador hace entrega a satisfacción de todos los activos asignados.',

    perm_fecha_solicitud: todayStr,
    perm_decision: 'autoriza',
    perm_tipo: 'Personal',
    perm_motivo: 'Diligencia personal debidamente justificada ante la jefatura inmediata.',
    perm_fecha_inicio: todayStr,
    perm_fecha_fin: todayStr,
    perm_hora_inicio: '08:00',
    perm_hora_fin: '17:00',
    perm_total: '1 jornada laboral (8 horas)',
    perm_compensacion: 'El permiso es remunerado y no requiere reposición de tiempo',

    sol_objeto: 'presentar la propuesta técnica y documentación corporativa oficial',
    sol_referencia: 'Licitación y Verificación de Utilidades Subterráneas',
    sol_doc_adicional: 'Pólizas de Responsabilidad Civil Extracontractual y ARL',
    sol_nota: 'Cualquier verificación adicional podrá ser coordinada con nuestra dirección técnica.',
  });

  // Pre-llenar datos del usuario autenticado si existen
  useEffect(() => {
    if (session?.user?.name && !formData.emp_nombre) {
      setFormData((prev) => ({
        ...prev,
        emp_nombre: session.user.name || '',
      }));
    }
  }, [session, formData.emp_nombre]);

  // Cargar proyectos y colaboradores para autocompletado canónico
  useEffect(() => {
    setIsLoadingCatalogs(true);
    Promise.allSettled([
      fetch('/api/projects').then((r) => r.json()),
      fetch('/api/admin/users').then((r) => r.json()),
    ])
      .then(([projRes, userRes]) => {
        if (projRes.status === 'fulfilled' && projRes.value?.data) {
          setProjects(projRes.value.data);
        }
        if (userRes.status === 'fulfilled' && userRes.value?.data) {
          setCollaborators(userRes.value.data);
        }
      })
      .finally(() => setIsLoadingCatalogs(false));
  }, []);

  const handleChange = (field: keyof HrLetterData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Manejador cuando se selecciona un colaborador existente del catálogo
  const handleSelectCollaborator = (userId: string) => {
    const col = collaborators.find((c) => c.id === userId);
    if (col) {
      setFormData((prev) => ({
        ...prev,
        emp_nombre: col.full_name,
        emp_apellidos: col.full_name.split(' ').slice(1).join(' '),
      }));
    }
  };

  // Manejador cuando se selecciona un proyecto
  const handleSelectProject = (projectId: string) => {
    const proj = projects.find((p) => p.id === projectId);
    if (proj) {
      setFormData((prev) => ({
        ...prev,
        project_id: proj.id,
        proy_nombre: proj.name,
        proy_direccion: proj.location || prev.proy_direccion,
        proy_contrato: proj.contract_number || prev.proy_contrato,
      }));
    }
  };

  // Envío del Formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/letters/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          letterType: selectedType,
          data: formData,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error al generar la carta.');
      }

      setGenerationResult(json);
      setStep(3);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Descargar archivo desde base64
  const downloadFile = (base64Data: string, filename: string, mimeType: string) => {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selectedMeta = HR_LETTER_TYPES[selectedType];

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC]">
      <Navbar />

      {/* Hero Header */}
      <div className="page-hero bg-[#1E2229] border-b-2 border-[#EAA023]">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <BackButton href="/dashboard" label="Volver a Mi Panel" />
              <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 flex items-center gap-2.5">
                <FileText className="w-7 h-7 text-accent" strokeWidth={1.75} /> Elaboración de Cartas RRHH
              </h1>
              <p className="text-white/70 text-sm mt-1">
                Generación canónica con membrete oficial, descarga instantánea y radicado
              </p>
            </div>

            {/* Stepper visual */}
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-xs font-mono text-white/90">
              <span className={`px-2 py-0.5 rounded-md ${step === 1 ? 'bg-[#EAA023] text-[#1E2229] font-bold' : 'text-slate-400'}`}>
                1. Selección
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              <span className={`px-2 py-0.5 rounded-md ${step === 2 ? 'bg-[#EAA023] text-[#1E2229] font-bold' : 'text-slate-400'}`}>
                2. Diligenciamiento
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              <span className={`px-2 py-0.5 rounded-md ${step === 3 ? 'bg-emerald-500 text-white font-bold' : 'text-slate-400'}`}>
                3. Descarga
              </span>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 -mt-4 pb-24">
        {/* ─── PASO 1: SELECCIÓN DE PLANTILLA ─── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
                <div>
                  <h2 className="text-base font-bold text-[#1E2229]">
                    Seleccione el tipo de carta o certificación a elaborar
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Plantillas oficiales estandarizadas extraídas de la carpeta institucional de Recursos Humanos
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {(Object.keys(HR_LETTER_TYPES) as HrLetterType[]).map((key) => {
                  const item = HR_LETTER_TYPES[key];
                  const isSelected = selectedType === key;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedType(key)}
                      className={`text-left p-4 rounded-xl border transition-all duration-160 flex items-start gap-3.5 group ${
                        isSelected
                          ? 'border-[#EAA023] bg-[#FEF9EC] shadow-sm ring-1 ring-[#EAA023]'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 bg-white'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center font-mono text-xs font-bold transition-colors ${
                          isSelected
                            ? 'bg-[#EAA023] text-[#1E2229]'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                        }`}
                      >
                        {item.templateFile.slice(0, 2)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-bold text-sm text-[#0F172A] group-hover:text-[#1E2229]">
                            {item.title}
                          </h3>
                          <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="pt-0.5">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? 'border-[#EAA023] bg-[#EAA023] text-[#1E2229]'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Plantilla seleccionada: <strong className="text-[#0F172A]">{selectedMeta.title}</strong>
                </span>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E2229] hover:bg-[#15181D] active:scale-[0.98] text-white text-xs font-bold transition-all shadow-sm"
                >
                  <span>Continuar al Diligenciamiento</span>
                  <ChevronRight className="w-4 h-4 text-[#EAA023]" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── PASO 2: DILIGENCIAMIENTO DE INFORMACIÓN ─── */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Barra superior con resumen de selección */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Cambiar tipo de carta"
                >
                  <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#EAA023] tracking-wider">
                    {selectedMeta.badge}
                  </span>
                  <h2 className="text-base font-bold text-[#1E2229] leading-tight">
                    {selectedMeta.title}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-mono">
                  Radicado autogenerado o personalizado
                </span>
              </div>
            </div>

            {errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" strokeWidth={1.75} />
                <div>
                  <strong className="font-bold">Error al procesar:</strong> {errorMessage}
                </div>
              </div>
            )}

            {/* SECCIÓN A: Metadatos Básicos */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Calendar className="w-4 h-4 text-[#EAA023]" strokeWidth={1.75} />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  1. Metadatos de Emisión y Despacho
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fecha de Expedición
                  </label>
                  <input
                    type="text"
                    value={formData.carta_fecha}
                    onChange={(e) => handleChange('carta_fecha', e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                    placeholder="Ej. 23 de septiembre de 2026"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Número de Radicado (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.carta_radicado}
                    onChange={(e) => handleChange('carta_radicado', e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                    placeholder="Auto: PRC-RH-2026-XXXX"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="text"
                    value={formData.firma_tel}
                    onChange={(e) => handleChange('firma_tel', e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                    placeholder="300 530 6039"
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN B: Datos del Colaborador (para tipos 01 a 06) */}
            {selectedType !== '07_solicitud_entidad_externa' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#EAA023]" strokeWidth={1.75} />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      2. Datos del Colaborador / Trabajador
                    </h3>
                  </div>

                  {collaborators.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">Cargar de usuario:</span>
                      <select
                        onChange={(e) => handleSelectCollaborator(e.target.value)}
                        className="text-xs px-2 py-1 rounded-md border border-slate-200 bg-slate-50 font-medium"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Seleccionar colaborador...
                        </option>
                        {collaborators.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.full_name} ({c.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nombre Completo del Colaborador *
                    </label>
                    <input
                      type="text"
                      value={formData.emp_nombre}
                      onChange={(e) => handleChange('emp_nombre', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="Nombre y Apellidos completos"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tipo de Documento
                    </label>
                    <select
                      value={formData.emp_tipo_doc}
                      onChange={(e) => handleChange('emp_tipo_doc', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                    >
                      <option value="C.C.">Cédula de Ciudadanía (C.C.)</option>
                      <option value="C.E.">Cédula de Extranjería (C.E.)</option>
                      <option value="P.P.T.">Permiso por Protección Temporal (P.P.T.)</option>
                      <option value="Pasaporte">Pasaporte</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Número de Documento *
                    </label>
                    <input
                      type="text"
                      value={formData.emp_documento}
                      onChange={(e) => handleChange('emp_documento', e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="Ej. 1.045.678.900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ciudad de Expedición
                    </label>
                    <input
                      type="text"
                      value={formData.emp_ciudad_exp}
                      onChange={(e) => handleChange('emp_ciudad_exp', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="Ej. Barranquilla"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cargo / Función Oficial
                    </label>
                    <input
                      type="text"
                      value={formData.cargo_nombre}
                      onChange={(e) => handleChange('cargo_nombre', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="Ej. Localizador Técnico de Georradar"
                    />
                  </div>
                </div>

                {/* Campos específicos de seguridad social para presentación de obra */}
                {selectedType === '02_presentacion_personal_obra' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Entidad EPS
                      </label>
                      <input
                        type="text"
                        value={formData.emp_eps}
                        onChange={(e) => handleChange('emp_eps', e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                        placeholder="Ej. Sura EPS / Sanitas"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Fondo de Pensiones (AFP)
                      </label>
                      <input
                        type="text"
                        value={formData.emp_pension}
                        onChange={(e) => handleChange('emp_pension', e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                        placeholder="Ej. Porvenir / Protección"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Aseguradora ARL
                      </label>
                      <input
                        type="text"
                        value={formData.emp_arl}
                        onChange={(e) => handleChange('emp_arl', e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                        placeholder="Ej. Seguros Bolívar (Riesgo V)"
                      />
                    </div>
                  </div>
                )}

                {/* Campos salariales para Certificación Laboral */}
                {selectedType === '01_certificacion_laboral' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tipo de Contrato
                      </label>
                      <select
                        value={formData.cargo_tipo_contrato}
                        onChange={(e) => handleChange('cargo_tipo_contrato', e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      >
                        <option value="Término Fijo">A Término Fijo</option>
                        <option value="Término Indefinido">A Término Indefinido</option>
                        <option value="Por Obra o Labor">Por Obra o Labor Determinada</option>
                        <option value="Aprendizaje SENA">Contrato de Aprendizaje</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Fecha Inicio de Labores
                      </label>
                      <input
                        type="text"
                        value={formData.cargo_fecha_inicio}
                        onChange={(e) => handleChange('cargo_fecha_inicio', e.target.value)}
                        className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                        placeholder="Ej. 15 de enero de 2024"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Salario Mensual ($)
                      </label>
                      <input
                        type="text"
                        value={formData.cargo_salario}
                        onChange={(e) => handleChange('cargo_salario', e.target.value)}
                        className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                        placeholder="Ej. $ 3.500.000"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Salario en Letras
                      </label>
                      <input
                        type="text"
                        value={formData.cargo_salario_letras}
                        onChange={(e) => handleChange('cargo_salario_letras', e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                        placeholder="Ej. Tres millones quinientos mil"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Destino / Presentada ante
                      </label>
                      <input
                        type="text"
                        value={formData.cert_destino}
                        onChange={(e) => handleChange('cert_destino', e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                        placeholder="Ej. entidad bancaria / trámites pertinentes"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SECCIÓN C: Proyecto y Frente de Obra (para 02, 03, 06) */}
            {['02_presentacion_personal_obra', '03_vinculacion_a_proyecto', '06_permiso_laboral'].includes(selectedType) && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#EAA023]" strokeWidth={1.75} />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      3. Proyecto Asignado y Frente Operativo
                    </h3>
                  </div>

                  {projects.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">Cargar proyecto canónico:</span>
                      <select
                        onChange={(e) => handleSelectProject(e.target.value)}
                        value={formData.project_id || ''}
                        className="text-xs px-2 py-1 rounded-md border border-slate-200 bg-slate-50 font-medium"
                      >
                        <option value="">Seleccionar de lista oficial...</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.code ? `(${p.code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nombre Oficial del Proyecto
                    </label>
                    <input
                      type="text"
                      value={formData.proy_nombre}
                      onChange={(e) => handleChange('proy_nombre', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="Ej. Intersección Vial Calle 72 con Vía 40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ubicación / Dirección
                    </label>
                    <input
                      type="text"
                      value={formData.proy_direccion}
                      onChange={(e) => handleChange('proy_direccion', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="Ej. Barranquilla, Atlántico"
                    />
                  </div>

                  {selectedType === '03_vinculacion_a_proyecto' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Número de Contrato
                        </label>
                        <input
                          type="text"
                          value={formData.proy_contrato}
                          onChange={(e) => handleChange('proy_contrato', e.target.value)}
                          className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                          placeholder="Ej. PRC-2026-OP-04"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Duración de la Asignación
                        </label>
                        <input
                          type="text"
                          value={formData.proy_duracion}
                          onChange={(e) => handleChange('proy_duracion', e.target.value)}
                          className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                          placeholder="Ej. 6 meses prorrogables"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Nombre del Jefe Inmediato
                        </label>
                        <input
                          type="text"
                          value={formData.proy_jefe_nombre}
                          onChange={(e) => handleChange('proy_jefe_nombre', e.target.value)}
                          className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                          placeholder="Ej. Ing. Carlos Mendoza"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Cargo del Jefe Inmediato
                        </label>
                        <input
                          type="text"
                          value={formData.proy_jefe_cargo}
                          onChange={(e) => handleChange('proy_jefe_cargo', e.target.value)}
                          className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                          placeholder="Ej. Director de Geofísica"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Hora de Presentación
                        </label>
                        <input
                          type="text"
                          value={formData.cargo_hora_inicio}
                          onChange={(e) => handleChange('cargo_hora_inicio', e.target.value)}
                          className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                          placeholder="Ej. 07:00"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* SECCIÓN D: Destinatario (para 01, 02, 07) */}
            {['01_certificacion_laboral', '02_presentacion_personal_obra', '07_solicitud_entidad_externa'].includes(selectedType) && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <Briefcase className="w-4 h-4 text-[#EAA023]" strokeWidth={1.75} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    {selectedType === '07_solicitud_entidad_externa' ? '2. Entidad u Organización Destinataria' : '3. Destinatario de la Comunicación'}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nombre del Destinatario
                    </label>
                    <input
                      type="text"
                      value={formData.dest_nombre}
                      onChange={(e) => handleChange('dest_nombre', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="A QUIEN INTERESE o Nombre"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cargo del Destinatario
                    </label>
                    <input
                      type="text"
                      value={formData.dest_cargo}
                      onChange={(e) => handleChange('dest_cargo', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="Ej. Director de Interventoría"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Empresa o Entidad
                    </label>
                    <input
                      type="text"
                      value={formData.dest_empresa}
                      onChange={(e) => handleChange('dest_empresa', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="Ej. Consorcio Vial 2026"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ciudad
                    </label>
                    <input
                      type="text"
                      value={formData.dest_ciudad}
                      onChange={(e) => handleChange('dest_ciudad', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="Ej. Barranquilla / Bogotá"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECCIÓN E: Específico de Paz y Salvo (05_paz_y_salvo) */}
            {selectedType === '05_paz_y_salvo' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <FileCheck2 className="w-4 h-4 text-[#EAA023]" strokeWidth={1.75} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    3. Matriz de Conceptos de Paz y Salvo
                  </h3>
                </div>

                <div className="divide-y divide-slate-100">
                  {[
                    { key: 'psv_item_1', label: '1. Dotación y elementos de trabajo corporativos' },
                    { key: 'psv_item_2', label: '2. Elementos de Protección Personal (EPP)' },
                    { key: 'psv_item_3', label: '3. Equipos, herramientas y/o maquinaria GPR' },
                    { key: 'psv_item_4', label: '4. Llaves, accesos físicos y tarjetas de ingreso' },
                    { key: 'psv_item_5', label: '5. Documentos, planos DWG y archivos técnicos' },
                    { key: 'psv_item_6', label: '6. Saldos de anticipos, viáticos o caja menor' },
                    { key: 'psv_item_7', label: '7. Carnet corporativo y credenciales de identificación' },
                  ].map((row) => (
                    <div key={row.key} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-700">{row.label}</span>
                      <div className="flex items-center gap-1.5">
                        {['PAZ Y SALVO', 'ENTREGADO', 'NO APLICA', 'PENDIENTE'].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleChange(row.key as keyof HrLetterData, val)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                              formData[row.key as keyof HrLetterData] === val
                                ? 'bg-[#1E2229] text-[#EAA023]'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Observaciones de Paz y Salvo
                  </label>
                  <textarea
                    rows={2}
                    value={formData.psv_observaciones}
                    onChange={(e) => handleChange('psv_observaciones', e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                    placeholder="Detalles sobre entregas, devoluciones o aclaraciones..."
                  />
                </div>
              </div>
            )}

            {/* SECCIÓN F: Específico de Terminación de Contrato (04_terminacion_contrato) */}
            {selectedType === '04_terminacion_contrato' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <ShieldAlert className="w-4 h-4 text-[#EAA023]" strokeWidth={1.75} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    3. Condiciones de Terminación Contractual
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Modalidad de Terminación
                    </label>
                    <select
                      value={formData.term_tipo}
                      onChange={(e) => handleChange('term_tipo', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                    >
                      <option value="con justa causa">Con Justa Causa</option>
                      <option value="sin justa causa">Sin Justa Causa (Indemnizada)</option>
                      <option value="por vencimiento del término pactado">Vencimiento del Término Pactado</option>
                      <option value="por finalización de la obra o labor contratada">Finalización de Obra o Labor</option>
                      <option value="por mutuo acuerdo entre las partes">Mutuo Acuerdo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Fecha Efectiva de Terminación
                    </label>
                    <input
                      type="text"
                      value={formData.term_fecha}
                      onChange={(e) => handleChange('term_fecha', e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="Ej. 30 de septiembre de 2026"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Causas y Justificación Legal
                    </label>
                    <textarea
                      rows={3}
                      value={formData.term_causas}
                      onChange={(e) => handleChange('term_causas', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="Explicación detallada de las causas que motivan la terminación..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Compromiso de Liquidación
                    </label>
                    <input
                      type="text"
                      value={formData.term_indem_texto}
                      onChange={(e) => handleChange('term_indem_texto', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="liquidará y pagará la totalidad de conceptos de ley"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Fecha Límite Entrega de Puesto y Bienes
                    </label>
                    <input
                      type="text"
                      value={formData.term_fecha_entrega}
                      onChange={(e) => handleChange('term_fecha_entrega', e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="Ej. 30 de septiembre de 2026"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECCIÓN G: Específico de Permiso Laboral (06_permiso_laboral) */}
            {selectedType === '06_permiso_laboral' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <Calendar className="w-4 h-4 text-[#EAA023]" strokeWidth={1.75} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    3. Parámetros del Permiso Laboral
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tipo de Permiso
                    </label>
                    <select
                      value={formData.perm_tipo}
                      onChange={(e) => handleChange('perm_tipo', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                    >
                      <option value="Personal">Personal</option>
                      <option value="Médico / Cita Salud">Médico / Cita de Salud</option>
                      <option value="Calamidad Doméstica">Calamidad Doméstica</option>
                      <option value="Capacitación / Estudio">Capacitación / Estudio</option>
                      <option value="Licencia Especial">Licencia Especial</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Decisión Empresarial
                    </label>
                    <select
                      value={formData.perm_decision}
                      onChange={(e) => handleChange('perm_decision', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                    >
                      <option value="autoriza">Autoriza el permiso</option>
                      <option value="concede">Concede el permiso</option>
                      <option value="aprueba de forma extraordinaria">Aprueba de forma extraordinaria</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Duración Total
                    </label>
                    <input
                      type="text"
                      value={formData.perm_total}
                      onChange={(e) => handleChange('perm_total', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="Ej. 1 jornada laboral (8 horas) / 2 días"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Motivo / Justificación
                    </label>
                    <textarea
                      rows={2}
                      value={formData.perm_motivo}
                      onChange={(e) => handleChange('perm_motivo', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="Descripción de la causa del permiso..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Fecha Inicio
                    </label>
                    <input
                      type="text"
                      value={formData.perm_fecha_inicio}
                      onChange={(e) => handleChange('perm_fecha_inicio', e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="Ej. 24 de septiembre de 2026"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Fecha Fin
                    </label>
                    <input
                      type="text"
                      value={formData.perm_fecha_fin}
                      onChange={(e) => handleChange('perm_fecha_fin', e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="Ej. 24 de septiembre de 2026"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Régimen de Compensación
                    </label>
                    <input
                      type="text"
                      value={formData.perm_compensacion}
                      onChange={(e) => handleChange('perm_compensacion', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="Remunerado / Sin reposición de tiempo"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECCIÓN H: Específico de Solicitud Externa (07_solicitud_entidad_externa) */}
            {selectedType === '07_solicitud_entidad_externa' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <FileText className="w-4 h-4 text-[#EAA023]" strokeWidth={1.75} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    3. Objeto y Referencia de la Solicitud
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Objeto Principal de la Comunicación
                    </label>
                    <textarea
                      rows={2}
                      value={formData.sol_objeto}
                      onChange={(e) => handleChange('sol_objeto', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="Ej. radicar formalmente el plan de manejo de tránsito y evidencias técnicas de georradar..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Referencia del Trámite
                    </label>
                    <input
                      type="text"
                      value={formData.sol_referencia}
                      onChange={(e) => handleChange('sol_referencia', e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="Ej. Radicado de Entrada No. 2026-EE-9901"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Documentos Adicionales Anexos
                    </label>
                    <input
                      type="text"
                      value={formData.sol_doc_adicional}
                      onChange={(e) => handleChange('sol_doc_adicional', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="Ej. Pólizas de cumplimiento y ensayos de laboratorio"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nota de Cierre
                    </label>
                    <input
                      type="text"
                      value={formData.sol_nota}
                      onChange={(e) => handleChange('sol_nota', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EAA023]"
                      placeholder="Ej. Quedamos atentos a cualquier solicitud o aclaración requerida..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Volver a Plantillas
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#1E2229] hover:bg-[#15181D] active:scale-[0.98] text-[#EAA023] text-xs font-bold transition-all shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#EAA023]" />
                    <span>Compilando Word y PDF...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-[#EAA023]" strokeWidth={1.75} />
                    <span>Generar Carta, Guardar y Enviar al Correo</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ─── PASO 3: PANTALLA DE ÉXITO Y DESCARGA INMEDIATA ─── */}
        {step === 3 && generationResult && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-emerald-200 shadow-md p-6 sm:p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" strokeWidth={1.75} />
              </div>

              <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                Emisión Exitosa &middot; {generationResult.radicado}
              </span>

              <h2 className="text-xl sm:text-2xl font-bold text-[#1E2229] mt-3">
                {generationResult.letterTitle} Elaborada
              </h2>

              <p className="text-xs text-slate-600 max-w-lg mx-auto mt-2 leading-relaxed">
                El documento ha sido compilado en alta fidelidad y guardado en la base de datos de auditoría.
                {generationResult.emailSent ? (
                  <span className="text-emerald-700 font-semibold block mt-1">
                    Se envió una copia con los archivos adjuntos a: {generationResult.userEmail}
                  </span>
                ) : (
                  <span className="text-slate-500 block mt-1">
                    Envío de correo registrado de forma segura.
                  </span>
                )}
              </p>

              {/* Botones de Descarga Destacados */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() =>
                    downloadFile(
                      generationResult.docxBase64,
                      `${generationResult.radicado}_${selectedMeta.title.replace(/[\s/]/g, '_')}.docx`,
                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    )
                  }
                  className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold transition-all shadow-sm"
                >
                  <Download className="w-4 h-4" strokeWidth={1.75} />
                  <span>Descargar Word (.docx)</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    downloadFile(
                      generationResult.pdfBase64,
                      `${generationResult.radicado}_${selectedMeta.title.replace(/[\s/]/g, '_')}.pdf`,
                      'application/pdf'
                    )
                  }
                  className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#1E2229] hover:bg-[#15181D] active:scale-[0.98] text-[#EAA023] text-xs font-bold transition-all shadow-sm"
                >
                  <Download className="w-4 h-4 text-[#EAA023]" strokeWidth={1.75} />
                  <span>Descargar PDF (.pdf)</span>
                </button>
              </div>

              {/* Acciones secundarias */}
              <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const win = window.open();
                    if (win) {
                      win.document.write(
                        `<iframe src="data:application/pdf;base64,${generationResult.pdfBase64}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
                      );
                    }
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  Previsualizar PDF en Pantalla
                </button>

                <Link
                  href="/dashboard"
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Volver a Mi Panel
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setGenerationResult(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Generar Otra Carta
                </button>
              </div>
            </div>

            {/* Previsualización del Texto Renderizado Oficial */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#EAA023]" strokeWidth={1.75} />
                  Texto Oficial Registrado en Auditoría
                </h3>
                <span className="font-mono text-[10px] text-slate-400">
                  {generationResult.radicado}
                </span>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                {generationResult.renderedText}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
