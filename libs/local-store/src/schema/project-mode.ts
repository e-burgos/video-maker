export const PROJECT_MODES = ['footage', 'motion'] as const;

export type ProjectMode = (typeof PROJECT_MODES)[number];
