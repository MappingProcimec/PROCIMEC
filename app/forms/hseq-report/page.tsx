'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { DigitalSignatureModal } from '@/components/hseq/DigitalSignatureModal';
import {
  getHseqFormatConfig,
  getOptimalResponses,
  HseqFormatConfig,
} from '@/lib/hseq-definitions';
import { PenTool, AlertCircle, Check, FileSpreadsheet, ExternalLink, ClipboardList, Sparkles, Loader2, ShieldCheck } from 'lucide-react';

interface HseqTemplateOption {
  id: string;
  name: string;
  code: string;
  title: string;
  folderName: string;
  folderId: string;
  mimeType: string;
  webViewLink?: string;
}

interface ProjectOption {
  id: string;
  name: string;
  cost_center?: string;
  code?: string;
  client?: string;
  location?: string;
}

interface TemplatesApiResponse {
  ok: boolean;
  count: number;
  folderId: string;
  templates: HseqTemplateOption[];
  source: 'google_drive' | 'fallback';
  warning?: string;
}

async function fetchTemplates(refresh = false): Promise<TemplatesApiResponse> {
  const res = await fetch(`/api/hseq/templates${refresh ? '?refresh=true' : ''}`);
  if (!res.ok) throw new Error('Error al consultar formatos en Google Drive');
  return res.json();
}

async function fetchActiveProjects(): Promise<ProjectOption[]> {
  const res = await fetch('/api/projects');
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data ?? []) as ProjectOption[];
}

export default function HseqReportPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  // Estados principales
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectName, setProjectName] = useState('');
  const [inspectionDate, setInspectionDate] = useState(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  });

  // Datos del equipo según formato (divididos canónicamente: Equipo, Marca/Modelo y Serial)
  const [equipmentName, setEquipmentName] = useState('Drone');
  const [equipmentBrandModel, setEquipmentBrandModel] = useState('');
  const [equipmentSerial, setEquipmentSerial] = useState('');
  const [gprAkulaSerial, setGprAkulaSerial] = useState('');
  const [gprPcSerial, setGprPcSerial] = useState('');

  // Datos específicos del vehículo (FOR-HSEQ-029: Conductor y Vencimiento de Documentos)
  const [vehicleKilometraje, setVehicleKilometraje] = useState('');
  const [conductorName, setConductorName] = useState('');
  const [conductorCedula, setConductorCedula] = useState('');
  const [vencTarjetaPropiedad, setVencTarjetaPropiedad] = useState('');
  const [vencSoat, setVencSoat] = useState('');
  const [vencTecnomecanica, setVencTecnomecanica] = useState('');
  const [vencLicencia, setVencLicencia] = useState('');
  const [vencManejoDefensivo, setVencManejoDefensivo] = useState('');
  const [revisadoContratante, setRevisadoContratante] = useState<'SI' | 'NO' | 'NA'>('SI');
  const [vencBotiquin, setVencBotiquin] = useState('');
  const [vencExtintor, setVencExtintor] = useState('');
  const [vencBateria, setVencBateria] = useState('');

  // Checklist reactivo
  const [itemsResponses, setItemsResponses] = useState<Record<string, 'SI' | 'NO' | 'NA'>>({});
  const [criticalPoint, setCriticalPoint] = useState('Ninguno');
  const [generalObservations, setGeneralObservations] = useState('Ninguna');

  // Firmas Digitales
  const [operatorSignName, setOperatorSignName] = useState('');
  const [operatorSignDataUrl, setOperatorSignDataUrl] = useState('');
  const [sstaSignName, setSstaSignName] = useState('');
  const [sstaSignDataUrl, setSstaSignDataUrl] = useState('');

  // Modales de firma
  const [isOperatorModalOpen, setIsOperatorModalOpen] = useState(false);
  const [isSstaModalOpen, setIsSstaModalOpen] = useState(false);

  // Estados de envío y descarga
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [generatedPdfResult, setGeneratedPdfResult] = useState<{
    fileName: string;
    webViewLink?: string;
    pdfBase64?: string;
    excelFileName?: string;
    excelBase64?: string;
    driveError?: string | null;
  } | null>(null);

  // 1. Asignar usuario logueado como operador por defecto
  useEffect(() => {
    if (session?.user?.name) {
      if (!operatorSignName) setOperatorSignName(session.user.name);
      if (!conductorName) setConductorName(session.user.name);
    } else if (session?.user?.email) {
      const fallback = session.user.email.split('@')[0];
      if (!operatorSignName) setOperatorSignName(fallback);
      if (!conductorName) setConductorName(fallback);
    }
  }, [session, operatorSignName, conductorName]);

  // 2. Consulta de Proyectos
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['user-active-projects'],
    queryFn: fetchActiveProjects,
  });

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      const first = projects[0];
      setSelectedProjectId(first.id);
      setProjectName(first.name);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // 3. Consulta de Plantillas de Google Drive
  const {
    data: templatesData,
    isLoading: isLoadingTemplates,
    refetch: refetchTemplates,
  } = useQuery({
    queryKey: ['hseq-templates'],
    queryFn: () => fetchTemplates(false),
  });

  const [isRefreshingTemplates, setIsRefreshingTemplates] = useState(false);
  const handleForceRefresh = async () => {
    setIsRefreshingTemplates(true);
    try {
      await fetchTemplates(true);
      if (selectedTemplateId) {
        await fetch(`/api/hseq/templates/${encodeURIComponent(selectedTemplateId)}/schema?refresh=true`);
      }
      await queryClient.invalidateQueries({ queryKey: ['hseq-templates'] });
      await queryClient.invalidateQueries({ queryKey: ['hseq-dynamic-schema'] });
      await refetchTemplates();
    } catch (err) {
      console.error('Error refrescando formatos:', err);
    } finally {
      setIsRefreshingTemplates(false);
    }
  };

  const templates: HseqTemplateOption[] = useMemo(() => {
    const raw = templatesData?.templates ?? [];
    const hasDrone = raw.some(
      (t) => t.code.includes('024') || t.title.toLowerCase().includes('drone')
    );
    const hasEstacion = raw.some(
      (t) => t.code.includes('025') || t.title.toLowerCase().includes('estacion') || t.title.toLowerCase().includes('estación')
    );
    const hasVehiculo = raw.some(
      (t) => t.code.includes('029') || t.title.toLowerCase().includes('vehiculo') || t.title.toLowerCase().includes('vehículo')
    );

    const extra: HseqTemplateOption[] = [];

    if (!hasDrone) {
      extra.push({
        id: 'hseq-drone-preoperational',
        code: 'FOR-HSEQ-024',
        title: 'INSPECCIÓN PRE-OPERACIONAL DE DRONE',
        name: 'FOR-HSEQ-024 Inspección Pre-operacional de Drone.xlsx',
        folderName: '24. Procedimientos y formatos',
        folderId: 'folder-24',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    }

    if (!hasEstacion) {
      extra.push({
        id: 'hseq-estacion-total',
        code: 'FOR-HSEQ-025',
        title: 'INSPECCIÓN PRE-OPERACIONAL DE ESTACIÓN TOTAL',
        name: 'FOR-HSEQ-025 Inspección Pre-operacional de Estación Total.xlsx',
        folderName: '24. Procedimientos y formatos',
        folderId: 'folder-24',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    }

    if (!hasVehiculo) {
      extra.push({
        id: 'hseq-vehiculo-preoperational',
        code: 'FOR-HSEQ-029',
        title: 'INSPECCIÓN PRE-OPERACIONAL DE VEHÍCULO',
        name: 'FOR-Inspección preoperacional del vehículo.xlsx',
        folderName: '24. Procedimientos y formatos',
        folderId: 'folder-24',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    }

    return [...raw, ...extra].map((t) => ({
      ...t,
      title: (t.title || '').toUpperCase().trim(),
    }));
  }, [templatesData]);

  // Plantilla seleccionada
  const activeTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || null;
  }, [templates, selectedTemplateId]);

  // Consulta reactiva del esquema dinámico del formato seleccionado
  const { data: dynamicSchema, isLoading: isLoadingSchema } = useQuery({
    queryKey: ['hseq-dynamic-schema', selectedTemplateId],
    queryFn: async () => {
      if (!selectedTemplateId) return null;
      const res = await fetch(`/api/hseq/templates/${encodeURIComponent(selectedTemplateId)}/schema`);
      if (!res.ok) return null;
      const json = await res.json();
      return (json.schema as HseqFormatConfig) || null;
    },
    enabled: Boolean(selectedTemplateId),
  });

  // Configuración del formato seleccionado (dinámico de Drive o nativo)
  const formatConfig: HseqFormatConfig | null = useMemo(() => {
    if (!activeTemplate) return null;
    if (dynamicSchema) {
      return dynamicSchema;
    }
    const identifier = `${activeTemplate.id} ${activeTemplate.code} ${activeTemplate.title}`;
    return getHseqFormatConfig(identifier);
  }, [activeTemplate, dynamicSchema]);

  // Detectar si el formato seleccionado corresponde a Georadar (GPR)
  const isGprFormat = useMemo(() => {
    if (!formatConfig) return false;
    const str = `${formatConfig.code} ${formatConfig.title} ${formatConfig.id}`.toLowerCase();
    return str.includes('027') || str.includes('gpr') || str.includes('georadar');
  }, [formatConfig]);

  // Detectar si el formato seleccionado corresponde a Vehículo
  const isVehiculoFormat = useMemo(() => {
    if (!formatConfig) return false;
    const str = `${formatConfig.code} ${formatConfig.title} ${formatConfig.id}`.toLowerCase();
    return str.includes('029') || str.includes('vehiculo') || str.includes('camioneta');
  }, [formatConfig]);

  // Sincronizar equipo por defecto (Marca/Modelo y Serial quedan siempre vacíos con ejemplo y obligatorios)
  useEffect(() => {
    if (formatConfig) {
      if (formatConfig.equipmentName) {
        setEquipmentName(formatConfig.equipmentName);
      }
      // Marca/Modelo y Serial quedan siempre vacíos por defecto (obligatorios por el usuario)
      setEquipmentBrandModel('');
      setEquipmentSerial('');
      setGprAkulaSerial('');
      setGprPcSerial('');
    }
  }, [formatConfig]);

  // Al cambiar formato, inicializar respuestas
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setSubmitError(null);
    setItemsResponses({});
  };

  // Botón rápido: marcar todo en condición óptima según el mapa canónico de este formato
  const handleMarkAllOptimal = () => {
    if (!formatConfig) return;
    const optimalMap = getOptimalResponses(formatConfig.code || formatConfig.id || formatConfig.items);

    const isDrone =
      formatConfig.code.includes('024') ||
      formatConfig.title.toLowerCase().includes('drone') ||
      formatConfig.id.toLowerCase().includes('drone');

    if (isDrone && optimalMap['1.4']) {
      optimalMap['1.4'] = 'NO';
    }

    if (isDrone) {
      for (const it of formatConfig.items) {
        if (it.description.toLowerCase().includes('corrosi')) {
          optimalMap[it.code] = 'NO';
        }
      }
    }

    // Para GPS Diferencial (026): 1.4 es SI, 3.1 es NO, 1.2 es NO, 2.2 es NO, resto SI
    if (formatConfig.code.includes('026') || formatConfig.title.toLowerCase().includes('gps')) {
      optimalMap['1.4'] = 'SI';
      optimalMap['3.1'] = 'NO';
      optimalMap['1.2'] = 'NO';
      optimalMap['2.2'] = 'NO';
    }

    // Para Georadar GPR (027): Todas las condiciones óptimas son estrictamente SI
    if (formatConfig.code.includes('027') || formatConfig.title.toLowerCase().includes('gpr') || formatConfig.title.toLowerCase().includes('georadar')) {
      for (const it of formatConfig.items) {
        optimalMap[it.code] = 'SI';
      }
    }

    // Para Localizador Electromagnético (028): 1.2 es NO, 2.2 es NO, resto SI
    if (formatConfig.code.includes('028') || formatConfig.title.toLowerCase().includes('localizador')) {
      optimalMap['1.2'] = 'NO';
      optimalMap['2.2'] = 'NO';
    }

    // Para Vehículo (029): 1.6 es NO (fugas en el motor), resto SI
    if (formatConfig.code.includes('029') || formatConfig.title.toLowerCase().includes('vehiculo') || formatConfig.title.toLowerCase().includes('camioneta')) {
      for (const it of formatConfig.items) {
        optimalMap[it.code] = (it.code === '1.6' || it.description.toLowerCase().includes('fuga')) ? 'NO' : 'SI';
      }
    }

    setItemsResponses(optimalMap);
  };

  // Manejo de respuesta individual en checklist
  const handleItemResponse = (code: string, value: 'SI' | 'NO' | 'NA') => {
    setItemsResponses((prev) => ({
      ...prev,
      [code]: value,
    }));
  };

  // Envío del Formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!selectedProjectId) {
      setSubmitError('Por favor selecciona el proyecto asignado.');
      return;
    }

    if (!formatConfig) {
      setSubmitError('Por favor selecciona un formato de inspección.');
      return;
    }

    // Validar datos de equipo obligatorios
    if (!equipmentName.trim()) {
      setSubmitError('El campo Equipo / Herramienta es obligatorio.');
      return;
    }

    if (!equipmentBrandModel.trim()) {
      setSubmitError('La Marca y Modelo del equipo es obligatoria.');
      return;
    }

    const effectiveSerial = isGprFormat
      ? `Akula: ${gprAkulaSerial.trim()} | PC: ${gprPcSerial.trim()}`
      : equipmentSerial.trim();

    if (isGprFormat) {
      if (!gprAkulaSerial.trim() || !gprPcSerial.trim()) {
        setSubmitError('Los números de serial para Akula y Computadora son obligatorios.');
        return;
      }
    } else if (!effectiveSerial) {
      setSubmitError('El Número de Serial del equipo es obligatorio.');
      return;
    }

    // Validar ítems
    const totalRequired = formatConfig.items.length;
    const answeredCount = Object.keys(itemsResponses).length;
    if (answeredCount < totalRequired) {
      setSubmitError(
        `Debes responder todos los ${totalRequired} ítems de la lista. Has completado ${answeredCount} de ${totalRequired}.`
      );
      return;
    }

    if (!operatorSignName.trim() || !operatorSignDataUrl) {
      setSubmitError('La firma digital del Operador es obligatoria.');
      return;
    }

    if (!sstaSignName.trim() || !sstaSignDataUrl) {
      setSubmitError('La firma digital del Responsable/SSTA es obligatoria.');
      return;
    }

    setIsSubmitting(true);
    try {
      const proj = selectedProject;
      const costCenter = proj?.cost_center || proj?.code || 'PROCIMEC';
      const location = proj?.location || 'En campo';

      const res = await fetch('/api/hseq/drone-inspection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          templateCode: formatConfig.code,
          templateTitle: formatConfig.pdfTitle || formatConfig.title,
          templateVersion: formatConfig.version,
          templateDate: formatConfig.templateDate || '16-sep-2026',
          customItems: formatConfig.items,
          customSections: formatConfig.sections,
          projectId: selectedProjectId,
          projectName: proj?.name || projectName,
          costCenter,
          location,
          inspectionDate,
          equipmentName: equipmentName.trim(),
          equipmentBrandModel: equipmentBrandModel.trim(),
          equipmentSerial: effectiveSerial,
          serialAkula: isGprFormat ? gprAkulaSerial.trim() : undefined,
          serialComputadora: isGprFormat ? gprPcSerial.trim() : undefined,
          vehicleData: isVehiculoFormat
            ? {
                placa: effectiveSerial,
                kilometraje: vehicleKilometraje.trim(),
                nombre_conductor: conductorName.trim() || operatorSignName.trim(),
                cedula_conductor: conductorCedula.trim(),
                venc_tarjeta_propiedad: vencTarjetaPropiedad.trim(),
                venc_soat: vencSoat.trim(),
                venc_tecnomecanica: vencTecnomecanica.trim(),
                venc_licencia: vencLicencia.trim(),
                venc_manejo_defensivo: vencManejoDefensivo.trim(),
                revisado_contratante: revisadoContratante,
                venc_botiquin: vencBotiquin.trim(),
                venc_extintor: vencExtintor.trim(),
                venc_bateria: vencBateria.trim(),
              }
            : undefined,
          itemsResponses,
          criticalPoint,
          generalObservations,
          userRole: (session?.user as any)?.role || undefined,
          operatorName: operatorSignName,
          operatorSignatureDataUrl: operatorSignDataUrl,
          sstaName: sstaSignName,
          sstaSignatureDataUrl: sstaSignDataUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar la inspección');
      }

      setGeneratedPdfResult({
        fileName: data.fileName,
        webViewLink: data.webViewLink,
        pdfBase64: data.pdfBase64,
        excelFileName: data.excelFileName,
        excelBase64: data.excelBase64,
        driveError: data.driveWarning || null,
      });
      setSubmissionSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al procesar el formulario';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadLocalPdf = () => {
    if (!generatedPdfResult?.pdfBase64) return;
    try {
      const byteCharacters = atob(generatedPdfResult.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = generatedPdfResult.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error al descargar PDF:', e);
    }
  };

  const downloadLocalExcel = () => {
    if (!generatedPdfResult?.excelBase64 || !generatedPdfResult?.excelFileName) return;
    try {
      const byteCharacters = atob(generatedPdfResult.excelBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = generatedPdfResult.excelFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error al descargar Excel:', e);
    }
  };

  const totalItemsCount = formatConfig?.items.length || 0;
  const answeredCount = Object.keys(itemsResponses).length;

  return (
    <div className="min-h-[100dvh] bg-surface">
      <Navbar />

      {/* Franja Azul Institucional PROCIMEC (page-hero) */}
      <div className="page-hero">
        <div className="max-w-4xl mx-auto">
          <BackButton href="/dashboard" label="Volver al Tablero" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-accent" strokeWidth={1.75} /> Inspecciones HSEQ
          </h1>
          <p className="text-white/70 text-sm mt-1">
            Formatos oficiales de inspección y control pre-operacional en campo
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6 pb-20 space-y-6">
        {/* Pantalla de Éxito al Generar PDF */}
        {submissionSuccess && generatedPdfResult ? (
          <div className="card p-6 border-emerald-300 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl mx-auto font-bold">
              ✓
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-text-primary">
                Inspección Registrada Exitosamente
              </h2>
              <p className="text-xs text-text-muted">
                El reporte ha sido generado según la plantilla oficial de la <strong>Carpeta 24</strong>.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 text-xs space-y-2 border border-border">
              <p className="text-text-secondary">
                <strong>Archivo PDF generado:</strong>{' '}
                <code className="font-mono text-primary font-bold">{generatedPdfResult.fileName}</code>
              </p>
              {generatedPdfResult.excelFileName && (
                <p className="text-text-secondary">
                  <strong>Plantilla Excel diligenciada:</strong>{' '}
                  <code className="font-mono text-emerald-700 font-bold">{generatedPdfResult.excelFileName}</code>
                </p>
              )}
              <p className="text-text-secondary">
                <strong>Formato Oficial:</strong> {formatConfig?.pdfTitle || activeTemplate?.title} ({formatConfig?.code})
              </p>
              <p className="text-text-secondary">
                <strong>Proyecto:</strong> {selectedProject?.name || projectName}
              </p>
              <p className="text-text-secondary">
                <strong>Responsable Operador:</strong> {operatorSignName}
              </p>
              <p className="text-text-secondary">
                <strong>Responsable SSTA:</strong> {sstaSignName}
              </p>
              <p className="text-text-secondary">
                <strong>Fecha:</strong> {inspectionDate}
              </p>
            </div>

            {generatedPdfResult.driveError && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3 rounded-xl text-center flex items-center justify-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" strokeWidth={1.75} />
                <span>{generatedPdfResult.driveError}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {generatedPdfResult.pdfBase64 && (
                <button
                  type="button"
                  onClick={downloadLocalPdf}
                  className="btn btn-primary shadow-sm"
                >
                  <Check className="w-4 h-4" /> Descargar PDF Oficial
                </button>
              )}

              {generatedPdfResult.excelBase64 && (
                <button
                  type="button"
                  onClick={downloadLocalExcel}
                  className="btn bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Descargar Plantilla Excel Diligenciada (.xlsx)
                </button>
              )}

              {generatedPdfResult.webViewLink && (
                <a
                  href={generatedPdfResult.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline"
                >
                  <ExternalLink className="w-4 h-4" /> Ver en Google Drive
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  setSubmissionSuccess(false);
                  setGeneratedPdfResult(null);
                  setSelectedTemplateId('');
                  setItemsResponses({});
                  setCriticalPoint('Ninguno');
                  setOperatorSignDataUrl('');
                  setSstaSignDataUrl('');
                  setGeneralObservations('Ninguna');
                }}
                className="btn btn-ghost"
              >
                + Nueva Inspección
              </button>
            </div>
          </div>
        ) : (
          /* Formulario Principal */
          <div className="space-y-6">
            {/* 1. Selector de Formato Oficial */}
            <div className="card p-6 space-y-3">
              <div className="flex items-center justify-between">
                <label className="label text-xs font-bold text-text-primary uppercase tracking-wider mb-0">
                  Formato de Inspección <span className="text-error">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleForceRefresh}
                  disabled={isRefreshingTemplates}
                  className="text-xs text-primary hover:underline font-semibold disabled:opacity-50"
                >
                  {isRefreshingTemplates ? 'Actualizando...' : 'Actualizar Formatos'}
                </button>
              </div>

              {isLoadingTemplates ? (
                <div className="h-10 bg-gray-100 rounded-xl animate-pulse flex items-center px-3 text-xs text-text-muted">
                  Cargando formatos...
                </div>
              ) : (
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  required
                  className="select w-full"
                >
                  <option value="">-- Selecciona el formato de inspección --</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} — {t.title}
                    </option>
                  ))}
                </select>
              )}

              {isLoadingSchema && (
                <div className="text-xs text-primary animate-pulse flex items-center gap-1.5 py-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Extrayendo preguntas y lista de verificación del formato...
                </div>
              )}

              {formatConfig && !isLoadingSchema && (
                <div className="flex items-center justify-between text-xs text-primary bg-primary-50 px-3 py-2 rounded-xl border border-primary-200">
                  <span className="font-semibold">{formatConfig.pdfTitle}</span>
                  <span className="badge badge-primary font-mono text-[10px]">
                    {formatConfig.code} | Versión {formatConfig.version}
                  </span>
                </div>
              )}
            </div>

            {submitError && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* CUANDO SE SELECCIONA UN FORMATO: RENDERIZAR CAMPOS Y LISTA DE CHEQUEO */}
            {formatConfig && (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 2. Información General */}
                <div className="card p-6 space-y-4">
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider border-b border-border pb-2.5">
                    Información General
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label label-required text-xs">Proyecto</label>
                      {isLoadingProjects ? (
                        <div className="h-9 bg-gray-100 rounded-xl animate-pulse" />
                      ) : (
                        <select
                          value={selectedProjectId}
                          onChange={(e) => {
                            const pId = e.target.value;
                            setSelectedProjectId(pId);
                            const p = projects.find((proj) => proj.id === pId);
                            if (p) setProjectName(p.name);
                          }}
                          required
                          className="select w-full text-xs"
                        >
                          <option value="">-- Selecciona Proyecto --</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.cost_center || p.code} — {p.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="label label-required text-xs">Fecha de Inspección</label>
                      <input
                        type="date"
                        value={inspectionDate}
                        onChange={(e) => setInspectionDate(e.target.value)}
                        required
                        className="input text-xs"
                      />
                    </div>

                    <div>
                      <label className="label label-required text-xs">
                        {isVehiculoFormat ? 'Tipo de Vehículo' : 'Equipo / Herramienta'}
                      </label>
                      <input
                        type="text"
                        value={equipmentName}
                        onChange={(e) => setEquipmentName(e.target.value)}
                        required
                        placeholder={isVehiculoFormat ? 'Ej. Camioneta 4x4 / Vehículo' : 'Ej. Drone, Estación Total, Georadar (GPR)'}
                        className="input text-xs bg-slate-50 font-medium"
                      />
                    </div>

                    <div>
                      <label className="label label-required text-xs">
                        Marca y Modelo
                      </label>
                      <input
                        type="text"
                        value={equipmentBrandModel}
                        onChange={(e) => setEquipmentBrandModel(e.target.value)}
                        required
                        placeholder={
                          isVehiculoFormat
                            ? 'Ej. Toyota Hilux 4x4 / Nissan Frontier / Renault Duster'
                            : isGprFormat
                            ? 'Ej. Geoscanners Akula 9000B / Sensors & Software'
                            : 'Ej. DJI Mavic 3 Enterprise / Leica TS07 / Trimble R12'
                        }
                        className="input text-xs"
                      />
                    </div>

                    {isGprFormat ? (
                      <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-amber-500/5 rounded-xl border border-amber-500/20">
                        <div>
                          <label className="label label-required text-xs text-amber-900 font-semibold block">
                            Serial Unidad Akula
                          </label>
                          <input
                            type="text"
                            value={gprAkulaSerial}
                            onChange={(e) => setGprAkulaSerial(e.target.value)}
                            required
                            placeholder="Ej. PROC-AKU-001"
                            className="input text-xs font-mono border-amber-300 focus:border-amber-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="label label-required text-xs text-amber-900 font-semibold block">
                            Serial Computadora / Toughbook
                          </label>
                          <input
                            type="text"
                            value={gprPcSerial}
                            onChange={(e) => setGprPcSerial(e.target.value)}
                            required
                            placeholder="Ej. PROC-TB-001"
                            className="input text-xs font-mono border-amber-300 focus:border-amber-500 bg-white"
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="label label-required text-xs">
                            {isVehiculoFormat ? 'Placa del Vehículo' : 'Número de Serial'}
                          </label>
                          <input
                            type="text"
                            value={equipmentSerial}
                            onChange={(e) => setEquipmentSerial(e.target.value)}
                            required
                            placeholder={isVehiculoFormat ? 'Ej. ABC-123' : 'Ej. PROC-DRN-001 / 184920 / SN-2024-X'}
                            className="input text-xs font-mono uppercase"
                          />
                        </div>

                        {isVehiculoFormat && (
                          <div>
                            <label className="label label-required text-xs">Kilometraje Actual</label>
                            <input
                              type="text"
                              value={vehicleKilometraje}
                              onChange={(e) => setVehicleKilometraje(e.target.value)}
                              required
                              placeholder="Ej. 84,350 km"
                              className="input text-xs font-mono"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* SECCIONES ESPECÍFICAS DE VEHÍCULO (FOR-HSEQ-029) */}
                {isVehiculoFormat && (
                  <>
                    {/* I. Conductor Asignado */}
                    <div className="card p-6 space-y-4">
                      <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider border-b border-border pb-2.5 flex items-center justify-between">
                        <span>I. Conductor Asignado</span>
                        <span className="badge badge-primary text-[10px]">Vehículo</span>
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="label label-required text-xs">Nombre Completo del Conductor</label>
                          <input
                            type="text"
                            value={conductorName}
                            onChange={(e) => setConductorName(e.target.value)}
                            required
                            placeholder="Ej. Juan Pérez Rodríguez"
                            className="input text-xs"
                          />
                        </div>

                        <div>
                          <label className="label label-required text-xs">Documento de Identidad (C.C.)</label>
                          <input
                            type="text"
                            value={conductorCedula}
                            onChange={(e) => setConductorCedula(e.target.value)}
                            required
                            placeholder="Ej. 1020304050"
                            className="input text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* II. Verificación de Vencimiento de Documentos y Elementos */}
                    <div className="card p-6 space-y-4">
                      <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider border-b border-border pb-2.5 flex items-center justify-between">
                        <span>II. Verificación de Vencimiento de Documentos y Elementos</span>
                        <span className="text-[11px] text-text-muted font-normal lowercase">Fechas de vigencia del vehículo</span>
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <label className="label label-required text-xs">Vencimiento Tarjeta de Propiedad</label>
                          <input
                            type="date"
                            value={vencTarjetaPropiedad}
                            onChange={(e) => setVencTarjetaPropiedad(e.target.value)}
                            required
                            className="input text-xs"
                          />
                        </div>

                        <div>
                          <label className="label label-required text-xs">Vencimiento SOAT</label>
                          <input
                            type="date"
                            value={vencSoat}
                            onChange={(e) => setVencSoat(e.target.value)}
                            required
                            className="input text-xs"
                          />
                        </div>

                        <div>
                          <label className="label label-required text-xs">Vencimiento Tecnomecánica y Gases</label>
                          <input
                            type="date"
                            value={vencTecnomecanica}
                            onChange={(e) => setVencTecnomecanica(e.target.value)}
                            required
                            className="input text-xs"
                          />
                        </div>

                        <div>
                          <label className="label label-required text-xs">Vencimiento Licencia de Conducción</label>
                          <input
                            type="date"
                            value={vencLicencia}
                            onChange={(e) => setVencLicencia(e.target.value)}
                            required
                            className="input text-xs"
                          />
                        </div>

                        <div>
                          <label className="label text-xs">Vencimiento Curso Manejo Defensivo</label>
                          <input
                            type="date"
                            value={vencManejoDefensivo}
                            onChange={(e) => setVencManejoDefensivo(e.target.value)}
                            className="input text-xs"
                          />
                        </div>

                        <div>
                          <label className="label text-xs">Revisado por Contratante</label>
                          <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                            {(['SI', 'NO', 'NA'] as const).map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setRevisadoContratante(opt)}
                                className={`py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                                  revisadoContratante === opt
                                    ? 'bg-teal-600 text-white border-teal-600'
                                    : 'bg-white text-text-secondary border-border hover:bg-slate-50'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="label text-xs">Vencimiento Botiquín</label>
                          <input
                            type="date"
                            value={vencBotiquin}
                            onChange={(e) => setVencBotiquin(e.target.value)}
                            className="input text-xs"
                          />
                        </div>

                        <div>
                          <label className="label text-xs">Vencimiento Extintor</label>
                          <input
                            type="date"
                            value={vencExtintor}
                            onChange={(e) => setVencExtintor(e.target.value)}
                            className="input text-xs"
                          />
                        </div>

                        <div>
                          <label className="label text-xs">Vencimiento Garantía Batería</label>
                          <input
                            type="date"
                            value={vencBateria}
                            onChange={(e) => setVencBateria(e.target.value)}
                            className="input text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* 3. Lista de Chequeo Oficial del Formato */}
                <div className="card p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                    <div>
                      <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                        Lista de Chequeo Pre-operacional
                      </h3>
                      <p className="text-xs text-text-muted mt-0.5">
                        Progreso: {answeredCount} de {totalItemsCount} evaluados
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleMarkAllOptimal}
                      className="btn btn-sm btn-accent self-start sm:self-auto"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Marcar todo en estado óptimo
                    </button>
                  </div>

                  <div className="space-y-6">
                    {formatConfig.sections.map((secName) => {
                      const secItems = formatConfig.items.filter((it) => it.section === secName);
                      if (secItems.length === 0) return null;

                      return (
                        <div key={secName} className="space-y-3">
                          <h4 className="text-xs font-bold text-primary bg-primary-50 px-3 py-1.5 rounded-lg border border-primary-100 uppercase tracking-wide">
                            {secName}
                          </h4>

                          <div className="space-y-2">
                            {secItems.map((item) => {
                              const currentVal = itemsResponses[item.code];
                              return (
                                <div
                                  key={item.code}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl border border-border hover:border-gray-300 bg-white transition-colors"
                                >
                                  <div className="flex items-start gap-2 max-w-xl">
                                    <span className="text-xs font-mono font-bold text-primary min-w-[32px] pt-0.5">
                                      {item.code}
                                    </span>
                                    <span className="text-xs text-text-primary leading-tight">
                                      {item.description}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                    {(['SI', 'NO', 'NA'] as const).map((val) => {
                                      const isSelected = currentVal === val;
                                      return (
                                        <button
                                          key={val}
                                          type="button"
                                          onClick={() => handleItemResponse(item.code, val)}
                                          className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                                            isSelected
                                              ? val === 'SI'
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                                : val === 'NO'
                                                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                                : 'bg-slate-600 text-white border-slate-600 shadow-sm'
                                              : 'bg-gray-50 text-text-secondary border-border hover:bg-gray-100'
                                          }`}
                                        >
                                          {val}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Observaciones y Punto Crítico */}
                <div className="card p-6 space-y-4">
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider border-b border-border pb-2.5">
                    Observaciones y Novedades
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="label text-xs">Punto crítico que inhabilita el equipo</label>
                      <input
                        type="text"
                        value={criticalPoint}
                        onChange={(e) => setCriticalPoint(e.target.value)}
                        placeholder="Ej. Ninguno / Falla en rotor / Prisma roto"
                        className="input text-xs"
                      />
                    </div>

                    <div>
                      <label className="label text-xs font-semibold text-text-secondary">Observaciones generales</label>
                      <textarea
                        rows={3}
                        value={generalObservations}
                        onChange={(e) => setGeneralObservations(e.target.value)}
                        placeholder="Ej. Ninguna / Describa cualquier novedad..."
                        className="textarea text-xs"
                      />
                      <span className="text-[11px] text-text-muted mt-1 block">
                        * Por defecto viene como <strong>&quot;Ninguna&quot;</strong>. Si escribe alguna observación o novedad, el sistema notificará automáticamente al equipo HSEQ (ghprocimec@gmail.com).
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5. Firmas Digitales */}
                <div className="card p-6 space-y-4">
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider border-b border-border pb-2.5">
                    Firmas Digitales
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Firma Operador */}
                    <div className="border border-border rounded-xl p-4 bg-gray-50/50 space-y-2.5">
                      <span className="text-xs font-bold text-text-secondary block">
                        Operador / Responsable del Equipo <span className="text-error">*</span>
                      </span>

                      {operatorSignDataUrl ? (
                        <div className="space-y-2">
                          <div className="bg-white border border-border rounded-lg p-2 flex items-center justify-center h-20">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={operatorSignDataUrl}
                              alt="Firma Operador"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <p className="text-xs font-semibold text-text-primary truncate">
                            {operatorSignName}
                          </p>
                          <button
                            type="button"
                            onClick={() => setIsOperatorModalOpen(true)}
                            className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
                          >
                            <PenTool className="w-3 h-3" /> Modificar Firma
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsOperatorModalOpen(true)}
                          className="btn btn-outline w-full text-xs"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          <span>Capturar Firma Operador</span>
                        </button>
                      )}
                    </div>

                    {/* Firma Responsable/SSTA */}
                    <div className="border border-border rounded-xl p-4 bg-gray-50/50 space-y-2.5">
                      <span className="text-xs font-bold text-text-secondary block">
                        Responsable/SSTA <span className="text-error">*</span>
                      </span>

                      {sstaSignDataUrl ? (
                        <div className="space-y-2">
                          <div className="bg-white border border-border rounded-lg p-2 flex items-center justify-center h-20">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={sstaSignDataUrl}
                              alt="Firma Responsable/SSTA"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <p className="text-xs font-semibold text-text-primary truncate">
                            {sstaSignName}
                          </p>
                          <button
                            type="button"
                            onClick={() => setIsSstaModalOpen(true)}
                            className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
                          >
                            <PenTool className="w-3 h-3" /> Modificar Firma
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsSstaModalOpen(true)}
                          className="btn btn-outline w-full text-xs font-semibold hover:border-primary hover:text-primary transition-all"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          <span>Capturar Firma Responsable/SSTA</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Botón de Envío */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <Link href="/dashboard" className="btn btn-ghost text-xs">
                    Cancelar
                  </Link>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Generando PDF Oficial...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Finalizar y Generar PDF Oficial</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Estado Vacío: Selección Pendiente */}
            {!selectedTemplateId && (
              <div className="card p-10 text-center space-y-2 border-dashed">
                <ClipboardList className="w-8 h-8 text-primary/40 mx-auto" />
                <p className="text-sm font-bold text-text-primary">
                  Selecciona un formato para comenzar
                </p>
                <p className="text-xs text-text-muted max-w-sm mx-auto">
                  Selecciona el formato correspondiente de la lista superior para cargar sus criterios de verificación y firmas oficiales.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Firma Operador */}
      <DigitalSignatureModal
        isOpen={isOperatorModalOpen}
        onClose={() => setIsOperatorModalOpen(false)}
        title="Firma Digital del Operador / Responsable"
        roleLabel="Operador / Responsable"
        initialName={operatorSignName}
        onSaveSignature={(name, dataUrl) => {
          setOperatorSignName(name);
          setOperatorSignDataUrl(dataUrl);
        }}
      />

      {/* Modal Firma Responsable/SSTA */}
      <DigitalSignatureModal
        isOpen={isSstaModalOpen}
        onClose={() => setIsSstaModalOpen(false)}
        title="Firma Digital del Responsable/SSTA"
        roleLabel="Responsable/SSTA"
        initialName={sstaSignName}
        onSaveSignature={(name, dataUrl) => {
          setSstaSignName(name);
          setSstaSignDataUrl(dataUrl);
        }}
      />
    </div>
  );
}
