# spec-e-burgos-007-web-montage cycle-02 — 2026-09-09

## Qué pasó
El E2E de punta a punta falló en su primera corrida con `ASSERTION FAILED: work/timeline.json
produced from the studio is byte-identical to the CLI baseline`. El producto estaba bien: el
`sha256` crudo de `timeline.json` y de `catalog.json` **no puede** coincidir entre dos corridas
porque los dos documentos embeben `probedAt` y `modifiedAtMs`, marcas de la ingesta. `cycle-01` ya
lo había medido y estaba escrito en el estado heredado; el oráculo lo ignoró igual. El invariante
real (RNF-1, "salida byte-idéntica a la de la CLI") se verifica sobre `work/edl.json`, que es el
único de los tres artefactos sin timestamps y el único que decide el render: ese sí dio
`f96256aaddba…` idéntico en las dos corridas, con `catalog.json` distinto entre ellas
(`fb88e6b24d41…` vs `7202b9a23bdc…`). Para los otros dos, la comparación correcta es del documento
con los campos volátiles removidos recursivamente.

## Lección
Antes de usar `sha256` como oráculo de "misma salida", separar el artefacto que **no** embebe
timestamps del que sí: el primero se compara byte a byte, el segundo sólo con los campos volátiles
removidos.

## Costo evitable
Una corrida completa del E2E (~90 s de montaje + arranque de dos servidores y Chrome) y una
bisección mental de "¿el montaje de la API divergió del de la CLI?" que la evidencia de `cycle-01`
ya respondía. Barato acá; caro si el mismo oráculo hubiese entrado como CA de un ciclo y hubiera
bloqueado un cierre.
