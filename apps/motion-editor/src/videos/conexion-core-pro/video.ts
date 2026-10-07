// Video "Conectá tu Core Pro" — instructivo para el cliente final que
// recibe una pantalla (por dentro, una Raspberry Pi 5 — nunca se lo llama así
// en pantalla, ver docs/product/webapp-user-manual.md líneas 11/71/207-209)
// en su local (Ciclo 73, Épica B, HU-73-B-01; corregido por defecto de
// nomenclatura y fidelidad de hardware reportado por el dueño). Fiel a
// docs/devices/raspberry-client-setup-guide.md: todo paso, dirección, nombre
// de red y tiempo que aparece acá existe textualmente en esa guía — sólo
// cambia cómo se le llama al equipo (Core Pro / "Pantalla" en el panel). El
// slug no aparece acá: lo pone el registro a partir del nombre de esta
// carpeta (conexion-core-pro).
import { defineVideo } from '../define-video';
import timeline from './timeline.json';
import { Apertura, ConexionVideo, ConexionRed, Encendido } from './scenes/acto1-conexion-fisica';
import { RedConfiguracion, PantallaConfig, Transicion } from './scenes/acto2-red-wifi';
import { Verificacion } from './scenes/acto3-verificacion';

export default defineVideo({
  title: 'Conectá tu Core Pro',
  audience: 'cliente',
  scenes: {
    Apertura,
    ConexionVideo,
    ConexionRed,
    Encendido,
    RedConfiguracion,
    PantallaConfig,
    Transicion,
    Verificacion,
  },
  timeline,
});
