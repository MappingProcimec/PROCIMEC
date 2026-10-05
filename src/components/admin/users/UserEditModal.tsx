'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  Clock,
  Building2,
  Layers,
  Wrench,
  FileText,
  RotateCcw,
  AlertTriangle,
  MessageSquare,
  User as UserIcon,
} from 'lucide-react';
import {
  User,
  DivisionOption,
  RoleOption,
  ProjectOption,
  ToolOption,
  FormOption,
  DivisionBlock,
} from './types';
import {
  buildInitialDivisionBlocks,
  deriveSystemRole,
  getUserEffectiveToolsAndForms,
  getToolsAndFormsFromRoles,
  getUserRoleIds,
  TOOL_CATEGORY_STYLES,
  ToolCategoryIcon,
} from './user-helpers';
import { DivisionBlockCard } from './DivisionBlockCard';

export interface UserEditModalProps {
  user: User;
  allProjects: ProjectOption[];
  roleOptions: RoleOption[];
  divisions: DivisionOption[];
  allTools: ToolOption[];
  allForms: FormOption[];
  rolesById: Map<string, RoleOption>;
  projectsByDivisionId: Map<string, ProjectOption[]>;
  rolesByDivisionId: Map<string, RoleOption[]>;
  globalRoles: RoleOption[];
  isPending: boolean;
  onClose: () => void;
  onSave: (payload: {
    id: string;
    role?: string;
    role_id?: string | null;
    is_active?: boolean;
    project_ids?: string[];
    division_roles?: { division_id: string; role_id: string | null }[];
    tool_ids?: string[];
    form_ids?: string[];
    full_name?: string;
    nick_name?: string | null;
    email?: string;
    phone?: string | null;
  }) => void;
  mutationError?: string | null;
}

export function UserEditModal({
  user,
  allProjects,
  roleOptions,
  divisions,
  allTools,
  allForms,
  rolesById,
  projectsByDivisionId,
  rolesByDivisionId,
  globalRoles,
  isPending,
  onClose,
  onSave,
  mutationError,
}: UserEditModalProps) {
  // Inicialización sincrónica instantánea (cero parpadeo / cero useEffect)
  const [editName, setEditName] = useState(user.full_name || '');
  const [editNickName, setEditNickName] = useState(user.nick_name || user.full_name || '');
  const [editEmail, setEditEmail] = useState(user.email || '');
  const [editPhone, setEditPhone] = useState(user.phone || '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const [accessType, setAccessType] = useState<'admin' | 'pending' | 'division'>(() => {
    return user.role === 'admin' ? 'admin' : user.role === 'pending' ? 'pending' : 'division';
  });

  const [editBlocks, setEditBlocks] = useState<DivisionBlock[]>(() =>
    buildInitialDivisionBlocks(user, rolesById, allProjects, projectsByDivisionId)
  );

  const [sectionTab, setSectionTab] = useState<'division' | 'tools' | 'forms'>('division');

  const [selectedToolIds, setSelectedToolIds] = useState<Set<string>>(() =>
    new Set(getUserEffectiveToolsAndForms(user).toolIds)
  );
  const [selectedFormIds, setSelectedFormIds] = useState<Set<string>>(() =>
    new Set(getUserEffectiveToolsAndForms(user).formIds)
  );

  const [toolSearch, setToolSearch] = useState('');
  const [formSearch, setFormSearch] = useState('');

  const projectsForDiv = useCallback(
    (divId: string) => (divId ? projectsByDivisionId.get(divId) || [] : []),
    [projectsByDivisionId]
  );

  // Operaciones de bloques de división
  const addBlock = () =>
    setEditBlocks((prev) => [...prev, { divisionId: '', roleId: '', projectIds: new Set() }]);

  const removeBlock = (i: number) => setEditBlocks((prev) => prev.filter((_, idx) => idx !== i));

  const onDivisionChange = (i: number, divId: string) => {
    const divProjs = projectsForDiv(divId);
    setEditBlocks((prev) =>
      prev.map((b, idx) => {
        if (idx !== i) return b;
        const currentRole = roleOptions.find((r) => r.id === b.roleId);
        const keepRole = currentRole && (!currentRole.division_id || currentRole.division_id === divId);
        return {
          divisionId: divId,
          roleId: keepRole ? b.roleId : '',
          projectIds: new Set(divProjs.map((p) => p.id)),
        };
      })
    );
  };

  const onRoleChange = (i: number, roleId: string) => {
    setEditBlocks((prev) => prev.map((b, idx) => (idx === i ? { ...b, roleId } : b)));
    if (roleId) {
      const { toolIds: newToolIds, formIds: newFormIds } = getToolsAndFormsFromRoles(
        [roleId],
        roleOptions,
        rolesById
      );
      setSelectedToolIds((prev) => {
        const next = new Set(prev);
        newToolIds.forEach((id) => next.add(id));
        return next;
      });
      setSelectedFormIds((prev) => {
        const next = new Set(prev);
        newFormIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const onToggleProject = (blockIndex: number, projId: string) => {
    setEditBlocks((prev) =>
      prev.map((b, idx) => {
        if (idx !== blockIndex) return b;
        const next = new Set(b.projectIds);
        if (next.has(projId)) next.delete(projId);
        else next.add(projId);
        return { ...b, projectIds: next };
      })
    );
  };

  const onToggleTool = (toolId: string) => {
    setSelectedToolIds((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
  };

  const onToggleForm = (formId: string) => {
    setSelectedFormIds((prev) => {
      const next = new Set(prev);
      if (next.has(formId)) next.delete(formId);
      else next.add(formId);
      return next;
    });
  };

  const usedDivisionIds = useMemo(
    () => editBlocks.map((b) => b.divisionId).filter(Boolean),
    [editBlocks]
  );

  const filteredTools = useMemo(() => {
    if (!toolSearch) return allTools;
    const q = toolSearch.toLowerCase();
    return allTools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        (t.category && t.category.toLowerCase().includes(q))
    );
  }, [allTools, toolSearch]);

  const filteredForms = useMemo(() => {
    if (!formSearch) return allForms;
    const q = formSearch.toLowerCase();
    return allForms.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.slug.toLowerCase().includes(q) ||
        (f.description && f.description.toLowerCase().includes(q))
    );
  }, [allForms, formSearch]);

  const currentModalRoleIds = useMemo(() => {
    const fromBlocks = editBlocks.map((b) => b.roleId).filter(Boolean);
    if (fromBlocks.length > 0) return fromBlocks;
    return getUserRoleIds(user, roleOptions);
  }, [editBlocks, user, roleOptions]);

  const currentRolePermissions = useMemo(() => {
    return getToolsAndFormsFromRoles(currentModalRoleIds, roleOptions, rolesById);
  }, [currentModalRoleIds, roleOptions, rolesById]);

  const handleResetToRoleDefaults = () => {
    setSelectedToolIds(new Set(currentRolePermissions.toolIds));
    setSelectedFormIds(new Set(currentRolePermissions.formIds));
  };

  const handleSave = () => {
    const trimmedName = editName.trim();
    const trimmedNickName = editNickName.trim() || trimmedName;
    const trimmedEmail = editEmail.trim().toLowerCase();
    const trimmedPhone = editPhone.trim();

    if (!trimmedName) {
      setValidationError('El nombre completo no puede estar vacío.');
      return;
    }

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setValidationError('Ingresa un correo electrónico válido.');
      return;
    }

    setValidationError(null);

    const tool_ids = Array.from(selectedToolIds);
    const form_ids = Array.from(selectedFormIds);

    const basePayload = {
      id: user.id,
      full_name: trimmedName,
      nick_name: trimmedNickName,
      email: trimmedEmail,
      phone: trimmedPhone || null,
      tool_ids,
      form_ids,
    };

    if (accessType === 'admin') {
      onSave({
        ...basePayload,
        role: 'admin',
        role_id: null,
        division_roles: [],
        project_ids: [],
      });
    } else if (accessType === 'pending') {
      onSave({
        ...basePayload,
        role: 'pending',
        role_id: null,
        division_roles: [],
        project_ids: [],
      });
    } else {
      const valid = editBlocks.filter((b) => b.divisionId);
      const division_roles = valid.map((b) => ({ division_id: b.divisionId, role_id: b.roleId || null }));
      const project_ids = Array.from(new Set(valid.flatMap((b) => Array.from(b.projectIds))));
      const primaryRoleId = valid.map((b) => b.roleId).find(Boolean) || null;
      const primaryRole = roleOptions.find((r) => r.id === primaryRoleId);
      const sysRole = primaryRole ? deriveSystemRole(primaryRole.name) : 'localizador';

      onSave({
        ...basePayload,
        role: sysRole,
        role_id: primaryRoleId,
        division_roles,
        project_ids,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="card w-full max-w-xl animate-slide-up max-h-[92vh] flex flex-col shadow-2xl bg-white border border-border">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-bold text-text-primary text-base">Editar Usuario</h3>
          </div>
          <button type="button" onClick={onClose} className="btn-icon btn-ghost">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* User info Card */}
          <div className="flex items-center gap-3.5 pb-3 border-b border-border">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar_url}
                alt={editName || user.full_name}
                className="w-12 h-12 rounded-full border border-border flex-shrink-0 object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold text-lg">
                  {(editName || user.full_name || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-text-primary text-sm sm:text-base truncate">
                {editName || user.full_name}
              </p>
              <p className="text-xs text-text-muted truncate font-mono">{editEmail || user.email}</p>
            </div>
          </div>

          {/* Información Personal y Contacto */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-slate-600" strokeWidth={1.75} />
                <span>Datos Personales</span>
              </label>
            </div>

            <div className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Nombre Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => {
                      setEditName(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder="Nombre completo"
                    className="input text-xs w-full py-2 bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Apodo
                  </label>
                  <input
                    type="text"
                    value={editNickName}
                    onChange={(e) => setEditNickName(e.target.value)}
                    placeholder="Apodo"
                    className="input text-xs w-full py-2 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Correo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => {
                      setEditEmail(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder="correo@ejemplo.com"
                    className="input text-xs w-full py-2 bg-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1 flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-text-secondary" strokeWidth={1.75} />{' '}
                    WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Ej. +57 300 123 4567"
                    className="input text-xs w-full py-2 bg-white font-mono"
                  />
                </div>
              </div>
            </div>

            {validationError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" strokeWidth={1.75} />
                <span>{validationError}</span>
              </p>
            )}
          </div>

          {/* Access type buttons */}
          <div className="form-group">
            <label className="label font-semibold text-xs text-text-secondary uppercase tracking-wider mb-2 block">
              Tipo de acceso
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['admin', 'pending', 'division'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAccessType(t)}
                  className={`py-2.5 px-3 rounded-xl border-2 text-xs font-semibold transition-all active:scale-[0.98] ${
                    accessType === t
                      ? 'border-primary bg-primary text-white shadow-sm'
                      : 'border-border text-text-secondary hover:border-primary/40 bg-white'
                  }`}
                >
                  {t === 'admin' ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.75} /> Administrador
                    </span>
                  ) : t === 'pending' ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" strokeWidth={1.75} /> Pendiente
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" strokeWidth={1.75} /> División
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {accessType === 'pending' && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" strokeWidth={1.75} />
              <span>Sin acceso asignado hasta aprobación</span>
            </div>
          )}

          {accessType === 'division' && (
            <div className="space-y-4">
              {/* Selector de Pestañas: División vs Herramientas vs Formularios */}
              <div className="flex border-b border-border gap-1 bg-gray-50/70 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSectionTab('division')}
                  className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                    sectionTab === 'division'
                      ? 'bg-white text-primary shadow-sm border border-border'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>División & Proyectos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSectionTab('tools')}
                  className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                    sectionTab === 'tools'
                      ? 'bg-white text-primary shadow-sm border border-border'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Herramientas</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                      selectedToolIds.size > 0
                        ? 'bg-primary-100 text-primary'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {selectedToolIds.size}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSectionTab('forms')}
                  className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                    sectionTab === 'forms'
                      ? 'bg-white text-primary shadow-sm border border-border'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Formularios</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                      selectedFormIds.size > 0
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {selectedFormIds.size}
                  </span>
                </button>
              </div>

              {/* PESTAÑA 1: DIVISIÓN, PROYECTOS Y ROL */}
              {sectionTab === 'division' && (
                <div className="space-y-3">
                  {editBlocks.map((block, i) => (
                    <DivisionBlockCard
                      key={i}
                      block={block}
                      blockIndex={i}
                      divisions={divisions}
                      roleOptions={roleOptions}
                      allProjects={allProjects}
                      projectsByDivisionId={projectsByDivisionId}
                      rolesByDivisionId={rolesByDivisionId}
                      globalRoles={globalRoles}
                      usedDivisionIds={usedDivisionIds}
                      canRemove={editBlocks.length > 1}
                      onDivisionChange={onDivisionChange}
                      onRoleChange={onRoleChange}
                      onToggleProject={onToggleProject}
                      onRemove={removeBlock}
                    />
                  ))}

                  <button
                    type="button"
                    onClick={addBlock}
                    disabled={usedDivisionIds.length >= divisions.length}
                    className="w-full py-2.5 border-2 border-dashed border-border rounded-xl text-xs text-text-muted hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    + Otra división
                  </button>
                </div>
              )}

              {/* PESTAÑA 2: HERRAMIENTAS ASIGNADAS */}
              {sectionTab === 'tools' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-text-primary uppercase tracking-wide">
                        Herramientas
                      </h4>
                      <p className="text-[11px] text-text-muted font-mono">
                        {selectedToolIds.size} / {allTools.length} seleccionadas
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={handleResetToRoleDefaults}
                        className="text-primary hover:underline font-semibold flex items-center gap-1"
                        title="Restablecer a las herramientas otorgadas por su rol"
                      >
                        <RotateCcw className="w-3 h-3" strokeWidth={1.75} />
                        <span>Por Rol</span>
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedToolIds(new Set(allTools.map((t) => t.id)))}
                        className="text-primary hover:underline font-semibold"
                      >
                        Todas
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedToolIds(new Set())}
                        className="text-text-muted hover:text-error hover:underline font-medium"
                      >
                        Ninguna
                      </button>
                    </div>
                  </div>

                  {/* Buscador de herramientas */}
                  <div className="relative">
                    <svg
                      className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                      />
                    </svg>
                    <input
                      type="text"
                      value={toolSearch}
                      onChange={(e) => setToolSearch(e.target.value)}
                      placeholder="Buscar herramienta por nombre o categoría..."
                      className="input pl-7 py-1.5 text-xs w-full"
                    />
                  </div>

                  {/* Lista de herramientas */}
                  <div className="border border-border rounded-xl max-h-64 overflow-y-auto divide-y divide-border bg-white">
                    {filteredTools.length === 0 ? (
                      <p className="px-3 py-4 text-xs text-text-muted text-center">
                        No se encontraron herramientas
                      </p>
                    ) : (
                      filteredTools.map((tool) => {
                        const isChecked = selectedToolIds.has(tool.id);
                        const isGrantedByRole = currentRolePermissions.toolIds.has(tool.id);
                        const catStyle = TOOL_CATEGORY_STYLES[tool.category] ?? {
                          label: tool.category,
                          type: 'admin',
                          bg: 'bg-gray-50 border-gray-200',
                          text: 'text-gray-700',
                        };

                        return (
                          <label
                            key={tool.id}
                            className={`flex items-center gap-3 px-3.5 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors ${
                              isChecked ? 'bg-primary-50/30' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => onToggleTool(tool.id)}
                              className="rounded text-primary focus:ring-primary w-4 h-4"
                            />
                            <span className="flex-shrink-0 flex items-center">
                              <ToolCategoryIcon type={catStyle.type} />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-text-primary truncate">
                                  {tool.name}
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 rounded border text-[10px] font-medium ${catStyle.bg} ${catStyle.text}`}
                                >
                                  {catStyle.label}
                                </span>
                                {isGrantedByRole && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-gray-100 text-text-secondary border border-gray-200">
                                    Rol
                                  </span>
                                )}
                              </div>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* PESTAÑA 3: FORMULARIOS ASIGNADOS */}
              {sectionTab === 'forms' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-text-primary uppercase tracking-wide">
                        Formularios
                      </h4>
                      <p className="text-[11px] text-text-muted font-mono">
                        {selectedFormIds.size} / {allForms.length} seleccionados
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={handleResetToRoleDefaults}
                        className="text-primary hover:underline font-semibold flex items-center gap-1"
                        title="Restablecer a los formularios otorgados por su rol"
                      >
                        <RotateCcw className="w-3 h-3" strokeWidth={1.75} />
                        <span>Por Rol</span>
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedFormIds(new Set(allForms.map((f) => f.id)))}
                        className="text-primary hover:underline font-semibold"
                      >
                        Todos
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedFormIds(new Set())}
                        className="text-text-muted hover:text-error hover:underline font-medium"
                      >
                        Ninguno
                      </button>
                    </div>
                  </div>

                  {/* Buscador de formularios */}
                  <div className="relative">
                    <svg
                      className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                      />
                    </svg>
                    <input
                      type="text"
                      value={formSearch}
                      onChange={(e) => setFormSearch(e.target.value)}
                      placeholder="Buscar formulario..."
                      className="input pl-7 py-1.5 text-xs w-full"
                    />
                  </div>

                  {/* Lista de formularios */}
                  <div className="border border-border rounded-xl max-h-64 overflow-y-auto divide-y divide-border bg-white">
                    {filteredForms.length === 0 ? (
                      <p className="px-3 py-4 text-xs text-text-muted text-center">
                        No se encontraron formularios
                      </p>
                    ) : (
                      filteredForms.map((form) => {
                        const isChecked = selectedFormIds.has(form.id);
                        const isGrantedByRole = currentRolePermissions.formIds.has(form.id);

                        return (
                          <label
                            key={form.id}
                            className={`flex items-start gap-3 px-3.5 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors ${
                              isChecked ? 'bg-emerald-50/40' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => onToggleForm(form.id)}
                              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs font-semibold text-text-primary">{form.name}</p>
                                {isGrantedByRole && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-gray-100 text-text-secondary border border-gray-200">
                                    Rol
                                  </span>
                                )}
                              </div>
                              {form.description && (
                                <p className="text-[11px] text-text-muted mt-0.5">{form.description}</p>
                              )}
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                              {form.slug}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {mutationError && (
            <p className="text-xs text-red-600 font-medium bg-red-50 p-2.5 rounded-lg border border-red-200 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" strokeWidth={1.75} />
              <span>{mutationError}</span>
            </p>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex gap-3 p-5 border-t border-border flex-shrink-0 bg-gray-50/50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="btn-primary flex-1"
          >
            {isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{' '}
                Guardando...
              </>
            ) : (
              'Guardar cambios'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
