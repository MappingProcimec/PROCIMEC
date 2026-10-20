# ENGRAM — REGISTRO DE DECISIONES DE ARQUITECTURA (ADR)

> **Inspirado en Gentle-AI & Engram (Gentleman-Programming)**  
> Registro inmutable de decisiones técnicas para garantizar coherencia en el ciclo de vida del software.

---

## ADR-001: Adopción de Arquitectura Hexagonal para el Subsistema de IA
* **Fecha:** 2026-10-20
* **Estado:** Aceptado e Implementado
* **Contexto:**
  Anteriormente, las llamadas a Google Gemini estaban acopladas directamente a `fetch` dentro de librerías de reportes (`src/lib/gpr/geminiGprSummary.ts`) y route handlers. Esto dificultaba la portabilidad a otros LLMs, el testing automatizado y la resiliencia en caso de cortes de cuota.
* **Decisión:**
  Implementar la arquitectura limpia de puertos y adaptadores (Gentleman Programming):
  1. Definición del contrato agnóstico `AiPort`.
  2. Implementación de `GeminiAdapter` y `MockAdapter`.
  3. Validación de salidas mediante esquemas Zod (*Structured Outputs* tipados).
  4. Encapsulación de lógica en Casos de Uso (`src/core/ai/application/use-cases`).
  5. Inclusión obligatoria de Circuit Breakers deterministas (fallback local sin IA).
* **Consecuencias:**
  - Código desacoplado y 100% testeable sin realizar llamadas de red de pago.
  - Cero roturas en la UI por respuestas no estructuradas del modelo.
  - Facilidad para alternar o combinar proveedores (Gemini, Claude, Ollama, DeepSeek) sin tocar componentes visuales.

---

## ADR-002: Copiloto Asistencial PWA con Dictado por Voz y Pre-Auditoría
* **Fecha:** 2026-10-20
* **Estado:** Aceptado e Implementado
* **Contexto:**
  Las cuadrillas de geofísica y topografía operan en campo bajo condiciones adversas (luz solar, guantes, polvo), lo que dificulta el diligenciamiento manual de métricas y formularios en pantallas móviles.
* **Decisión:**
  Crear el componente `GentleCopilotModal` integrado a la PWA con:
  1. Soporte para dictado por voz (Web Speech Recognition API).
  2. Extracción instantánea de ML, m², redes detectadas y anomalías.
  3. Pre-auditoría de conformidad HSEQ antes de la firma digital (respetando Ley 3 y Ley 8).
  4. Botón flotante accesible solo para usuarios autenticados.
* **Consecuencias:**
  - Aumento de productividad y reducción drástica de errores de digitación en campo.
  - Filtro preventivo de calidad documental previo al almacenamiento en Supabase.
