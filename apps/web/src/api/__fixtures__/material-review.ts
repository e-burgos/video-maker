import type { MaterialReview, MaterialReviewItem } from '@video-maker/timeline-core';

import type { MaterialReviewDocument } from '../material-review-types';

export function materialItem(overrides: Partial<MaterialReviewItem> = {}): MaterialReviewItem {
  return {
    file: 'images/dashboard.png',
    source: 'project',
    shows: 'Panel de ventas con gráficos',
    useFor: 'escena del resumen',
    verdict: 'fits',
    reason: 'Se lee bien y coincide con la idea.',
    ...overrides,
  };
}

export function materialReview(overrides: Partial<MaterialReview> = {}): MaterialReview {
  return {
    version: 1,
    reviewedAt: '2026-10-12T20:00:00.000Z',
    items: [
      materialItem(),
      materialItem({
        file: 'images/selfie.png',
        shows: 'Una selfie en la oficina',
        useFor: undefined,
        verdict: 'unfit',
        reason: 'No muestra el producto.',
      }),
      materialItem({
        file: 'brand:logo',
        source: 'brand',
        shows: 'Logo sobre fondo blanco',
        verdict: 'doubtful',
        reason: 'Poco contraste en fondo oscuro.',
      }),
    ],
    gaps: [{ need: 'Captura del formulario de pago', note: 'No hay ninguna imagen del paso final.' }],
    ...overrides,
  };
}

export function materialReviewDocument(
  review: MaterialReview | null = materialReview(),
  slug = 'demo-01',
): MaterialReviewDocument {
  const warnings =
    review === null
      ? null
      : { items: review.items.filter((item) => item.verdict !== 'fits'), gaps: review.gaps };
  return { slug, path: 'work/producer/material-review.json', review, warnings };
}
