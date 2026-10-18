/**
 * Catálogo del bot de Telegram: menú, precios y envío.
 *
 * IMPORTANTE: los nombres y precios deben coincidir EXACTAMENTE con
 * `src/lib/products.ts` (MENU_DATA), que es lo que muestra el dashboard.
 * El test `npm run test:bot` compara ambos catálogos y falla si se
 * desincronizan (así un cambio de precio no se queda a medias).
 *
 * Este archivo NO importa nada: se puede importar directo con Node.
 */

export type CategoriaMenu = 'Hamburguesas' | 'Hot Dogs' | 'Extras';

export interface ProductoMenuBot {
  /** Nombre canónico (igual que en el dashboard). */
  nombre: string;
  categoria: CategoriaMenu;
  /** Precio sin papas (único en hamburguesas y extras). */
  precio: number;
  /** Sólo hot dogs: precio cuando el cliente pide "con papas". */
  precioConPapas?: number;
  /** Formas en que un cliente (o Gemini) puede nombrar el producto. */
  alias: string[];
}

export const CARGO_ENVIO = 30;

export const PRODUCTOS: ProductoMenuBot[] = [
  {
    nombre: 'Burger Sencilla',
    categoria: 'Hamburguesas',
    precio: 100,
    alias: ['sencilla', 'hamburguesa sencilla', 'burger sencilla', 'burguer sencilla', 'hamburguesa de res', 'hamburguesa'],
  },
  {
    nombre: 'Burger Tocino',
    categoria: 'Hamburguesas',
    precio: 110,
    alias: ['tocino', 'hamburguesa de tocino', 'burger tocino', 'burguer tocino', 'hamburguesa con tocino'],
  },
  {
    nombre: 'Burger Hawaiana',
    categoria: 'Hamburguesas',
    precio: 125,
    alias: ['hawaiana', 'hamburguesa hawaiana', 'burger hawaiana', 'burguer hawaiana', 'hamburguesa con piña'],
  },
  {
    nombre: 'Burger Especial',
    categoria: 'Hamburguesas',
    precio: 150,
    alias: ['especial', 'burguer especial', 'burger especial', 'hamburguesa especial', 'hamburguesa doble'],
  },
  {
    nombre: 'Burguer de Pollo',
    categoria: 'Hamburguesas',
    precio: 120,
    alias: ['pollo', 'hamburguesa de pollo', 'burger pollo', 'burguer pollo', 'hamburguesa con pollo'],
  },
  {
    nombre: 'Hot Dog Sencillo',
    categoria: 'Hot Dogs',
    precio: 40,
    precioConPapas: 50,
    alias: ['perro sencillo', 'hotdog sencillo', 'jocho sencillo', 'sencillo'],
  },
  {
    nombre: 'Hot Dog Queso',
    categoria: 'Hot Dogs',
    precio: 45,
    precioConPapas: 55,
    alias: ['de queso', 'con queso', 'hotdog queso', 'perro con queso', 'queso'],
  },
  {
    nombre: 'Hot Dog Tocino',
    categoria: 'Hot Dogs',
    precio: 65,
    precioConPapas: 75,
    alias: ['tocino', 'hot dog de tocino', 'hotdog de tocino', 'perro con tocino', 'hot dog tocino'],
  },
  {
    nombre: 'Hot Dog Hawaiano',
    categoria: 'Hot Dogs',
    precio: 70,
    precioConPapas: 75,
    alias: ['hawaiano', 'hot dog de piña', 'hotdog hawaiano', 'perro hawaiano'],
  },
  {
    nombre: 'Hot Dog Combinado',
    categoria: 'Hot Dogs',
    precio: 80,
    precioConPapas: 90,
    alias: ['combinado', 'hot dog con todo', 'hotdog combinado', 'con todo'],
  },
  {
    nombre: 'Papas',
    categoria: 'Extras',
    precio: 50,
    alias: ['papas', 'orden de papas', 'papas a la francesa', 'porcion de papas'],
  },
];

/** Texto del menú que se le pasa a Gemini (idéntico al que pidió el negocio). */
export const MENU_TEXTO = `HAMBURGUESAS: Sencilla $100 | Tocino $110 | Hawaiana $125 | Especial $150 | Pollo $120
HOT DOGS (sin/con papas): Sencillo $40/$50 | Queso $45/$55 | Tocino $65/$75 | Hawaiano $70/$75 | Combinado $80/$90
EXTRAS: Papas $50
ENVÍO: A domicilio $30`;

/** Nombres exactos que debe devolver Gemini para poder casar precios. */
export const NOMBRES_CANONICOS = PRODUCTOS.map((p) => p.nombre);

/** minúsculas, sin acentos y sin puntuación: "Burger Especial!" → "burger especial" */
export function normalizarTexto(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palabras que no distinguen un producto de otro (familia o relleno). */
const PALABRAS_GENERICAS = new Set([
  'hamburguesa', 'hamburguesas', 'burger', 'burgers', 'burguer', 'burguers',
  'hot', 'dog', 'dogs', 'hotdog', 'hotdogs', 'perro', 'perros', 'jocho', 'jochos', 'jumbo', 'jumbos',
  'orden', 'porcion', 'porciones', 'de', 'del', 'la', 'el', 'los', 'las',
  'con', 'sin', 'y', 'a', 'para', 'una', 'uno', 'unos', 'unas', 'mi', 'al',
]);

/** Tokens que sí identifican al producto: "especial", "tocino", "hawaiana"… */
function tokensDistintivos(producto: ProductoMenuBot): string[] {
  const tokens = normalizarTexto([producto.nombre, ...producto.alias].join(' '))
    .split(' ')
    .filter((token) => token.length >= 3 && !PALABRAS_GENERICAS.has(token));
  return [...new Set(tokens)];
}

function familiaDe(texto: string): CategoriaMenu | null {
  // "jumbo" es como el cliente llama al hot dog en este negocio.
  if (/(hot ?dog|hotdog|perro|jocho|jumbo)s?/.test(texto)) return 'Hot Dogs';
  if (/(hamburguesa|burger|burguer)s?/.test(texto)) return 'Hamburguesas';
  if (/\bpapas\b/.test(texto)) return 'Extras';
  return null;
}

/**
 * Encuentra el producto del menú a partir de un texto libre.
 * 1) nombre canónico exacto → 2) alias exacto → 3) familia + tokens distintivos
 * (con plurales: "hamburguesas especiales" → Burger Especial).
 */
export function buscarProducto(entrada: unknown): ProductoMenuBot | null {
  const consulta = normalizarTexto(entrada);
  if (!consulta) return null;

  const porNombre = PRODUCTOS.find((p) => normalizarTexto(p.nombre) === consulta);
  if (porNombre) return porNombre;

  const porAlias = PRODUCTOS.find((p) => p.alias.some((a) => normalizarTexto(a) === consulta));
  if (porAlias) return porAlias;

  const familia = familiaDe(consulta);
  const candidatos = familia ? PRODUCTOS.filter((p) => p.categoria === familia) : PRODUCTOS;
  const tokensConsulta = consulta.split(' ').filter(Boolean);

  let mejor: ProductoMenuBot | null = null;
  let mejorPuntaje = 0;
  let mejorLargo = 0;

  for (const producto of candidatos) {
    let puntaje = 0;
    let masLargo = 0;
    for (const clave of tokensDistintivos(producto)) {
      const coincide = tokensConsulta.some((token) => token.includes(clave) || clave.includes(token));
      if (coincide) {
        puntaje += 1;
        masLargo = Math.max(masLargo, clave.length);
      }
    }
    if (puntaje > mejorPuntaje || (puntaje === mejorPuntaje && puntaje > 0 && masLargo > mejorLargo)) {
      mejor = producto;
      mejorPuntaje = puntaje;
      mejorLargo = masLargo;
    }
  }

  return mejorPuntaje > 0 ? mejor : null;
}

/** Precio del producto (con papas sólo aplica a hot dogs). */
export function precioProducto(nombre: string, conPapas = false): number {
  const producto = PRODUCTOS.find((p) => p.nombre === nombre) ?? buscarProducto(nombre);
  if (!producto) return 0;
  if (conPapas && producto.precioConPapas != null) return producto.precioConPapas;
  return producto.precio;
}

/** ¿El producto admite la variante con papas? */
export function admitePapas(nombre: string): boolean {
  const producto = PRODUCTOS.find((p) => p.nombre === nombre);
  return producto?.precioConPapas != null;
}
