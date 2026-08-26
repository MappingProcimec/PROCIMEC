import { ToolShell } from '@/components/ToolShell';

export default function GisViewerPage() {
  return (
    <ToolShell
      name="Base de Datos GIS Integrada (2D/3D)"
      description="Visualización geoespacial 2D y 3D de todos los proyectos GPR geolocalizados. Filtra por fecha, cliente y tipo de hallazgo sobre un mapa interactivo."
      category="admin"
    />
  );
}
