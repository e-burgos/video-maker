/**
 * Franja fija roja arriba (architect.md §4.3) con los issues de severidad
 * `error` del registro completo. No es descartable: es el "ruido en pantalla"
 * que exige DEC-73-001 para que un video roto nunca pase inadvertido.
 */
import type { CSSProperties } from 'react';
import type { RegistryIssue } from '../videos/build-registry';

interface Props {
  issues: RegistryIssue[];
}

const wrap: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 100,
  padding: '10px 16px',
  background: '#7f1d1d',
  color: '#fee2e2',
  font: '500 12px/1.5 ui-sans-serif, system-ui, sans-serif',
  maxHeight: '30vh',
  overflowY: 'auto',
};

/** Franja de errores del registro. Se renderiza sólo si hay algo de severidad `error`. */
export function RegistryIssuesBanner({ issues }: Props) {
  const errors = issues.filter((i) => i.severity === 'error');
  if (errors.length === 0) return null;

  return (
    <div style={wrap} role="alert">
      <strong>
        {errors.length === 1 ? 'Hay 1 video con error:' : `Hay ${errors.length} errores:`}
      </strong>
      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
        {errors.map((i, idx) => (
          <li key={idx}>{i.message}</li>
        ))}
      </ul>
    </div>
  );
}
