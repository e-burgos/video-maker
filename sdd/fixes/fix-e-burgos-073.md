# FIX-e-burgos-073 — El productor no fija el efecto de los bumpers cuando solo se pide que suenen

| Campo | Valor |
| --- | --- |
| **ID** | FIX-e-burgos-073 |
| **Tipo** | BUGFIX |
| **Fecha** | 2026-11-11 |
| **Estado** | implemented |
| **Spec** | — |

## Problema
En la verificación del studio del 2026-11-11, se le pidió al productor «inicio y fin con el logo, que tengan su sonido». Escribió `sfxKind` a mano (`shimmer` en el intro, `whoosh` en el outro), aunque la regla del FIX-e-burgos-058 pide dejarlo en automático salvo que el usuario pida un sonido concreto. Así el efecto deja de seguir al revelado y a la rotación.

## Solución
- La sección «Variety» del prompt del productor aclara que pedir que los bumpers suenen («con su sonido») no es pedir un sonido concreto: ya suenan, así que `sfxKind` queda afuera.
- `sfxKind` se fija solo cuando el usuario nombra el sonido (un whoosh, un golpe, un brillo, clicks) o pide silencio.

- El schema de bumpers (`timeline-core`) describe `sfxKind` y `sfx`, y la herramienta `patch_timeline` que ve el modelo lleva esa descripción: «dejalo afuera: el bumper ya suena solo».

- `patch_timeline` mezcla un `style` parcial con el guardado. En la verificación, el productor mandó `style: {rotate: true}` y se perdía la `seed`; ahora se conservan la semilla, los colores y los pools.

## Verificación
- `nx test` y `lint` en verde para producer-tools (449), con la frase nueva cubierta por un test.
- En el studio (`f7484de`, con la línea del prompt pero sin la descripción del schema), el productor volvió a fijar `sfxKind` en `prueba-motion-guion`, cuya conversación ya tenía esos valores de un turno anterior. En una copia sin conversación, el turno quedó colgado sin eventos y la cancelación no lo cortó. Queda por verificar en limpio después del próximo reinicio.
- Verificado en el studio (`9ed865c`) sobre `prueba-motion-guion-limpio`, una copia sin conversación previa. Ante «inicio y fin con el logo, que tengan su sonido», el productor prendió los bumpers sin `sfxKind` ni `sfx`.
