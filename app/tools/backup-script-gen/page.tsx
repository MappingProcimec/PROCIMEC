import { ToolShell } from '@/components/ToolShell';

export default function BackupScriptGenPage() {
  return (
    <ToolShell
      name="Generador de Scripts de Respaldo Local"
      description="Genera scripts de respaldo (.bat / .sh) para sincronizar localmente los archivos GPR desde Google Drive hacia el servidor o disco local de la empresa."
      category="gpr"
    />
  );
}
