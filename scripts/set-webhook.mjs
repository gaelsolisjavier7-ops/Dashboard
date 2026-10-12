/**
 * Registra el webhook del bot en Telegram.
 *
 *   node scripts/set-webhook.mjs https://tu-app.vercel.app/api/telegram
 *   node scripts/set-webhook.mjs --info      (ver el estado actual)
 *   node scripts/set-webhook.mjs --delete    (quitar el webhook)
 *
 * Necesita en el entorno:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_WEBHOOK_SECRET   (el mismo valor que pusiste en Vercel)
 */

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
const url = process.argv[2];

if (!token) {
  console.error('Falta TELEGRAM_BOT_TOKEN en el entorno.');
  process.exit(1);
}

const api = (metodo) => `https://api.telegram.org/bot${token}/${metodo}`;

async function llamar(metodo, payload) {
  const respuesta = await fetch(api(metodo), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });
  const cuerpo = await respuesta.json();
  console.log(metodo, '→', respuesta.status);
  console.log(JSON.stringify(cuerpo, null, 2));
  return cuerpo.ok === true;
}

if (!url || url === '--info') {
  await llamar('getWebhookInfo');
  process.exit(0);
}

if (url === '--delete') {
  await llamar('deleteWebhook', { drop_pending_updates: false });
  process.exit(0);
}

if (!secret) {
  console.error('Falta TELEGRAM_WEBHOOK_SECRET en el entorno (debe ser el mismo de Vercel).');
  process.exit(1);
}

if (!/^https:\/\/.+/.test(url)) {
  console.error('La URL debe ser https (Telegram no acepta http ni localhost).');
  process.exit(1);
}

const ok = await llamar('setWebhook', {
  url,
  secret_token: secret,
  allowed_updates: ['message', 'callback_query'],
  drop_pending_updates: true,
});

if (ok) {
  console.log('\n✅ Webhook registrado. Manda un mensaje al bot para probarlo.');
  await llamar('getWebhookInfo');
}
process.exit(ok ? 0 : 1);
