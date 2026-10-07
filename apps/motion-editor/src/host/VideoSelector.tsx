/**
 * Selector de video (HU-73-A-03). Chrome del host: no aparece en el frame
 * exportado (vive fuera del `<SceneStage>`, ver architect.md §10.4).
 */
import type { CSSProperties } from 'react';
import type { VideoRegistry } from '../videos/build-registry';

interface Props {
  registry: VideoRegistry;
  activeSlug: string | null;
  onSelect: (slug: string) => void;
}

const wrap: CSSProperties = {
  position: 'fixed',
  top: 16,
  left: 16,
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(14,14,17,0.94)',
  backdropFilter: 'blur(12px)',
  font: '500 12px/1 ui-sans-serif, system-ui, sans-serif',
  color: '#e9e9ee',
};

const select: CSSProperties = {
  height: 28,
  padding: '0 8px',
  borderRadius: 7,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.05)',
  color: '#e9e9ee',
  font: 'inherit',
  cursor: 'pointer',
};

/** Selector visible + cambio de `?v=<slug>` sin recargar (DEC-73-009). */
export function VideoSelector({ registry, activeSlug, onSelect }: Props) {
  if (registry.videos.length === 0) return null;

  return (
    <div style={wrap}>
      <span style={{ color: 'rgba(233,233,238,0.55)' }}>Video</span>
      <select
        style={select}
        value={activeSlug ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        aria-label="Elegir video"
      >
        {activeSlug !== null && !registry.bySlug.has(activeSlug) && (
          <option value={activeSlug} disabled>
            «{activeSlug}» (no existe)
          </option>
        )}
        {registry.videos.map((v) => (
          <option key={v.slug} value={v.slug} disabled={!v.playable}>
            {v.definition.title}
            {!v.playable ? ' (con errores)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
