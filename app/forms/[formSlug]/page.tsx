'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import { Layers } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import TwoStepForm, { FormConfig, Project } from '@/components/forms/TwoStepForm';
import CadRegisterFormPage from '@/app/forms/cad-register-form/page';
import NewReportPage from '@/app/projects/[projectId]/new-report/page';
import HseqReportFormPage from '@/app/forms/hseq-report/page';
import ElaboracionCartasForm from '@/components/forms/ElaboracionCartasForm';
import RegistroEquipoFormPage from '@/app/forms/registro-equipo/page';

// --- Form catalog configurations ---
const FORM_CONFIGS: Record<string, FormConfig> = {
  'gpr-field-form': {
    name: 'Formulario de Campo GPR',
    description: 'Formulario de reporte operacional de exploración y medición en campo',
    hasAttachments: true,
    step1Fields: [
      {
        key: 'project_id',
        label: 'Proyecto',
        type: 'select',
        required: true,
      },
      {
        key: 'date',
        label: 'Fecha de inspección',
        type: 'date',
        required: true,
      },
      {
        key: 'localizador_name',
        label: 'Localizador / Responsable de campo',
        type: 'text',
        required: true,
        placeholder: 'Nombre completo del localizador',
      },
      {
        key: 'cad_priority',
        label: 'Prioridad de elaboración CAD',
        type: 'select',
        required: true,
        options: [
          { value: 'normal', label: 'Normal' },
          { value: 'media', label: 'Media' },
          { value: 'alta', label: 'Alta' },
          { value: 'urgente', label: 'Urgente' },
        ],
      },
      {
        key: 'notes',
        label: 'Observaciones y comentarios de campo',
        type: 'textarea',
        placeholder: 'Detalles del levantamiento GPR, condiciones climáticas o hallazgos...',
      },
    ],
  },
  'cad-register-form': {
    name: 'Formulario de Registro CAD/BIM',
    description: 'Registro de actividades de modelado y dibujo técnico',
    hasAttachments: false,
    step1Fields: [
      {
        key: 'project_id',
        label: 'Proyecto',
        type: 'select',
        required: true,
      },
      {
        key: 'date',
        label: 'Fecha',
        type: 'date',
        required: true,
      },
      {
        key: 'software',
        label: 'Software utilizado',
        type: 'software-group',
        required: true,
        options: [
          { value: 'civil3d', label: 'Civil 3D' },
          { value: 'revit', label: 'Revit' },
          { value: 'autocad', label: 'AutoCAD' },
          { value: 'otro', label: 'Otro', allowCustom: true },
        ],
      },
      {
        key: 'phase',
        label: 'Fase de entrega',
        type: 'select',
        required: true,
        options: [
          { value: 'preliminar', label: 'Preliminar' },
          { value: 'intermedio', label: 'Intermedio' },
          { value: 'final', label: 'Final' },
          { value: 'revision', label: 'Revisión' },
        ],
      },
      {
        key: 'had_rework',
        label: 'Hubo reproceso',
        type: 'toggle',
      },
      {
        key: 'rework_notes',
        label: 'Observaciones de reproceso',
        type: 'textarea',
        required: true,
        placeholder: 'Describe el motivo del reproceso...',
        conditionalOn: { key: 'had_rework', truthy: true },
      },
      {
        key: 'notes',
        label: 'Notas adicionales',
        type: 'textarea',
        placeholder: 'Opcional...',
      },
    ],
  },

  // ─── COMPRAS (purchasing) ──────────────────────────────────────────────────
  'requerimiento-compra': {
    name: 'Requerimiento de Compra',
    description: 'Solicitud interna de insumos, herramientas o servicios requeridos por proyectos o áreas.',
    hasAttachments: false,
    step1Fields: [
      { key: 'title', label: 'Título / Resumen del Requerimiento', type: 'text', required: true, placeholder: 'Ej: Adquisición de baterías y estacas para Frente Magdalena' },
      { key: 'project_id', label: 'Proyecto u Obra Destino', type: 'select' },
      {
        key: 'category',
        label: 'Categoría de Adquisición',
        type: 'select',
        required: true,
        options: [
          { value: 'repuestos', label: 'Repuestos de Instrumental' },
          { value: 'insumos_campo', label: 'Insumos de Campo (Pintura, Estacas, Cintas)' },
          { value: 'herramientas', label: 'Herramientas Menores y Accesorios' },
          { value: 'servicios', label: 'Servicios Técnicos / Calibración' },
          { value: 'epp', label: 'EPP y Dotación de Seguridad' },
          { value: 'general', label: 'General / Oficina' },
        ],
      },
      {
        key: 'priority',
        label: 'Nivel de Prioridad',
        type: 'select',
        required: true,
        options: [
          { value: 'baja', label: 'Baja (Programable)' },
          { value: 'media', label: 'Media (Estándar 5-7 días)' },
          { value: 'alta', label: 'Alta (Próximas 48h)' },
          { value: 'urgente', label: 'Urgente (Crítico para operación)' },
        ],
      },
      { key: 'required_date', label: 'Fecha Límite Requerida en Obra', type: 'date', required: true },
      { key: 'items_text', label: 'Listado Detallado de Ítems (Descripción, Cantidad y Unidad)', type: 'textarea', required: true, placeholder: '1. Pintura naranja fluo - 12 latas\n2. Estacas de madera 50cm - 100 unidades...' },
      { key: 'justification', label: 'Justificación Operativa de la Necesidad', type: 'textarea', required: true, placeholder: 'Explica el motivo técnico y frente donde se utilizarán...' },
    ],
  },
  'orden-compra': {
    name: 'Orden de Compra y Adjudicación',
    description: 'Registro formal de orden de compra, proveedor seleccionado, condiciones de pago y montos.',
    hasAttachments: true,
    step1Fields: [
      { key: 'order_code', label: 'Código de Orden de Compra (OC)', type: 'text', required: true, placeholder: 'Ej: OC-2026-001' },
      { key: 'project_id', label: 'Proyecto Imputable', type: 'select' },
      { key: 'supplier_name', label: 'Razón Social del Proveedor', type: 'text', required: true, placeholder: 'Ej: TopoEquipos de Colombia SAS' },
      { key: 'supplier_nit', label: 'NIT / Identificación Tributaria', type: 'text', required: true, placeholder: '900.123.456-7' },
      { key: 'total_amount', label: 'Valor Total Aprobado (COP)', type: 'number', required: true, placeholder: 'Monto con impuestos incluidos' },
      { key: 'delivery_deadline', label: 'Fecha Pactada de Entrega', type: 'date', required: true },
      {
        key: 'payment_terms',
        label: 'Condiciones Comerciales y de Pago',
        type: 'select',
        required: true,
        options: [
          { value: 'contado', label: 'Pago de Contado contra Entrega' },
          { value: 'credito_15', label: 'Crédito a 15 días' },
          { value: 'credito_30', label: 'Crédito a 30 días' },
          { value: 'anticipo_50', label: '50% Anticipo - 50% contra Entrega' },
        ],
      },
      { key: 'notes', label: 'Observaciones y Términos de Garantía', type: 'textarea', placeholder: 'Garantía del fabricante, lugar de entrega en bodega o frente...' },
    ],
  },
  'evaluacion-proveedor': {
    name: 'Evaluación y Recepción de Proveedor',
    description: 'Calificación de calidad, tiempos de entrega y nivel de servicio de compras recibidas.',
    hasAttachments: false,
    step1Fields: [
      { key: 'supplier_name', label: 'Proveedor Evaluado', type: 'text', required: true, placeholder: 'Nombre del proveedor' },
      {
        key: 'quality_score',
        label: 'Calidad del Producto o Servicio (1 al 5)',
        type: 'select',
        required: true,
        options: [
          { value: '5', label: '5 - Excelente (Cumple 100% especificaciones técnicas)' },
          { value: '4', label: '4 - Bueno (Detalles menores sin impacto operacional)' },
          { value: '3', label: '3 - Aceptable (Cumple estándar mínimo)' },
          { value: '2', label: '2 - Regular (Presentó defectos o inconsistencias)' },
          { value: '1', label: '1 - Deficiente (No cumple requisitos)' },
        ],
      },
      {
        key: 'delivery_time_score',
        label: 'Cumplimiento en Tiempos de Entrega (1 al 5)',
        type: 'select',
        required: true,
        options: [
          { value: '5', label: '5 - A tiempo (En o antes de la fecha pactada)' },
          { value: '4', label: '4 - Retraso leve (1 a 2 días con aviso previo)' },
          { value: '3', label: '3 - Retraso moderado (3 a 5 días)' },
          { value: '2', label: '2 - Retraso significativo (Más de una semana)' },
          { value: '1', label: '1 - Incumplimiento crítico de plazo' },
        ],
      },
      {
        key: 'service_score',
        label: 'Atención al Cliente y Soporte Post-Venta (1 al 5)',
        type: 'select',
        required: true,
        options: [
          { value: '5', label: '5 - Excelente atención y respuesta inmediata' },
          { value: '4', label: '4 - Buena atención y diligencia' },
          { value: '3', label: '3 - Aceptable' },
          { value: '2', label: '2 - Difícil comunicación' },
          { value: '1', label: '1 - Pésima atención' },
        ],
      },
      {
        key: 'recommend_supplier',
        label: '¿Recomienda a este proveedor para futuras adquisiciones?',
        type: 'select',
        required: true,
        options: [
          { value: 'yes', label: 'Sí, totalmente recomendado' },
          { value: 'conditional', label: 'Sí, bajo condiciones estrictas' },
          { value: 'no', label: 'No recomendado' },
        ],
      },
      { key: 'comments', label: 'Comentarios y Justificación de Calificación', type: 'textarea', placeholder: 'Observaciones sobre el embalaje, certificados de calidad o novedades...' },
    ],
  },

  // ─── COMERCIAL (commercial) ────────────────────────────────────────────────
  'registro-oportunidad': {
    name: 'Registro de Oportunidad / Licitación',
    description: 'Captura de requerimientos de clientes, pliegos licitatorios y solicitudes comerciales.',
    hasAttachments: false,
    step1Fields: [
      { key: 'opportunity_title', label: 'Nombre de la Oportunidad / Licitación', type: 'text', required: true, placeholder: 'Ej: Exploración GPR Troncal 4G Consorcio Vial' },
      { key: 'client_name', label: 'Empresa o Cliente Potencial', type: 'text', required: true, placeholder: 'Ej: Consorcio Vías del Norte' },
      { key: 'client_contact', label: 'Persona de Contacto', type: 'text', required: true, placeholder: 'Ing. Carlos Mendoza' },
      { key: 'client_email', label: 'Correo Electrónico', type: 'text', required: true, placeholder: 'carlos.mendoza@empresa.com' },
      { key: 'client_phone', label: 'Teléfono / Móvil', type: 'text', placeholder: '+57 300 123 4567' },
      {
        key: 'service_type',
        label: 'Línea de Servicio Principal',
        type: 'select',
        required: true,
        options: [
          { value: 'gpr_localizacion', label: 'Georradar GPR y Localización de Redes' },
          { value: 'topografia_cad', label: 'Topografía de Precisión y Modelado CAD/BIM' },
          { value: 'inspeccion_dron', label: 'Inspección Aérea y Fotogrametría Dron' },
          { value: 'geofisica_integral', label: 'Geofísica Integral (Tomografía, MASW, SEV)' },
          { value: 'consultoria', label: 'Consultoría y Diseño de Infraestructura' },
        ],
      },
      { key: 'estimated_value', label: 'Presupuesto Estimado del Cliente (COP)', type: 'number', placeholder: 'Monto aproximado' },
      { key: 'deadline_date', label: 'Fecha Límite de Entrega de Propuesta', type: 'date', required: true },
      { key: 'location', label: 'Ubicación Geográfica del Proyecto', type: 'text', required: true, placeholder: 'Municipio, Departamento' },
      { key: 'notes', label: 'Alcance Solicitado y Requerimientos Clave', type: 'textarea', placeholder: 'Metros lineales estimados, tipos de tubería, pliego de condiciones...' },
    ],
  },
  'cotizacion-comercial': {
    name: 'Cotización Comercial Emitida',
    description: 'Registro formal de propuesta económica y técnica presentada al cliente.',
    hasAttachments: true,
    step1Fields: [
      { key: 'quote_code', label: 'Código de Cotización Comercial', type: 'text', required: true, placeholder: 'Ej: COT-2026-015' },
      { key: 'client_name', label: 'Cliente / Razón Social', type: 'text', required: true, placeholder: 'Razón social del cliente' },
      { key: 'scope_description', label: 'Alcance Técnico Ofertado', type: 'textarea', required: true, placeholder: 'Metros lineales de GPR, frentes de topografía, entregables...' },
      { key: 'subtotal', label: 'Valor Subtotal (COP, Antes de IVA)', type: 'number', required: true, placeholder: 'Subtotal en pesos colombianos' },
      { key: 'tax_amount', label: 'Valor del IVA (19%)', type: 'number', placeholder: 'IVA aplicable' },
      { key: 'total_amount', label: 'Valor Total Ofertado con IVA (COP)', type: 'number', required: true, placeholder: 'Monto total de la cotización' },
      { key: 'validity_days', label: 'Validez de la Oferta (Días Calendario)', type: 'number', required: true, placeholder: '30' },
      { key: 'delivery_weeks', label: 'Plazo Estimado de Ejecución (Semanas)', type: 'number', required: true, placeholder: '2' },
      { key: 'notes', label: 'Condiciones Comerciales y Forma de Pago', type: 'textarea', placeholder: 'Anticipos, actas de entrega, exclusiones operativas...' },
    ],
  },
  'cierre-comercial': {
    name: 'Cierre de Negociación',
    description: 'Registro del desenlace comercial de la oferta: adjudicada, perdida o desierta.',
    hasAttachments: false,
    step1Fields: [
      { key: 'quote_code', label: 'Código de Cotización Negociada', type: 'text', required: true, placeholder: 'Ej: COT-2026-015' },
      { key: 'client_name', label: 'Cliente', type: 'text', required: true, placeholder: 'Nombre del cliente' },
      {
        key: 'result',
        label: 'Resultado Final de la Negociación',
        type: 'select',
        required: true,
        options: [
          { value: 'won', label: 'Adjudicada / Ganada (Firma de Contrato u OS)' },
          { value: 'lost', label: 'No Adjudicada / Perdida ante Competencia' },
          { value: 'cancelled', label: 'Cancelada / Pliego Declarado Desierto' },
        ],
      },
      { key: 'final_contract_value', label: 'Valor Final de Cierre (COP)', type: 'number', placeholder: 'Valor acordado si fue adjudicada' },
      { key: 'contract_number', label: 'Número de Contrato u Orden de Servicio', type: 'text', placeholder: 'Ej: OS-7842' },
      {
        key: 'loss_reason',
        label: 'Motivo de Pérdida o Deserción',
        type: 'select',
        options: [
          { value: 'precio', label: 'Precio más alto que la competencia' },
          { value: 'plazo', label: 'Tiempos de entrega exigidos por el cliente' },
          { value: 'tecnico', label: 'Especificaciones técnicas o equipo no disponible' },
          { value: 'cliente_cancelo', label: 'El cliente canceló o suspendió el proyecto' },
          { value: 'otro', label: 'Otro motivo comercial' },
        ],
      },
      { key: 'closing_notes', label: 'Conclusiones y Lecciones Aprendidas', type: 'textarea', placeholder: 'Detalles de la decisión del cliente y recomendaciones para futuras ofertas...' },
    ],
  },

  // ─── FINANZAS (finance) ────────────────────────────────────────────────────
  'solicitud-viaticos': {
    name: 'Solicitud de Viáticos y Anticipos',
    description: 'Petición formal de fondos para comisiones de campo, combustible, peajes y hospedajes.',
    hasAttachments: false,
    step1Fields: [
      { key: 'project_id', label: 'Proyecto Imputable', type: 'select', required: true },
      { key: 'beneficiary_name', label: 'Colaborador Beneficiario', type: 'text', required: true, placeholder: 'Nombre completo de quien recibe el anticipo' },
      { key: 'beneficiary_document', label: 'Cédula de Ciudadanía', type: 'text', required: true, placeholder: 'Número de documento de identidad' },
      { key: 'destination', label: 'Ciudad o Municipio de Destino', type: 'text', required: true, placeholder: 'Ej: Aguachica, Cesar' },
      { key: 'departure_date', label: 'Fecha de Salida', type: 'date', required: true },
      { key: 'return_date', label: 'Fecha Estimada de Retorno', type: 'date', required: true },
      { key: 'estimated_transport', label: 'Transporte y Taxis (COP)', type: 'number', placeholder: 'Estimado pasajes o traslados' },
      { key: 'estimated_lodging', label: 'Hospedaje (COP)', type: 'number', placeholder: 'Estimado noches de hotel' },
      { key: 'estimated_meals', label: 'Alimentación (COP)', type: 'number', placeholder: 'Estimado alimentación cuadrilla' },
      { key: 'estimated_tolls_fuel', label: 'Combustible y Peajes (COP)', type: 'number', placeholder: 'Estimado peajes y gasolina' },
      { key: 'estimated_total', label: 'Total Anticipo Solicitado (COP)', type: 'number', required: true, placeholder: 'Monto total requerido' },
      { key: 'notes', label: 'Detalles del Itinerario y Justificación', type: 'textarea', placeholder: 'Personal que viaja, rutas a cubrir y cronograma de comisiones...' },
    ],
  },
  'legalizacion-gastos': {
    name: 'Legalización y Rendición de Gastos',
    description: 'Rendición pormenorizada de comprobantes de gastos ejecutados contra anticipos recibidos.',
    hasAttachments: true,
    step1Fields: [
      { key: 'project_id', label: 'Proyecto Imputable', type: 'select', required: true },
      { key: 'beneficiary_name', label: 'Colaborador que Legaliza', type: 'text', required: true, placeholder: 'Nombre del colaborador' },
      { key: 'advancement_amount', label: 'Monto del Anticipo Recibido (COP)', type: 'number', required: true, placeholder: 'Valor desembolsado por Tesorería' },
      { key: 'total_spent', label: 'Total Gastos con Soporte (COP)', type: 'number', required: true, placeholder: 'Suma de todas las facturas y recibos' },
      { key: 'balance', label: 'Saldo Resultante (COP)', type: 'number', required: true, placeholder: 'Positivo: A reintegrar | Negativo: Reembolso a favor' },
      { key: 'receipts_summary', label: 'Relación de Comprobantes (Fecha, NIT, Proveedor, Concepto, Valor)', type: 'textarea', required: true, placeholder: '1. Factura Hotel Sol - $250.000\n2. Peaje Río Bogotá - $14.500...' },
      { key: 'notes', label: 'Observaciones y Aclaraciones de Soportes', type: 'textarea', placeholder: 'Comentarios sobre recibos no formales o saldos por devolver a la empresa...' },
    ],
  },
  'registro-pago': {
    name: 'Comprobante de Egreso y Pago',
    description: 'Captura de comprobante bancario, transferencias realizadas y soportes contables.',
    hasAttachments: true,
    step1Fields: [
      { key: 'payment_date', label: 'Fecha de Ejecución del Pago', type: 'date', required: true },
      { key: 'payment_concept', label: 'Concepto del Desembolso', type: 'text', required: true, placeholder: 'Ej: Anticipo Viáticos Frente Tolima / Pago Factura Proveedor' },
      { key: 'recipient_name', label: 'Beneficiario / Razón Social', type: 'text', required: true, placeholder: 'Nombre o empresa que recibe el pago' },
      { key: 'recipient_nit', label: 'NIT / Cédula del Beneficiario', type: 'text', placeholder: 'Documento tributario' },
      { key: 'amount', label: 'Valor Desembolsado (COP)', type: 'number', required: true, placeholder: 'Monto transferido' },
      {
        key: 'bank_source',
        label: 'Cuenta Bancaria de Origen',
        type: 'select',
        required: true,
        options: [
          { value: 'Bancolombia Cta Cte', label: 'Bancolombia Cuenta Corriente' },
          { value: 'Davivienda Ahorros', label: 'Davivienda Cuenta de Ahorros' },
          { value: 'Caja Menor Central', label: 'Caja Menor Central PROCIMEC' },
        ],
      },
      { key: 'transaction_reference', label: 'Número de Aprobación / Comprobante Bancario', type: 'text', required: true, placeholder: 'Número de referencia bancaria' },
      { key: 'notes', label: 'Notas Contables / Centro de Costo Imputable', type: 'textarea', placeholder: 'Imputación contable o notas internas de Tesorería...' },
    ],
  },

  // ─── CONTABILIDAD (accounting) ─────────────────────────────────────────────
  'radicacion-factura': {
    name: 'Radicación de Factura Proveedor',
    description: 'Entrada y registro de facturas de proveedores para trámite de causación y pago.',
    hasAttachments: true,
    step1Fields: [
      { key: 'invoice_number', label: 'Número de Factura Electrónica / Documento', type: 'text', required: true, placeholder: 'Ej: FE-10492' },
      { key: 'supplier_name', label: 'Razón Social del Proveedor', type: 'text', required: true, placeholder: 'Nombre del proveedor' },
      { key: 'supplier_nit', label: 'NIT / RUT del Proveedor', type: 'text', required: true, placeholder: '900.852.147-3' },
      { key: 'project_id', label: 'Centro de Costos / Proyecto Imputable', type: 'select' },
      { key: 'issue_date', label: 'Fecha de Emisión de la Factura', type: 'date', required: true },
      { key: 'due_date', label: 'Fecha Límite de Vencimiento de Pago', type: 'date', required: true },
      { key: 'subtotal', label: 'Subtotal Facturado (Antes de IVA)', type: 'number', required: true, placeholder: 'Subtotal en COP' },
      { key: 'tax_amount', label: 'IVA Facturado (19%)', type: 'number', placeholder: 'Valor IVA' },
      { key: 'withholding_tax', label: 'Retención en la Fuente Aplicada (COP)', type: 'number', placeholder: 'Retefuente estimada' },
      { key: 'total_amount', label: 'Valor Total Neto a Pagar (COP)', type: 'number', required: true, placeholder: 'Monto a pagar' },
      { key: 'concept', label: 'Concepto Detallado del Gasto o Servicio', type: 'textarea', required: true, placeholder: 'Descripción de los insumos o servicios facturados...' },
    ],
  },
  'soporte-cobro': {
    name: 'Soporte de Cobro y Facturación',
    description: 'Registro de corte de obra y actas de interventoría aprobadas para facturar al cliente.',
    hasAttachments: true,
    step1Fields: [
      { key: 'project_id', label: 'Proyecto Imputable', type: 'select', required: true },
      { key: 'client_name', label: 'Cliente / Razón Social a Facturar', type: 'text', required: true, placeholder: 'Nombre del cliente' },
      { key: 'cut_period_start', label: 'Fecha de Inicio del Periodo de Corte', type: 'date', required: true },
      { key: 'cut_period_end', label: 'Fecha de Fin del Periodo de Corte', type: 'date', required: true },
      { key: 'delivered_ml', label: 'Metros Lineales (ML) Ejecutados y Aprobados', type: 'number', placeholder: 'ML reconocidos en el acta' },
      { key: 'delivered_m2', label: 'Metros Cuadrados (M2) Ejecutados y Aprobados', type: 'number', placeholder: 'M2 reconocidos en el acta' },
      { key: 'amount_to_bill', label: 'Monto Bruto a Facturar (COP)', type: 'number', required: true, placeholder: 'Valor acordado en acta de obra' },
      { key: 'acta_number', label: 'Número de Acta de Obra / Radicado de Interventoría', type: 'text', required: true, placeholder: 'Ej: ACTA-03-CORTE' },
      { key: 'approver_client_name', label: 'Nombre del Interventor o Ingeniero que Aprobó', type: 'text', required: true, placeholder: 'Ing. Supervisor de Obra' },
      { key: 'notes', label: 'Observaciones sobre Deducciones o Amortización de Anticipo', type: 'textarea', placeholder: 'Detalles de amortización, retenciones de garantía contractual...' },
    ],
  },
};

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects');
  const json = await res.json();
  return json.data ?? [];
}

// --- Inner component ---
function FormPageInner({ params }: { params: { formSlug: string } }) {
  const { formSlug } = params;
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') ?? undefined;
  const router = useRouter();

  const config = FORM_CONFIGS[formSlug] ?? {
    name: `Formulario: ${formSlug}`,
    description: 'Formulario activo del catálogo',
    hasAttachments: true,
    step1Fields: [
      { key: 'project_id', label: 'Proyecto', type: 'select', required: true },
      { key: 'date', label: 'Fecha', type: 'date', required: true },
      { key: 'localizador_name', label: 'Responsable', type: 'text', required: true },
      { key: 'notes', label: 'Observaciones', type: 'textarea' },
    ],
  };

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const handleSubmit = async (data: Record<string, unknown>) => {
    const targetSlug = formSlug === 'gpr-field-form' ? 'gpr-field-form' : formSlug;
    const res = await fetch(`/api/forms/${targetSlug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, project_id: projectId ?? data.project_id }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Error al enviar formulario');
    router.push(projectId ? `/projects/${projectId}` : '/dashboard');
  };

  const backUrl = projectId ? `/projects/${projectId}` : '/dashboard';
  const backLabel = projectId ? 'Volver al Proyecto' : 'Volver a Mi Panel';

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="page-hero">
        <div className="max-w-2xl mx-auto">
          <BackButton href={backUrl} label={backLabel} />
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3 flex items-center gap-2.5">
            <Layers className="w-7 h-7 text-accent" strokeWidth={1.75} /> {config.name}
          </h1>
          {config.description && (
            <p className="text-white/70 text-sm mt-1">{config.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-6 pb-20">
        <TwoStepForm
          formConfig={config}
          formSlug={formSlug}
          projectId={projectId}
          projects={projects}
          onSubmit={handleSubmit}
          backHref={backUrl}
        />
      </div>
    </div>
  );
}

// --- Main Page ---
export default function FormPage({ params }: { params: { formSlug: string } }) {
  if (
    params.formSlug === 'nueva-actividad' ||
    params.formSlug === 'cad-register-form' ||
    params.formSlug === 'cad-register'
  ) {
    return <CadRegisterFormPage />;
  }

  if (params.formSlug === 'gpr-field-form' || params.formSlug === 'gpr-report') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-surface flex items-center justify-center text-text-muted">Cargando formulario de campo...</div>}>
        <NewReportPage />
      </Suspense>
    );
  }

  if (params.formSlug === 'hseq-report' || params.formSlug === 'hseq') {
    return <HseqReportFormPage />;
  }

  if (
    params.formSlug === 'elaboracion-cartas' ||
    params.formSlug === 'cartas' ||
    params.formSlug === 'cartas-rrhh'
  ) {
    return <ElaboracionCartasForm />;
  }

  if (
    params.formSlug === 'registro-equipo' ||
    params.formSlug === 'alta-equipo' ||
    params.formSlug === 'equipo-nuevo' ||
    params.formSlug === 'despacho-equipo' ||
    params.formSlug === 'salida-equipo' ||
    params.formSlug === 'despacho' ||
    params.formSlug === 'retorno-equipo' ||
    params.formSlug === 'reingreso-equipo' ||
    params.formSlug === 'retorno'
  ) {
    return <RegistroEquipoFormPage />;
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-surface flex items-center justify-center text-text-muted">Cargando formulario...</div>}>
      <FormPageInner params={params} />
    </Suspense>
  );
}
