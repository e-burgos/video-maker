import type { ReactNode } from 'react';

type SceneProps = { children: ReactNode; className?: string };

const ambientBackground = { background: 'var(--cl-ambient), var(--cl-canvas)' };

export function Scene({ children, className = '' }: SceneProps) {
  return (
    <div className={`relative isolate min-h-dvh overflow-hidden ${className}`}>
      <SceneBackdrop />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function SceneBackdrop() {
  return (
    <div aria-hidden data-scene-backdrop className="fixed inset-0 z-0" style={ambientBackground}>
      <span
        className="absolute -top-20 left-[35%] size-[300px] rounded-full blur-[90px]"
        style={{ background: 'var(--cl-orb-a)' }}
      />
      <span
        className="absolute -bottom-24 right-[5%] size-[280px] rounded-full blur-[90px]"
        style={{ background: 'var(--cl-orb-b)' }}
      />
    </div>
  );
}
