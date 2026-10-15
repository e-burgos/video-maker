import { VoiceDirectionSchema } from '@video-maker/timeline-core';
import { z } from 'zod';

import { ImageBoxListSchema } from './image-box';

export const ICON_NAMES = [
  'alert',
  'bell',
  'box',
  'cable',
  'calendar',
  'chart',
  'check',
  'clock',
  'cloud',
  'dollar',
  'image',
  'lock',
  'message',
  'monitor-off',
  'phone',
  'pin',
  'play',
  'plug',
  'router',
  'shield',
  'signal',
  'sparkles',
  'sun',
  'trending-up',
  'tv',
  'usb',
  'users',
  'wifi',
  'wifi-off',
  'x',
  'zap',
] as const;

const Text = z.string().trim().min(1);
const Cue = Text.describe('Prefix of a word spoken in this scene voice line; the element appears when the voice says it');
const Icon = z.enum(ICON_NAMES);
const Tone = z.enum(['sky', 'teal', 'warm', 'zinc']);
const ImageRef = Text.describe('Project image path like images/photo.jpg, or brand asset like brand:counter-15');

const Accent = Text.describe('Words shown right AFTER the title (or tagline) in the accent gradient; never repeat words of the title');

const Headline = { title: Text, accent: Accent.optional() };

const PromoScreen = z.strictObject({ type: z.literal('promo'), kicker: Text.optional(), big: Text, small: Text.optional(), tone: Tone.optional() });
const ListScreen = z.strictObject({
  type: z.literal('list'),
  title: Text,
  sub: Text.optional(),
  items: z.array(Text).min(1).max(5),
  select: z.number().int().nonnegative().optional(),
  field: Text.optional(),
  button: Text.optional(),
});
const UrlScreen = z.strictObject({ type: z.literal('url'), url: Text, toggle: Text.optional() });
const StatusScreen = z.strictObject({ type: z.literal('status'), title: Text, status: Text, ok: z.boolean().optional() });
const BootScreen = z.strictObject({ type: z.literal('boot') });
const OffScreen = z.strictObject({ type: z.literal('off'), text: Text.optional() });
const ImageScreen = z.strictObject({ type: z.literal('image'), src: ImageRef });

export const ScreenSchema = z.discriminatedUnion('type', [PromoScreen, ListScreen, UrlScreen, StatusScreen, BootScreen, OffScreen, ImageScreen]);
const ScreenState = z.strictObject({ screen: ScreenSchema, cue: Cue.optional() });
const ScreenStates = z.array(ScreenState).min(1).max(4);

const VisualImage = z.strictObject({ kind: z.literal('image'), src: ImageRef });
const VisualDevice = z.strictObject({ kind: z.literal('device'), device: Text, states: ScreenStates.optional() });
const VisualPhone = z.strictObject({ kind: z.literal('phone'), states: ScreenStates });
const VisualTablet = z.strictObject({ kind: z.literal('tablet'), states: ScreenStates });
const VisualTv = z.strictObject({ kind: z.literal('tv'), states: ScreenStates });
const VisualIcon = z.strictObject({ kind: z.literal('icon'), icon: Icon });
const VisualCountdown = z.strictObject({ kind: z.literal('countdown'), seconds: z.number().int().min(2).max(30), cue: Cue.optional(), icon: Icon.optional() });
const VisualTimer = z.strictObject({ kind: z.literal('timer'), labels: z.array(Text).min(2).max(6), caption: Text.optional(), cue: Cue.optional() });

export const VisualSchema = z.discriminatedUnion('kind', [VisualImage, VisualDevice, VisualPhone, VisualTablet, VisualTv, VisualIcon, VisualCountdown, VisualTimer]);

const Chip = z.strictObject({ text: Text, icon: Icon.optional(), tone: z.enum(['ok', 'no', 'warn']).optional(), cue: Cue.optional() });

const HookProps = z.strictObject({
  lines: z.array(z.strictObject({ ...Headline, cue: Cue.optional() })).min(1).max(2),
  screen: z.strictObject({ kicker: Text.optional(), text: Text, stamp: Text.optional(), offCue: Cue.optional(), stampCue: Cue.optional() }).optional(),
});
const ProblemProps = z.strictObject({ kicker: Text.optional(), items: z.array(z.strictObject({ icon: Icon, label: Text, cue: Cue.optional() })).min(2).max(4), strike: z.boolean() });
const BrandRevealProps = z.strictObject({ tagline: Text.optional(), accent: Accent.optional(), chips: z.array(Text).max(3).optional() });
const FeatureProps = z.strictObject({ ...Headline, kicker: Text.optional(), text: Text.optional(), bullets: z.array(Chip).max(5), visual: VisualSchema.optional() });
const RemoteUpdateProps = z.strictObject({
  ...Headline,
  campaign: z.strictObject({ name: Text, meta: Text.optional(), badge: Text }),
  publishCue: Cue.optional(),
  screens: z.array(z.strictObject({ label: Text, before: Text, after: Text, kicker: Text.optional() })).min(1).max(3),
});
const ScheduleProps = z.strictObject({
  ...Headline,
  axis: z.strictObject({ from: z.number().int().min(0).max(23), to: z.number().int().min(1).max(24) }),
  days: z.strictObject({ on: z.array(Text).max(7), highlight: z.array(Text).max(7).optional(), cue: Cue.optional() }).optional(),
  blocks: z.array(z.strictObject({ label: Text, start: z.number().min(0).max(24), end: z.number().min(0).max(24), row: z.union([z.literal(0), z.literal(1)]).optional(), tone: Tone.optional(), cue: Cue.optional() })).min(1).max(6),
  tags: z.array(z.strictObject({ text: Text, cue: Cue.optional() })).max(3).optional(),
});
const DashboardProps = z.strictObject({
  ...Headline,
  rows: z.array(z.strictObject({ name: Text, place: Text, now: Text })).min(1).max(5),
  stat: z.strictObject({ label: Text, value: z.number().int().nonnegative(), total: z.number().int().positive().optional(), cue: Cue.optional() }),
  alert: z.strictObject({ row: z.number().int().nonnegative(), title: Text, detail: Text, cue: Cue.optional() }).optional(),
});
const AiGenerateProps = z.strictObject({
  ...Headline,
  label: Text.optional(),
  prompt: Text,
  result: z.union([z.strictObject({ image: ImageRef }), z.strictObject({ kicker: Text.optional(), big: Text, small: Text.optional(), tone: Tone.optional() })]),
  badge: Text.optional(),
  resultCue: Cue.optional(),
});
const ContextProps = z.strictObject({ ...Headline, chips: z.array(Chip).min(1).max(4), radar: z.strictObject({ label: Text, pins: z.number().int().min(0).max(6), cue: Cue.optional() }).optional() });
const SuggestionProps = z.strictObject({ label: Text, text: Text, accent: Text.describe('Words of `text` to highlight in the accent gradient').optional(), action: Text, done: Text, actionCue: Cue.optional() });
const ProductProps = z.strictObject({
  kicker: Text.optional(),
  name: Text,
  accent: Accent.optional(),
  text: Text,
  specs: z.array(Text).max(4).optional(),
  visual: VisualSchema,
  textCue: Cue.optional(),
});
const GalleryProps = z.strictObject({ images: z.array(ImageRef).min(2).max(4), caption: Text.optional() });
const StepProps = z.strictObject({ n: z.number().int().positive().optional(), label: Text, ...Headline, text: Text.optional(), chips: z.array(Chip).max(4).optional(), visual: VisualSchema.optional() });
const ConnectionsProps = z.strictObject({
  ...Headline,
  device: Text.describe('Device id from the brand manifest'),
  links: z.array(z.strictObject({ to: z.enum(['tv', 'router', 'power', 'phone']), label: Text, cue: Cue.optional() })).min(1).max(3),
  tv: ScreenStates.optional(),
});
const DoDontProps = z.strictObject({ ...Headline, bad: z.strictObject({ title: Text, items: z.array(Text).min(1).max(3), cue: Cue.optional() }), good: z.strictObject({ title: Text, items: z.array(Text).min(1).max(3), cue: Cue.optional() }) });
const CtaProps = z.strictObject({ tagline: Text.optional(), accent: Accent.optional(), button: Text, url: Text.optional(), buttonCue: Cue.optional() });

const Unit = z.number().min(0).max(1);
const UnitSize = z.number().gt(0).max(1);

export const WALKTHROUGH_ACTIONS = ['move', 'click', 'type', 'highlight', 'callout', 'zoom'] as const;
const TEXT_ACTIONS: ReadonlySet<string> = new Set(['type', 'callout']);
const BOX_ACTIONS: ReadonlySet<string> = new Set(['type', 'highlight', 'zoom']);
const OVERFLOW_TOLERANCE = 1e-6;

const WalkthroughStep = z
  .strictObject({
    action: z.enum(WALKTHROUGH_ACTIONS).describe('move: cursor travels to x,y. click: cursor clicks at x,y. type: text is typed inside the field box. highlight: outlines the box. callout: speech bubble with text anchored at x,y. zoom: magnifies the region and returns'),
    box: Text.describe('Name of a measured box of the capture (see boxes). Use it instead of x,y,w,h whenever the brief gives the box: move, click and callout go to its center, type, highlight and zoom cover it').optional(),
    x: Unit.describe('Horizontal position over the capture, 0 = left edge, 1 = right edge. For boxes (type, highlight, zoom) it is the left edge of the box. Omit when box is set').optional(),
    y: Unit.describe('Vertical position over the capture, 0 = top edge, 1 = bottom edge. For boxes it is the top edge of the box. Omit when box is set').optional(),
    w: UnitSize.describe('Box width as a fraction of the capture width (type, highlight, zoom)').optional(),
    h: UnitSize.describe('Box height as a fraction of the capture height (type, highlight, zoom)').optional(),
    text: Text.describe('Required for type (the text typed) and callout (the bubble text)').optional(),
    cue: Cue.optional(),
    at: z.number().nonnegative().describe('Seconds from the scene start when the step happens; used only when there is no cue').optional(),
  })
  .superRefine((step, ctx) => {
    if (TEXT_ACTIONS.has(step.action) && step.text === undefined) ctx.addIssue({ code: 'custom', path: ['text'], message: `text is required when action is "${step.action}"` });
    if (step.box !== undefined) {
      if (step.x !== undefined || step.y !== undefined || step.w !== undefined || step.h !== undefined) ctx.addIssue({ code: 'custom', path: ['box'], message: 'a step uses either box or x,y,w,h, not both' });
      return;
    }
    if (step.x === undefined || step.y === undefined) ctx.addIssue({ code: 'custom', path: ['x'], message: 'x and y are required unless box is set' });
    if ((step.w !== undefined || step.h !== undefined) && !BOX_ACTIONS.has(step.action)) ctx.addIssue({ code: 'custom', path: ['w'], message: `w and h only apply to type, highlight and zoom, not "${step.action}"` });
    if (step.x !== undefined && step.w !== undefined && step.x + step.w > 1 + OVERFLOW_TOLERANCE) ctx.addIssue({ code: 'custom', path: ['w'], message: `box leaves the capture: x + w = ${step.x + step.w} must be at most 1` });
    if (step.y !== undefined && step.h !== undefined && step.y + step.h > 1 + OVERFLOW_TOLERANCE) ctx.addIssue({ code: 'custom', path: ['h'], message: `box leaves the capture: y + h = ${step.y + step.h} must be at most 1` });
  });

const UiWalkthroughProps = z.strictObject({
  title: Text.optional(),
  accent: Accent.optional(),
  image: ImageRef.describe('Capture of the interface: project image path or brand asset. All step coordinates are fractions of this image'),
  frame: z.enum(['browser', 'phone', 'none']).describe('Frame around the capture; default browser').optional(),
  url: Text.describe('Address shown in the browser bar; only with frame browser').optional(),
  boxes: ImageBoxListSchema.describe('Measured boxes of the capture, copied from the brief image; steps point at them by name with box').optional(),
  autoZoom: z.boolean().describe('The studio camera follows the steps (zooms into each one and pans between them) when the scene has no zoom step; set false to keep the full capture in view').optional(),
  steps: z.array(WalkthroughStep).min(1).max(8),
});

const sceneBase = {
  id: z.string().regex(/^[a-z][a-z0-9-]*$/u, 'kebab-case id'),
  chapter: Text.optional(),
  vo: Text.describe('Exact voice-over line for this scene, spoken in the target language'),
  minBars: z.number().positive().max(16).optional(),
  minSec: z.number().positive().max(60).describe('Minimum scene length in seconds, kept with or without beat sync and never cutting the voice; use it for scenes that carry several visual steps').optional(),
  anchor: z.union([z.literal('drop'), z.number().nonnegative()]).optional(),
  direction: VoiceDirectionSchema.describe('How this voice-over line is delivered: pace, energy, pause after the line and words to stress. Omit it for the voice default').optional(),
};

const scene = <K extends string, P extends z.ZodTypeAny>(kind: K, props: P) =>
  z.strictObject({ ...sceneBase, kind: z.literal(kind), props });

export const MotionSceneSchema = z.discriminatedUnion('kind', [
  scene('hook', HookProps),
  scene('problem', ProblemProps),
  scene('brand-reveal', BrandRevealProps),
  scene('feature', FeatureProps),
  scene('remote-update', RemoteUpdateProps),
  scene('schedule', ScheduleProps),
  scene('dashboard', DashboardProps),
  scene('ai-generate', AiGenerateProps),
  scene('context', ContextProps),
  scene('suggestion', SuggestionProps),
  scene('product', ProductProps),
  scene('gallery', GalleryProps),
  scene('step', StepProps),
  scene('connections', ConnectionsProps),
  scene('ui-walkthrough', UiWalkthroughProps),
  scene('do-dont', DoDontProps),
  scene('cta', CtaProps),
]);

export const SCENE_KINDS = MotionSceneSchema.options.map((option) => option.shape.kind.value);

export const MotionStoryboardSchema = z
  .strictObject({
    version: z.literal(1),
    title: Text,
    brand: z.string().regex(/^[a-z][a-z0-9-]*$/u),
    format: z.enum(['16:9', '9:16']),
    beatSync: z.boolean(),
    music: z
      .strictObject({
        track: Text,
        volume: z.number().min(0.05).max(1).describe('Legacy music level; the real level is calibrated automatically (about -27 LUFS without voice, 14.5 dB lower under the voice) and this value does not change it').optional(),
        mode: z.enum(['bed', 'segments']).describe('bed (default): the music runs under the voice, ducked while it speaks. segments: the music plays full in the intro, the outro and the voice-free gaps of 2 s or more, with 0.6 s fades, and drops to a very low floor while the voice speaks').optional(),
        floorDb: z.number().min(-60).max(-6).describe('Only with mode segments: dB below the full music level while the voice speaks; default -30').optional(),
      })
      .nullable(),
    voice: z.strictObject({ id: Text, lengthScale: z.number().min(0.7).max(1.4) }).optional(),
    scenes: z.array(MotionSceneSchema).min(2).max(16),
  })
  .superRefine((storyboard, ctx) => {
    const seen = new Set<string>();
    storyboard.scenes.forEach((s, index) => {
      if (seen.has(s.id)) ctx.addIssue({ code: 'custom', path: ['scenes', index, 'id'], message: `duplicated scene id "${s.id}"` });
      seen.add(s.id);
      const voice = s.vo.toLowerCase();
      (s.direction?.emphasis ?? []).forEach((word, wordIndex) => {
        if (!voice.includes(word.toLowerCase())) ctx.addIssue({ code: 'custom', path: ['scenes', index, 'direction', 'emphasis', wordIndex], message: `emphasis "${word}" is not in the vo of scene "${s.id}"` });
      });
    });
  });

export type MotionScreen = z.infer<typeof ScreenSchema>;
export type MotionVisual = z.infer<typeof VisualSchema>;
export type WalkthroughStepSpec = z.infer<typeof WalkthroughStep>;
export type MotionChip = z.infer<typeof Chip>;
export type MotionStoryboardScene = z.infer<typeof MotionSceneSchema>;
export type MotionSceneKind = MotionStoryboardScene['kind'];
export type MotionStoryboard = z.infer<typeof MotionStoryboardSchema>;
export type SceneOf<K extends MotionSceneKind> = Extract<MotionStoryboardScene, { kind: K }>;
export type IconName = (typeof ICON_NAMES)[number];
