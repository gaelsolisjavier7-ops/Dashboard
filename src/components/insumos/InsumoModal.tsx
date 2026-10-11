import React, { useState } from 'react';
import {
  CATEGORIAS_INSUMO,
  UNIDADES_COMPRA,
  calcularCostoUnidadBase,
  formatCostoUnitario,
  resolverConversion,
  unidadesBaseDeCompra,
} from '../../lib/costeo';
import type { UnidadCompra } from '../../lib/costeo';
import type { Insumo } from '../../types/finance';
import { actualizarInsumo, crearInsumo } from '../../services/insumos';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { ETIQUETA_CLASE, INPUT_CLASE, INPUT_NUM_CLASE, OVERLAY_MODAL, PANEL_MODAL } from './estilos';
import { etiquetaUnidad } from './estilos';

interface InsumoModalProps {
  /** Si viene, el modal edita ese insumo; si no, crea uno nuevo. */
  insumo?: Insumo | null;
  onClose: () => void;
  onSaved: (mensaje: string) => void;
}

const numero = (valor: string) => Number(valor) || 0;

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
              El costo por {etiquetaUnidad(unidadBase)} se calcula solo con la regla de conversión.
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <label className={ETIQUETA_CLASE}>Unidad de compra</label>
              <select
                value={unidadCompra}
                onChange={(e) => setUnidadCompra(e.target.value as UnidadCompra)}
                className={`${INPUT_CLASE} cursor-pointer`}
              >
                {UNIDADES_COMPRA.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={ETIQUETA_CLASE}>
                Cantidad de compra ({unidadCompra === 'paquete' ? 'paquetes' : unidadCompra})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={cantidadCompra}
                onChange={(e) => setCantidadCompra(e.target.value)}
                className={INPUT_NUM_CLASE}
                placeholder={unidadCompra === 'kg' ? '5' : '1'}
                required
              />
            </div>

            <div>
              <label className={ETIQUETA_CLASE}>Precio de compra total (MXN)</label>
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
          </div>

          {esPaquete && (
            <div>
              <label className={ETIQUETA_CLASE}>¿Cuántas piezas trae el paquete? *</label>
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

          {/* Preview en vivo */}
          <div className="rounded-[14px] bg-[#f5f5f7] border border-[#e0e0e0] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-[#7a7a7a]">
                Costo por {etiquetaUnidad(unidadBase)}
              </span>
              <span className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight">
                {formatCostoUnitario(costoUnidadBase)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[12px] text-[#7a7a7a] mt-2 pt-2 border-t border-dashed border-[#e0e0e0]">
              <span>Conversión</span>
              <span>
                {cantidadNum || 0} {unidadCompra} × {factorConversion || 0} ={' '}
                {compraCompleta.toLocaleString('es-MX')} {etiquetaUnidad(unidadBase)}
              </span>
            </div>
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
                Si lo dejas vacío se asume la compra completa ({compraCompleta.toLocaleString('es-MX')}{' '}
                {etiquetaUnidad(unidadBase)}).
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
              <p className="text-[11px] text-[#8e8e93] mt-1">Alerta cuando el stock baje de aquí.</p>
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
