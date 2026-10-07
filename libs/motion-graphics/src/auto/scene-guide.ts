import type { MotionSceneKind } from '../storyboard/motion-storyboard.schema';

export const SCENE_GUIDE: Record<MotionSceneKind, string> = {
  hook: 'Opening scene that states the pain or the question in one or two big headline lines, optionally with a screen that goes dark.',
  problem: 'Two to four icon+label pains, struck out one by one when strike is true; use it right after the hook.',
  'brand-reveal': 'Reveals the brand name and tagline; use anchor "drop" when the music has a drop. Once per video.',
  feature: 'A benefit with a headline, optional text, up to five bullets or chips and an optional visual (image, device, icon, countdown, timer).',
  'remote-update': 'Shows a campaign being published from the phone and updating several screens; pairs a campaign badge with before/after screens.',
  schedule: 'A day/hour timeline with colored blocks for rules by time and day.',
  dashboard: 'A live status board with rows of screens, a counter and an optional alert on one row.',
  'ai-generate': 'The AI writes a prompt and produces a promo or an image result.',
  context: 'Context signals (weather, holidays) as chips plus an optional radar of nearby competitors.',
  suggestion: 'An AI suggestion card with an accented phrase and an action button that flips to done.',
  product: 'Presents one product or device by name with text, specs and a visual, usually a brand device with screen states.',
  gallery: 'Two to four real photos with an optional caption; use the brief images or brand images.',
  step: 'One numbered step of a how-to with a headline, optional chips and a phone, tablet or tv visual with screen states.',
  connections: 'Wiring diagram of a brand device linked to tv, router, power or phone.',
  'do-dont': 'Two columns, what to avoid and what to do, with up to three items each.',
  cta: 'Closing call to action with the tagline, a button and optionally the url. Always the last scene.',
};
