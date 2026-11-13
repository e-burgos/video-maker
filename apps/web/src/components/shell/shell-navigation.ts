import type { TranslationKey } from '../../i18n/messages-en';

export type SidebarIcon = 'Film' | 'Palette' | 'Send' | 'Settings' | 'BookOpen';

export type SidebarItem = {
  to: string;
  testId: string;
  labelKey: TranslationKey;
  icon: SidebarIcon;
  end?: boolean;
};

export type SidebarSection = {
  id: string;
  labelKey: TranslationKey;
  items: readonly SidebarItem[];
};

export const SIDEBAR_SECTIONS: readonly SidebarSection[] = [
  {
    id: 'produce',
    labelKey: 'nav.section.produce',
    items: [
      { to: '/', testId: 'videos-nav', labelKey: 'nav.videos', icon: 'Film', end: true },
      { to: '/brands', testId: 'brands-nav', labelKey: 'nav.brands', icon: 'Palette' },
    ],
  },
  {
    id: 'output',
    labelKey: 'nav.section.output',
    items: [{ to: '/publish-queue', testId: 'publish-queue-nav', labelKey: 'nav.publishQueue', icon: 'Send' }],
  },
  {
    id: 'system',
    labelKey: 'nav.section.system',
    items: [
      { to: '/settings', testId: 'settings-nav', labelKey: 'nav.settings', icon: 'Settings' },
      { to: '/guide', testId: 'guide-nav', labelKey: 'nav.guide', icon: 'BookOpen' },
    ],
  },
];

export type VideoStep = {
  path: string;
  labelKey: TranslationKey;
  titleKey: TranslationKey;
  end?: boolean;
  motionOnly?: boolean;
};

export const VIDEO_STEPS: readonly VideoStep[] = [
  { path: '', labelKey: 'nav.productor', titleKey: 'toolbar.title.producer', end: true },
  { path: '/motion', labelKey: 'nav.motion', titleKey: 'toolbar.title.motion', motionOnly: true },
  { path: '/library', labelKey: 'nav.library', titleKey: 'toolbar.title.library' },
  { path: '/storyboard', labelKey: 'nav.storyboard', titleKey: 'toolbar.title.storyboard' },
  { path: '/voice', labelKey: 'nav.voice', titleKey: 'toolbar.title.voice' },
  { path: '/preview', labelKey: 'nav.preview', titleKey: 'toolbar.title.preview' },
];

export type StepStatus = 'pending' | 'ok' | 'warn';

export function stepsForMode(isMotion: boolean): readonly VideoStep[] {
  return VIDEO_STEPS.filter((step) => isMotion || step.motionOnly !== true);
}

export function videoStepPath(slug: string, step: VideoStep): string {
  return `/projects/${encodeURIComponent(slug)}${step.path}`;
}

export function projectSlugFromPathname(pathname: string): string | null {
  const match = /^\/projects\/([^/]+)(?:\/|$)/.exec(pathname);
  return match === null ? null : decodeURIComponent(match[1] as string);
}

const MIGRATED_ROUTE_PREFIXES: readonly string[] = ['/'];
const MIGRATED_EXACT_ROUTES: readonly RegExp[] = [
  /^\/projects\/[^/]+\/?$/,
  /^\/projects\/[^/]+\/library\/?$/,
  /^\/projects\/[^/]+\/storyboard\/?$/,
  /^\/projects\/[^/]+\/voice\/?$/,
];

export function isMigratedRoute(pathname: string): boolean {
  return (
    MIGRATED_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    MIGRATED_EXACT_ROUTES.some((route) => route.test(pathname))
  );
}

export type ToolbarHeading = { titleKey: TranslationKey; subtitleKey: TranslationKey | null };

const TOP_LEVEL_HEADINGS: readonly { prefix: string; heading: ToolbarHeading }[] = [
  { prefix: '/brands', heading: { titleKey: 'toolbar.title.brands', subtitleKey: 'toolbar.subtitle.brands' } },
  { prefix: '/publish-queue', heading: { titleKey: 'toolbar.title.publishQueue', subtitleKey: 'toolbar.subtitle.publishQueue' } },
  { prefix: '/settings', heading: { titleKey: 'toolbar.title.settings', subtitleKey: 'toolbar.subtitle.settings' } },
  { prefix: '/guide', heading: { titleKey: 'toolbar.title.guide', subtitleKey: 'toolbar.subtitle.guide' } },
];

const VIDEOS_HEADING: ToolbarHeading = { titleKey: 'toolbar.title.videos', subtitleKey: 'toolbar.subtitle.videos' };

function activeVideoStep(pathname: string): VideoStep {
  const rest = pathname.replace(/^\/projects\/[^/]+/, '').replace(/\/$/, '');
  return VIDEO_STEPS.find((step) => step.path === rest) ?? (VIDEO_STEPS[0] as VideoStep);
}

export function toolbarHeadingFor(pathname: string): ToolbarHeading {
  const slug = projectSlugFromPathname(pathname);
  if (slug !== null) {
    return { titleKey: activeVideoStep(pathname).titleKey, subtitleKey: null };
  }
  const topLevel = TOP_LEVEL_HEADINGS.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return topLevel?.heading ?? VIDEOS_HEADING;
}
