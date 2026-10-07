/**
 * Workspace de UN video activo (architect.md §10.4). Se monta con
 * `key={video.slug}` desde `App.tsx`: el remonte reinicia `scenesJson`, el
 * motor y garantiza una sola instancia de `<MotionEditor>` a la vez (el
 * puente de export sólo puede responder una vez — RISK-73-06).
 */
import { useEffect, useState } from 'react';
import { SceneStage } from '../engine/api';
import { C, W, H } from '../theme';
import type { RegisteredVideo } from '../videos/build-registry';
import MotionEditor from '../editor/MotionEditor';

interface Props {
  video: RegisteredVideo;
  motionEditorOn: boolean;
  /** Notifica al host si hay cambios sin guardar, para el confirm() al cambiar de video. */
  onDirtyChange?: (dirty: boolean) => void;
}

export function VideoWorkspace({ video, motionEditorOn, onDirtyChange }: Props) {
  const initialJson = JSON.stringify(video.definition.timeline, null, 2);
  const [scenesJson, setScenesJson] = useState(initialJson);
  // Línea base de "guardado": arranca igual al timeline original y se
  // actualiza tras un guardado exitoso del plugin dev-only (DEC-73-003 §10.6),
  // así los cambios recién guardados dejan de contar como pendientes.
  const [savedJson, setSavedJson] = useState(initialJson);

  // Nota: no hace falta re-sembrar el estado cuando cambia `timeline.json` en
  // disco. Vite NO propaga ese cambio a través del `import.meta.glob` eager del
  // registro (los `.tsx` de escenas sí hot-updatean, el JSON no), así que el
  // módulo del video nunca cambiaría de identidad acá. Lo resuelve el dev
  // server forzando recarga completa — ver `vite-plugins/reload-on-video-change.ts`.
  useEffect(() => {
    onDirtyChange?.(scenesJson !== savedJson);
  }, [scenesJson, savedJson, onDirtyChange]);

  return (
    <>
      <SceneStage
        width={video.definition.width || W}
        height={video.definition.height || H}
        scenes={scenesJson}
        playback={JSON.stringify(video.definition.playback)}
        bg={C.bg}
      >
        {video.definition.scenes}
      </SceneStage>

      {motionEditorOn && (
        <MotionEditor
          scenesJson={scenesJson}
          onScenesJson={setScenesJson}
          fps={video.definition.fps || 30}
          filename={video.slug}
          slug={video.slug}
          onSaved={() => setSavedJson(scenesJson)}
        />
      )}
    </>
  );
}
