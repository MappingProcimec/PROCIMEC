import Link from 'next/link';

export const metadata = {
  title: 'Política de Privacidad — PROCIMEC Mapping Ingeniería',
  description: 'Política de privacidad y tratamiento de datos personales de PROCIMEC.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-surface text-text-primary">
      {/* Header */}
      <header className="bg-primary text-white py-8 px-4 border-b border-primary-800">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <Link href="/" className="text-white/70 hover:text-white text-xs font-semibold uppercase tracking-wider block mb-1">
              ← Volver a PROCIMEC
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold">Política de Privacidad</h1>
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
            <h2 className="text-lg font-bold text-primary mb-2">1. Información General</h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              PROCIMEC es un sistema de registro digital de levantamientos técnicos y gestión de actividades desarrollado por **Mapping Ingeniería**. Respetamos y protegemos la privacidad de nuestros usuarios y del personal autorizado que utiliza la plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">2. Información que Recopilamos</h2>
            <p className="text-text-secondary text-sm leading-relaxed mb-3">
              Recopilamos únicamente la información necesaria para la gestión del servicio y autenticación de usuarios:
            </p>
            <ul className="list-disc list-inside text-text-secondary text-sm space-y-1.5 pl-2">
              <li><strong>Datos de cuenta:</strong> Nombre completo, correo electrónico y foto de perfil provenientes de la cuenta corporativa de Google.</li>
              <li><strong>Datos de actividad:</strong> Registros técnicos de campo (Radar GPR), archivos de proyectos, fechas de trabajo, uso de software de dibujo y observaciones de proyectos.</li>
              <li><strong>Almacenamiento en Google Drive:</strong> Archivos adjuntos y reportes técnicos autorizados en el almacenamiento corporativo.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">3. Uso de la Información</h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              La información recopilada se utiliza exclusivamente para la administración interna de proyectos de ingeniería, generación de informes técnicos en formato Word, control de asistencia y asignación de actividades por roles de usuario autorizados. No vendemos ni compartimos datos con terceros con fines comerciales.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">4. Seguridad y Protección de Datos</h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              Implementamos mecanismos de seguridad mediante cifrado SSL/TLS, autenticación por tokens JWT y seguridad a nivel de filas (*Row Level Security*) en la base de datos para garantizar la integridad de la información.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">5. Contacto</h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              Para consultas relacionadas con esta política de privacidad o el tratamiento de datos, comuníquese con la administración a través de <strong className="text-primary">mapping.procimec2024@gmail.com</strong>.
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
