# Lecciones de costo (tutoriales grabados)

Origen: los tutoriales de Display Ads. El primero tardó ~3 horas por redescubrir la UI corrida a corrida; con estas
reglas el siguiente salió en ~40 minutos y en una sola toma.

1. **Un solo ensayo que recorra TODO el flujo** y para cada paso imprima qué encontró (`count()`, visible, tag y
   textos de los botones). Probar, imprimir, cerrar sin guardar.
2. **Leer el código de la UI antes del primer ensayo**, todo junto: `aria-label`, `title`, `onClick`, clases
   estables. Lo ya mapeado se anota en un helper del módulo y no se redescubre.
3. **Timeouts cortos en el ensayo y verificar ANTES de la acción cara.** Un clic a ciegas al final de un flujo que
   crea registros no se puede repetir sin crearlos otra vez. Verificar el CONTENIDO (de quién es lo abierto), no
   sólo que algo se abrió.
4. **Desktop y mobile son el mismo flujo con otro `formato`.** Parametrizar; el ensayo mobile se hace una vez por
   módulo y las diferencias se anotan.
5. **Revisar frames en una sola extracción dirigida**: primero, cada hito de riesgo y último, no una grilla.
6. **Ensayo y toma en primer plano con timeout suficiente** (600 s); background sólo para tareas largas ajenas.
7. **El estado previo define el video.** Antes de grabar, listar el estado real (registros, medios) y decidir qué
   se muestra; anotar qué quedó creado y qué habría que limpiar.
8. **El tutorial encuentra bugs: presupuestalos.** Grabar es la forma más barata de auditar un flujo.

| Paso | Tiempo objetivo |
| --- | --- |
| Mapear controles en código + escribir el flujo desde la plantilla | 15 min |
| Ensayo único y ajustes | 10 min |
| Toma definitiva | duración del video + 2 min |
| Revisión de frames, informe y entrega | 10 min |

Si un tutorial supera los 45 minutos, algo de esta lista se saltó.

## Trampas ya resueltas por la librería

| Trampa | Resuelto por |
| --- | --- |
| La sesión vive en `sessionStorage` y `storageState` no la captura | `abrirGrabacion` la copia y la siembra con un init script |
| Un overlay (tour, banner) intercepta los clics | gancho `alNavegar(page)` que `irARuta` corre tras cada navegación |
| Un blanco más ancho que la pantalla recibe el clic en otro elemento | `irA` apunta dentro de la parte visible; `clicPreciso` delega el clic en Playwright |
| El texto visible no es el nombre accesible (CSS `uppercase`/`capitalize`) | selectores con `/…/i` |
| El cursor no se dibuja en la grabación | cursor sintético inyectado y reinyectado cada 1,5 s |
