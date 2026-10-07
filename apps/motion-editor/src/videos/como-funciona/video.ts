// Video "Cómo funciona DisplayAds" — explainer de referencia (12 escenas, ~120 s).
// Migrado desde src/scenes/ + window.OM_SCENES (TASK-FE-73-01). El slug no
// aparece acá: lo pone el registro a partir del nombre de esta carpeta.
import { defineVideo } from '../define-video';
import timeline from './timeline.json';
import { Apertura, Problema } from './scenes/acto1-problema';
import { PanelScene, Manana, Timeline, Mediodia } from './scenes/acto2-panel';
import { IA, Publicar, Hardware } from './scenes/acto3-ia';
import { Medir, Noche, Cierre } from './scenes/acto4-cierre';

export default defineVideo({
  title: 'Cómo funciona DisplayAds',
  audience: 'prospecto',
  scenes: {
    Apertura,
    Problema,
    Panel: PanelScene,
    'Mañana': Manana,
    Timeline,
    'Mediodía': Mediodia,
    IA,
    Publicar,
    Hardware,
    Medir,
    Noche,
    Cierre,
  },
  timeline,
});
