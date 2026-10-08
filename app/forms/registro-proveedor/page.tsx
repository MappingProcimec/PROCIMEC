'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { BackButton } from '@/components/BackButton';
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShoppingBag,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  FileText,
} from 'lucide-react';

const CATEGORIES = [
  'Materiales Pétreos y Áridos',
  'Cementos, Concretos y Prefabricados',
  'Equipos, Andamiaje y Maquinaria',
  'Ferretería y Tornillería General',
  'Herramientas Eléctricas y Manuales',
  'Servicios Técnicos y Especializados',
  'Transporte, Acarreos y Logística',
  'EPP y Seguridad Industrial',
  'Combustibles y Lubricantes',
  'Papelería y Suministros de Oficina',
  'Otro / Suministro Diverso',
];

const PAYMENT_TERMS_OPTIONS = [
  { value: 'Contado', label: 'Pago de Contado contra Entrega' },
  { value: 'Anticipo 50% - Saldo contra Entrega', label: '50% Anticipo - 50% contra Entrega' },
  { value: 'Crédito 15 días', label: 'Crédito a 15 días' },
  { value: 'Crédito 30 días', label: 'Crédito a 30 días' },
  { value: 'Crédito 60 días', label: 'Crédito a 60 días' },
];

export default function RegistroProveedorPage() {
  const router = useRouter();

  // Form State
  const [companyName, setCompanyName] = useState('');
  const [nit, setNit] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [paymentTerms, setPaymentTerms] = useState('Contado');
  const [bankName, setBankName] = useState('');
  const [bankAccountType, setBankAccountType] = useState('Ahorros');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [notes, setNotes] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [registeredSupplier, setRegisteredSupplier] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!companyName.trim()) {
      setErrorMessage('La Razón Social o Nombre de la Empresa es obligatoria.');
      return;
    }
    if (!nit.trim()) {
      setErrorMessage('El NIT o Identificación Tributaria es obligatorio.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        company_name: companyName.trim(),
        nit: nit.trim(),
        contact_name: contactName.trim() || null,
        email: email.trim().toLowerCase() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        category: category.trim(),
        payment_terms: paymentTerms.trim(),
        bank_name: bankName.trim() || null,
        bank_account_type: bankAccountType,
        bank_account_number: bankAccountNumber.trim() || null,
        notes: notes.trim() || null,
      };

      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No fue posible registrar el proveedor.');
      }

      setRegisteredSupplier(data.supplier);
      setIsSuccess(true);
    } catch (err: unknown) {
      console.error('Error al registrar proveedor:', err);
      const msg = err instanceof Error ? err.message : 'Error de comunicación con el servidor.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setCompanyName('');
    setNit('');
    setContactName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setCity('');
    setCategory(CATEGORIES[0]);
    setPaymentTerms('Contado');
    setBankName('');
    setBankAccountType('Ahorros');
    setBankAccountNumber('');
    setNotes('');
    setIsSuccess(false);
    setRegisteredSupplier(null);
    setErrorMessage(null);
  };

  if (isSuccess && registeredSupplier) {
    return (
      <div className="min-h-[100dvh] bg-surface flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-3xl mx-auto px-4 py-10 w-full">
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-card text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-accent text-primary-900 shadow-2xs inline-block mb-3">
              FOR-COM-004 · REGISTRADO
            </span>

            <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-2">
              Proveedor Homologado Exitosamente
            </h2>
            <p className="text-text-secondary text-sm max-w-md mx-auto mb-6">
              <strong className="text-text-primary">{registeredSupplier.company_name}</strong> ha sido vinculado a la base de datos oficial de proveedores de PROCIMEC.
            </p>

            <div className="bg-slate-50 border border-border rounded-xl p-4 text-left max-w-lg mx-auto mb-8 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-text-muted block">Razón Social:</span>
                <span className="font-semibold text-text-primary">{registeredSupplier.company_name}</span>
              </div>
              <div>
                <span className="text-text-muted block">NIT / RUT:</span>
                <span className="font-mono font-bold text-text-primary">{registeredSupplier.nit}</span>
              </div>
              <div>
                <span className="text-text-muted block">Categoría:</span>
                <span className="font-medium text-text-primary">{registeredSupplier.category || 'General'}</span>
              </div>
              <div>
                <span className="text-text-muted block">Condiciones de Pago:</span>
                <span className="font-medium text-text-primary">{registeredSupplier.payment_terms || 'Contado'}</span>
              </div>
              {registeredSupplier.contact_name && (
                <div>
                  <span className="text-text-muted block">Contacto:</span>
                  <span className="font-medium text-text-primary">{registeredSupplier.contact_name}</span>
                </div>
              )}
              {registeredSupplier.phone && (
                <div>
                  <span className="text-text-muted block">Teléfono / WhatsApp:</span>
                  <span className="font-mono font-medium text-text-primary">{registeredSupplier.phone}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/tools/purchasing-dashboard"
                className="w-full sm:w-auto btn bg-accent text-primary-900 font-bold hover:brightness-105 px-6 py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 shadow-xs"
              >
                <ShoppingBag className="w-4 h-4" />
                Ir a Gestión de Compras
              </Link>
              <button
                type="button"
                onClick={handleReset}
                className="w-full sm:w-auto btn bg-white text-text-primary border border-border hover:bg-gray-50 text-xs px-5 py-2.5 rounded-lg flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4 text-text-muted" />
                Registrar Otro Proveedor
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col">
      <Navbar />

      {/* Hero Institucional PROCIMEC */}
      <div className="page-hero">
        <div className="max-w-4xl mx-auto">
          <BackButton href="/dashboard" label="Volver a Mi Panel" />
          <div className="mt-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-primary-900 shadow-sm">
              <Building2 className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-white/10 text-accent border border-accent/30">
                  FOR-COM-004 · v1
                </span>
                <span className="text-xs text-white/60">Gestión de Compras y Suministros</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">
                Registro y Homologación de Proveedores
              </h1>
            </div>
          </div>
          <p className="text-white/70 text-xs sm:text-sm mt-2">
            Ficha técnica obligatoria para la inscripción y actualización de proveedores en el catálogo institucional.
          </p>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto px-4 py-6 w-full">
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3 text-xs">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Error en el registro:</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tarjeta 1: Información Legal y Tributaria */}
          <div className="card bg-white border border-border shadow-card rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-primary-900 flex items-center gap-2 border-b border-border pb-3">
              <Building2 className="w-4 h-4 text-accent" />
              1. Identificación y Razón Social
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Razón Social / Nombre Legal <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ej: Insumos de Ingeniería del Caribe SAS"
                  className="w-full text-xs rounded-lg border border-border bg-white px-3 py-2 text-text-primary focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  NIT / Identificación Tributaria <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nit}
                  onChange={(e) => setNit(e.target.value)}
                  placeholder="Ej: 900.123.456-1"
                  className="w-full text-xs font-mono rounded-lg border border-border bg-white px-3 py-2 text-text-primary focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Categoría / Línea de Suministro <span className="text-accent">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs rounded-lg border border-border bg-white px-3 py-2 text-text-primary focus:ring-1 focus:ring-accent"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Ciudad Principal de Operación
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ej: Barranquilla, Bogotá, Cartagena..."
                  className="w-full text-xs rounded-lg border border-border bg-white px-3 py-2 text-text-primary focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Dirección de Planta / Bodega / Oficina
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ej: Vía 40 # 73 - 290, Zona Industrial"
                  className="w-full text-xs rounded-lg border border-border bg-white px-3 py-2 text-text-primary focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Contacto Comercial y Operativo */}
          <div className="card bg-white border border-border shadow-card rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-primary-900 flex items-center gap-2 border-b border-border pb-3">
              <Phone className="w-4 h-4 text-accent" />
              2. Contacto Comercial y Despachos
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Nombre de Asesor / Contacto
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Ej: Juan Carlos Pérez"
                  className="w-full text-xs rounded-lg border border-border bg-white px-3 py-2 text-text-primary focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Teléfono / Celular / WhatsApp
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: 300 123 4567"
                  className="w-full text-xs font-mono rounded-lg border border-border bg-white px-3 py-2 text-text-primary focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Correo Electrónico de Pedidos
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ventas@proveedor.com"
                  className="w-full text-xs rounded-lg border border-border bg-white px-3 py-2 text-text-primary focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>
          </div>

          {/* Tarjeta 3: Condiciones Comerciales y Bancarias */}
          <div className="card bg-white border border-border shadow-card rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-primary-900 flex items-center gap-2 border-b border-border pb-3">
              <CreditCard className="w-4 h-4 text-accent" />
              3. Condiciones Comerciales y Datos Bancarios
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Condiciones de Pago Habituales <span className="text-accent">*</span>
                </label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full text-xs rounded-lg border border-border bg-white px-3 py-2 text-text-primary focus:ring-1 focus:ring-accent"
                >
                  {PAYMENT_TERMS_OPTIONS.map((term) => (
                    <option key={term.value} value={term.value}>
                      {term.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Entidad Bancaria
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Ej: Bancolombia, Davivienda, etc."
                  className="w-full text-xs rounded-lg border border-border bg-white px-3 py-2 text-text-primary focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Tipo de Cuenta Bancaria
                </label>
                <select
                  value={bankAccountType}
                  onChange={(e) => setBankAccountType(e.target.value)}
                  className="w-full text-xs rounded-lg border border-border bg-white px-3 py-2 text-text-primary focus:ring-1 focus:ring-accent"
                >
                  <option value="Ahorros">Cuenta de Ahorros</option>
                  <option value="Corriente">Cuenta Corriente</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Número de Cuenta Bancaria
                </label>
                <input
                  type="text"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  placeholder="Ej: 123-456789-01"
                  className="w-full text-xs font-mono rounded-lg border border-border bg-white px-3 py-2 text-text-primary focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Observaciones, Condiciones de Flete o Garantías
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Horarios de cargue, fletes incluidos, tiempos promedio de entrega o especificaciones técnicas..."
                  className="w-full text-xs rounded-lg border border-border bg-white px-3 py-2 text-text-primary focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold border border-border text-text-secondary hover:bg-gray-50 text-center transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto btn bg-accent text-primary-900 font-bold hover:brightness-105 active:scale-[0.98] transition-all text-xs px-6 py-2.5 rounded-xl inline-flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-primary-900 border-t-transparent rounded-full animate-spin" />
                  <span>Guardando Proveedor...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Guardar y Homologar Proveedor</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
