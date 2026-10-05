'use client';

import React, { useState, useMemo } from 'react';
import {
  DivisionBlock,
  DivisionOption,
  RoleOption,
  ProjectOption,
} from './types';

export interface DivisionBlockCardProps {
  block: DivisionBlock;
  blockIndex: number;
  divisions: DivisionOption[];
  roleOptions: RoleOption[];
  allProjects: ProjectOption[];
  usedDivisionIds: string[];
  canRemove: boolean;
  onDivisionChange: (i: number, divId: string) => void;
  onRoleChange: (i: number, roleId: string) => void;
  onToggleProject: (i: number, projId: string) => void;
  onRemove: (i: number) => void;
  projectsByDivisionId?: Map<string, ProjectOption[]>;
  rolesByDivisionId?: Map<string, RoleOption[]>;
  globalRoles?: RoleOption[];
}

export function DivisionBlockCard({
  block,
  blockIndex,
  divisions,
  roleOptions,
  allProjects,
  usedDivisionIds,
  canRemove,
  onDivisionChange,
  onRoleChange,
  onToggleProject,
  onRemove,
  projectsByDivisionId,
  rolesByDivisionId,
  globalRoles,
}: DivisionBlockCardProps) {
  const [search, setSearch] = useState('');

  const divProjects = useMemo(() => {
    if (projectsByDivisionId) {
      return projectsByDivisionId.get(block.divisionId) || [];
    }
    return allProjects.filter((p) => (p.divisions ?? []).some((d) => d.id === block.divisionId));
  }, [projectsByDivisionId, block.divisionId, allProjects]);

  const filtered = useMemo(() => {
    if (!search) return divProjects;
    const s = search.toLowerCase();
    return divProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        (p.cost_center || p.code || '').toLowerCase().includes(s)
    );
  }, [divProjects, search]);

  const divSpecificRoles = useMemo(() => {
    if (rolesByDivisionId) {
      return rolesByDivisionId.get(block.divisionId) || [];
    }
    return roleOptions.filter((r) => r.division_id === block.divisionId);
  }, [rolesByDivisionId, block.divisionId, roleOptions]);

  const resolvedGlobalRoles = useMemo(() => {
    if (globalRoles) return globalRoles;
    return roleOptions.filter((r) => !r.division_id);
  }, [globalRoles, roleOptions]);

  const availableRoles = useMemo(
    () => [...divSpecificRoles, ...resolvedGlobalRoles],
    [divSpecificRoles, resolvedGlobalRoles]
  );

  return (
    <div className="border border-border rounded-xl p-4 space-y-3 bg-gray-50/40">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-text-secondary uppercase tracking-wide">División</span>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(blockIndex)}
            className="text-xs text-error hover:underline"
          >
            Quitar
          </button>
        )}
      </div>

      {/* Selector de división */}
      <select
        value={block.divisionId}
        onChange={(e) => onDivisionChange(blockIndex, e.target.value)}
        className="select text-sm w-full"
      >
        <option value="">— Seleccionar división —</option>
        {divisions
          .filter((d) => d.id === block.divisionId || !usedDivisionIds.includes(d.id))
          .map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
      </select>

      {block.divisionId && (
        <>
          {/* Proyectos */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label text-xs">
                Proyectos
                <span className="ml-1 text-text-muted font-normal">
                  ({block.projectIds.size}/{divProjects.length})
                </span>
              </label>
              {divProjects.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      divProjects.forEach((p) => {
                        if (!block.projectIds.has(p.id)) onToggleProject(blockIndex, p.id);
                      })
                    }
                    className="text-primary hover:underline font-semibold"
                  >
                    Todos
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() =>
                      divProjects.forEach((p) => {
                        if (block.projectIds.has(p.id)) onToggleProject(blockIndex, p.id);
                      })
                    }
                    className="text-text-muted hover:text-error hover:underline font-medium"
                  >
                    Ninguno
                  </button>
                </div>
              )}
            </div>

            {divProjects.length === 0 ? (
              <p className="text-xs text-text-muted">Esta división no tiene proyectos vinculados.</p>
            ) : (
              <>
                <div className="relative mb-1.5">
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
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar proyecto..."
                    className="input pl-7 py-1 text-xs w-full"
                  />
                </div>
                <div className="border border-border rounded-xl max-h-36 overflow-y-auto divide-y divide-border bg-white">
                  {filtered.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-text-muted text-center">Sin resultados</p>
                  ) : (
                    filtered.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={block.projectIds.has(p.id)}
                          onChange={() => onToggleProject(blockIndex, p.id)}
                          className="rounded text-primary focus:ring-primary"
                        />
                        <span className="text-xs font-bold text-text-muted w-14 flex-shrink-0 font-mono">
                          {p.cost_center || p.code || '—'}
                        </span>
                        <span className="text-sm text-text-primary flex-1 truncate">{p.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Rol */}
          <div>
            <label className="label text-xs mb-1.5 block">Rol</label>
            <select
              value={block.roleId}
              onChange={(e) => onRoleChange(blockIndex, e.target.value)}
              className="select text-sm w-full"
            >
              <option value="">— Seleccionar rol —</option>
              {divSpecificRoles.length > 0 && (
                <optgroup label="Roles de la división">
                  {divSpecificRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {resolvedGlobalRoles.length > 0 && (
                <optgroup label="Roles globales">
                  {resolvedGlobalRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (Global)
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {availableRoles.length === 0 && (
              <p className="text-xs text-text-muted mt-1">
                Esta división no tiene roles asignados ni roles globales disponibles.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
