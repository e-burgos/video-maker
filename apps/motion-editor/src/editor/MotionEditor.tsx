/**
 * Motion editor standalone: el panel que en el host venía de afuera.
 * Maneja transporte, scrub, bloques de escena con retiming por arrastre y
 * exportación de video — todo hablándole al stage por el protocolo de seek.
 *
 *   const [scenesJson, setScenesJson] = useState(JSON.stringify(video.timeline, null, 2));
 *   <SceneStage scenes={scenesJson} ... />
 *   {tw.motionEditor && (
 *     <MotionEditor scenesJson={scenesJson} onScenesJson={setScenesJson} filename={video.slug} />
 *   )}
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  exportVideo,
  findExportableRoot,
  getDuration,
  seek,
  type ExportableRoot,
} from './exportVideo';
import { saveTimeline, type SaveState } from './saveTimeline';

interface Scene {
  name: string;
  dur: number;
  nat?: number;
  [k: string]: unknown;
}

interface Props {
  /** El literal JSON de escenas que le pasás al SceneStage. */
  scenesJson: string;
  /** Recibe el JSON nuevo cuando el usuario retimea una escena. */
  onScenesJson?: (json: string) => void;
  fps?: number;
  /**
   * Nombre del archivo exportado, SIN extensión (HU-73-A-06). Lo deriva el
   * host del slug del video activo. Único literal de filename del componente:
   * tanto el botón del editor como el puente de `omelette:request-video-export`
   * llaman al mismo `doExport`, así que los dos exportan con el mismo nombre.
   */
  filename?: string;
  /**
   * Slug del video activo: identifica qué `timeline.json` escribe el botón
   * "Guardar" (DEC-73-003). Si no viene, el botón no se muestra.
   */
  slug?: string;
  /** El host actualiza acá la línea base de `dirty` tras un guardado exitoso. */
  onSaved?: () => void;
}

const C = {
  panel: 'rgba(14,14,17,0.94)',
  line: 'rgba(255,255,255,0.10)',
  text: '#e9e9ee',
  dim: 'rgba(233,233,238,0.55)',
  accent: '#6d8cff',
  block: 'rgba(109,140,255,0.18)',
  blockOn: 'rgba(109,140,255,0.40)',
};

const btn: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  height: 28,
  padding: '0 10px',
  borderRadius: 7,
  border: `1px solid ${C.line}`,
  background: 'rgba(255,255,255,0.05)',
  color: C.text,
  font: '500 12px/1 ui-sans-serif, system-ui, sans-serif',
  cursor: 'pointer',
};

const fmt = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t % 1) * 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
};

export default function MotionEditor({
  scenesJson,
  onScenesJson,
  fps = 30,
  filename = 'display-ads-video',
  slug,
  onSaved,
}: Props) {
  const rootRef = useRef<ExportableRoot | null>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [prog, setProg] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const trackRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scenes: Scene[] = useMemo(() => {
    try {
      const v = JSON.parse(scenesJson);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }, [scenesJson]);

  const starts = useMemo(() => {
    const out = [0];
    scenes.forEach((s) => out.push(out[out.length - 1] + (Number(s.dur) || 0)));
    return out;
  }, [scenes]);
  const total = starts[starts.length - 1] || duration;

  // Engancha la raíz exportable y sigue su duración.
  useEffect(() => {
    const attach = () => {
      const root = findExportableRoot();
      if (!root) return false;
      rootRef.current = root;
      setDuration(getDuration(root));
      return true;
    };
    if (!attach()) {
      const id = setInterval(() => attach() && clearInterval(id), 120);
      return () => clearInterval(id);
    }
    // `attach()` ya devolvió true acá arriba, lo que garantiza que asignó `rootRef.current`
    // (Ciclo 75, DEC-75-006): se narrowa explícito en vez de asumirlo con `!`.
    const attachedRoot = rootRef.current;
    if (attachedRoot == null) return;
    const obs = new MutationObserver(() => {
      const root = rootRef.current;
      if (root) setDuration(getDuration(root));
    });
    obs.observe(attachedRoot, { attributes: true });
    return () => obs.disconnect();
  }, [scenesJson]);

  const goTo = useCallback(
    (t: number, opts: { playing?: boolean } = {}) => {
      const root = rootRef.current;
      const clamped = Math.max(0, Math.min(total || duration, t));
      setTime(clamped);
      if (root) seek(root, clamped, { playing: opts.playing });
    },
    [total, duration],
  );

  // Reloj propio: el stage queda en pausa y avanza sólo por nuestros seeks.
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let id = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTime((t) => {
        const next = t + dt;
        const wrapped = next >= total ? 0 : next;
        const root = rootRef.current;
        if (root) seek(root, wrapped, { playing: true });
        return wrapped;
      });
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, total]);

  // Teclas: espacio, flechas (shift = 1s), J/K/L opcional.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.code === 'ArrowLeft') {
        setPlaying(false);
        goTo(time - (e.shiftKey ? 1 : 1 / fps));
      } else if (e.code === 'ArrowRight') {
        setPlaying(false);
        goTo(time + (e.shiftKey ? 1 : 1 / fps));
      } else if (e.code === 'Home' || e.key === '0') {
        goTo(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, time, fps]);

  const timeFromX = (clientX: number) => {
    // `trackRef` sólo se lee dentro de handlers de puntero de la propia pista (Ciclo 75,
    // DEC-75-006): para cuando disparan, el div ya está montado.
    const track = trackRef.current;
    if (track == null) throw new Error('trackRef sin montar: timeFromX se invoca sólo tras un pointerdown sobre la pista');
    const r = track.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * (total || duration);
  };

  const onTrackDown = (e: React.PointerEvent) => {
    setPlaying(false);
    goTo(timeFromX(e.clientX));
    const move = (ev: PointerEvent) => goTo(timeFromX(ev.clientX));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const setDur = (i: number, dur: number) => {
    const next = scenes.map((s, k) =>
      k === i ? { ...s, dur: Math.max(0.1, Math.round(dur * 100) / 100) } : s,
    );
    onScenesJson?.(JSON.stringify(next, null, 2));
  };

  // Arrastre del borde derecho de un bloque = retiming de esa escena.
  const onEdgeDown = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    setPlaying(false);
    // Mismo razonamiento que en `timeFromX`: sólo se llama tras un pointerdown sobre un
    // borde de escena, ya dentro de la pista montada (Ciclo 75, DEC-75-006).
    const track = trackRef.current;
    if (track == null) throw new Error('trackRef sin montar: onEdgeDown se invoca sólo tras un pointerdown sobre un borde de la pista');
    const r = track.getBoundingClientRect();
    const secPerPx = (total || duration) / r.width;
    const x0 = e.clientX;
    const d0 = Number(scenes[i].dur) || 0;
    const move = (ev: PointerEvent) => setDur(i, d0 + (ev.clientX - x0) * secPerPx);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // El feedback del botón "Guardar" no usa setTimeout: vuelve a 'idle' con la
  // próxima edición del timeline, sin código nuevo ni falsos positivos en el
  // grep de determinismo (INV-LOCAL-33-1).
  useEffect(() => {
    setSaveState('idle');
  }, [scenesJson]);

  const doSave = useCallback(async () => {
    if (!slug || saveState === 'saving') return;
    setSaveState('saving');
    const result = await saveTimeline(slug, scenes);
    if (result.ok) {
      setSaveState('ok');
      onSaved?.();
    } else {
      setSaveState('error');
      console.error('[MotionEditor] error al guardar timeline:', result.message);
    }
  }, [slug, scenes, saveState, onSaved]);

  const doExport = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setProg(null);
      return;
    }
    const root = rootRef.current;
    if (!root) return;
    setPlaying(false);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setProg(0);
    try {
      await exportVideo(root, {
        fps,
        filename,
        signal: ctrl.signal,
        onProgress: (p) => setProg(p),
      });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error(err);
    } finally {
      abortRef.current = null;
      setProg(null);
      goTo(0);
    }
  }, [fps, filename, goTo]);

  // La barra de reproducción del motor trae su propio botón de exportar, pero
  // sólo emite `postMessage` al host que lo embebía originalmente. Parados solos
  // ese mensaje nos llega a nosotros mismos (window.parent === window), así que
  // lo atendemos: si no, el usuario ve dos botones de export y uno no hace nada.
  // Sólo aceptamos el mensaje si viene de esta misma ventana.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window) return;
      if (e.data?.type === 'omelette:request-video-export') void doExport();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [doExport]);

  const pct = (v: number) => `${((v / (total || 1)) * 100).toFixed(4)}%`;

  return (
    <div
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${C.line}`,
        background: C.panel,
        backdropFilter: 'blur(12px)',
        color: C.text,
        font: '400 12px/1.3 ui-sans-serif, system-ui, sans-serif',
      }}
    >
      {/* Transporte */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button style={btn} onClick={() => setPlaying((p) => !p)}>
          {playing ? '❚❚ Pausa' : '▶ Play'}
        </button>
        <button style={btn} onClick={() => { setPlaying(false); goTo(0); }}>
          ⏮ Inicio
        </button>
        <button style={btn} onClick={() => { setPlaying(false); goTo(time - 1 / fps); }}>
          ◀ frame
        </button>
        <button style={btn} onClick={() => { setPlaying(false); goTo(time + 1 / fps); }}>
          frame ▶
        </button>
        <div
          style={{
            marginLeft: 4,
            fontVariantNumeric: 'tabular-nums',
            font: '500 12px/1 ui-monospace, monospace',
            color: C.dim,
          }}
        >
          {fmt(time)} / {fmt(total || duration)} · f{Math.round(time * fps)}
        </div>

        <div style={{ flex: 1 }} />

        {sel != null && scenes[sel] && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.dim }}>
            <span style={{ color: C.text, fontWeight: 500 }}>{scenes[sel].name}</span>
            <input
              type="number"
              step={0.1}
              min={0.1}
              value={Number(scenes[sel].dur) || 0}
              onChange={(e) => setDur(sel, Number(e.target.value))}
              style={{
                width: 62,
                height: 26,
                padding: '0 6px',
                borderRadius: 6,
                border: `1px solid ${C.line}`,
                background: 'rgba(0,0,0,0.35)',
                color: C.text,
                font: '500 12px/1 ui-monospace, monospace',
              }}
            />
            <span>s</span>
          </div>
        )}

        <button
          style={btn}
          onClick={() => navigator.clipboard.writeText(JSON.stringify(scenes, null, 2))}
          title="Copiar el JSON de escenas para pegarlo en el código"
        >
          Copiar JSON
        </button>
        {import.meta.env.DEV && slug && (
          <button
            style={btn}
            onClick={doSave}
            disabled={saveState === 'saving'}
            title={`Escribe src/videos/${slug}/timeline.json`}
          >
            {saveState === 'saving'
              ? 'Guardando…'
              : saveState === 'ok'
                ? '✓ Guardado'
                : saveState === 'error'
                  ? '✗ Error al guardar'
                  : 'Guardar'}
          </button>
        )}
        <button
          style={{
            ...btn,
            borderColor: prog == null ? C.accent : C.line,
            background: prog == null ? 'rgba(109,140,255,0.18)' : 'rgba(255,255,255,0.05)',
          }}
          onClick={doExport}
        >
          {prog == null ? '⬇ Descargar video' : `Cancelar · ${Math.round(prog * 100)}%`}
        </button>
      </div>

      {/* Pista con bloques de escena */}
      <div
        ref={trackRef}
        onPointerDown={onTrackDown}
        style={{
          position: 'relative',
          height: 44,
          borderRadius: 8,
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${C.line}`,
          overflow: 'hidden',
          cursor: 'pointer',
          touchAction: 'none',
        }}
      >
        {scenes.map((s, i) => (
          <div
            key={`${s.name}-${i}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              setSel(i);
              setPlaying(false);
              goTo(starts[i]);
            }}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: pct(starts[i]),
              width: pct(Number(s.dur) || 0),
              boxSizing: 'border-box',
              padding: '6px 8px',
              borderRight: `1px solid ${C.line}`,
              background: sel === i ? C.blockOn : C.block,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
            <div style={{ color: C.dim, fontSize: 10 }}>{(Number(s.dur) || 0).toFixed(1)}s</div>
            <div
              onPointerDown={onEdgeDown(i)}
              title="Arrastrar para retimear"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: 6,
                cursor: 'ew-resize',
                background: 'rgba(255,255,255,0.14)',
              }}
            />
          </div>
        ))}

        {/* Playhead */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: pct(time),
            width: 2,
            marginLeft: -1,
            background: '#fff',
            boxShadow: '0 0 6px rgba(255,255,255,0.6)',
            pointerEvents: 'none',
          }}
        />

        {/* Progreso de export */}
        {prog != null && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              height: 3,
              width: `${prog * 100}%`,
              background: C.accent,
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  );
}
