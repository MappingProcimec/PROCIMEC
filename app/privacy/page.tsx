import Link from 'next/link';
import { ShieldCheck, ArrowLeft, Clock, FileText } from 'lucide-react';

export const metadata = {
  title: 'Política de Tratamiento de Datos Personales (Habeas Data) — PROCIMEC INGENIERÍA S.A.S.',
  description: 'Política institucional de tratamiento de datos personales conforme a la Ley Estatutaria 1581 de 2012 de Colombia.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#1E2229] text-white">
      {/* Header */}
      <header className="bg-[#15181D] py-8 px-4 border-b border-white/10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-semibold uppercase tracking-wider mb-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
              Volver al inicio
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-[#EAA023]" strokeWidth={1.75} />
              Política de Tratamiento de Datos Personales
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Habeas Data · Ley Estatutaria 1581 de 2012 y Decreto 1377 de 2013
            </p>
          </div>
          <Link
            href="/login"
            className="hidden sm:inline-flex bg-[#EAA023] hover:bg-[#d48f1c] text-[#1E2229] font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95"
          >
            Iniciar Sesión
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        <div className="bg-[#2A303C] border border-white/10 rounded-3xl p-6 sm:p-10 space-y-8 shadow-2xl">
          {/* 1. Responsable */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#EAA023]" strokeWidth={1.75} />
              1. Identificación del Responsable del Tratamiento
            </h2>
            <div className="text-white/80 text-sm leading-relaxed space-y-1 bg-[#1E2229] p-4 rounded-2xl border border-white/5">
              <p><strong>Razón Social:</strong> PROCIMEC INGENIERÍA S.A.S.</p>
              <p><strong>Domicilio:</strong> Bogotá D.C., República de Colombia</p>
              <p><strong>Canal Exclusivo de Habeas Data:</strong> mapping.procimec2024@gmail.com</p>
              <p><strong>Plataforma Tecnológica:</strong> PCM CLOUD (Sistema Corporativo de Gestión e Inspección Técnica)</p>
            </div>
          </section>

          {/* 2. Marco Legal */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2">
              2. Marco Legal y Ámbito de Aplicación
            </h2>
            <p className="text-white/80 text-sm leading-relaxed">
              La presente política rige el tratamiento de datos personales de colaboradores, contratistas, operadores y clientes, en estricto cumplimiento de la <strong>Ley Estatutaria 1581 de 2012</strong>, el <strong>Decreto 1377 de 2013</strong> (compilado en el Decreto Único Reglamentario 1074 de 2015) y demás directrices emitidas por la <strong>Superintendencia de Industria y Comercio (SIC)</strong> de la República de Colombia.
            </p>
          </section>

          {/* 3. Finalidades */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2">
              3. Finalidades del Tratamiento de Datos
            </h2>
            <p className="text-white/80 text-sm leading-relaxed">
              Los datos recolectados mediante credenciales corporativas (Google OAuth) y captura en formularios de campo se tratarán exclusivamente para los siguientes propósitos legítimos:
            </p>
            <ul className="list-disc list-inside text-white/80 text-sm space-y-2 pl-2">
              <li><strong>Autenticación y Control de Accesos:</strong> Identificación unívoca del personal autorizado y asignación de perfiles según su rol de trabajo.</li>
              <li><strong>Auditoría Técnica y Operacional:</strong> Estampado de autoría inmutable en reportes de prospección geofísica (GPR), actas de reunión y hojas de ruta.</li>
              <li><strong>Gestión HSEQ y Seguridad Laboral:</strong> Registro de inspecciones preoperacionales de equipos, vehículos y drones (formatos FOR-HSEQ y FOR-SIG).</li>
              <li><strong>Gestión Contractual y Financiera:</strong> Soporte de actividades operativas para liquidación de servicios, compras y nómina operativa.</li>
            </ul>
          </section>

          {/* 4. Derechos del Titular */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2">
              4. Derechos de los Titulares (Art. 8, Ley 1581 de 2012)
            </h2>
            <p className="text-white/80 text-sm leading-relaxed">
              De conformidad con la legislación colombiana, todo titular de datos personales cuenta con las siguientes prerrogativas:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="bg-[#1E2229] p-3.5 rounded-xl border border-white/5 text-xs text-white/80">
                <strong className="text-white block mb-1">a) Conocimiento y Actualización:</strong>
                Conocer, actualizar y rectificar sus datos personales frente a información inexacta o incompleta.
              </div>
              <div className="bg-[#1E2229] p-3.5 rounded-xl border border-white/5 text-xs text-white/80">
                <strong className="text-white block mb-1">b) Prueba de Autorización:</strong>
                Solicitar prueba de la autorización otorgada al Responsable del tratamiento.
              </div>
              <div className="bg-[#1E2229] p-3.5 rounded-xl border border-white/5 text-xs text-white/80">
                <strong className="text-white block mb-1">c) Información de Uso:</strong>
                Ser informado, previa solicitud, respecto del uso que se le ha dado a sus datos.
              </div>
              <div className="bg-[#1E2229] p-3.5 rounded-xl border border-white/5 text-xs text-white/80">
                <strong className="text-white block mb-1">d) Quejas ante la SIC:</strong>
                Presentar ante la Superintendencia de Industria y Comercio quejas por infracciones a la ley.
              </div>
              <div className="bg-[#1E2229] p-3.5 rounded-xl border border-white/5 text-xs text-white/80">
                <strong className="text-white block mb-1">e) Revocatoria y Supresión:</strong>
                Revocar la autorización o solicitar la supresión de datos cuando no medie deber legal o contractual.
              </div>
              <div className="bg-[#1E2229] p-3.5 rounded-xl border border-white/5 text-xs text-white/80">
                <strong className="text-white block mb-1">f) Acceso Gratuito:</strong>
                Acceder de forma gratuita a sus datos personales que hayan sido objeto de tratamiento.
              </div>
            </div>
          </section>

          {/* 5. Procedimiento y Plazos */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2 flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#EAA023]" strokeWidth={1.75} />
              5. Procedimiento y Términos de Atención a Consultas y Reclamos
            </h2>
            <div className="space-y-3 text-sm text-white/80 leading-relaxed">
              <p>
                Los titulares o sus causahabientes podrán radicar sus solicitudes mediante correo electrónico a <strong className="text-[#EAA023]">mapping.procimec2024@gmail.com</strong> indicando nombre completo, número de identificación, hechos y solicitud concreta.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="border border-white/10 rounded-2xl p-4 bg-[#1E2229]">
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider text-[#EAA023] mb-1">Consultas (Art. 14)</h3>
                  <p className="text-xs text-white/70">
                    Serán atendidas en un término máximo de <strong>diez (10) días hábiles</strong> contados a partir de la fecha de su recibo. Si no fuere posible, se informará al interesado indicando el motivo y la fecha de respuesta, sin superar cinco (5) días hábiles adicionales.
                  </p>
                </div>
                <div className="border border-white/10 rounded-2xl p-4 bg-[#1E2229]">
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider text-[#EAA023] mb-1">Reclamos (Art. 15)</h3>
                  <p className="text-xs text-white/70">
                    Serán atendidos en un término máximo de <strong>quince (15) días hábiles</strong> contados a partir del día siguiente a la fecha de recepción completa. Si no fuere posible resolverlo en dicho lapso, se informará prorrogando hasta por ocho (8) días hábiles adicionales.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 6. RNBD */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2">
              6. Registro Nacional de Bases de Datos (RNBD)
            </h2>
            <p className="text-white/80 text-sm leading-relaxed">
              PROCIMEC INGENIERÍA S.A.S. mantiene sus inventarios y manuales de políticas actualizados. En cumplimiento de lo dispuesto por el Decreto 090 de 2018 expedido por el Ministerio de Comercio, Industria y Turismo, la sociedad opera bajo los lineamientos de registro y reporte establecidos para sociedades según el umbral de activos totales regulado por la SIC.
            </p>
          </section>

          {/* 7. Vigencia */}
          <section className="space-y-2 pt-2 border-t border-white/10 text-xs text-white/50 flex flex-col sm:flex-row justify-between items-center gap-2">
            <span>Versión de Política: <strong>2026-v2</strong></span>
            <span>Vigencia: Octubre de 2026 · PROCIMEC INGENIERÍA S.A.S.</span>
          </section>
        </div>
      </div>
    </main>
  );
}
