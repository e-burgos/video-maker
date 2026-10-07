/**
 * Fuente de verdad del video activo (DEC-73-009 §10.1). El estado de React
 * manda; la URL (`?v=<slug>`) es un espejo bidireccional via `pushState` /
 * `popstate`. Sin `react-router`, sin recarga (nunca `location.href = …`).
 */
import { useCallback, useEffect, useState } from 'react';
import type { RegisteredVideo, VideoRegistry } from '../videos/build-registry';

export interface ActiveVideo {
  /** Slug pedido: el del ?v=, o el defaultSlug si no vino ninguno. Puede no existir. */
  requestedSlug: string | null;
  /** El video resuelto, o null si requestedSlug no está en el registro. */
  active: RegisteredVideo | null;
  /** Cambia de video: actualiza estado + history.pushState. */
  select: (slug: string) => void;
}

function readSlugFromLocation(): string | null {
  return new URLSearchParams(window.location.search).get('v');
}

export function useActiveVideo(registry: VideoRegistry): ActiveVideo {
  const [requestedSlug, setRequestedSlug] = useState<string | null>(() => {
    const fromUrl = readSlugFromLocation();
    if (fromUrl !== null) return fromUrl;
    return registry.defaultSlug;
  });

  // Si no vino ?v= en la carga inicial, dejamos la URL compartible sin
  // ensuciar el historial (replace, no push).
  useEffect(() => {
    if (readSlugFromLocation() === null && requestedSlug !== null) {
      const url = new URL(window.location.href);
      url.searchParams.set('v', requestedSlug);
      window.history.replaceState({ v: requestedSlug }, '', url.toString());
    }
    // Sólo al montar: no queremos reescribir la URL en cada render.
  }, []);

  // El botón atrás/adelante del navegador sincroniza el estado con la URL.
  useEffect(() => {
    const onPopState = () => setRequestedSlug(readSlugFromLocation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const select = useCallback((slug: string) => {
    setRequestedSlug(slug);
    const url = new URL(window.location.href);
    url.searchParams.set('v', slug);
    window.history.pushState({ v: slug }, '', url.toString());
  }, []);

  const active = requestedSlug !== null ? registry.bySlug.get(requestedSlug) ?? null : null;

  return { requestedSlug, active, select };
}
