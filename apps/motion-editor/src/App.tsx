import { useRef } from 'react';
import { useTweaks, TweaksPanel, TweakSection, TweakToggle, type TweakDefaults } from './engine/api';
import { captionsFlag } from './components/Frame';
import { REGISTRY } from './videos/registry';
import { useActiveVideo } from './host/useActiveVideo';
import { VideoSelector } from './host/VideoSelector';
import { VideoErrorPanel } from './host/VideoErrorPanel';
import { RegistryIssuesBanner } from './host/RegistryIssuesBanner';
import { VideoWorkspace } from './host/VideoWorkspace';
import { HOST_TWEAK_DEFAULTS } from './host/tweak-defaults';

export default function App() {
  const [tw, setTweak] = useTweaks<TweakDefaults>(HOST_TWEAK_DEFAULTS);
  const { requestedSlug, active, select } = useActiveVideo(REGISTRY);
  // Espeja si el workspace del video activo tiene cambios sin guardar, para
  // el confirm() de DEC-73-009 §10.3 al intentar cambiar de video.
  const dirtyRef = useRef(false);

  // El flag de subtítulos se lee dentro de <Frame> en cada escena.
  captionsFlag.on = tw.captions !== false;

  const handleSelect = (slug: string) => {
    if (dirtyRef.current) {
      const title = active?.definition.title ?? requestedSlug ?? '';
      const ok = window.confirm(
        `Tenés cambios sin guardar en el timeline de "${title}". Si cambiás de video se pierden. ¿Seguimos?`,
      );
      if (!ok) return;
    }
    dirtyRef.current = false;
    select(slug);
  };

  return (
    <div style={{ width: '100%', height: '100%', background: '#050506', position: 'relative' }}>
      <RegistryIssuesBanner issues={REGISTRY.issues} />

      {active !== null && active.playable ? (
        <VideoWorkspace
          key={active.slug}
          video={active}
          motionEditorOn={tw.motionEditor !== false}
          onDirtyChange={(d) => {
            dirtyRef.current = d;
          }}
        />
      ) : active !== null ? (
        <VideoErrorPanel registry={REGISTRY} brokenVideo={active} />
      ) : requestedSlug !== null ? (
        <VideoErrorPanel registry={REGISTRY} unknownSlug={requestedSlug} />
      ) : (
        <VideoErrorPanel registry={REGISTRY} emptyRegistry />
      )}

      <VideoSelector registry={REGISTRY} activeSlug={requestedSlug} onSelect={handleSelect} />

      <TweaksPanel>
        <TweakSection label="Video" />
        <TweakToggle
          label="Subtítulos en pantalla"
          value={tw.captions}
          onChange={(v) => setTweak('captions', v)}
        />
        <TweakToggle
          label="Motion editor"
          value={tw.motionEditor}
          onChange={(v) => setTweak('motionEditor', v)}
        />
      </TweaksPanel>
    </div>
  );
}
