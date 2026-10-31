import React, { useMemo, useState } from 'react';
import type { Insumo } from '../../types/finance';
import {
  CATEGORIAS_INSUMO,
  formatCostoUnitario,
  formatMXN,
  redondear,
  stockBajo,
} from '../../lib/costeo';
import { ajustarStockInsumo, eliminarInsumo } from '../../services/insumos';
import { InsumoModal } from './InsumoModal';
import { IconoCategoria } from './IconoCategoria';
import { etiquetaUnidad } from './estilos';
import { INPUT_CLASE } from './estilos';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

interface InventarioPanelProps {
  insumos: Insumo[];
  loading: boolean;
  error: Error | null;
  notificar: (mensaje: string, tipo?: 'success' | 'error') => void;
}

type OrdenInsumos = 'nombre' | 'costo' | 'stock';

const UNIDADES_AJUSTE: Record<string, { unidad: 'g' | 'ml' | 'pza'; factor: number }> = {
  g: { unidad: 'g', factor: 1 },
  gr: { unidad: 'g', factor: 1 },
  grs: { unidad: 'g', factor: 1 },
  gramo: { unidad: 'g', factor: 1 },
  gramos: { unidad: 'g', factor: 1 },
  kg: { unidad: 'g', factor: 1000 },
  kgs: { unidad: 'g', factor: 1000 },
  kilo: { unidad: 'g', factor: 1000 },
  kilos: { unidad: 'g', factor: 1000 },
  kilogramo: { unidad: 'g', factor: 1000 },
  kilogramos: { unidad: 'g', factor: 1000 },
  ml: { unidad: 'ml', factor: 1 },
  mls: { unidad: 'ml', factor: 1 },
  mililitro: { unidad: 'ml', factor: 1 },
  mililitros: { unidad: 'ml', factor: 1 },
  l: { unidad: 'ml', factor: 1000 },
  lt: { unidad: 'ml', factor: 1000 },
  lts: { unidad: 'ml', factor: 1000 },
  litro: { unidad: 'ml', factor: 1000 },
  litros: { unidad: 'ml', factor: 1000 },
  pza: { unidad: 'pza', factor: 1 },
  pzas: { unidad: 'pza', factor: 1 },
  pz: { unidad: 'pza', factor: 1 },
  pieza: { unidad: 'pza', factor: 1 },
  piezas: { unidad: 'pza', factor: 1 },
  u: { unidad: 'pza', factor: 1 },
  unidad: { unidad: 'pza', factor: 1 },
  unidades: { unidad: 'pza', factor: 1 },
};

/**
 * Convierte lo que escribe el usuario ("5000", "5 kg", "1.5 L", "2 pzas") a la
 * unidad base del insumo. Si omite la unidad, se asume la unidad base.
 */
function parsearCantidadAjuste(
  entrada: string,
  unidadBase: string
): { cantidad: number; error: string | null } {
  const texto = entrada
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const match = /^(\d+(?:[.,]\d+)?)\s*([a-z]*)$/.exec(texto);

  if (!match) {
    return { cantidad: 0, error: 'Escribe una cantidad válida (ej. 5000, 5 kg o 2 pzas).' };
  }

  const numero = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(numero) || numero <= 0) {
    return { cantidad: 0, error: 'La cantidad debe ser mayor a 0.' };
  }

  const base: 'g' | 'ml' | 'pza' =
    unidadBase === 'g' || unidadBase === 'ml' ? unidadBase : 'pza';
  const sufijo = match[2];
  if (!sufijo) return { cantidad: numero, error: null };

  const equivalencia = UNIDADES_AJUSTE[sufijo];
  if (!equivalencia) {
    return { cantidad: 0, error: `No reconozco la unidad "${sufijo}". Usa ${etiquetaUnidad(base)}.` };
  }
  if (equivalencia.unidad !== base) {
    return {
      cantidad: 0,
      error: `Este insumo se mide en ${etiquetaUnidad(base)}; escribe la cantidad en esa unidad.`,
    };
  }

  return { cantidad: numero * equivalencia.factor, error: null };
}

/** Tabla/lista de insumos con filtros, alta, edición y borrado inline. */
export const InventarioPanel: React.FC<InventarioPanelProps> = ({
  insumos,
  loading,
  error,
  notificar,
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const [orden, setOrden] = useState<OrdenInsumos>('nombre');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Insumo | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);
  const [ajustando, setAjustando] = useState<{ id: string; delta: number } | null>(null);

  const categorias = useMemo(() => {
    const set = new Set(insumos.map((i) => i.categoria));
    return ['Todas', ...CATEGORIAS_INSUMO.filter((c) => set.has(c)), ...[...set].filter((c) => !CATEGORIAS_INSUMO.includes(c as never))];
  }, [insumos]);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const filtrados = insumos.filter((i) => {
      if (categoria !== 'Todas' && i.categoria !== categoria) return false;
      if (!texto) return true;
      return (
        i.nombre.toLowerCase().includes(texto) ||
        String(i.proveedor ?? '').toLowerCase().includes(texto) ||
        i.categoria.toLowerCase().includes(texto)
      );
    });

    const ordenados = [...filtrados];
    if (orden === 'costo') ordenados.sort((a, b) => b.costoUnidadBase - a.costoUnidadBase);
    else if (orden === 'stock') ordenados.sort((a, b) => a.stockActual - b.stockActual);
    else ordenados.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return ordenados;
  }, [insumos, busqueda, categoria, orden]);

  const abrirNuevo = () => {
    setEditando(null);
    setModalAbierto(true);
  };

  const abrirEdicion = (insumo: Insumo) => {
    setEditando(insumo);
    setModalAbierto(true);
  };

  const handleEliminar = async (insumo: Insumo) => {
    setBorrandoId(insumo.id);
    try {
      await eliminarInsumo(insumo.id);
      notificar(`Insumo "${insumo.nombre}" eliminado`);
      setConfirmandoId(null);
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error('Error al eliminar el insumo:', err);
      notificar(e?.message || 'No se pudo eliminar el insumo.', 'error');
    } finally {
      setBorrandoId(null);
    }
  };

  /**
   * Ajuste rápido desde la tabla: [+] suma stock (compra) y [−] registra una
   * merma. Se pide la cantidad con un prompt para no abrir el modal completo.
   */
  const ajustarStock = async (insumo: Insumo, signo: 1 | -1) => {
    const esSuma = signo > 0;
    const unidad = etiquetaUnidad(insumo.unidadBase);
    const ejemplo =
      insumo.unidadBase === 'g' ? '5 kg o 5000' : insumo.unidadBase === 'ml' ? '1.5 L o 1500' : '2';

    const entrada = window.prompt(
      `${esSuma ? 'Agregar stock' : 'Registrar merma'} · ${insumo.nombre}\n\n` +
        `Stock actual: ${insumo.stockActual.toLocaleString('es-MX')} ${unidad}\n` +
        `Cantidad a ${esSuma ? 'sumar' : 'restar'} (ej. ${ejemplo}):`
    );
    if (entrada === null) return;

    const { cantidad, error } = parsearCantidadAjuste(entrada, insumo.unidadBase);
    if (error) {
      notificar(error, 'error');
      return;
    }

    const cantidadFinal = redondear(cantidad, 4);
    if (!esSuma && cantidadFinal > insumo.stockActual) {
      notificar(
        `No puedes restar ${cantidadFinal.toLocaleString('es-MX')} ${unidad}: el stock actual es ${insumo.stockActual.toLocaleString('es-MX')} ${unidad}.`,
        'error'
      );
      return;
    }

    setAjustando({ id: insumo.id, delta: signo });
    try {
      await ajustarStockInsumo(insumo.id, esSuma ? cantidadFinal : -cantidadFinal);
      notificar(
        `${esSuma ? '+' : '−'}${cantidadFinal.toLocaleString('es-MX')} ${unidad} · ${insumo.nombre}`
      );
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error('Error al ajustar el stock:', err);
      notificar(e?.message || 'No se pudo ajustar el stock.', 'error');
    } finally {
      setAjustando(null);
    }
  };

  const Acciones: React.FC<{ insumo: Insumo }> = ({ insumo }) =>
    confirmandoId === insumo.id ? (
      <div className="flex items-center justify-end space-x-1.5">
        <button
          type="button"
          onClick={() => handleEliminar(insumo)}
          disabled={borrandoId === insumo.id}
          title="Confirmar eliminación"
          className="px-3 min-h-[36px] rounded-full bg-[#ff3b30] text-white text-[12px] font-semibold hover:bg-[#ff453a] transition-colors cursor-pointer disabled:opacity-60"
        >
          {borrandoId === insumo.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Eliminar'}
        </button>
        <button
          type="button"
          onClick={() => setConfirmandoId(null)}
          title="Cancelar"
          className="p-2 rounded-full text-[#7a7a7a] hover:bg-[#f5f5f7] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    ) : (
      <div className="flex items-center justify-end space-x-1">
        <button
          type="button"
          onClick={() => abrirEdicion(insumo)}
          title="Editar insumo"
          className="p-2 rounded-full text-[#7a7a7a] hover:bg-[#f5f5f7] hover:text-[#0066cc] transition-colors cursor-pointer"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setConfirmandoId(insumo.id)}
          title="Eliminar insumo"
          className="p-2 rounded-full text-[#7a7a7a] hover:bg-[#fff0f0] hover:text-[#ff3b30] transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );

  return (
    <div className="w-full">
      {/* Toolbar: buscador, filtros y alta */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-5">
        <div className="relative flex-1 lg:max-w-[380px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8e8e93]" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar insumo por nombre..."
            aria-label="Buscar insumos"
            className={`${INPUT_CLASE} pl-9 ${busqueda ? 'pr-10' : ''}`}
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              title="Limpiar búsqueda"
              aria-label="Limpiar búsqueda"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-[#8e8e93] hover:bg-[#e8e8ed] hover:text-[#1d1d1f] transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            aria-label="Filtrar por categoría"
            className={`${INPUT_CLASE} cursor-pointer min-w-0 lg:w-auto`}
          >
            {categorias.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'Todas' ? 'Todas las categorías' : cat}
              </option>
            ))}
          </select>

          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as OrdenInsumos)}
            aria-label="Ordenar insumos"
            className={`${INPUT_CLASE} cursor-pointer min-w-0 lg:w-auto`}
          >
            <option value="nombre">Ordenar: nombre</option>
            <option value="costo">Ordenar: costo</option>
            <option value="stock">Ordenar: stock</option>
          </select>
        </div>

        <button
          type="button"
          onClick={abrirNuevo}
          className="apple-btn-primary min-h-[44px] text-[15px] whitespace-nowrap cursor-pointer lg:ml-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Insumo</span>
        </button>
      </div>

      {loading && insumos.length === 0 ? (
        <div className="py-14 text-center apple-card bg-white">
          <Loader2 className="w-6 h-6 text-[#0066cc] animate-spin inline-block mb-3" />
          <p className="text-[15px] text-[#7a7a7a]">Cargando insumos desde Firestore...</p>
        </div>
      ) : error ? (
        <div className="flex items-start space-x-2 p-4 rounded-[12px] bg-[#ff3b30]/5 border border-[#ff3b30]/20">
          <AlertCircle className="w-4 h-4 text-[#ff3b30] flex-shrink-0 mt-0.5" />
          <p className="text-[14px] text-[#ff3b30]">
            No se pudieron leer los insumos: {error.message}
          </p>
        </div>
      ) : insumos.length === 0 ? (
        <div className="apple-card bg-white text-center py-14 px-4">
          <div className="w-14 h-14 rounded-full bg-[#f5f5f7] flex items-center justify-center mx-auto">
            <Package className="w-7 h-7 text-[#7a7a7a]" />
          </div>
          <p className="text-[17px] font-semibold text-[#1d1d1f] mt-4">
            Aún no has cargado insumos
          </p>
          <p className="text-[14px] text-[#7a7a7a] mt-1 max-w-[420px] mx-auto">
            Empieza con los básicos: carne, pan, queso, tocino, papas.
          </p>
          <button
            type="button"
            onClick={abrirNuevo}
            className="apple-btn-primary mt-5 text-[14px] py-2 px-5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar el primer insumo</span>
          </button>
        </div>
      ) : visibles.length === 0 ? (
        <div className="apple-card bg-white text-center py-12">
          <p className="text-[15px] text-[#7a7a7a]">
            Ningún insumo coincide con el filtro de búsqueda.
          </p>
        </div>
      ) : (
        <div className="apple-card bg-white p-0 sm:p-6">
          {/* Cabecera de tabla (escritorio) */}
          <div className="hidden sm:grid grid-cols-12 gap-3 px-1 pb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)] border-b border-[var(--border-soft)]">
            <span className="col-span-4">Nombre</span>
            <span className="col-span-2">Categoría</span>
            <span className="col-span-2 text-right">Costo / unidad</span>
            <span className="col-span-2 text-right">Stock</span>
            <span className="col-span-1 text-right">Mínimo</span>
            <span className="col-span-1 text-right">Acciones</span>
          </div>

          <div className="divide-y divide-[#f5f5f7] sm:divide-y">
            {visibles.map((insumo) => {
              const bajo = stockBajo(insumo);
              return (
                <div
                  key={insumo.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center px-4 sm:px-1 py-3.5 hover:bg-[#fafafc] transition-colors"
                >
                  {/* Nombre + categoría (móvil) */}
                  <div className="sm:col-span-4 flex items-center space-x-3 min-w-0">
                    <IconoCategoria categoria={insumo.categoria} />
                    <div className="min-w-0">
                      <span className="text-[15px] font-medium text-[#1d1d1f] block truncate">
                        {insumo.nombre}
                      </span>
                      <span className="text-[12px] text-[#8e8e93] sm:hidden">
                        {insumo.categoria}
                        {insumo.proveedor ? ` · ${insumo.proveedor}` : ''}
                      </span>
                      {insumo.proveedor && (
                        <span className="hidden sm:block text-[12px] text-[#8e8e93] truncate">
                          {insumo.proveedor}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Categoría (escritorio) */}
                  <div className="hidden sm:flex sm:col-span-2 items-center">
                    <span className="text-[13px] text-[#7a7a7a] px-2.5 py-1 rounded-full bg-[#f5f5f7]">
                      {insumo.categoria}
                    </span>
                  </div>

                  {/* Costo por unidad base */}
                  <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-2">
                    <span className="sm:hidden text-[12px] font-semibold uppercase tracking-wide text-[#7a7a7a]">
                      Costo / {etiquetaUnidad(insumo.unidadBase)}
                    </span>
                    <span className="text-[15px] font-semibold text-[#1d1d1f]">
                      {formatCostoUnitario(insumo.costoUnidadBase)}
                    </span>
                  </div>

                  {/* Stock actual + ajuste rápido [-] [+] */}
                  <div className="sm:col-span-2 flex flex-col sm:items-end gap-1.5">
                    <div className="flex w-full items-center justify-between sm:justify-end gap-2">
                      <span className="sm:hidden text-[12px] font-semibold uppercase tracking-wide text-[#7a7a7a]">
                        Stock actual
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void ajustarStock(insumo, -1)}
                          disabled={ajustando?.id === insumo.id}
                          title="Registrar merma (restar stock)"
                          aria-label={`Restar stock de ${insumo.nombre}`}
                          className="w-7 h-7 flex-shrink-0 rounded-full border border-[#d2d2d7] text-[#7a7a7a] hover:border-[#ff3b30] hover:bg-[#fff0f0] hover:text-[#ff3b30] transition-colors cursor-pointer flex items-center justify-center disabled:opacity-40 disabled:cursor-wait"
                        >
                          {ajustando?.id === insumo.id && ajustando.delta < 0 ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Minus className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <span
                          className={`text-[15px] font-semibold tabular-nums ${
                            bajo ? 'text-[#ff3b30]' : 'text-[#1d1d1f]'
                          }`}
                        >
                          {insumo.stockActual.toLocaleString('es-MX')}{' '}
                          <span className="text-[12px] font-normal text-[#7a7a7a]">
                            {etiquetaUnidad(insumo.unidadBase)}
                          </span>
                        </span>

                        <button
                          type="button"
                          onClick={() => void ajustarStock(insumo, 1)}
                          disabled={ajustando?.id === insumo.id}
                          title="Agregar stock (sumar cantidad)"
                          aria-label={`Sumar stock de ${insumo.nombre}`}
                          className="w-7 h-7 flex-shrink-0 rounded-full border border-[#d2d2d7] text-[#7a7a7a] hover:border-[#34c759] hover:bg-[#f0fff4] hover:text-[#248a3d] transition-colors cursor-pointer flex items-center justify-center disabled:opacity-40 disabled:cursor-wait"
                        >
                          {ajustando?.id === insumo.id && ajustando.delta > 0 ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {bajo && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-[#ff3b30]/10 text-[#ff3b30] text-[11px] font-semibold border border-[#ff3b30]/30 whitespace-nowrap">
                        <AlertCircle className="w-3 h-3" />
                        <span>Stock bajo</span>
                      </span>
                    )}
                  </div>

                  {/* Stock mínimo */}
                  <div className="sm:col-span-1 flex items-center justify-between sm:justify-end gap-2">
                    <span className="sm:hidden text-[12px] font-semibold uppercase tracking-wide text-[#7a7a7a]">
                      Stock mínimo
                    </span>
                    <span className="text-[13px] text-[#7a7a7a]">
                      {insumo.stockMinimo.toLocaleString('es-MX')}
                    </span>
                  </div>

                  {/* Acciones */}
                  <div className="sm:col-span-1 flex items-center justify-between sm:justify-end gap-2">
                    <span className="sm:hidden text-[12px] font-semibold uppercase tracking-wide text-[#7a7a7a]">
                      Acciones
                    </span>
                    <Acciones insumo={insumo} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center space-x-2 pt-4 mt-2 border-t border-[#f0f0f0] text-[12px] text-[#8e8e93]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              {visibles.length} de {insumos.length} insumo{insumos.length === 1 ? '' : 's'} · valor
              de lo visible:{' '}
              {formatMXN(visibles.reduce((acc, i) => acc + i.stockActual * i.costoUnidadBase, 0))}
            </span>
          </div>
        </div>
      )}

      {modalAbierto && (
        <InsumoModal
          insumo={editando}
          onClose={() => {
            setModalAbierto(false);
            setEditando(null);
          }}
          onSaved={(mensaje) => {
            setModalAbierto(false);
            setEditando(null);
            notificar(mensaje);
          }}
        />
      )}
    </div>
  );
};
