'use client';

import { useQuery } from '@tanstack/react-query';

export interface ActiveFormatVersionData {
  id?: string;
  code: string;
  name: string;
  process: string;
  form_slug: string | null;
  roles_access: string[];
  is_universal: boolean;
  current_version: string;
  effective_date: string;
  status: 'active' | 'obsolete' | 'draft';
  category?: string;
  description?: string | null;
  download_template_url?: string | null;
}

interface ActiveVersionApiResponse {
  ok: boolean;
  data: ActiveFormatVersionData;
  source: 'database' | 'fallback';
}

/**
 * Hook reactivo para obtener la versión oficial vigente y fecha de elaboración/vigencia
 * de un formato desde PostgreSQL (document_format_versions).
 *
 * Se actualiza automáticamente cuando el usuario incrementa la versión o edita el formato
 * desde la herramienta Control de Versiones.
 *
 * @param codeOrSlug Código formal (ej: 'FOR-SIG-001', 'FOR-HSEQ-024') o slug del formulario (ej: 'analisis-planificacion-cambios-sig')
 */
export function useFormatVersion(codeOrSlug: string | null | undefined) {
  const query = (codeOrSlug || '').trim();

  return useQuery<ActiveFormatVersionData | null>({
    queryKey: ['active-format-version', query],
    queryFn: async () => {
      if (!query) return null;
      const res = await fetch(`/api/tools/version-control/active-version?query=${encodeURIComponent(query)}`);
      if (!res.ok) return null;
      const json: ActiveVersionApiResponse = await res.json();
      return json?.data ?? null;
    },
    enabled: Boolean(query),
    staleTime: 60 * 1000, // 60 segundos de caché según LEY 6
    refetchOnWindowFocus: false, // Desactivado según LEY 6
  });
}
