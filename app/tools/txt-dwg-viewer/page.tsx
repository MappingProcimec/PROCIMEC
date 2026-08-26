import { ToolShell } from '@/components/ToolShell';

export default function TxtDwgViewerPage() {
  return (
    <ToolShell
      name="Previsualizador TXT y Exportador DWG"
      description="Previsualiza archivos TXT de coordenadas GPR y genera planos DWG listos para AutoCAD con las anomalías detectadas georreferenciadas."
      category="gpr"
    />
  );
}
