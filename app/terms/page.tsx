import Link from 'next/link';

export const metadata = {
  title: 'Términos del Servicio — PROCIMEC Mapping Ingeniería',
  description: 'Términos y condiciones de uso del sistema PROCIMEC.',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-surface text-text-primary">
      {/* Header */}
      <header className="bg-primary text-white py-8 px-4 border-b border-primary-800">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <Link href="/" className="text-white/70 hover:text-white text-xs font-semibold uppercase tracking-wider block mb-1">
              ← Volver a PROCIMEC
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold">Términos del Servicio</h1>
            <p className="text-white/70 text-sm mt-1">Mapping Ingeniería · PROCIMEC</p>
          </div>
          <Link href="/login" className="btn-accent text-xs font-semibold px-4 py-2 rounded-xl">
            Iniciar Sesión
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        <div className="card p-6 sm:p-8 space-y-6">
          <section>
            <h2 className="text-lg font-bold text-primary mb-2">1. Aceptación de los Términos</h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              Al acceder y utilizar el sistema **PROCIMEC**, administrado por **Mapping Ingeniería**, usted acepta cumplir con los presentes Términos del Servicio y todas las normativas aplicables.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">2. Uso Autorizado del Sistema</h2>
            <p className="text-text-secondary text-sm leading-relaxed mb-3">
              PROCIMEC es una herramienta interna de uso profesional y corporativo destinada al registro de campo, gestión de actividades de dibujo y generación de informes de levantamiento GPR:
            </p>
            <ul className="list-disc list-inside text-text-secondary text-sm space-y-1.5 pl-2">
              <li>El acceso está restringido a personal autorizado por la administración de Mapping Ingeniería.</li>
              <li>Cada usuario es responsable de mantener la seguridad y confidencialidad de su cuenta institucional de Google.</li>
              <li>Queda prohibida la reproducción, modificación no autorizada o distribución externa de la información confidencial de proyectos contenida en el sistema.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">3. Propiedad Intelectual</h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              Todos los nombres comerciales, marcas, logotipos, código fuente, plantillas de reporte y contenidos de PROCIMEC son propiedad exclusiva de **Mapping Ingeniería**.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">4. Modificaciones a los Términos</h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              Mapping Ingeniería se reserva el derecho de actualizar o modificar estos términos en cualquier momento para adaptarlos a mejoras técnicas o requerimientos legales.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">5. Contacto</h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              Para preguntas relativas a los Términos del Servicio, contáctenos en <strong className="text-primary">mapping.procimec2024@gmail.com</strong>.
            </p>
          </section>
        </div>

        <div className="text-center pt-4 border-t border-border text-text-muted text-xs">
          Última actualización: {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })} · Mapping Ingeniería
        </div>
      </div>
    </main>
  );
}
