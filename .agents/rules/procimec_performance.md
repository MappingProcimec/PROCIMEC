# ESTÁNDARES DE RENDIMIENTO Y ALGORITMIA PROCIMEC (procimec_performance.md)

Este documento establece las reglas obligatorias de eficiencia algorítmica, gestión de memoria y optimización de I/O para el frontend y backend de PROCIMEC.

---

## 1. Reglas de Colecciones y Búsquedas en Memoria (Frontend y Backend)
- **Prohibido el anidamiento O(N * M):** Nunca iterar un arreglo `A` y dentro ejecutar `.find()`, `.filter()` o `.some()` sobre un arreglo `B`.
- **Indexación O(1) Mandatoria:** Cuando se crucen dos colecciones o se resuelvan IDs (ej. proyectos por división, roles por usuario, items de verificación):
  - Pre-indexar `B` en un `Map<ID, Entidad>` o `Map<Clave, Entidad[]>` usando las utilidades de `@/lib/indexing` (`indexBy`, `groupBy`).
  - Consultar mediante `.get(id)` en tiempo $O(1)$.
- **Memoización en React:** En componentes con listas de más de 20 elementos, memoizar los mapas y filtros con `useMemo`.

## 2. Reglas de Base de Datos y Supabase (Reducción de I/O)
- **Prohibido `select('*')` en tablas con binarios/JSON libre:** Tablas como `hseq_drone_inspections` o auditorías que contengan firmas en base64 (`operator_signature_data`) o JSONs voluminosos deben proyectar únicamente las columnas requeridas para listados.
- **Consultas Acotadas (Bounded Queries):** Toda consulta de listado a PostgreSQL en rutas de API debe incluir límite (`limit(50)` o parametrizado) o paginación por cursor/claves. Prohibido transferir conjuntos de datos no acotados a la memoria de Node.js.
- **Evitar N+1 Queries:** Utilizar joins declarativos de Supabase (`select('*, projects(...), users(...)')`) en lugar de consultas en bucles.

## 3. Reglas de I/O Asíncrono y Pipelines de Ejecución
- **Prohibido el "Waterfall" Secuencial de Red:** Cuando una operación de backend realice múltiples llamadas a red que no dependan entre sí (ej. subida a Supabase Storage, subida a Drive, consulta de perfil de usuario, envío de alertas):
  - Ejecutarlas en paralelo utilizando `Promise.allSettled()` o `Promise.all()`.
  - La latencia total del pipeline debe tender a $\max(T_1, \dots, T_n)$ y no a $\sum T_i$.
- **Cero Re-evaluación en Bucles:** Nunca invocar generadores de esquemas, regexes dinámicas o funciones puras estáticas (como `getOptimalResponses`) dentro de un `.map()` o `.forEach()`. Computarlas una única vez fuera del bucle.
