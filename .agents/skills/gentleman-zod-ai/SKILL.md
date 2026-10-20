---
name: gentleman-zod-ai
description: Estándares de desarrollo para salidas estructuradas de IA con validación Zod, Circuit Breakers y resiliencia determinista (Gentleman Programming).
---

# Habilidad: Salidas Estructuradas de IA con Zod & Circuit Breakers

Esta habilidad regula la integración de modelos de lenguaje (LLM) para evitar alucinaciones, respuestas que rompan la UI y garantizar continuidad operativa si la API remota se cae.

## Reglas Obligatorias

1. **Structured Outputs Estrictos:**
   - La IA nunca debe devolver texto plano cuando se espera alimentar componentes o almacenar registros en base de datos.
   - Definir siempre un esquema Zod estricto (`z.object({...})`) con descripciones claras en cada propiedad.
   - Inferir el tipo de TypeScript directamente del esquema: `type MyData = z.infer<typeof mySchema>`.

2. **Validación en Tiempo de Ejecución:**
   - Usar `schema.safeParse(jsonResponse)`.
   - Si la validación falla (`!success`), el adaptador debe registrar los errores de esquema e invocar el reintento o el Circuit Breaker.

3. **Circuit Breaker Determinista (Respaldo Local):**
   - Todo caso de uso que invoque un modelo externo (Gemini, Claude, OpenAI) DEBE tener un método de respaldo local (`buildDeterministicFallback`).
   - Si la cuota de la API se agota (HTTP 429), hay timeout o corte de red, el sistema genera automáticamente un resultado válido utilizando reglas heurísticas o expresiones regulares, sin congelar al usuario ni arrojar pantallas rojas.

4. **Zero-Emoji & Neutralidad Formal:**
   - Todo prompt para reportes oficiales de ingeniería debe ordenar explícitamente: "Cero emojis, en tercera persona, sin introducciones ni despedidas de cortesía".
