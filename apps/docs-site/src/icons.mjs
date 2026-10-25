const ICON_PATHS = {
  github:
    '<path fill="currentColor" stroke="none" d="M12 1.5a10.5 10.5 0 0 0-3.32 20.46c.53.1.72-.23.72-.5v-1.85c-2.92.63-3.54-1.25-3.54-1.25-.48-1.22-1.17-1.54-1.17-1.54-.95-.65.08-.64.08-.64 1.05.08 1.6 1.08 1.6 1.08.94 1.6 2.46 1.14 3.06.87.1-.68.37-1.14.66-1.4-2.33-.27-4.78-1.17-4.78-5.18 0-1.15.41-2.08 1.08-2.82-.1-.27-.47-1.33.1-2.78 0 0 .88-.28 2.89 1.08a10 10 0 0 1 5.26 0c2-1.36 2.88-1.08 2.88-1.08.58 1.45.21 2.51.1 2.78.68.74 1.08 1.67 1.08 2.82 0 4.02-2.45 4.9-4.79 5.17.38.32.71.96.71 1.94v2.87c0 .28.19.6.73.5A10.5 10.5 0 0 0 12 1.5Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  moon: '<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  script: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h6"/>',
  voice: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  scenes: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M8 5v4M16 5v4"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  render: '<path d="M8 5v14l11-7z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>',
  captions: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15h4M13 15h4M7 11h10"/>',
  brand: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
  code: '<path d="M8 8l-5 4 5 4M16 8l5 4-5 4M14 4l-4 16"/>',
  scale: '<path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0zM8 21h8"/>',
};

export function icon(name, className = 'icon') {
  const paths = ICON_PATHS[name];
  if (paths === undefined) {
    throw new Error(`unknown icon "${name}"`);
  }
  return `<svg class="${className}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

export const BRAND_MARK_SVG =
  '<svg class="brand-mark" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false"><defs><linearGradient id="vm-mark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5470"/><stop offset="1" stop-color="#7c5cff"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#vm-mark)"/><path d="M12.5 9.5v13l10-6.5z" fill="#fff"/></svg>';

