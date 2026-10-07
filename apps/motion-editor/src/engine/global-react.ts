/**
 * El motor de animación (src/engine/animations-v2.jsx) y el panel de tweaks
 * son librerías que se autoregistran en `window` y esperan encontrar React
 * ahí. Este módulo lo expone ANTES de que se evalúen (ver src/engine/api.ts,
 * que importa este archivo primero).
 */
import * as React from 'react';
import * as ReactDOM from 'react-dom';

declare global {
  interface Window {
    React?: typeof React;
    ReactDOM?: typeof ReactDOM;
  }
}

window.React = React;
// El motor detecta `ReactDOM.flushSync` para aplicar los seeks marcados con
// `sync: true` de forma síncrona (data-om-sync-seek="true"). Sin esto el
// exportador tiene que esperar dos refrescos de pantalla por frame y encima
// serializa un DOM que puede ir un commit atrasado respecto del timestamp.
window.ReactDOM = ReactDOM;

export {};
