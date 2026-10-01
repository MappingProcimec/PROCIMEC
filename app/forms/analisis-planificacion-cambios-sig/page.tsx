'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Download,
  RotateCcw,
  ArrowRight,
  ShieldAlert,
  Users,
  CheckSquare,
  ClipboardList,
} from 'lucide-react';
import {
  SigChangeWorkTeamMember,
  SigChangeRisk,
  SigChangeActivity,
} from '@/lib/sig-templates';
import { SignaturePad } from '@/components/forms/SignaturePad';

// Orígenes oficiales del cambio según plantilla FOR-SIG-001
const CHANGE_ORIGINS = [
  { id: 'direccionamiento', label: 'Cambios en el direccionamiento estratégico' },
  { id: 'nuevos_proyectos', label: 'Nuevos proyectos' },
  { id: 'estructura_org', label: 'Cambios en la estructura organizacional' },
  { id: 'legislacion', label: 'Cambios en la legislación' },
  { id: 'procesos_sig', label: 'Cambios en los procesos del SIG' },
  { id: 'normas_sig', label: 'Actualización normas SIG' },
  { id: 'alcance_sig', label: 'Cambio en el alcance del SIG' },
  { id: 'innovacion', label: 'Innovación' },
  { id: 'prestacion_servicio', label: 'Cambios en la prestación del servicio' },
  { id: 'partes_interesadas', label: 'Necesidades/expectativas partes interesadas' },
  { id: 'instalaciones_equipos', label: 'Modificaciones en Instalaciones/equipos' },
  { id: 'riesgos_oportunidades', label: 'Riesgos y/u oportunidades identificados' },
  { id: 'implementacion_mejoras', label: 'Implementación de mejoras' },
  { id: 'contexto_interno_externo', label: 'Modificaciones en contexto interno o externo' },
  { id: 'adecuaciones_trabajo', label: 'Adecuaciones sitios de trabajo' },
  { id: 'conocimiento_ssta', label: 'Cambios en el conocimiento en SSTA' },
  { id: 'otro', label: 'Otro origen' },
];

export default function SigManagementChangeFormPage() {
  // Identificación
  const [identifierName, setIdentifierName] = useState('');
  const [identifierPosition, setIdentifierPosition] = useState('');
  const [identifierProcess, setIdentifierProcess] = useState('');
  const [identificationDate, setIdentificationDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [changeDescription, setChangeDescription] = useState('');
  const [justification, setJustification] = useState('');
  const [affectedProcesses, setAffectedProcesses] = useState('');

  // Orígenes
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);
  const [originsOther, setOriginsOther] = useState('');

  // Equipo de trabajo
  const [workTeam, setWorkTeam] = useState<SigChangeWorkTeamMember[]>([
    { nombre: '', cargo: '', proceso: '' },
  ]);

  // Riesgos y oportunidades
  const [risks, setRisks] = useState<SigChangeRisk[]>([
    { descripcion_efectos: '', tipo: 'Amenaza', controles_acciones: '' },
  ]);

  // Plan de actividades
  const [activities, setActivities] = useState<SigChangeActivity[]>([
    { actividad: '', responsable: '', fecha_limite: '', producto_esperado: '' },
  ]);

  // Aprobación y seguimiento
  const [approvalName, setApprovalName] = useState('');
  const [approvalPosition, setApprovalPosition] = useState('');
  const [approvalProcess, setApprovalProcess] = useState('');
  const [approvalSignature, setApprovalSignature] = useState('');

  const [trackingName, setTrackingName] = useState('');
  const [trackingPosition, setTrackingPosition] = useState('');
  const [trackingProcess, setTrackingProcess] = useState('');
  const [trackingSignature, setTrackingSignature] = useState('');

  // Efectividad
  const [controlRisksControlled, setControlRisksControlled] = useState<boolean | null>(null);
  const [changeEffective, setChangeEffective] = useState<boolean | null>(null);
  const [effectivenessNotesNo, setEffectivenessNotesNo] = useState('');

  // Estado del formulario
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Toggle de orígenes
  const toggleOrigin = (originId: string) => {
    setSelectedOrigins((prev) =>
      prev.includes(originId) ? prev.filter((id) => id !== originId) : [...prev, originId]
    );
  };

  // Modificadores de equipo
  const addTeamMember = () => {
    setWorkTeam((prev) => [...prev, { nombre: '', cargo: '', proceso: '' }]);
  };

  const removeTeamMember = (index: number) => {
    if (workTeam.length <= 1) return;
    setWorkTeam((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTeamMember = (index: number, field: keyof SigChangeWorkTeamMember, value: string) => {
    setWorkTeam((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  // Modificadores de riesgos
  const addRisk = () => {
    setRisks((prev) => [
      ...prev,
      { descripcion_efectos: '', tipo: 'Amenaza', controles_acciones: '' },
    ]);
  };

  const removeRisk = (index: number) => {
    if (risks.length <= 1) return;
    setRisks((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRisk = (index: number, field: keyof SigChangeRisk, value: string) => {
    setRisks((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  // Modificadores de actividades
  const addActivity = () => {
    setActivities((prev) => [
      ...prev,
      { actividad: '', responsable: '', fecha_limite: '', producto_esperado: '' },
    ]);
  };

  const removeActivity = (index: number) => {
    if (activities.length <= 1) return;
    setActivities((prev) => prev.filter((_, i) => i !== index));
  };

  const updateActivity = (index: number, field: keyof SigChangeActivity, value: string) => {
    setActivities((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!identifierName.trim() || !identifierPosition.trim() || !identifierProcess.trim()) {
      setErrorMessage('Por favor ingrese nombre, cargo y proceso de quien identifica el cambio.');
      return;
    }

    if (!changeDescription.trim() || !justification.trim() || !affectedProcesses.trim()) {
      setErrorMessage('Por favor diligencie la descripción, justificación y procesos afectados.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        identifier_name: identifierName.trim(),
        identifier_position: identifierPosition.trim(),
        identifier_process: identifierProcess.trim(),
        identification_date: identificationDate,
        change_description: changeDescription.trim(),
        justification: justification.trim(),
        affected_processes: affectedProcesses.trim(),
        origins: selectedOrigins,
        origins_other: selectedOrigins.includes('otro') ? originsOther.trim() : null,
        work_team: workTeam.filter((m) => m.nombre.trim() !== ''),
        risks: risks.filter((r) => r.descripcion_efectos.trim() !== ''),
        activities: activities.filter((a) => a.actividad.trim() !== ''),
        approval_name: approvalName.trim() || null,
        approval_position: approvalPosition.trim() || null,
        approval_process: approvalProcess.trim() || null,
        approval_signature: approvalSignature.trim() || null,
        tracking_name: trackingName.trim() || null,
        tracking_position: trackingPosition.trim() || null,
        tracking_process: trackingProcess.trim() || null,
        tracking_signature: trackingSignature.trim() || null,
        control_risks_controlled: controlRisksControlled,
        change_effective: changeEffective,
        effectiveness_notes_no: effectivenessNotesNo.trim() || null,
      };

      const res = await fetch('/api/forms/analisis-planificacion-cambios-sig', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error al guardar el formulario');
      }

      setCreatedId(json.id);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setCreatedId(null);
    setIdentifierName('');
    setIdentifierPosition('');
    setIdentifierProcess('');
    setChangeDescription('');
    setJustification('');
    setAffectedProcesses('');
    setSelectedOrigins([]);
    setOriginsOther('');
    setWorkTeam([{ nombre: '', cargo: '', proceso: '' }]);
    setRisks([{ descripcion_efectos: '', tipo: 'Amenaza', controles_acciones: '' }]);
    setActivities([{ actividad: '', responsable: '', fecha_limite: '', producto_esperado: '' }]);
    setApprovalName('');
    setApprovalPosition('');
    setApprovalProcess('');
    setApprovalSignature('');
    setTrackingName('');
    setTrackingPosition('');
    setTrackingProcess('');
    setTrackingSignature('');
    setControlRisksControlled(null);
    setChangeEffective(null);
    setEffectivenessNotesNo('');
  };

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6">
        {/* Hero Canónico */}
        <div className="mb-6">
          <BackButton href="/dashboard" label="Volver a Mi Panel" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 flex items-center gap-2.5">
            <FileSpreadsheet className="w-7 h-7 text-accent" strokeWidth={1.75} />
            <span>Análisis y Planificación de Cambios SIG</span>
          </h1>
          <p className="text-white/70 text-sm mt-1">
            Registro formal de análisis, riesgos, plan de actividades y efectividad para cambios que afecten al SIG (FOR-SIG-001).
          </p>
        </div>

        {/* Pantalla de Éxito y Descargas Duales */}
        {createdId ? (
          <div className="bg-[#1E2229] border border-border-default rounded-xl p-6 sm:p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-accent/15 rounded-full flex items-center justify-center mx-auto text-accent">
              <CheckCircle2 className="w-9 h-9" strokeWidth={1.75} />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Registro del Cambio Guardado Exitosamente
              </h2>
              <p className="text-white/70 text-sm max-w-xl mx-auto">
                La información fue registrada en la base de datos de PROCIMEC. Puedes descargar inmediatamente el formato oficial diligenciado en Excel (.xlsx) o el informe formal firmado en PDF (.pdf).
              </p>
            </div>

            {/* Acciones de Descarga Dual */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <a
                href={`/api/forms/analisis-planificacion-cambios-sig/export?id=${createdId}&format=xlsx`}
                download
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-accent text-surface-dark font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all"
              >
                <FileSpreadsheet className="w-4 h-4" strokeWidth={1.75} />
                <span>Descargar Formato Excel (.xlsx)</span>
              </a>

              <a
                href={`/api/forms/analisis-planificacion-cambios-sig/export?id=${createdId}&format=pdf`}
                download
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#2A303C] hover:bg-[#343C4A] text-white font-medium text-sm border border-white/10 active:scale-[0.98] transition-all"
              >
                <Download className="w-4 h-4" strokeWidth={1.75} />
                <span>Descargar Informe PDF (.pdf)</span>
              </a>
            </div>

            <div className="pt-4 border-t border-border-default flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white/80 hover:text-white text-sm hover:bg-white/5 transition-colors"
              >
                <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
                <span>Registrar Otro Cambio</span>
              </button>

              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-accent hover:underline text-sm font-medium"
              >
                <span>Volver a Mi Panel</span>
                <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            {errorMessage && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" strokeWidth={1.75} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* SECCIÓN 1: Identificación y Análisis */}
            <div className="bg-[#1E2229] border border-border-default rounded-xl p-5 sm:p-6 space-y-5">
              <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2 border-b border-border-default pb-3">
                <ClipboardList className="w-5 h-5 text-accent" strokeWidth={1.75} />
                <span>1. Identificación y Análisis del Cambio</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Persona que identifica el cambio <span className="text-accent">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={identifierName}
                    onChange={(e) => setIdentifierName(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full bg-[#15181D] border border-border-default rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Cargo <span className="text-accent">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={identifierPosition}
                    onChange={(e) => setIdentifierPosition(e.target.value)}
                    placeholder="Ej: Coordinador SIG / Ing. de Proyectos"
                    className="w-full bg-[#15181D] border border-border-default rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Proceso al que pertenece <span className="text-accent">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={identifierProcess}
                    onChange={(e) => setIdentifierProcess(e.target.value)}
                    placeholder="Ej: Gestión HSEQ / Ingeniería"
                    className="w-full bg-[#15181D] border border-border-default rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Fecha de identificación <span className="text-accent">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={identificationDate}
                    onChange={(e) => setIdentificationDate(e.target.value)}
                    className="w-full bg-[#15181D] border border-border-default rounded-lg px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Descripción del cambio y fecha estimada de materialización <span className="text-accent">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={changeDescription}
                    onChange={(e) => setChangeDescription(e.target.value)}
                    placeholder="Describa el cambio de forma clara, detallando el alcance y la fecha prevista..."
                    className="w-full bg-[#15181D] border border-border-default rounded-lg p-3 text-sm text-white placeholder-white/40 focus:outline-none focus:border-accent resize-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Justificación del cambio <span className="text-accent">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Motivos estratégicos, normativos u operativos por los cuales se efectúa el cambio..."
                    className="w-full bg-[#15181D] border border-border-default rounded-lg p-3 text-sm text-white placeholder-white/40 focus:outline-none focus:border-accent resize-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Procesos afectados por el cambio <span className="text-accent">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={affectedProcesses}
                    onChange={(e) => setAffectedProcesses(e.target.value)}
                    placeholder="Ej: Operaciones GPR, Almacén, HSEQ, Todos los procesos"
                    className="w-full bg-[#15181D] border border-border-default rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Orígenes del Cambio */}
              <div className="pt-3 border-t border-border-default">
                <label className="block text-xs font-semibold text-white/90 mb-3 uppercase tracking-wider">
                  Origen del Cambio (Seleccione todas las que correspondan)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {CHANGE_ORIGINS.map((orig) => {
                    const isChecked = selectedOrigins.includes(orig.id);
                    return (
                      <button
                        type="button"
                        key={orig.id}
                        onClick={() => toggleOrigin(orig.id)}
                        className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all ${
                          isChecked
                            ? 'bg-accent/10 border-accent text-white ring-1 ring-accent'
                            : 'bg-[#15181D] border-border-default text-white/70 hover:border-white/20'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border text-xs font-bold ${
                            isChecked ? 'bg-accent text-surface-dark border-accent' : 'border-white/30'
                          }`}
                        >
                          {isChecked && 'X'}
                        </div>
                        <span className="text-xs">{orig.label}</span>
                      </button>
                    );
                  })}
                </div>

                {selectedOrigins.includes('otro') && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-white/80 mb-1">
                      Especifique el otro origen del cambio:
                    </label>
                    <input
                      type="text"
                      value={originsOther}
                      onChange={(e) => setOriginsOther(e.target.value)}
                      placeholder="Detalle del origen del cambio"
                      className="w-full bg-[#15181D] border border-border-default rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* SECCIÓN 2: Equipo de Trabajo */}
            <div className="bg-[#1E2229] border border-border-default rounded-xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border-default pb-3">
                <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-accent" strokeWidth={1.75} />
                  <span>2. Equipo de Trabajo para el Cambio</span>
                </h2>
                <button
                  type="button"
                  onClick={addTeamMember}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 text-accent text-xs font-semibold hover:bg-accent/25 transition-colors"
                >
                  <Plus className="w-4 h-4" strokeWidth={1.75} />
                  <span>Agregar Integrante</span>
                </button>
              </div>

              <div className="space-y-3">
                {workTeam.map((member, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 rounded-lg bg-[#15181D] border border-border-default items-center"
                  >
                    <div className="sm:col-span-5">
                      <input
                        type="text"
                        placeholder="Nombre completo"
                        value={member.nombre}
                        onChange={(e) => updateTeamMember(idx, 'nombre', e.target.value)}
                        className="w-full bg-[#1E2229] border border-border-default rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        placeholder="Cargo"
                        value={member.cargo}
                        onChange={(e) => updateTeamMember(idx, 'cargo', e.target.value)}
                        className="w-full bg-[#1E2229] border border-border-default rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        placeholder="Proceso"
                        value={member.proceso}
                        onChange={(e) => updateTeamMember(idx, 'proceso', e.target.value)}
                        className="w-full bg-[#1E2229] border border-border-default rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      {workTeam.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTeamMember(idx)}
                          className="p-1.5 text-white/50 hover:text-red-400 transition-colors"
                          title="Eliminar fila"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECCIÓN 3: Análisis de Riesgos y Oportunidades */}
            <div className="bg-[#1E2229] border border-border-default rounded-xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border-default pb-3">
                <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-accent" strokeWidth={1.75} />
                  <span>3. Análisis del Cambio (Riesgos y Oportunidades)</span>
                </h2>
                <button
                  type="button"
                  onClick={addRisk}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 text-accent text-xs font-semibold hover:bg-accent/25 transition-colors"
                >
                  <Plus className="w-4 h-4" strokeWidth={1.75} />
                  <span>Agregar Riesgo</span>
                </button>
              </div>

              <div className="space-y-3">
                {risks.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 rounded-lg bg-[#15181D] border border-border-default items-center"
                  >
                    <div className="sm:col-span-5">
                      <input
                        type="text"
                        placeholder="Descripción de efectos potenciales"
                        value={item.descripcion_efectos}
                        onChange={(e) => updateRisk(idx, 'descripcion_efectos', e.target.value)}
                        className="w-full bg-[#1E2229] border border-border-default rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <select
                        value={item.tipo}
                        onChange={(e) => updateRisk(idx, 'tipo', e.target.value)}
                        className="w-full bg-[#1E2229] border border-border-default rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                      >
                        <option value="Amenaza">Amenaza</option>
                        <option value="Oportunidad">Oportunidad</option>
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        placeholder="Controles / Acciones a tomar"
                        value={item.controles_acciones}
                        onChange={(e) => updateRisk(idx, 'controles_acciones', e.target.value)}
                        className="w-full bg-[#1E2229] border border-border-default rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      {risks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRisk(idx)}
                          className="p-1.5 text-white/50 hover:text-red-400 transition-colors"
                          title="Eliminar fila"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECCIÓN 4: Plan de Actividades */}
            <div className="bg-[#1E2229] border border-border-default rounded-xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border-default pb-3">
                <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-accent" strokeWidth={1.75} />
                  <span>4. Implementación del Cambio (Actividades)</span>
                </h2>
                <button
                  type="button"
                  onClick={addActivity}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 text-accent text-xs font-semibold hover:bg-accent/25 transition-colors"
                >
                  <Plus className="w-4 h-4" strokeWidth={1.75} />
                  <span>Agregar Actividad</span>
                </button>
              </div>

              <div className="space-y-3">
                {activities.map((act, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 rounded-lg bg-[#15181D] border border-border-default items-center"
                  >
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        placeholder="Actividad a ejecutar"
                        value={act.actividad}
                        onChange={(e) => updateActivity(idx, 'actividad', e.target.value)}
                        className="w-full bg-[#1E2229] border border-border-default rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        placeholder="Responsable / Cargo"
                        value={act.responsable}
                        onChange={(e) => updateActivity(idx, 'responsable', e.target.value)}
                        className="w-full bg-[#1E2229] border border-border-default rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="date"
                        value={act.fecha_limite}
                        onChange={(e) => updateActivity(idx, 'fecha_limite', e.target.value)}
                        className="w-full bg-[#1E2229] border border-border-default rounded-md px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        placeholder="Producto esperado"
                        value={act.producto_esperado}
                        onChange={(e) => updateActivity(idx, 'producto_esperado', e.target.value)}
                        className="w-full bg-[#1E2229] border border-border-default rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      {activities.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeActivity(idx)}
                          className="p-1.5 text-white/50 hover:text-red-400 transition-colors"
                          title="Eliminar fila"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECCIÓN 5: Aprobación y Seguimiento */}
            <div className="bg-[#1E2229] border border-border-default rounded-xl p-5 sm:p-6 space-y-5">
              <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2 border-b border-border-default pb-3">
                <Users className="w-5 h-5 text-accent" strokeWidth={1.75} />
                <span>5. Aprobación y Responsable del Seguimiento</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Quien Aprueba */}
                <div className="space-y-3 p-4 rounded-lg bg-[#15181D] border border-border-default">
                  <span className="text-xs font-bold text-accent uppercase tracking-wider">
                    Aprobación del Cambio
                  </span>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Nombre Completo</label>
                    <input
                      type="text"
                      placeholder="Nombre de quien aprueba"
                      value={approvalName}
                      onChange={(e) => setApprovalName(e.target.value)}
                      className="w-full bg-[#1E2229] border border-border-default rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Cargo</label>
                    <input
                      type="text"
                      placeholder="Ej: Gerente General"
                      value={approvalPosition}
                      onChange={(e) => setApprovalPosition(e.target.value)}
                      className="w-full bg-[#1E2229] border border-border-default rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Proceso</label>
                    <input
                      type="text"
                      placeholder="Ej: Planeación y Direccionamiento"
                      value={approvalProcess}
                      onChange={(e) => setApprovalProcess(e.target.value)}
                      className="w-full bg-[#1E2229] border border-border-default rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="pt-1">
                    <SignaturePad
                      label="Firma Digital de Quien Aprueba"
                      value={approvalSignature}
                      onChange={(dataUrl) => setApprovalSignature(dataUrl || '')}
                    />
                  </div>
                </div>

                {/* Responsable Seguimiento */}
                <div className="space-y-3 p-4 rounded-lg bg-[#15181D] border border-border-default">
                  <span className="text-xs font-bold text-accent uppercase tracking-wider">
                    Seguimiento del Cambio
                  </span>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Nombre Completo</label>
                    <input
                      type="text"
                      placeholder="Nombre del responsable de seguimiento"
                      value={trackingName}
                      onChange={(e) => setTrackingName(e.target.value)}
                      className="w-full bg-[#1E2229] border border-border-default rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Cargo</label>
                    <input
                      type="text"
                      placeholder="Ej: Coordinador SIG"
                      value={trackingPosition}
                      onChange={(e) => setTrackingPosition(e.target.value)}
                      className="w-full bg-[#1E2229] border border-border-default rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Proceso</label>
                    <input
                      type="text"
                      placeholder="Ej: Gestión HSEQ"
                      value={trackingProcess}
                      onChange={(e) => setTrackingProcess(e.target.value)}
                      className="w-full bg-[#1E2229] border border-border-default rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="pt-1">
                    <SignaturePad
                      label="Firma Digital del Responsable de Seguimiento"
                      value={trackingSignature}
                      onChange={(dataUrl) => setTrackingSignature(dataUrl || '')}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 6: Efectividad del Cambio */}
            <div className="bg-[#1E2229] border border-border-default rounded-xl p-5 sm:p-6 space-y-4">
              <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2 border-b border-border-default pb-3">
                <CheckCircle2 className="w-5 h-5 text-accent" strokeWidth={1.75} />
                <span>6. Evaluación de la Efectividad del Cambio</span>
              </h2>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-[#15181D] border border-border-default">
                  <span className="text-xs text-white/90">
                    ¿Se controlaron los riesgos generados por el cambio?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setControlRisksControlled(true)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        controlRisksControlled === true
                          ? 'bg-accent text-surface-dark border-accent ring-1 ring-accent'
                          : 'bg-[#1E2229] border-border-default text-white/70 hover:border-white/30'
                      }`}
                    >
                      SÍ
                    </button>
                    <button
                      type="button"
                      onClick={() => setControlRisksControlled(false)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        controlRisksControlled === false
                          ? 'bg-accent text-surface-dark border-accent ring-1 ring-accent'
                          : 'bg-[#1E2229] border-border-default text-white/70 hover:border-white/30'
                      }`}
                    >
                      NO
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-[#15181D] border border-border-default">
                  <span className="text-xs text-white/90">
                    Efectividad General del Cambio
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setChangeEffective(true)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        changeEffective === true
                          ? 'bg-accent text-surface-dark border-accent ring-1 ring-accent'
                          : 'bg-[#1E2229] border-border-default text-white/70 hover:border-white/30'
                      }`}
                    >
                      SÍ
                    </button>
                    <button
                      type="button"
                      onClick={() => setChangeEffective(false)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        changeEffective === false
                          ? 'bg-accent text-surface-dark border-accent ring-1 ring-accent'
                          : 'bg-[#1E2229] border-border-default text-white/70 hover:border-white/30'
                      }`}
                    >
                      NO
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-white/70 mb-1">
                    Si alguna respuesta es NO, detalle las acciones de mejora a implementar:
                  </label>
                  <textarea
                    rows={2}
                    value={effectivenessNotesNo}
                    onChange={(e) => setEffectivenessNotesNo(e.target.value)}
                    placeholder="Acciones correctivas o de mejora según procedimiento..."
                    className="w-full bg-[#15181D] border border-border-default rounded-lg p-3 text-sm text-white placeholder-white/40 focus:outline-none focus:border-accent resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Acciones del Formulario */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <Link
                href="/dashboard"
                className="px-5 py-2.5 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-lg bg-accent text-surface-dark font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Guardando Registro...' : 'Guardar y Generar Documentos'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
