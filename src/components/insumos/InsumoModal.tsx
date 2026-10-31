import React, { useState } from 'react';
import {
  CATEGORIAS_INSUMO,
  calcularCostoUnidadBase,
  formatCostoUnitario,
  resolverConversion,
  unidadesBaseDeCompra,
} from '../../lib/costeo';
import type { UnidadCompra } from '../../lib/costeo';
import type { Insumo } from '../../types/finance';
import { actualizarInsumo, crearInsumo } from '../../services/insumos';
import { AlertCircle, ChevronDown, Loader2, Settings2, X } from 'lucide-react';
import { ETIQUETA_CLASE, INPUT_CLASE, INPUT_NUM_CLASE, OVERLAY_MODAL, PANEL_MODAL } from './estilos';
import { etiquetaUnidad } from './estilos';

interface InsumoModalProps {
  /** Si viene, el modal edita ese insumo; si no, crea uno nuevo. */
  insumo?: Insumo | null;
  onClose: () => void;
  onSaved: (mensaje: string) => void;
}

const numero = (valor: string) => Number(valor) || 0;

/** Etiquetas pensadas para cocina, no para inventario técnico. */
const ETIQUETA_COMPRA: Record<UnidadCompra, string> = {
  kg: 'kilogramos (kg)',
  litro: 'litros (L)',
  pza: 'piezas',
  paquete: 'paquetes',
};

/** Nombre de la unidad base sin abreviaturas para el resumen de costo. */
const nombreUnidadBase = (unidadBase: string) =>
  unidadBase === 'g' ? 'gramo' : unidadBase === 'ml' ? 'ml' : 'pieza';

export const InsumoModal: React.FC<InsumoModalProps> = ({ insumo = null, onClose, onSaved }) => {
  const editando = Boolean(insumo);

  const [nombre, setNombre] = useState(insumo?.nombre ?? '');
  const [categoria, setCategoria] = useState<string>(insumo?.categoria ?? 'Carne');
  const [unidadCompra, setUnidadCompra] = useState<UnidadCompra>(
    (insumo?.unidadCompra as UnidadCompra) ?? 'kg'
  );
  const [cantidadCompra, setCantidadCompra] = useState(insumo ? String(insumo.cantidadCompra) : '1');
  const [precioCompra, setPrecioCompra] = useState(insumo ? String(insumo.precioCompra) : '');
  const [piezasPorPaquete, setPiezasPorPaquete] = useState(
    insumo?.piezasPorPaquete != null ? String(insumo.piezasPorPaquete) : ''
  );
  const [stockActual, setStockActual] = useState(insumo ? String(insumo.stockActual) : '');
  const [stockMinimo, setStockMinimo] = useState(insumo ? String(insumo.stockMinimo) : '');
  const [proveedor, setProveedor] = useState(insumo?.proveedor ?? '');
  const [notas, setNotas] = useState(insumo?.notas ?? '');
  const [avanzado, setAvanzado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview en vivo
  const { unidadBase, factorConversion } = resolverConversion(unidadCompra, numero(piezasPorPaquete));
  const cantidadNum = numero(cantidadCompra);
  const precioNum = numero(precioCompra);
  const costoUnidadBase = calcularCostoUnidadBase(precioNum, cantidadNum, factorConversion);
  const compraCompleta = unidadesBaseDeCompra(cantidadNum, factorConversion);
  const esPaquete = unidadCompra === 'paquete';
  const faltaPiezas = esPaquete && !(numero(piezasPorPaquete) > 0);
  const puedeGuardar = nombre.trim().length > 0 && cantidadNum > 0 && !faltaPiezas && !guardando;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!puedeGuardar) return;

    setGuardando(true);
    setError(null);
    const datos = {
      nombre,
      categoria,
      unidadCompra,
      cantidadCompra: cantidadNum,
      precioCompra: precioNum,
      piezasPorPaquete: esPaquete ? numero(piezasPorPaquete) : null,
      stockActual: stockActual.trim() === '' ? null : numero(stockActual),
      stockMinimo: numero(stockMinimo),
      proveedor,
      notas,
    };

    try {
      if (editando && insumo) {
        await actualizarInsumo(insumo.id, datos);
        onSaved(`Insumo "${nombre.trim()}" actualizado`);
      } else {
        await crearInsumo(datos);
        onSaved('Insumo agregado');
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error('Error al guardar el insumo:', err);
      setError(e?.message || 'No se pudo guardar el insumo en Firestore.');
      setGuardando(false);
    }
  };

  return (
    <div className={OVERLAY_MODAL}>
      <div className={`${PANEL_MODAL} max-w-[560px] p-5 sm:p-7`}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-[21px] sm:text-[23px] font-semibold text-[#1d1d1f] tracking-tight">
              {editando ? 'Editar insumo' : 'Nuevo insumo'}
            </h3>
            <p className="text-[13px] text-[#7a7a7a] mt-1">
              Lo básico: nombre, precio y cuánto trae la compra.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar"
            className="p-2 rounded-full text-[#7a7a7a] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className={ETIQUETA_CLASE}>Nombre *</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Carne molida de res"
              className={INPUT_CLASE}
              required
            />
          </div>

          <div>
            <label className={ETIQUETA_CLASE}>Categoría</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className={`${INPUT_CLASE} cursor-pointer`}
            >
              {CATEGORIAS_INSUMO.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={ETIQUETA_CLASE}>Precio de la compra (MXN) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={precioCompra}
              onChange={(e) => setPrecioCompra(e.target.value)}
              className={INPUT_NUM_CLASE}
              placeholder="450.00"
              required
            />
          </div>

          <div>
            <label className={ETIQUETA_CLASE}>¿Cuánto trae? *</label>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={cantidadCompra}
                onChange={(e) => setCantidadCompra(e.target.value)}
                className={INPUT_NUM_CLASE}
                placeholder={unidadCompra === 'kg' ? '5' : '1'}
                aria-label="Cantidad que trae la compra"
                required
              />
              <select
                value={unidadCompra}
                onChange={(e) => setUnidadCompra(e.target.value as UnidadCompra)}
                aria-label="Unidad de la compra"
                className={`${INPUT_CLASE} cursor-pointer`}
              >
                {(Object.keys(ETIQUETA_COMPRA) as UnidadCompra[]).map((u) => (
                  <option key={u} value={u}>
                    {ETIQUETA_COMPRA[u]}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-[#8e8e93] mt-1">
              Ej. compraste 5 kg de carne por $450 → pon 5 y “kilogramos”.
            </p>
          </div>

          {esPaquete && (
            <div>
              <label className={ETIQUETA_CLASE}>¿Cuántas piezas trae cada paquete? *</label>
              <input
                type="number"
                min="1"
                step="1"
                value={piezasPorPaquete}
                onChange={(e) => setPiezasPorPaquete(e.target.value)}
                className={INPUT_NUM_CLASE}
                placeholder="24"
                required
              />
            </div>
          )}

          {/* Preview en lenguaje simple */}
          {cantidadNum > 0 && precioNum > 0 && (
            <div className="rounded-[14px] bg-[#f5f5f7] border border-[#e0e0e0] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-[#7a7a7a]">
                  Te sale a {formatCostoUnitario(costoUnidadBase)} por {nombreUnidadBase(unidadBase)}
                </span>
                <span className="text-[13px] font-semibold text-[#1d1d1f] whitespace-nowrap">
                  {compraCompleta.toLocaleString('es-MX')} {etiquetaUnidad(unidadBase)}
                </span>
              </div>
            </div>
          )}

          {/* Configuración avanzada */}
          <div className="rounded-[14px] border border-[#e0e0e0] overflow-hidden">
            <button
              type="button"
              onClick={() => setAvanzado((v) => !v)}
              aria-expanded={avanzado}
              className="w-full min-h-[48px] px-4 flex items-center justify-between gap-3 bg-[#f5f5f7] hover:bg-[#e0e0e0] transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 text-[13px] font-semibold text-[#1d1d1f] whitespace-nowrap">
                <Settings2 className="w-4 h-4 text-[#7a7a7a] flex-shrink-0" />
                Configuración Avanzada
                <span className="hidden sm:inline text-[11px] font-normal text-[#8e8e93]">(opcional)</span>
              </span>
              <ChevronDown
                className={`w-4 h-4 text-[#7a7a7a] transition-transform ${avanzado ? 'rotate-180' : ''}`}
              />
            </button>

            {avanzado && (
              <div className="p-4 space-y-4 border-t border-[#e0e0e0]">
                <div className="rounded-[12px] bg-[#f5f5f7] border border-[#e0e0e0] px-3 py-2 text-[12px] text-[#7a7a7a] flex items-center justify-between gap-3">
                  <span>Conversión a unidad base</span>
                  <span className="font-semibold text-[#1d1d1f]">
                    1 {unidadCompra} = {factorConversion || 0} {etiquetaUnidad(unidadBase)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={ETIQUETA_CLASE}>Stock inicial ({etiquetaUnidad(unidadBase)})</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={stockActual}
                      onChange={(e) => setStockActual(e.target.value)}
                      className={INPUT_NUM_CLASE}
                      placeholder={String(compraCompleta || 0)}
                    />
                    <p className="text-[11px] text-[#8e8e93] mt-1">
                      Si lo dejas vacío se asume la compra completa (
                      {compraCompleta.toLocaleString('es-MX')} {etiquetaUnidad(unidadBase)}).
                    </p>
                  </div>

                  <div>
                    <label className={ETIQUETA_CLASE}>Stock mínimo ({etiquetaUnidad(unidadBase)})</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={stockMinimo}
                      onChange={(e) => setStockMinimo(e.target.value)}
                      className={INPUT_NUM_CLASE}
                      placeholder="0"
                    />
                    <p className="text-[11px] text-[#8e8e93] mt-1">
                      La tarjeta se pone roja cuando baja de aquí.
                    </p>
                  </div>
                </div>

                <div>
                  <label className={ETIQUETA_CLASE}>Proveedor (opcional)</label>
                  <input
                    type="text"
                    value={proveedor}
                    onChange={(e) => setProveedor(e.target.value)}
                    className={INPUT_CLASE}
                    placeholder="Ej. Carnicería La Central"
                  />
                </div>

                <div>
                  <label className={ETIQUETA_CLASE}>Notas (opcional)</label>
                  <textarea
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    rows={2}
                    className={`${INPUT_CLASE} resize-none py-3`}
                    placeholder="Ej. Bolsa de 10 medallones"
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start space-x-2 p-3.5 rounded-[12px] bg-[#ff3b30]/5 border border-[#ff3b30]/20">
              <AlertCircle className="w-4 h-4 text-[#ff3b30] flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-[#ff3b30]">{error}</p>
            </div>
          )}

          <div className="sticky bottom-0 -mx-5 sm:static sm:mx-0 bg-white pt-3 flex flex-col gap-3 pb-4 sm:pb-0 sm:gap-0 sm:flex-row sm:items-center sm:justify-end sm:space-x-3 border-t border-[#f0f0f0]">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto min-h-[44px] px-5 rounded-full text-[15px] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!puedeGuardar}
              className="apple-btn-primary w-full sm:w-auto min-h-[44px] text-[15px] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {guardando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>{editando ? 'Guardar cambios' : 'Agregar insumo'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
