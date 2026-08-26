import { ToolShell } from '@/components/ToolShell';

export default function DocxGeneratorPage() {
  return (
    <ToolShell
      name="Generador de Reportes Técnicos (.docx)"
      description="Genera reportes técnicos Word (.docx) a partir de los datos del formulario de campo GPR con formato corporativo PROCIMEC y carga automática a Google Drive."
      category="gpr"
    />
  );
}
