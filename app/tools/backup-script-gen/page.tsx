'use client';

import { useState } from 'react';
import { BackButton } from '@/components/BackButton';
import { Database, Download, Copy, Check, Terminal, Shield, HardDrive, RefreshCw } from 'lucide-react';

export default function BackupScriptGenPage() {
  const [dbHost, setDbHost] = useState('db.your-project.supabase.co');
  const [dbUser, setDbUser] = useState('postgres');
  const [dbName, setDbName] = useState('postgres');
  const [targetDir, setTargetDir] = useState('C:\\PROCIMEC_BACKUPS');
  const [scriptType, setScriptType] = useState<'powershell' | 'bash' | 'batch'>('powershell');
  const [copied, setCopied] = useState(false);

  const generateScript = () => {
    const timestamp = '$(Get-Date -Format "yyyyMMdd_HHmmss")';

    if (scriptType === 'powershell') {
      return `# ==============================================================================
# Script de Respaldo Automatizado - PROCIMEC PCM CLOUD
# Generado para: Base de Datos PostgreSQL (Supabase) y Evidencias
# ==============================================================================
param(
  [string]$BackupDir = "${targetDir}",
  [string]$DbHost = "${dbHost}",
  [string]$DbUser = "${dbUser}",
  [string]$DbName = "${dbName}"
)

$ErrorActionPreference = "Stop"
$Timestamp = ${timestamp}
$OutputFile = Join-Path $BackupDir "procimec_db_$Timestamp.sql"

Write-Host ">>> Iniciando proceso de respaldo de PROCIMEC ($Timestamp)..." -ForegroundColor Cyan

if (-not (Test-Path $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
  Write-Host "Directorio de respaldo creado: $BackupDir" -ForegroundColor Green
}

# Ejecución de pg_dump con compresión
Write-Host "Extrayendo volcado de base de datos PostgreSQL..."
pg_dump -h $DbHost -p 5432 -U $DbUser -d $DbName -F c -b -v -f "$OutputFile.dump"

if ($LASTEXITCODE -eq 0) {
  Write-Host ">>> Respaldo completado con exito: $OutputFile.dump" -ForegroundColor Green
} else {
  Write-Host ">>> Error en la generacion del respaldo" -ForegroundColor Red
}
`;
    }

    if (scriptType === 'bash') {
      return `#!/usr/bin/env bash
# ==============================================================================
# Script de Respaldo Automatizado - PROCIMEC PCM CLOUD (Linux / macOS)
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${targetDir.replace(/\\/g, '/')}"
DB_HOST="${dbHost}"
DB_USER="${dbUser}"
DB_NAME="${dbName}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="$BACKUP_DIR/procimec_db_$TIMESTAMP.dump"

echo ">>> Iniciando respaldo de base de datos PROCIMEC..."
mkdir -p "$BACKUP_DIR"

pg_dump -h "$DB_HOST" -p 5432 -U "$DB_USER" -d "$DB_NAME" -F c -b -v -f "$OUTPUT_FILE"

echo ">>> Respaldo exitoso: $OUTPUT_FILE"
`;
    }

    return `@echo off
:: ==============================================================================
:: Script de Respaldo Automatizado - PROCIMEC PCM CLOUD (Windows Batch)
:: ==============================================================================
set BACKUP_DIR=${targetDir}
set DB_HOST=${dbHost}
set DB_USER=${dbUser}
set DB_NAME=${dbName}
set TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%

echo >>> Iniciando respaldo PROCIMEC...
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

pg_dump -h %DB_HOST% -p 5432 -U %DB_USER% -d %DB_NAME% -F c -b -v -f "%BACKUP_DIR%\\procimec_db_%TIMESTAMP%.dump"

if %ERRORLEVEL% equ 0 (
  echo >>> Respaldo completado exitosamente en %BACKUP_DIR%
) else (
  echo >>> Ocurrio un error al ejecutar pg_dump
)
pause
`;
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generateScript());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = scriptType === 'powershell' ? 'ps1' : scriptType === 'bash' ? 'sh' : 'bat';
    const blob = new Blob([generateScript()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `procimec_backup_${scriptType}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#1E2229] text-white">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <BackButton href="/dashboard" label="Volver a Mi Panel" />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <Database className="w-8 h-8 text-[#EAA023]" strokeWidth={1.75} />
              Generador de Scripts de Respaldo
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Genera rutinas automatizadas de copia de seguridad para PostgreSQL (Supabase) y almacenamiento institucional PCM CLOUD.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-[#EAA023]">
              <Shield className="w-3.5 h-3.5" />
              SRE & Continuidad
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuración */}
          <div className="bg-[#2A303C] border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#EAA023] flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              Parámetros del Servidor
            </h2>

            <div className="space-y-1">
              <label className="text-xs text-white/70">Host PostgreSQL (Supabase)</label>
              <input
                type="text"
                value={dbHost}
                onChange={(e) => setDbHost(e.target.value)}
                className="w-full bg-[#15181D] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-[#EAA023]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-white/70">Usuario DB</label>
                <input
                  type="text"
                  value={dbUser}
                  onChange={(e) => setDbUser(e.target.value)}
                  className="w-full bg-[#15181D] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-[#EAA023]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/70">Base de Datos</label>
                <input
                  type="text"
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  className="w-full bg-[#15181D] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-[#EAA023]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-white/70">Directorio Local de Respaldo</label>
              <input
                type="text"
                value={targetDir}
                onChange={(e) => setTargetDir(e.target.value)}
                className="w-full bg-[#15181D] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-[#EAA023]"
              />
            </div>

            <div className="space-y-1 pt-2">
              <label className="text-xs text-white/70">Formato del Script</label>
              <div className="grid grid-cols-3 gap-2">
                {(['powershell', 'bash', 'batch'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setScriptType(t)}
                    className={`px-2 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${
                      scriptType === t
                        ? 'bg-[#EAA023] text-[#1E2229] font-bold shadow-md'
                        : 'bg-[#15181D] text-white/70 hover:text-white border border-white/5'
                    }`}
                  >
                    {t === 'powershell' ? 'PowerShell' : t === 'bash' ? 'Bash (.sh)' : 'Batch (.bat)'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Vista Previa del Script */}
          <div className="lg:col-span-2 bg-[#2A303C] border border-white/10 rounded-2xl p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#EAA023]" />
                  Script Generado ({scriptType})
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-medium text-white transition-all active:scale-95"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copiado' : 'Copiar'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#EAA023] hover:bg-[#d48f1c] text-[#1E2229] font-bold rounded-xl text-xs transition-all active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar</span>
                  </button>
                </div>
              </div>

              <pre className="bg-[#15181D] border border-white/5 rounded-xl p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-[360px] leading-relaxed">
                {generateScript()}
              </pre>
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
              <span>Compatible con PostgreSQL 14, 15 y 16</span>
              <span className="flex items-center gap-1">
                <RefreshCw className="w-3 h-3 text-[#EAA023]" />
                Listo para automatizar con Task Scheduler o Cron
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
