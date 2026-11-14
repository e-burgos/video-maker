# spec-e-burgos-025-liquid-glass-rebrand cycle-04 — 2026-11-13

## Qué pasó
Para separar dos commits de tasks que compartían archivos, un subagente sacó archivos del árbol de trabajo y los restauró segundos después. El studio de desarrollo (4200) sirve ese mismo árbol con HMR y otra sesión lo estaba usando: durante esos segundos la app quedó rota.

## Lección
Con el studio corriendo sobre el repo, nunca mover ni borrar archivos para armar un commit: usar `git add <rutas>` explícitas y, si dos tasks comparten un archivo, commitearlo en la primera y explicarlo en el reporte.

## Costo evitable
Un studio compartido roto por unos segundos y un riesgo de perder cambios sin commitear.
