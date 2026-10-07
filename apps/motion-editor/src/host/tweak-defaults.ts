/**
 * Defaults de los tweaks del HOST (DEC-73-004). `window.TWEAK_DEFAULTS` se
 * elimina de `index.html`: estos dos toggles son controles de la herramienta
 * de edición (qué se ve encima del stage), no propiedades de ningún video, por
 * eso no pasan a `defineVideo` y viven acá como código, no como global.
 */
import type { TweakDefaults } from '../engine/api';

export const HOST_TWEAK_DEFAULTS: TweakDefaults = {
  captions: true,
  motionEditor: true,
};
