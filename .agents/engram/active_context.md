# ENGRAM — CONTEXTO ACTIVO DEL SISTEMA (PROCIMEC / PCM CLOUD)

> **Inspirado en Gentle-AI & Engram (Gentleman-Programming)**  
> Este documento representa la memoria persistente activa del proyecto. Debe consultarse y mantenerse actualizado por desarrolladores y agentes de IA para evitar amnesia de contexto y código redundante (*slop*).

---

## 🏛️ 1. Arquitectura y Stack Tecnológico
- **Frontend / PWA:** Next.js 14 (App Router), React 18, TypeScript 5, TailwindCSS 3.4.
- **Backend & Base de Datos:** Supabase PostgreSQL con RLS, Serverless Route Handlers en Next.js.
- **Autenticación & Sesión:** NextAuth.js (`getServerSession(authOptions)`).
- **Omnicanalidad:** WhatsApp Bot con Baileys (`bot-whatsapp/` en `.gitignore`).
- **Subsistema de Inteligencia Artificial:** Arquitectura Hexagonal (Ports & Adapters) en `src/core/ai` con validación estricta Zod y Google Gemini AI (modelos gratuitos flash).

---

## 🛡️ 2. Restricciones Críticas y Leyes Fundamentales
1. **Cero Servidores Locales ni Navegadores:** Jamás ejecutar `npm run dev` o abrir navegadores sin orden explícita del usuario (Ley 1).
2. **Compilación Cero Errores:** `npm run type-check` (`tsc --noEmit`) y `npm run test` deben pasar al 100% antes de cualquier commit o push (Ley 1).
3. **Contraste Cromático Sagrado (WCAG AAA):** Prohibido `text-white` sobre fondos o botones ámbar (`#EAA023`, `bg-accent`). Obligatorio `text-primary-900 font-bold` (Ley 5).
4. **Zero-Emoji Policy:** Prohibido el uso de emojis en toda la plataforma; usar exclusivamente iconos de Lucide React con `strokeWidth={1.75}` (Ley 5).
5. **Dualidad Idiomática:** Frontend 100% en Español formal técnico; Backend, tablas y código en inglés canónico (Ley 7).
6. **Hub Centralizado:** Toda la operativa converge en `/dashboard` (Ley 4).

---

## 🤖 3. Módulo Gentle AI y Copiloto Operativo
- **Puerto Agnóstico:** `src/core/ai/domain/ports/ai.port.ts` (`AiPort`).
- **Adaptadores:** `GeminiAdapter` (Google AI Studio) y `MockAdapter` (Testing unitario).
- **Structured Outputs:** Validación con Zod (`fieldExtractionSchema`, `hseqAuditSchema`, `gprSummaryOutputSchema`).
- **Casos de Uso de Aplicación:**
  - `ExtractFieldDataUseCase`: Extracción y estructuración de parámetros a partir de notas de voz/campo.
  - `AuditHseqComplianceUseCase`: Auditoría preventiva pre-firma documental.
  - `GenerateGprSummaryUseCase`: Síntesis técnica ejecutiva para reportes de Georadar con respaldo determinista.
- **Componentes PWA:** `GentleCopilotModal` y `GentleCopilotFloatingButton` disponibles para colaboradores autenticados.
- **Endpoint Seguro:** `app/api/ai/copilot/route.ts` protegido por sesión NextAuth y rate limiting.
