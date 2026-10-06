import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Presentación Ejecutiva — Transformación Digital | Gerencia Financiera',
  description: 'Estrategia integral de digitalización de flujos de trabajo, control analítico de costos, desacoplamiento operativo y soberanía de datos.',
};

export default function PresentacionPage() {
  return (
    <main className="w-full h-[100dvh] bg-[#15181D] overflow-hidden m-0 p-0 flex flex-col">
      <iframe
        src="/presentacion/index.html"
        title="Presentación Ejecutiva - Gerencia Financiera"
        className="w-full h-full border-0 flex-1"
        allow="fullscreen; clipboard-write"
      />
    </main>
  );
}
