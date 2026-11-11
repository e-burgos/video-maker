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

## Verificación
- `nx test` y `lint` en verde para producer-tools (449), con la frase nueva cubierta por un test.
- Sin verificar con el productor real: el studio corre el prompt anterior hasta su próximo reinicio.
