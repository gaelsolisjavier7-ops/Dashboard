#  Apple Finance — Gestor de Finanzas Personales & Negocios

Aplicación web desarrollada en **React 19**, **TypeScript**, **Vite** y **Tailwind CSS**, diseñada bajo los principios y especificaciones visuales de **Apple Design Analysis** para gestionar de forma integral finanzas personales y dos unidades de negocio:
1. **Hamburguesas** (Local de smash burgers y delivery)
2. **Reventa de AirPods** (Comercialización de tecnología y gadgets)
3. **Finanzas Personales** (Gastos de vida, ahorros y retiros de utilidades)

---

## 🌟 Características Principales

### 1. Registro de Ingresos y Gastos con Categoría
- Selector dinámico por entidad: **Personal**, **Hamburguesas** y **AirPods**.
- Categorías contextuales predeterminadas para cada modelo de negocio (ej. Carne & Pan, Compra de Lote, Sueldos, Publicidad, Renta, etc.).
- Registro de monto, tipo (ingreso / gasto), método de pago (transferencia, efectivo, tarjeta), fecha y notas.
- Búsqueda en tiempo real por concepto, categoría o notas.
- Edición y eliminación de movimientos.
- Importación y exportación de respaldos en formato JSON.

### 2. Dashboard Ejecutivo con Gráficos Apple-Style
- **Hero Metrics**: Tiles alternadas de alto impacto visual con balance neto consolidado o por negocio.
- **Gráfico de Gastos por Categoría**: Vista Donut interactiva y vista en barras horizontales con la paleta de colores y microinteracciones de Apple.
- **Rendimiento por Unidad de Negocio**: Comparativa en tarjetas de utilidad (`store-utility-card`) con renders vectoriales de productos (Smash Burger, AirPods Pro y Apple Titanium Card).

### 3. Vista Especializada de 'Flujo de Caja' (Cash Flow)
- Muestra con exactitud **cuánto dinero queda libre** tras restar los gastos de cada negocio:
  - **Negocio Hamburguesas**: Ventas brutas − Costos de insumos, sueldos y local = **Flujo Libre**.
  - **Negocio AirPods**: Ventas − Costo de compra de lotes y envíos = **Flujo Libre**.
  - **Finanzas Personales**: Retiro de utilidades − Gastos de vida = **Superávit / Ahorro Neto**.
- **Herramienta interactiva de Retiro de Utilidades**: Permite transferir con un clic ganancias netas del negocio hacia la cuenta personal, registrando la salida del negocio y la entrada en finanzas personales automáticamente.

### 4. Integración con Firebase (Auth & Firestore)
- Soporte para autenticación por correo/contraseña y Google Sign-In.
- Base de datos en tiempo real con Firestore (`onSnapshot`).
- **Modo Híbrido Resiliente**: Si no has configurado claves de Firebase, la app funciona de inmediato en modo local con datos de muestra realistas y almacenamiento en `localStorage`. Puedes ingresar tus claves en cualquier momento desde el botón en la barra superior o configurando un archivo `.env`.

---

## 🎨 Sistema de Diseño (Apple Design Analysis)

La interfaz sigue estrictamente las especificaciones del documento de diseño de Apple:
- **Color Principal**: Action Blue (`#0066cc`, hover `#0071e3`, active scale `0.95`).
- **Superficies**: Blanco puro (`#ffffff`), Parchment (`#f5f5f7`), Pearl (`#fafafc`) y Dark Tiles (`#272729`, `#2a2a2c`, `#000000`).
- **Sin sombras decorativas**: Tarjetas con bordes ultra-finos de 1px (`#e0e0e0`). La única sombra en el sistema (`rgba(0,0,0,0.22) 3px 5px 30px 0`) está reservada para renders de producto descansando sobre una superficie.
- **Navegación**:
  - `global-nav`: Barra fija superior negra de 44px (`#000000`).
  - `sub-nav-frosted`: Barra translúcida de 52px con efecto frosted glass (`backdrop-filter: blur(20px) saturate(180%)`).
- **Tipografía**: Escala tipográfica SF Pro / Inter con tracking negativo en títulos display (`-0.28px`) y texto base en 17px (`line-height: 1.47`).

---

## 🚀 Cómo Ejecutar el Proyecto

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Iniciar servidor de desarrollo**:
   ```bash
   npm run dev
   ```

3. **Construir para producción**:
   ```bash
   npm run build
   ```

4. **(Opcional) Configurar Firebase**:
   Copia el archivo `.env.example` como `.env` e introduce tus claves de proyecto de Firebase:
   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=tu-proyecto
   ```
