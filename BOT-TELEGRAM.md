# Bot de Telegram — registro de pedidos y gastos

```
Telegram → POST /api/telegram (Vercel Function · Node 20) → Gemini API → Firestore
```

Registra pedidos y gastos del negocio en lenguaje natural, pide confirmación y los deja en
las colecciones `pedidos` y `transacciones` que ya usa el dashboard.

---

## 1. Archivos

| Archivo | Qué hace |
| --- | --- |
| `api/telegram.ts` | Webhook: valida el secret, filtra el chat, anti-duplicados y compone las dependencias reales |
| `api/_lib/bot.ts` | Orquestador del flujo (mensajes, botones, confirmación, comandos). Dependencias inyectadas → testeable |
| `api/_lib/gemini.ts` | Parser con Gemini (fetch + `responseSchema`), sin SDK |
| `api/_lib/firestore.ts` | Escritura con Admin SDK (Service Account), lotes, borradores y anti-duplicados |
| `api/_lib/telegram.ts` | Helpers de la API de Telegram + teclados + validación del secret |
| `api/_lib/menu.ts` | Menú, precios, envío y matcher de productos |
| `api/_lib/pedido.ts` | Lógica pura: modalidad, papas, métodos de pago, totales, documentos y mensajes |
| `vercel.json` | Runtime Node 20, maxDuration, rewrite del SPA sin pisar `/api/*` |
| `scripts/test-bot.mjs` | 66 tests (puros + flujo completo con dependencias falsas) |
| `scripts/smoke-webhook.mjs` | Smoke test HTTP del webhook con un mensaje simulado |
| `scripts/set-webhook.mjs` | Registra / consulta / borra el webhook en Telegram |
| `scripts/resolver-ts.mjs` | Hook de Node para que los tests importen `api/` (que usa imports sin extensión) |
| `tsconfig.api.json` | Type-check de `api/` dentro de `npm run build` (`moduleResolution: bundler`, imports sin extensión) |

> **Build en Vercel:** los imports dentro de `api/` van **sin extensión** (`from './menu'`),
> como espera el bundler de Vercel. El type-check local usa `tsconfig.api.json` con
> `moduleResolution: "bundler"`, y los tests locales añaden la extensión con
> `scripts/resolver-ts.mjs` (`node --import ./scripts/resolver-ts.mjs …`). Verificado con
> TypeScript 6.0.3 y 7.0.2.
| `.env.example` | Todas las variables (las del bot y las de Firebase web) |

---

## 2. Variables de entorno

Se configuran **sólo en Vercel** (nunca en el código):

| Variable | Dónde se obtiene |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | @BotFather → `/newbot` |
| `TELEGRAM_CHAT_ID` | Tu id de Telegram (el del dueño). Por defecto en el ejemplo: `6002544825` |
| `TELEGRAM_WEBHOOK_SECRET` | Cadena aleatoria que tú generas |
| `GEMINI_API_KEY` | Google AI Studio → API keys |
| `GEMINI_MODEL` | Opcional. Por defecto `gemini-2.0-flash` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Console → Configuración → Cuentas de servicio → Generar clave privada |

Genera el secret con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Setear las variables en Vercel

**Opción A — Dashboard (recomendada):**

1. Entra a tu proyecto en [vercel.com](https://vercel.com) → **Settings** → **Environment Variables**.
2. Agrega cada variable una por una:
   - **Key**: el nombre exacto (`TELEGRAM_BOT_TOKEN`).
   - **Value**: el valor.
   - **Environments**: marca **Production**, **Preview** y **Development**.
3. Para `FIREBASE_SERVICE_ACCOUNT_JSON` pega el JSON **completo en una sola línea**
   (puede ser largo; el campo lo acepta). También funciona en base64.
4. **Save** en cada una.
5. Redeploy: **Deployments** → los tres puntos del último deploy → **Redeploy**
   (las variables nuevas sólo aplican a builds nuevos).

**Opción B — CLI:**

```bash
npm i -g vercel
vercel login
vercel link                       # conecta la carpeta con tu proyecto

vercel env add TELEGRAM_BOT_TOKEN production
vercel env add TELEGRAM_CHAT_ID production
vercel env add TELEGRAM_WEBHOOK_SECRET production
vercel env add GEMINI_API_KEY production
vercel env add FIREBASE_SERVICE_ACCOUNT_JSON production

vercel env pull .env.local        # opcional, para `vercel dev`
```

---

## 3. Deploy paso a paso

```bash
# 1) Requisitos y verificación local
npm install
npm run build           # incluye el type-check de api/ (tsconfig.api.json)
npm run test:bot        # 66 tests del bot
npm run bot:smoke       # smoke test HTTP del webhook (sin credenciales)

# 2) Deploy
npm i -g vercel         # si no lo tienes
vercel login
vercel                  # primer deploy (preview). Acepta detectar Vite.
vercel --prod           # deploy a producción
```

Vercel detecta `api/telegram.ts` automáticamente como Serverless Function
(los archivos dentro de `api/_lib/` no se exponen porque la carpeta empieza con `_`).
El resultado será algo como `https://tu-app.vercel.app`.

### Registrar el webhook en Telegram

Con las variables en tu terminal:

```bash
# PowerShell
$env:TELEGRAM_BOT_TOKEN="123456:ABC..."
$env:TELEGRAM_WEBHOOK_SECRET="el-mismo-que-pusiste-en-vercel"

node scripts/set-webhook.mjs https://tu-app.vercel.app/api/telegram
```

```bash
# bash / zsh
export TELEGRAM_BOT_TOKEN="123456:ABC..."
export TELEGRAM_WEBHOOK_SECRET="el-mismo-que-pusiste-en-vercel"
node scripts/set-webhook.mjs https://tu-app.vercel.app/api/telegram
```

También puedes hacerlo a mano con `curl`:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://tu-app.vercel.app/api/telegram",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message", "callback_query"],
    "drop_pending_updates": true
  }'

curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"    # verificar
curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"   # quitar
```

`getWebhookInfo` debe mostrar `"url"` correcta y `"last_error_message"` vacío.

### Probar

Mándale al bot:

```
2 hamburguesas especiales y 1 hot dog de tocino a domicilio en Calle Hidalgo 123 efectivo
```

Responde con el resumen y los botones **[✅ Confirmar] [✏️ Editar] [❌ Cancelar]**.
Al confirmar aparecen el pedido y las transacciones en el dashboard.

Prueba también: `gasté 450 en carne`, `/hoy`, `/ayer`, `/pendientes`, `/cancelar`.

Para probar localmente la función (opcional, requiere login de Vercel):

```bash
vercel dev            # levanta http://localhost:3000/api/telegram
```

---

## 4. Cómo funciona

### Detección

Gemini devuelve JSON estricto (`responseSchema`) y después el bot **recalcula todo**
con el menú local: precios, importes, subtotal, envío y total. Lo que responda el modelo
sobre dinero se ignora: así un precio inventado nunca llega a Firestore.

La modalidad se decide con reglas de palabras clave (deterministas):

| Texto | Resultado |
| --- | --- |
| domicilio, envío, a la casa, llévenlo, a la colonia | `delivery` + $30 de envío |
| recoger, paso por él, para llevar, voy al local | `pickup` sin envío |
| no menciona la entrega | `ambiguo` → el bot pregunta con botones |

`con papas` usa el precio con papas de los hot dogs ($50/$55/$75/$75/$90);
`sin papas` o silencio usa el precio base.

### Al confirmar

1. `pedidos/{autoId}`: `origen: "whatsapp"`, `estado: "Pendiente"`,
   `cliente: {nombre, telefono, direccion}`, productos, subtotal, cargoEnvio, total,
   `modalidad`, `metodo_pago`, `requiereReparto`, `folio`, `fecha` y `createdAt`.
2. `transacciones`: ingreso por productos (`Ventas Delivery` o `Ventas Mostrador`,
   monto = subtotal) y, si es delivery, otro ingreso de `Envíos` por $30.
   Ambos llevan `pedidoId` y la descripción `Pedido WhatsApp #AB12C`.
3. **No** se registra gasto de repartidor: eso lo agregas tú al final del día.

Todo se escribe en un solo lote (`batch`) para que no queden pedidos sin sus ingresos.

### Gastos

Si el mensaje es un gasto (`gasté 450 en carne`), se guarda directo en `transacciones`
con la categoría detectada (`Carne & Pan`, `Gas & Servicios Local`, `Insumos`, …).

### Comandos

| Comando | Respuesta |
| --- | --- |
| `/start` · `/help` | Bienvenida e instrucciones |
| `/hoy` | Pedidos, ventas de productos, envíos cobrados y total de hoy |
| `/ayer` | Igual, del día anterior |
| `/pendientes` | Últimos 10 pendientes con botones [✅ Entregado] [❌ Cancelar] |
| `/cancelar` | Cancela la operación en curso |

### Seguridad

- Se exige `X-Telegram-Bot-Api-Secret-Token` = `TELEGRAM_WEBHOOK_SECRET`; si no, **401**.
- Sólo se atienden mensajes del `TELEGRAM_CHAT_ID`; el resto se ignora silenciosamente.
- El texto se sanea y se recorta a **1000 caracteres** antes de Gemini.
- **Anti-duplicados**: cada `update_id` se marca en `bot_updates`; si Telegram reintenta,
  el segundo intento se ignora (no se registra dos veces el mismo pedido).
- El Admin SDK se salta las reglas de Firestore: la Service Account vive sólo en Vercel.
- Los borradores (`bot_borradores/{chatId}`) caducan a las 2 h y los botones viejos
  dejan de funcionar.

---

## 5. Decisiones ante lo ambiguo

1. **Estado del borrador en Firestore** (`bot_borradores`), no en memoria: en Vercel cada
   invocación puede caer en otra instancia, así que un `Map` no sería confiable.
2. **La modalidad la decide el texto**, no el modelo (reglas de la spec), para que el
   resultado sea predecible y testeable.
3. **Los gastos se guardan directo** (como pediste, sin paso de confirmación); los pedidos
   siempre piden confirmación porque mueven el flujo de reparto.
4. **Gemini por `fetch`** en vez de `@google/generative-ai` (deprecado) → una dependencia menos.
5. **Sin `parse_mode`** en los mensajes: así una dirección con `_` o `*` nunca rompe el envío.
6. **Zona horaria fija UTC-6** para `/hoy` y `/ayer`: México ya no aplica horario de verano,
   y en Vercel el servidor corre en UTC.
7. **Nombres canónicos del dashboard** (`Burger Especial`, `Hot Dog Tocino`, `Papas`), con
   alias para el matching (`Burguer`, `hot dog de tocino`, `hamburguesas especiales`…).
   El test compara ambos catálogos y falla si un precio se desincroniza.
8. **Dos categorías nuevas** en el dashboard (`Envíos` e `Insumos`) para que estos
   movimientos salgan con color propio en las gráficas.
9. **`paymentMethod` además de `metodo_pago`**: el dashboard lee el primero (en minúsculas)
   y la spec pedía el segundo; se escriben los dos.
10. **Producto no reconocido** → se omite del pedido, se avisa en el resumen y la confianza
    baja a `baja` (el dueño puede editar o registrarlo a mano).

## 6. Límites conocidos

- `/hoy` y `/ayer` cuentan lo que esté en `pedidos`. Si un pedido viejo guardó la fecha
  como texto en lugar de `Timestamp`, la consulta por rango no lo ve.
- Si Gemini no responde en 9 s, el bot pide reintentar con el formato de ejemplo.
- Los documentos de `bot_updates` (anti-duplicados) se pueden limpiar solos activando una
  política **TTL** de Firestore sobre el campo `expiresAt` (opcional).
