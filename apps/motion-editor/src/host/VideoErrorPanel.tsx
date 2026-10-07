/**
 * Panel de aviso (HU-73-A-03 CA-3 / HU-73-A-02 CA-5): se muestra cuando el
 * slug pedido no existe en el registro, o cuando existe pero el video no es
 * `playable`. Nunca pantalla negra/vacía — siempre hay un mensaje accionable
 * y el selector queda operable al lado.
 */
import type { CSSProperties } from 'react';
import type { RegisteredVideo, VideoRegistry } from '../videos/build-registry';

interface Props {
  registry: VideoRegistry;
  /** El slug que se pidió y no resolvió a un video existente. */
  unknownSlug?: string;
  /** El video que existe pero tiene issues de error (no playable). */
  brokenVideo?: RegisteredVideo;
  /** No hay ningún video registrado en absoluto (registro vacío). */
  emptyRegistry?: boolean;
}

const wrap: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  padding: 32,
  background: '#050506',
  color: '#e9e9ee',
  font: '400 15px/1.5 ui-sans-serif, system-ui, sans-serif',
  textAlign: 'center',
};

/** Se muestra en lugar del `<SceneStage>` cuando el video activo no es reproducible. */
export function VideoErrorPanel({ registry, unknownSlug, brokenVideo, emptyRegistry }: Props) {
  const availableSlugs = registry.videos.map((v) => v.slug).join(' · ');

  return (
    <div style={wrap} role="alert">
      {emptyRegistry === true ? (
        <strong style={{ fontSize: 20 }}>
          No hay ningún video disponible. Revisá src/videos/ y la franja de errores.
        </strong>
      ) : unknownSlug !== undefined ? (
        <>
          <strong style={{ fontSize: 20 }}>
            No existe ningún video con el identificador &quot;{unknownSlug}&quot;.
          </strong>
          <span style={{ color: 'rgba(233,233,238,0.65)' }}>
            Videos disponibles: {availableSlugs || '(ninguno)'}
          </span>
        </>
      ) : brokenVideo !== undefined ? (
        <>
          <strong style={{ fontSize: 20 }}>
            El video &quot;{brokenVideo.definition.title}&quot; tiene errores y no se puede
            reproducir.
          </strong>
          <ul style={{ textAlign: 'left', color: 'rgba(233,233,238,0.75)' }}>
            {brokenVideo.issues
              .filter((i) => i.severity === 'error')
              .map((i, idx) => (
                <li key={idx}>{i.message}</li>
              ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
