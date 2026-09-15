# 🌐 PRODUCT TRUTH & BUSINESS CONTEXT: PROCIMEC / PCM CLOUD

## 1. Visión y Misión del Producto
**PROCIMEC (Procimec Engineering / PCM CLOUD)** es una firma tecnológica y de ingeniería especializada en:
- **3D Underground Mapping:** Cartografía y modelado tridimensional de infraestructura subterránea y redes de servicios públicos (*utility surveys*).
- **Geofísica Aplicada / GPR (Ground Penetrating Radar):** Ensayos no destructivos (NDT) de alta frecuencia para auscultación estructural y localización precisa de tuberías, ductos y anomalías en el subsuelo.
- **Tecnologías Sin Zanja (No-Dig / Trenchless Technology):** Localización y trazado de interferencias para perforación horizontal dirigida y obras civiles de alto impacto.
- **PCM Cloud Services:** Plataforma en la nube para procesamiento, visualización, aseguramiento metrológico y descarga de modelos y radargramas.

**Propósito Central:** Mitigar riesgos catastróficos de rotura o perforación accidental de servicios críticos (gas, alta tensión, fibra óptica, agua), optimizar costos en obra civil y digitalizar la información del subsuelo con exactitud milimétrica.

---

## 2. Arquetipos de Usuario y Contexto de Operación

### A. Operador de Georradar / Técnico de Campo
- **Entorno:** Obras civiles, zanjas viales, subestaciones, refinerías.
- **Dispositivo:** Teléfonos inteligentes y tabletas industriales (Android / iOS).
- **Condiciones:** Luz solar directa, polvo, vibraciones, uso frecuente con guantes o una sola mano.
- **Requisitos de Interfaz:**
  - Botones táctiles grandes (mínimo `44x44px`).
  - Alto contraste solar (mínimo 4.5:1 WCAG AA).
  - Cero lag; navegación fluida sin recargas innecesarias.
  - Teclados numéricos directos (`inputMode="decimal"`) para métricas de campo.
  - Alturas de contenedor `min-h-[100dvh]` para evitar brincos de pantalla cuando se despliega el teclado virtual.

### B. Ingeniero Modelador CAD / BIM / Especialista GPR
- **Entorno:** Oficina técnica, estaciones de trabajo con pantallas duales 4K.
- **Dispositivo:** Escritorio (Chrome / Edge / Firefox).
- **Requisitos de Interfaz:**
  - Densidad de datos equilibrada en tablas y dashboards.
  - Tipografía monoespaciada para metadatos (coordenadas UTM, frecuencias en GHz, códigos de proyecto, horas trabajadas).
  - Visualización técnica sin distracciones, gradientes decorativos absurdos o elementos de fantasía.

### C. Director de Proyecto / Administrador
- **Entorno:** Oficina y movilidad ejecutiva.
- **Objetivo:** Asignación ágil de recursos, control de usuarios, seguimiento de métricas operacionales y auditoría de integridad de datos.
- **Requisitos de Interfaz:**
  - Tablas de control con ordenamiento y filtros instantáneos.
  - Acciones rápidas de cambio de estado con confirmaciones claras y microinteracciones de respuesta física inmediata (`:active`).

---

## 3. Tono, Lenguaje y Vocabulario Técnico
- **Tono:** Sobrio, formal, exacto, confiable y orientado a la ingeniería de precisión.
- **Terminología Oficial Obligatoria:**
  - Proyectos: Usar siempre los códigos canónicos y nombres oficiales de la base de datos (Ley 3 de Arquitectura).
  - Geofísica: *GPR, Radargrama, Ondas Electromagnéticas, Frecuencia de Antena (MHz/GHz), Calibración Dieléctrica*.
  - Entregables: *Plano CAD, Modelo 3D BIM, Nube de Puntos, Ortofoto, As-Built*.
- **Prohibición:** Cero emojis infantiles o decorativos en la interfaz del sistema. Cero lenguaje informal en formularios o tablas.
