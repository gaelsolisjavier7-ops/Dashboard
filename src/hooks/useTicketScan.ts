import { useCallback, useState } from 'react';
import { auth } from '../services/firebase';
import type { TicketEscaneado } from '../lib/ticket';

export interface ResultadoTicketScan extends TicketEscaneado {
  /** Data URL comprimida, para la vista previa del modal. */
  preview: string;
  /** KB del base64 que se enviaron al servidor (para depurar el peso). */
  pesoKb: number;
}

export interface UseTicketScan {
  scanning: boolean;
  error: string | null;
  resultado: ResultadoTicketScan | null;
  escanear: (archivo: File) => Promise<TicketEscaneado | null>;
  reset: () => void;
}

/** Ancho máximo antes de enviar: 4 MB de foto → ~200 KB de JPEG. */
export const MAX_ANCHO_TICKET = 1024;
const CALIDAD_JPEG = 0.8;

function leerDataURL(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result ?? ''));
    lector.onerror = () => rechazar(new Error('No se pudo leer la foto'));
    lector.readAsDataURL(archivo);
  });
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const imagen = new Image();
    imagen.onload = () => resolver(imagen);
    imagen.onerror = () => rechazar(new Error('No se pudo procesar la foto (formato no soportado)'));
    imagen.src = src;
  });
}

/** Comprime con canvas a `MAX_ANCHO_TICKET` de ancho y devuelve base64 JPEG. */
export async function comprimirTicket(
  archivo: File
): Promise<{ base64: string; preview: string; mimeType: string }> {
  const original = await leerDataURL(archivo);
  const imagen = await cargarImagen(original);

  const anchoOriginal = imagen.naturalWidth || imagen.width;
  const altoOriginal = imagen.naturalHeight || imagen.height;
  const escala = Math.min(1, MAX_ANCHO_TICKET / (anchoOriginal || MAX_ANCHO_TICKET));
  const ancho = Math.max(1, Math.round(anchoOriginal * escala));
  const alto = Math.max(1, Math.round(altoOriginal * escala));

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('No se pudo procesar la imagen');

  // JPEG no guarda transparencia: fondo blanco (los tickets son papel blanco).
  contexto.fillStyle = '#ffffff';
  contexto.fillRect(0, 0, ancho, alto);
  contexto.drawImage(imagen, 0, 0, ancho, alto);

  const preview = lienzo.toDataURL('image/jpeg', CALIDAD_JPEG);
  const base64 = preview.split(',')[1] ?? '';
  if (!base64) throw new Error('No se pudo comprimir la foto');
  return { base64, preview, mimeType: 'image/jpeg' };
}

/**
 * Escanea un ticket: comprime la foto, pide el ID token y llama a
 * `POST /api/ticket-scan`. No escribe nada en Firestore (eso lo decide el modal).
 */
export function useTicketScan(): UseTicketScan {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoTicketScan | null>(null);

  const reset = useCallback(() => {
    setResultado(null);
    setError(null);
  }, []);

  const escanear = useCallback(async (archivo: File): Promise<TicketEscaneado | null> => {
    setError(null);
    setResultado(null);

    if (!archivo.type.startsWith('image/')) {
      setError('El archivo debe ser una foto (JPG, PNG o HEIC)');
      return null;
    }

    setScanning(true);
    try {
      const { base64, preview, mimeType } = await comprimirTicket(archivo);

      const usuario = auth.currentUser;
      if (!usuario) throw new Error('Inicia sesión para escanear tickets');
      const token = await usuario.getIdToken();

      const respuesta = await fetch('/api/ticket-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ image: base64, mimeType }),
      });

      const tipoContenido = respuesta.headers.get('content-type') ?? '';
      const esJSON = tipoContenido.includes('application/json');
      const datos = esJSON
        ? ((await respuesta.json().catch(() => null)) as {
            ok?: boolean;
            error?: string;
            ticket?: TicketEscaneado;
          } | null)
        : null;

      if (!respuesta.ok || !datos?.ok || !datos.ticket) {
        if (!esJSON) {
          throw new Error(
            'El escáner sólo funciona en el servidor (npm run dev no expone /api). Prueba en el deploy de Vercel.'
          );
        }
        throw new Error(datos?.error ?? `No se pudo leer el ticket (error ${respuesta.status})`);
      }

      setResultado({
        ...datos.ticket,
        preview,
        pesoKb: Math.round(base64.length / 1024),
      });
      return datos.ticket;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo escanear el ticket');
      return null;
    } finally {
      setScanning(false);
    }
  }, []);

  return { scanning, error, resultado, escanear, reset };
}
