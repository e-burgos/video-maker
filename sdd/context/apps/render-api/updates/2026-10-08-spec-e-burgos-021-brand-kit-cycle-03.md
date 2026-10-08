# spec-e-burgos-021-brand-kit cycle-03 — 2026-10-08

## Estado
Proyectos con marca: `POST /projects` acepta `brand`, `GET` devuelve `brand` y `brandMissing`, `PUT /projects/:slug/brand`
nuevo; guardar el brief motion sincroniza la marca del proyecto; la importación de `media/` toma la marca del brief en
proyectos motion sin marca. El contexto del productor trae la marca del proyecto (nombre, tagline, web, voz, música,
fotos, equipos); `GET /motion/brands` suma `source`.

## Estructura
Nuevo `src/store/project-brand.ts`.

## Dependencias
Sin cambios.

## Qué sigue
cycle-04: material crudo con marca.
