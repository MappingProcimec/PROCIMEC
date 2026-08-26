import { ToolShell } from '@/components/ToolShell';

export default function GsfProcessorPage() {
  return (
    <ToolShell
      name="Procesador Web de Radargramas (.gsf)"
      description="Carga y procesa archivos de radargrama GPR (.gsf) directamente en el navegador. Visualiza, filtra y exporta los datos de radar sin software adicional."
      category="gpr"
    />
  );
}
