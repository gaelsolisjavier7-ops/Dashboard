import React, { useMemo, useState } from 'react';
import type { Insumo, Receta } from '../../types/finance';
import {
  CATEGORIAS_INSUMO,
  formatMXN,
  rendimientoReceta,
  semaforoStock,
  stockAmigable,
} from '../../lib/costeo';
import type { SemaforoStock } from '../../lib/costeo';
import { eliminarInsumo } from '../../services/insumos';
import { InsumoModal } from './InsumoModal';
import { AjusteStockModal } from './AjusteStockModal';
import type { ModoAjuste } from './AjusteStockModal';
import { INPUT_CLASE } from './estilos';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MinusCircle,
  Package,
  Pencil,
  Plus,
  PlusCircle,
  Search,
  Trash2,
} from 'lucide-react';

interface InventarioPanelProps {
  insumos: Insumo[];
  recetas?: Receta[];
  loading: boolean;
  error: Error | null;
  notificar: (mensaje: string, tipo?: 'success' | 'error') => void;
}

type OrdenInsumos = 'nombre' | 'costo' | 'stock';

/** Primero lo que urge comprar; después lo que está más cerca del mínimo. */
const PRIORIDAD_SEMAFORO: Record<SemaforoStock, number> = {
  rojo: 0,
  amarillo: 1,
  verde: 2,
};

/** Emoji por categoría: la pantalla debe sentirse como un menú, no como Excel. */
const EMOJI_CATEGORIA: Record<string, string> = {
  Carne: '🥩',
  'Panadería': '🍞',
  Quesos: '🧀',
  Verduras: '🥬',
  Salsas: '🌶️',
  Papas: '🍟',
  Bebidas: '🥤',
  Extras: '📦',
  Otros: '📦',
};

const COLORES: Record<
  SemaforoStock,
  { borde: string; sombra: string; badge: string; punto: string; etiqueta: string }
> = {
  rojo: {
    borde: '#ff3b30',
    sombra: 'rgba(255, 59, 48, 0.18)',
    badge: 'bg-[#ff3b30]/15 text-[#ff453a] border-[#ff3b30]/40',
    punto: 'bg-[#ff3b30]',
    etiqueta: 'Urgente comprar',
  },
  amarillo: {
    borde: '#ff9500',
    sombra: 'rgba(255, 149, 0, 0.16)',
    badge: 'bg-[#ff9500]/15 text-[#ffb340] border-[#ff9500]/40',
    punto: 'bg-[#ff9500]',
    etiqueta: 'Casi se acaba',
  },
  verde: {
    borde: '#34c759',
    sombra: 'rgba(52, 199, 89, 0.12)',
    badge: 'bg-[#34c759]/15 text-[#4ade80] border-[#34c759]/40',
    punto: 'bg-[#34c759]',
    etiqueta: 'Suficiente',
  },
};

/** Inventario en tarjetas: stock fácil de leer, semáforo y acciones grandes. */
export const InventarioPanel: React.FC<InventarioPanelProps> = ({
  insumos,
  recetas = [],
  loading,
  error,
  notificar,
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const [orden, setOrden] = useState<OrdenInsumos>('stock');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Insumo | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);
  const [ajuste, setAjuste] = useState<{ insumo: Insumo; modo: ModoAjuste } | null>(null);

  const categorias = useMemo(() => {
    const set = new Set(insumos.map((i) => i.categoria));
    return [
      'Todas',
      ...CATEGORIAS_INSUMO.filter((c) => set.has(c)),
      ...[...set].filter((c) => !(CATEGORIAS_INSUMO as readonly string[]).includes(c)),
    ];
  }, [insumos]);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const filtrados = insumos.filter((i) => {
      if (i.activo === false) return false;
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
    else if (orden === 'stock')
      ordenados.sort((a, b) => {
        const urgencia = PRIORIDAD_SEMAFORO[semaforoStock(a)] - PRIORIDAD_SEMAFORO[semaforoStock(b)];
        if (urgencia !== 0) return urgencia;
        const ratio = (i: Insumo) =>
          i.stockMinimo > 0 ? i.stockActual / i.stockMinimo : Number.POSITIVE_INFINITY;
        return ratio(a) - ratio(b);
      });
    else ordenados.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return ordenados;
  }, [insumos, busqueda, categoria, orden]);

  /** Cuántas porciones de cada receta alcanza el stock de un insumo. */
  const usosPorInsumo = useMemo(() => {
    const mapa = new Map<string, { productoNombre: string; cantidad: number }[]>();
    for (const receta of recetas) {
      if (receta.activo === false) continue;
      for (const ingrediente of receta.ingredientes ?? []) {
        if (!ingrediente.insumoId || !(Number(ingrediente.cantidad) > 0)) continue;
        const lista = mapa.get(ingrediente.insumoId) ?? [];
        lista.push({
          productoNombre: receta.productoNombre,
          cantidad: Number(ingrediente.cantidad),
        });
        mapa.set(ingrediente.insumoId, lista);
      }
    }
    return mapa;
  }, [recetas]);

  const alcanzaPara = (insumo: Insumo): { n: number; nombre: string } | null => {
    const usos = usosPorInsumo.get(insumo.id);
    if (!usos || usos.length === 0) return null;

    let limite: { n: number; nombre: string } | null = null;
    for (const uso of usos) {
      const n = rendimientoReceta(insumo.stockActual, uso.cantidad);
      if (!limite || n < limite.n) limite = { n, nombre: uso.productoNombre };
    }
    return limite;
  };

  const resumen = useMemo(() => {
    const activos = insumos.filter((i) => i.activo !== false);
    const conteo: Record<SemaforoStock, number> = { rojo: 0, amarillo: 0, verde: 0 };
    for (const insumo of activos) conteo[semaforoStock(insumo)] += 1;
    return { total: activos.length, ...conteo };
  }, [insumos]);

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

  return (
    <div className="w-full">
      {/* Toolbar: buscador, filtros y alta */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
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
            <option value="stock">Ordenar: urgencia</option>
            <option value="nombre">Ordenar: nombre</option>
            <option value="costo">Ordenar: costo</option>
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

      {/* Resumen del semáforo */}
      {resumen.total > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 text-[12px]">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ff3b30]/10 border border-[#ff3b30]/30 text-[#ff453a] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff3b30]" />
            {resumen.rojo} urgente{resumen.rojo === 1 ? '' : 's'}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ff9500]/10 border border-[#ff9500]/30 text-[#ffb340] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff9500]" />
            {resumen.amarillo} por acabarse
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#34c759]/10 border border-[#34c759]/30 text-[#4ade80] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34c759]" />
            {resumen.verde} con stock
          </span>
        </div>
      )}

      {loading && insumos.length === 0 ? (
        <div className="py-14 text-center glass-card rounded-[20px]">
          <Loader2 className="w-6 h-6 text-[#0a84ff] animate-spin inline-block mb-3" />
          <p className="text-[15px] text-[var(--text-secondary)]">
            Cargando insumos desde Firestore...
          </p>
        </div>
      ) : error ? (
        <div className="flex items-start space-x-2 p-4 rounded-[12px] bg-[#ff3b30]/10 border border-[#ff3b30]/30">
          <AlertCircle className="w-4 h-4 text-[#ff453a] flex-shrink-0 mt-0.5" />
          <p className="text-[14px] text-[#ff453a]">
            No se pudieron leer los insumos: {error.message}
          </p>
        </div>
      ) : insumos.length === 0 ? (
        <div className="glass-card rounded-[20px] text-center py-14 px-4">
          <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto">
            <Package className="w-7 h-7 text-[var(--text-secondary)]" />
          </div>
          <p className="text-[17px] font-semibold text-[var(--text)] mt-4">
            Aún no has cargado insumos
          </p>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1 max-w-[420px] mx-auto">
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
        <div className="glass-card rounded-[20px] text-center py-12">
          <p className="text-[15px] text-[var(--text-secondary)]">
            Ningún insumo coincide con el filtro de búsqueda.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {visibles.map((insumo) => {
              const stock = stockAmigable(insumo);
              const semaforo = semaforoStock(insumo);
              const color = COLORES[semaforo];
              const minimo = stockAmigable({ ...insumo, stockActual: insumo.stockMinimo });
              const receta = alcanzaPara(insumo);
              const confirmando = confirmandoId === insumo.id;

              return (
                <article
                  key={insumo.id}
                  className="glass-card rounded-[20px] p-3.5 sm:p-4 flex flex-col gap-2.5"
                  style={{ border: `2px solid ${color.borde}`, boxShadow: `0 18px 40px ${color.sombra}` }}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span aria-hidden="true" className="text-[26px] leading-none flex-shrink-0">
                      {EMOJI_CATEGORIA[insumo.categoria] ?? EMOJI_CATEGORIA.Otros}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] sm:text-[15px] font-semibold text-[var(--text)] leading-tight line-clamp-2">
                        {insumo.nombre}
                      </h3>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 truncate">
                        {insumo.categoria}
                      </p>
                    </div>
                    <div className="-mr-1 -mt-1 flex flex-col items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => abrirEdicion(insumo)}
                        title="Editar insumo"
                        aria-label={`Editar ${insumo.nombre}`}
                        className="p-1.5 rounded-full text-[var(--text-tertiary)] hover:bg-white/10 hover:text-[#0a84ff] transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmandoId(insumo.id)}
                        title="Eliminar insumo"
                        aria-label={`Eliminar ${insumo.nombre}`}
                        className="p-1.5 rounded-full text-[var(--text-tertiary)] hover:bg-[#ff3b30]/15 hover:text-[#ff453a] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[26px] sm:text-[30px] font-semibold leading-none text-[var(--text)] tabular-nums">
                        {stock.valor}
                      </span>
                      <span className="text-[14px] font-medium text-[var(--text-secondary)]">
                        {stock.unidad}
                      </span>
                    </div>
                    {stock.equivalencia && (
                      <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                        ≈ {stock.equivalencia}
                      </p>
                    )}
                    {insumo.stockMinimo > 0 && (
                      <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                        Mín. {minimo.valor} {minimo.unidad}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${color.badge}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${color.punto}`} />
                      {color.etiqueta}
                    </span>
                    {receta && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-medium text-[var(--text-secondary)]">
                        {receta.n > 0
                          ? `🍔 Alcanza ~${receta.n} ${receta.nombre}`
                          : `⚠️ No alcanza ni 1 ${receta.nombre}`}
                      </span>
                    )}
                  </div>

                  {confirmando ? (
                    <div className="mt-auto rounded-[12px] border border-[#ff3b30]/40 bg-[#ff3b30]/10 p-2">
                      <p className="text-[11px] text-[#ff453a] mb-1.5">¿Eliminar este insumo?</p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleEliminar(insumo)}
                          disabled={borrandoId === insumo.id}
                          className="flex-1 min-h-[36px] rounded-[10px] bg-[#ff3b30] text-white text-[12px] font-semibold hover:bg-[#ff453a] transition-colors cursor-pointer disabled:opacity-60"
                        >
                          {borrandoId === insumo.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                          ) : (
                            'Eliminar'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmandoId(null)}
                          className="flex-1 min-h-[36px] rounded-[10px] bg-white/5 text-[12px] font-semibold text-[var(--text-secondary)] hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAjuste({ insumo, modo: 'compra' })}
                        title={`Compré más ${insumo.nombre}`}
                        className="min-h-[44px] px-1.5 rounded-[12px] border border-[#34c759]/40 bg-[#34c759]/15 text-[#4ade80] text-[12px] font-semibold flex items-center justify-center gap-1 whitespace-nowrap hover:bg-[#34c759]/25 transition-colors cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4 flex-shrink-0" />
                        <span>Compré más</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAjuste({ insumo, modo: 'merma' })}
                        title={`Ajustar o registrar merma de ${insumo.nombre}`}
                        aria-label={`Ajustar o registrar merma de ${insumo.nombre}`}
                        className="min-h-[44px] px-1.5 rounded-[12px] border border-white/10 bg-white/5 text-[var(--text-secondary)] text-[12px] font-semibold flex items-center justify-center gap-1 whitespace-nowrap hover:bg-[#ff9500]/15 hover:text-[#ffb340] hover:border-[#ff9500]/40 transition-colors cursor-pointer"
                      >
                        <MinusCircle className="w-4 h-4 flex-shrink-0" />
                        <span>Ajustar</span>
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="flex items-center space-x-2 pt-4 mt-5 border-t border-[var(--border-soft)] text-[12px] text-[var(--text-secondary)]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              {visibles.length} de {insumos.length} insumo{insumos.length === 1 ? '' : 's'} · valor
              de lo visible:{' '}
              {formatMXN(visibles.reduce((acc, i) => acc + i.stockActual * i.costoUnidadBase, 0))}
            </span>
          </div>
        </>
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

      {ajuste && (
        <AjusteStockModal
          insumo={ajuste.insumo}
          modo={ajuste.modo}
          onClose={() => setAjuste(null)}
          onSaved={(mensaje, tipo) => {
            setAjuste(null);
            notificar(mensaje, tipo);
          }}
        />
      )}
    </div>
  );
};
