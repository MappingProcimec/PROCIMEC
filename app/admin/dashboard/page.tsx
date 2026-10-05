import { redirect } from 'next/navigation';

/**
 * Redirección canónica a /admin (Centro de Configuración de Plataforma).
 * Las métricas de operación ahora residen unificadas en /dashboard para el Administrador.
 */
export default function AdminDashboardRedirect() {
  redirect('/admin');
}
