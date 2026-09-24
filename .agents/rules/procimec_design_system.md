# 📐 SISTEMA DE DISEÑO PROCIMEC: INDUSTRIAL PRECISION

Este documento es de **acatamiento obligatorio** para todo agente de Inteligencia Artificial y desarrollador que diseñe, construya o modifique interfaces dentro del ecosistema de **PROCIMEC** y **PCM CLOUD**.

---

## 1. Identidad de Marca y Colores Institucionales (Basados en el Logo)

La paleta oficial está rigurosamente extraída del logotipo corporativo (`public/logo.png`):

```
Tipografía Principal: "PR - CIMEC"  ──>  Carbón Técnico / Grafito (#1E2229)
Emblema Central:      "O" de Radar  ──>  Ámbar Geofísico de Señal (#EAA023)
Descriptor:           "UNDERGROUND" ──>  Gris Neutro de Estratigrafía (#64748B)
```

### Tokens Cromáticos Obligatorios
- **Primario (Carbón Técnico / Grafito Subterráneo):**
  - `primary-700 / DEFAULT`: `#1E2229` (Color principal de textos prominentes, barras y botones principales).
  - `primary-800`: `#15181D` (Bordes profundos, estados hover oscuros).
  - `primary-900`: `#0C0E11` (Contenedores de instrumental y consolas de visualización).
  - `primary-50`: `#F5F6F8` (Fondos sutiles de selección).
- **Acento (Ámbar Geofísico / Ondas de Georradar):**
  - `accent-500 / DEFAULT`: `#EAA023` (Color de foco, acento, estados de alerta técnica y elementos activos).
  - `accent-600`: `#CE8315` (Hover en botones de acento).
  - `accent-50`: `#FEF9EC` (Fondos de badges o llamadas de atención técnica).
- **Superficies y Bordes:**
  - Fondo general: `#F8FAFC` (Gris técnico claro, no blanco cegador plano).
  - Fondo de tarjeta: `#FFFFFF`.
  - Bordes de tarjeta y tabla: `#E2E8F0` (con matiz sutil, nunca negro plano).
- **Texto:**
  - Primario: `#0F172A` (Slate profundo para máxima legibilidad).
  - Secundario: `#475569` (Etiquetas de formulario y descripciones).
  - Muted: `#94A3B8` (Metadatos y placeholders).
- **Semántica Técnica de Servicios Subterráneos:**
  - Agua potable: `#0284C7` (Azul)
  - Gas: `#EAB308` (Amarillo)
  - Energía eléctrica / Alta tensión: `#DC2626` (Rojo)
  - Telecomunicaciones / Fibra: `#EA580C` (Naranja)
  - Alcantarillado: `#10B981` (Verde)

---

## 2. Tipografía Bimodal y Jerarquía

1. **Tipografía de Interfaz (`font-sans`):** `Inter, system-ui, sans-serif`.
   - Utilizada para encabezados, párrafos, etiquetas de campo y botones.
   - Textos de encabezados deben usar tracking sutil (`tracking-tight`) en títulos y mayúsculas pequeñas espaciadas (`uppercase tracking-wider text-xs font-semibold text-text-secondary`) en encabezados de tabla.
2. **Tipografía de Datos Técnicos (`font-mono`):** `JetBrains Mono, monospace`.
   - **Obligatoria para:** Coordenadas UTM/GPS, frecuencias en GHz/MHz, horas trabajadas, números de reporte, códigos de proyecto, UUIDs, fechas y horas de auditoría.
   - Aporta alineación visual perfecta en columnas y sensación de instrumental de medición.

---

## 3. Directrices Anti-Slop (Erradicación del Diseño Amateur de IA)

Para evitar la estética genérica de plantillas generadas por IA (*AI Slop*):

1. **Zero-Emoji Policy (Estricto):**
   - **Prohibido terminantemente** incluir emojis (`📁`, `👷`, `⚙️`, `⚠️`, `✅`, `🚀`) en componentes de software, botones, badges o encabezados.
   - Todo icono debe ser vectorial mediante **Lucide Icons** con trazo técnico consistente: `strokeWidth={1.75}` o `strokeWidth={1.5}`.
2. **Prohibición de Gradientes Cliché:**
   - Prohibido usar gradientes violeta-azul o fondos de neón.
   - La estética debe ser plana, sobria, con sutiles sombras técnicas (`shadow-card` o `shadow-sm`) y bordes nítidos.
3. **Prohibición de "Tarjetas dentro de Tarjetas":**
   - No anidar cajas con borde dentro de cajas con borde sin necesidad estructural real. Mantener la superficie limpia con separadores de línea fina (`divide-y divide-border`).
4. **Mobile Viewport Stability:**
   - **Prohibido** usar `h-screen` en vistas móviles; usar siempre `min-h-[100dvh]` para evitar desfases con la barra de navegación del navegador móvil.
5. **Erradicación de Spans y Badges Redundantes en Encabezados:**
   - Prohibido saturar los encabezados de formularios o vistas con píldoras o badges de metadatos superfluos (e.g. `[FORMULARIO OPERATIVO]`, `[Catálogo: slug]`).
   - Todo formulario debe emular el estándar limpio de *Inspecciones HSEQ*: `<BackButton href="/dashboard" label="Volver a Mi Panel" />`, título `h1` con icono Lucide (`w-7 h-7 text-accent strokeWidth={1.75}`) y descripción técnica de una sola línea.

---

## 4. Leyes de Microinteracciones y Física de Interfaz (Emil Kowalski)

1. **Física Táctil en Botones:**
   - Todo botón y elemento cliqueable debe contar con respuesta física al presionar:
     ```css
     .btn:active {
       transform: scale(0.98);
     }
     ```
   - Transiciones rápidas y tensas: `transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1)`.
2. **Animaciones con Propósito y Easing Tenso:**
   - **Nunca usar `ease-in`** en la interfaz (se percibe pesado y lento). Usar siempre `ease-out` o la curva personalizada `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`.
   - **Nunca animar desde `scale(0)`**; los elementos que ingresan (modales, popovers) deben animar desde `scale(0.96)` y `opacity: 0`.
   - Duración máxima para animaciones de UI: **200ms a 250ms**.
3. **Zero-Animation en Acciones de Alta Frecuencia:**
   - Paginación, cambio de pestañas de tabla y filtros de búsqueda no deben tener animaciones de entrada lentas; el dato debe presentarse de inmediato.
4. **Origen Espacial:**
   - Los menús contextuales y menús desplegables deben expandirse desde el botón que los detonó (`transform-origin: var(--origin)`), no desde el centro de la pantalla.

---

## 5. Ergonomía de Campo y Accesibilidad (UI-UX Pro Max)

1. **Touch Targets de 44px:**
   - En vistas móviles, ningún botón, toggle o elemento táctil debe tener menos de `44x44px` de área interactiva.
2. **Contraste Solar (4.5:1):**
   - Asegurar que los textos sobre fondos de color cumplan con el ratio de contraste WCAG AA, garantizando legibilidad en campo bajo sol intenso.
3. **Teclados Especializados:**
   - Campos de horas, profundidades, coordenadas y metrajes deben incluir `inputMode="decimal"` o `type="number"` para desplegar teclado numérico nativo inmediato en dispositivos móviles.

---

## 6. Checklist de Calidad Pre-Commit (Pre-Flight Check)

Antes de dar por concluida cualquier modificación visual, el agente debe verificar:
- [ ] ¿Los colores respetan la paleta Carbón (`#1E2229`) y Ámbar (`#EAA023`) del logo?
- [ ] ¿Se erradicó el 100% de emojis sueltos en botones y tablas?
- [ ] ¿Los botones tienen estado `:active` responsivo (`scale-[0.98]`)?
- [ ] ¿Los identificadores técnicos, coordenadas y horas usan fuente `font-mono`?
- [ ] ¿Las alturas de contenedor móvil usan `min-h-[100dvh]`?
- [ ] ¿Se contemplaron estados de carga (*skeleton*), estados vacíos (*empty states*) y desbordamiento de texto (*truncate*)?
