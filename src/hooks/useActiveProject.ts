'use client';

import { useState, useEffect, useCallback } from 'react';

const ACTIVE_PROJECT_KEY = 'pcm_active_project_id';
const EVENT_NAME = 'pcm_active_project_changed';

export interface BaseProject {
  id: string;
  name: string;
  cost_center?: string;
  code?: string;
  client?: string;
}

/**
 * Obtiene el ID del proyecto activo almacenado en localStorage.
 * Seguro para Server-Side Rendering (SSR).
 */
export function getActiveProjectId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

/**
 * Establece el ID del proyecto activo y notifica a todos los componentes escuchando.
 */
export function setActiveProjectId(projectId: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (!projectId) {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    } else {
      localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { projectId } }));
  } catch (e) {
    console.warn('Error al persistir proyecto activo:', e);
  }
}

/**
 * Limpia el proyecto activo.
 */
export function clearActiveProjectId(): void {
  setActiveProjectId('');
}

/**
 * Hook de React para gestionar y sincronizar el proyecto activo en cualquier vista.
 */
export function useActiveProject(availableProjects: BaseProject[] = []) {
  const [activeProjectId, setLocalActiveProjectId] = useState<string | null>(null);

  useEffect(() => {
    // Lectura inicial del storage
    const stored = getActiveProjectId();
    setLocalActiveProjectId(stored);

    // Listener para cambios de proyecto en la misma ventana o entre pestañas
    const handleStorage = (e: StorageEvent) => {
      if (e.key === ACTIVE_PROJECT_KEY) {
        setLocalActiveProjectId(e.newValue);
      }
    };

    const handleCustom = (e: Event) => {
      const customEvent = e as CustomEvent<{ projectId: string }>;
      setLocalActiveProjectId(customEvent.detail?.projectId ?? null);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(EVENT_NAME, handleCustom);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(EVENT_NAME, handleCustom);
    };
  }, []);

  const changeActiveProject = useCallback((id: string) => {
    setActiveProjectId(id);
    setLocalActiveProjectId(id || null);
  }, []);

  const activeProject = availableProjects.find((p) => p.id === activeProjectId) ?? null;

  return {
    activeProjectId,
    activeProject,
    setActiveProject: changeActiveProject,
    clearActiveProject: () => changeActiveProject(''),
  };
}
