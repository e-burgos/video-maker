import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { arollAsset, brollAsset, musicAsset } from '../__fixtures__/assets';
import { ca013Edl, ca013Format, invalidPunchInEdl } from '../__fixtures__/edl';
import { overlappingWords, spanishTranscription } from '../__fixtures__/transcription';
import * as publicApi from '../index';
import { AudioMixPlanSchema, GainKeyframeSchema } from './audio-mix-plan.schema';
import type { EditDecisionList } from './edit-decision-list.schema';
import { EditDecisionSchema, EditDecisionListSchema } from './edit-decision-list.schema';
import { buildJsonSchemaBundle, serializeJsonSchemaFile, timelineToJsonSchema } from './json-schema';
import { MediaAssetSchema } from './media-asset.schema';
import { OutputFormatSchema, SafeZoneSchema } from './output-format.schema';
import { SCHEMA_FILE_NAMES } from './registry';
import type { Timeline } from './timeline.schema';
import { TimelineSchema, TransitionTimingSchema } from './timeline.schema';
import { SegmentSchema, TranscriptionSchema, WordSchema, normalizeTranscriptionWords } from './transcription.schema';

const SCHEMAS_DIR = join(__dirname, '..', '..', 'schemas');

const PUBLIC_VALUE_EXPORTS = [
  'OUTPUT_PRESETS',
  'OutputFormatSchema',
  'OutputPresetSchema',
  'SafeZoneSchema',
  'MediaAssetSchema',
  'MediaKindSchema',
  'SegmentSchema',
  'TranscriptionEngineSchema',
  'TranscriptionSchema',
  'WordSchema',
  'normalizeTranscriptionWords',
  'BrollOverlayDecisionSchema',
  'CaptionGroupDecisionSchema',
  'CutDecisionSchema',
  'DuckDecisionSchema',
  'EditDecisionListSchema',
  'EditDecisionSchema',
  'KeepDecisionSchema',
  'PunchInDecisionSchema',
  'TransitionDecisionSchema',
  'AudioMixPlanSchema',
  'GainKeyframeSchema',
  'MusicMixSettingsSchema',
  'VoiceTargetSchema',
  'AudioClipSchema',
  'CaptionClipSchema',
  'TimelineSchema',
  'TimelineTransitionSchema',
  'VideoClipSchema',
  'framesToMs',
  'msToFrames',
  'defaultFormat',
  'safeZoneFor',
  'detectSilencesFromWords',
  'mergeSilences',
  'pruneSilences',
  'planPunchIns',
  'remapMsAfterCuts',
  'LogoOverlaySchema',
  'LogoPositionSchema',
  'DEFAULT_MUSIC_REFERENCE_LUFS',
  'MUSIC_NORMALIZATION_MAX_GAIN_DB',
  'musicNormalizationGainDb',
  'TimelineBuildError',
  'buildTimeline',
  'LANDSCAPE_LOGO_WIDTH_RATIO',
  'PORTRAIT_LOGO_WIDTH_RATIO',
  'defaultLogoWidthRatio',
  'validateTimeline',
  'timelineWarnings',
  'DEFAULT_LOGO_BUMPER_BACKGROUND_COLOR',
  'DEFAULT_LOGO_BUMPER_DURATION_MS',
  'DEFAULT_LOGO_BUMPER_WIDTH_RATIO',
  'HexColorSchema',
  'LOGO_BUMPER_ANIMATIONS',
  'LogoBumperAnimationSchema',
  'LogoBumperSchema',
  'MAX_LOGO_BUMPER_DURATION_MS',
  'MIN_LOGO_BUMPER_DURATION_MS',
  'TimelineBumpersSchema',
  'introBumperFrames',
  'logoBumperFrames',
  'outroBumperFrames',
  'timelineTotalFrames',
  'groupWordsForCaptions',
  'pickEmphasisIndex',
  'CAPTION_GEOMETRY',
  'DEFAULT_CAPTION_GEOMETRY_ID',
  'PIP_MARGIN_RATIO',
  'PIP_WIDTH_RATIO',
  'PORTRAIT_MAX_SIDE_PADDING_RATIO',
  'captionBoxRect',
  'captionGeometryForFrame',
  'captionTextRect',
  'captionTextWidthEm',
  'fitCaptionFontSizeFor',
  'pipRect',
  'DEFAULT_AUDIO_MIX_PLAN',
  'DEFAULT_MUSIC_MIX',
  'planDucking',
  'buildJsonSchemaBundle',
  'serializeJsonSchemaFile',
  'timelineToJsonSchema',
  'RemotionSceneKindSchema',
  'RemotionSceneSchema',
  'STORYBOARD_SCHEMA_VERSION',
  'StoryboardCharacterProposalSchema',
  'StoryboardCharacterSchema',
  'StoryboardDocumentSchema',
  'StoryboardFormatSchema',
  'StoryboardProposalSchema',
  'StoryboardSceneProposalSchema',
  'StoryboardSceneSchema',
  'StoryboardSourceSchema',
  'VisualSourceSchema',
  'normalizeStoryboardProposalInput',
  'storyboardProposalJsonSchema',
  'toStoryboardDocument',
  'VOICE_MANIFEST_SCHEMA_VERSION',
  'VoiceManifestSchema',
  'VoiceTrackSchema',
  'VoiceTrackSourceSchema',
  'emptyVoiceManifest',
  'DEFAULT_VOICE_SCRIPT_GAP_MS',
  'VOICE_SCRIPT_MANIFEST_SCHEMA_VERSION',
  'VoiceScriptLineSchema',
  'VoiceScriptManifestSchema',
  'splitVoiceScriptLines',
  'CaptionStyleSchema',
  'CaptionThemeSchema',
  'DELIVERY_KINDS',
  'DeliveryContractSchema',
  'REVIEW_SEVERITIES',
  'ReviewFindingSchema',
  'ReviewReportSchema',
  'ReviewSeveritySchema',
  'ReviewStatusSchema',
  'reviewStatusFor',
  'SceneFrameSchema',
  'SceneVisualReviewSchema',
  'VISUAL_VERDICTS',
  'VisualReviewSchema',
  'VISUAL_NOT_REVIEWED_CHECK',
  'VISUAL_REVIEW_CHECK',
  'VisualReviewDraftSchema',
  'isSceneFlagged',
  'visualReviewProblems',
  'withVisualReview',
  'CAPTION_STYLES',
  'captionGroupingForStyle',
  'isCaptionStyle',
  'voiceScriptManifestIsTimed',
  'hashNarration',
  'DEFAULT_SEGMENTED_MUSIC_FLOOR_DB',
  'planSegmentedMusic',
  'SEGMENTED_MUSIC_FADE_MS',
  'SEGMENTED_MUSIC_MIN_GAP_MS',
  'segmentedMusicMix',
  'directedLengthScale',
  'hasVoiceDirection',
  'MAX_VOICE_PAUSE_AFTER_MS',
  'VoiceScriptDirectionsSchema',
  'VOICE_ENERGIES',
  'VOICE_PACES',
  'VoiceDirectionSchema',
  'voiceDirectionSynthesis',
  'hasVoiceScriptTimeMarks',
  'parseVoiceScriptLines',
  'stripVoiceScriptTimeMarks',
  'planVoiceScriptPlacements',
  'VOICE_SCRIPT_MIN_LENGTH_SCALE',
  'dropVoiceTracksOutsideScenes',
  'findVoiceTrack',
  'isVoiceTrackStale',
  'upsertVoiceTrack',
  'MAX_PROPOSAL_CONCEPTS',
  'MAX_PROPOSAL_DURATION_SEC',
  'MAX_PROPOSAL_SCENES',
  'MIN_PROPOSAL_CONCEPTS',
  'PRODUCTION_PROPOSAL_STATUSES',
  'PRODUCTION_PROPOSAL_VERSION',
  'PROPOSAL_MUSIC_MODES',
  'ProductionProposalDraftSchema',
  'ProductionProposalSchema',
  'ProposalConceptSchema',
  'approveProposalConcept',
  'pendingProposalFrom',
  'MATERIAL_REVIEW_SOURCES',
  'MATERIAL_REVIEW_VERSION',
  'MATERIAL_VERDICTS',
  'MAX_MATERIAL_REVIEW_GAPS',
  'MAX_MATERIAL_REVIEW_ITEMS',
  'MaterialGapSchema',
  'MaterialReviewDraftSchema',
  'MaterialReviewItemSchema',
  'MaterialReviewSchema',
  'MaterialWarningsSchema',
  'canonicalMaterialPath',
  'hasMaterialWarnings',
  'materialReviewFrom',
  'materialWarnings',
  'REFERENCE_BRIEF_VERSION',
  'REFERENCE_ORIENTATIONS',
  'ReferenceAudioSchema',
  'ReferenceBriefSchema',
  'ReferenceFormatSchema',
  'ReferencePaceSchema',
  'ReferencePhraseSchema',
  'ReferenceSceneSchema',
  'ReferenceVoiceSchema',
  'buildReferenceSummary',
  'orientationFor',
  'paceFromScenes',
  'wordsPerMinuteFor',
].sort();

const minimalTimeline: Timeline = {
  schemaVersion: 1,
  id: 'timeline-aroll-cam-01',
  format: ca013Format,
  durationFrames: 300,
  assets: [arollAsset],
  tracks: {
    aroll: [
      {
        id: 'aroll-0001',
        assetId: 'aroll-cam-01',
        from: 0,
        durationFrames: 300,
        trimStartMs: 0,
        transform: { scale: 1, translateX: 0, translateY: 0 },
      },
    ],
    broll: [],
    voice: [],
    music: [],
    captions: [],
  },
  audioMix: {
    voice: { integratedLufs: -14, truePeakDbtp: -1, loudnessRange: 11 },
    music: { baseGainDb: -12, duckedGainDb: -24, attackMs: 150, releaseMs: 400, holdMs: 250 },
    automation: [],
  },
};

function withDecisions(edl: EditDecisionList, decisions: EditDecisionList['decisions']): EditDecisionList {
  return { ...edl, decisions };
}

describe('OutputFormatSchema', () => {
  it('acepta un formato reels-9x16 válido', () => {
    const result = OutputFormatSchema.safeParse({
      preset: 'reels-9x16',
      width: 1080,
      height: 1920,
      fps: 30,
    });

    expect(result.success).toBe(true);
  });

  it('rechaza un preset fuera de la unión cerrada', () => {
    const result = OutputFormatSchema.safeParse({
      preset: 'square-1x1',
      width: 1080,
      height: 1920,
      fps: 30,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['preset']);
    }
  });

  it('rechaza un fps fuera de la unión cerrada', () => {
    const result = OutputFormatSchema.safeParse({
      preset: 'reels-9x16',
      width: 1080,
      height: 1920,
      fps: 29,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['fps']);
    }
  });

  it('rechaza width por debajo del mínimo', () => {
    const result = OutputFormatSchema.safeParse({
      preset: 'reels-9x16',
      width: 100,
      height: 1920,
      fps: 30,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['width']);
    }
  });

  it('rechaza propiedades adicionales', () => {
    const result = OutputFormatSchema.safeParse({
      preset: 'reels-9x16',
      width: 1080,
      height: 1920,
      fps: 30,
      extra: true,
    });

    expect(result.success).toBe(false);
  });
});

describe('SafeZoneSchema', () => {
  it('acepta márgenes enteros', () => {
    const result = SafeZoneSchema.safeParse({ top: 220, bottom: 400, left: 60, right: 140 });

    expect(result.success).toBe(true);
  });

  it('rechaza un margen no entero', () => {
    const result = SafeZoneSchema.safeParse({ top: 220.5, bottom: 400, left: 60, right: 140 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['top']);
    }
  });
});

describe('MediaAssetSchema', () => {
  it('acepta el fixture de video arollAsset', () => {
    expect(MediaAssetSchema.safeParse(arollAsset).success).toBe(true);
  });

  it('acepta el fixture de imagen brollAsset', () => {
    expect(MediaAssetSchema.safeParse(brollAsset).success).toBe(true);
  });

  it('acepta el fixture de audio musicAsset', () => {
    expect(MediaAssetSchema.safeParse(musicAsset).success).toBe(true);
  });

  it('rechaza un asset video sin fps', () => {
    const result = MediaAssetSchema.safeParse({
      id: 'video-sin-fps',
      kind: 'video',
      path: '/fixtures/video-sin-fps.mp4',
      durationMs: 5_000,
      width: 1080,
      height: 1920,
      hasAudio: true,
      probedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'fps')).toBe(true);
    }
  });

  it('rechaza un asset video sin width', () => {
    const result = MediaAssetSchema.safeParse({
      id: 'video-sin-width',
      kind: 'video',
      path: '/fixtures/video-sin-width.mp4',
      durationMs: 5_000,
      fps: 30,
      height: 1920,
      hasAudio: true,
      probedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'width')).toBe(true);
    }
  });

  it('rechaza un asset video sin height', () => {
    const result = MediaAssetSchema.safeParse({
      id: 'video-sin-height',
      kind: 'video',
      path: '/fixtures/video-sin-height.mp4',
      durationMs: 5_000,
      fps: 30,
      width: 1080,
      hasAudio: true,
      probedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'height')).toBe(true);
    }
  });

  it('rechaza un asset video sin hasAudio', () => {
    const result = MediaAssetSchema.safeParse({
      id: 'video-sin-has-audio',
      kind: 'video',
      path: '/fixtures/video-sin-has-audio.mp4',
      durationMs: 5_000,
      fps: 30,
      width: 1080,
      height: 1920,
      probedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'hasAudio')).toBe(true);
    }
  });

  it('rechaza un asset image con durationMs distinto de cero', () => {
    const result = MediaAssetSchema.safeParse({ ...brollAsset, durationMs: 500 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['durationMs']);
    }
  });

  it('rechaza un asset image con fps declarado', () => {
    const result = MediaAssetSchema.safeParse({ ...brollAsset, fps: 30 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['fps']);
    }
  });

  it('rechaza propiedades adicionales', () => {
    const result = MediaAssetSchema.safeParse({ ...arollAsset, extra: true });

    expect(result.success).toBe(false);
  });
});

describe('WordSchema y SegmentSchema', () => {
  it('rechaza una palabra vacía', () => {
    const result = WordSchema.safeParse({ text: '', startMs: 0, endMs: 100 });

    expect(result.success).toBe(false);
  });

  it('acepta un segmento sin additionalProperties: false', () => {
    const result = SegmentSchema.safeParse({
      startMs: 0,
      endMs: 100,
      text: 'hola',
      wordRange: [0, 1],
      note: 'campo no declarado en el contrato pero permitido',
    });

    expect(result.success).toBe(true);
  });
});

describe('TranscriptionSchema', () => {
  it('acepta el fixture spanishTranscription completo', () => {
    const result = TranscriptionSchema.safeParse(spanishTranscription);

    expect(result.success).toBe(true);
  });

  it('rechaza propiedades adicionales en el documento', () => {
    const result = TranscriptionSchema.safeParse({ ...spanishTranscription, extra: true });

    expect(result.success).toBe(false);
  });

  it('rechaza una palabra con endMs menor que startMs (T1)', () => {
    const words = spanishTranscription.words.map((word, index) =>
      index === 0 ? { ...word, startMs: 300, endMs: 100 } : word,
    );

    const result = TranscriptionSchema.safeParse({ ...spanishTranscription, words });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'words.0.endMs')).toBe(true);
    }
  });

  it('rechaza palabras que no están ordenadas por startMs (T2)', () => {
    const words = [
      { text: 'a', startMs: 100, endMs: 100 },
      { text: 'b', startMs: 50, endMs: 80 },
    ];

    const result = TranscriptionSchema.safeParse({ ...spanishTranscription, words });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'words.1.startMs')).toBe(true);
    }
  });

  it('rechaza palabras solapadas (T3)', () => {
    const result = TranscriptionSchema.safeParse({
      ...spanishTranscription,
      words: overlappingWords,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'words.0.endMs')).toBe(true);
    }
  });

  it('rechaza un wordRange fuera de los límites de words (T4)', () => {
    const segments = [{ ...spanishTranscription.segments[0], wordRange: [0, 25] as [number, number] }];

    const result = TranscriptionSchema.safeParse({ ...spanishTranscription, segments });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'segments.0.wordRange')).toBe(true);
    }
  });

  it('rechaza un wordRange con el extremo inicial mayor que el final (T4)', () => {
    const segments = [{ ...spanishTranscription.segments[0], wordRange: [5, 3] as [number, number] }];

    const result = TranscriptionSchema.safeParse({ ...spanishTranscription, segments });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'segments.0.wordRange')).toBe(true);
    }
  });
});

describe('EditDecisionSchema', () => {
  it('acepta cada variante de decisión', () => {
    const decisions: unknown[] = [
      { id: 'keep-0001', type: 'keep', startMs: 0, endMs: 100 },
      { id: 'cut-0001', type: 'cut', startMs: 100, endMs: 200, reason: 'silence' },
      { id: 'punch-0001', type: 'punch-in', startMs: 0, endMs: 100, scale: 1.1 },
      {
        id: 'broll-0001',
        type: 'broll-overlay',
        startMs: 0,
        endMs: 100,
        assetId: 'broll-shot-01',
        fit: 'cover',
      },
      { id: 'trans-0001', type: 'transition', atMs: 100, kind: 'fade', durationMs: 300 },
      {
        id: 'cap-0001',
        type: 'caption-group',
        startMs: 0,
        endMs: 100,
        words: [{ text: 'hola', startMs: 0, endMs: 100 }],
      },
      { id: 'duck-0001', type: 'duck', startMs: 0, endMs: 100, gainDb: -12 },
    ];

    decisions.forEach((decision) => {
      expect(EditDecisionSchema.safeParse(decision).success).toBe(true);
    });
  });

  it('rechaza un tipo de decisión desconocido', () => {
    const result = EditDecisionSchema.safeParse({
      id: 'unknown-0001',
      type: 'zoom',
      startMs: 0,
      endMs: 100,
    });

    expect(result.success).toBe(false);
  });
});

describe('EditDecisionListSchema', () => {
  it('acepta el fixture ca013Edl', () => {
    expect(EditDecisionListSchema.safeParse(ca013Edl).success).toBe(true);
  });

  it('rechaza propiedades adicionales en el documento', () => {
    const result = EditDecisionListSchema.safeParse({ ...ca013Edl, extra: true });

    expect(result.success).toBe(false);
  });

  it('rechaza un punch-in dentro de un cut (CA-015, E4)', () => {
    const result = EditDecisionListSchema.safeParse(invalidPunchInEdl);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'decisions.3')).toBe(true);
    }
  });

  it('rechaza ids de decisión duplicados (E1)', () => {
    const decisions = withDecisions(
      ca013Edl,
      ca013Edl.decisions.map((decision) =>
        decision.id === 'cap-0003' ? { ...decision, id: 'keep-0001' } : decision,
      ),
    );

    const result = EditDecisionListSchema.safeParse(decisions);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.join('.').endsWith('.id')),
      ).toBe(true);
    }
  });

  it('rechaza endMs menor o igual que startMs (E2)', () => {
    const decisions = withDecisions(ca013Edl, [
      { id: 'keep-0001', type: 'keep', startMs: 100, endMs: 100 },
    ]);

    const result = EditDecisionListSchema.safeParse(decisions);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'decisions.0.endMs')).toBe(true);
    }
  });

  it('rechaza un hueco entre keep y cut (E3)', () => {
    const decisions = withDecisions(ca013Edl, [
      { id: 'keep-0001', type: 'keep', startMs: 0, endMs: 4080 },
      { id: 'cut-0001', type: 'cut', startMs: 4200, endMs: 4920, reason: 'silence' },
      { id: 'keep-0002', type: 'keep', startMs: 4920, endMs: 10_000 },
    ]);

    const result = EditDecisionListSchema.safeParse(decisions);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'decisions.1.startMs')).toBe(true);
    }
  });

  it('rechaza un solape entre keep y cut (E3)', () => {
    const decisions = withDecisions(ca013Edl, [
      { id: 'keep-0001', type: 'keep', startMs: 0, endMs: 4080 },
      { id: 'cut-0001', type: 'cut', startMs: 4000, endMs: 4920, reason: 'silence' },
      { id: 'keep-0002', type: 'keep', startMs: 4920, endMs: 10_000 },
    ]);

    const result = EditDecisionListSchema.safeParse(decisions);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'decisions.1.startMs')).toBe(true);
    }
  });

  it('rechaza una decisión de partición que no arranca en 0 (E3)', () => {
    const decisions = withDecisions(ca013Edl, [{ id: 'keep-0001', type: 'keep', startMs: 10, endMs: 4080 }]);

    const result = EditDecisionListSchema.safeParse(decisions);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'decisions.0.startMs')).toBe(true);
    }
  });

  it('rechaza un broll-overlay fuera de todo keep (E4)', () => {
    const decisions = withDecisions(ca013Edl, [
      ...ca013Edl.decisions,
      { id: 'broll-0002', type: 'broll-overlay', startMs: 4200, endMs: 4500, assetId: 'broll-shot-01', fit: 'cover' },
    ]);

    const result = EditDecisionListSchema.safeParse(decisions);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'decisions.9')).toBe(true);
    }
  });

  it('rechaza un caption-group fuera de todo keep (E4)', () => {
    const decisions = withDecisions(ca013Edl, [
      ...ca013Edl.decisions,
      {
        id: 'cap-0004',
        type: 'caption-group',
        startMs: 4200,
        endMs: 4400,
        words: [{ text: 'silencio', startMs: 4200, endMs: 4400 }],
      },
    ]);

    const result = EditDecisionListSchema.safeParse(decisions);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'decisions.9')).toBe(true);
    }
  });

  it('rechaza un duck fuera de todo keep (E4)', () => {
    const decisions = withDecisions(ca013Edl, [
      ...ca013Edl.decisions,
      { id: 'duck-0001', type: 'duck', startMs: 4200, endMs: 4400, gainDb: -12 },
    ]);

    const result = EditDecisionListSchema.safeParse(decisions);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'decisions.9')).toBe(true);
    }
  });

  it('rechaza un transition.atMs que no coincide con el borde de un keep posterior (E5)', () => {
    const decisions = withDecisions(
      ca013Edl,
      ca013Edl.decisions.map((decision) =>
        decision.type === 'transition' ? { ...decision, atMs: 1000 } : decision,
      ),
    );

    const result = EditDecisionListSchema.safeParse(decisions);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'decisions.5.atMs')).toBe(true);
    }
  });

  it('rechaza un transition.atMs que coincide con el primer keep (E5)', () => {
    const decisions = withDecisions(
      ca013Edl,
      ca013Edl.decisions.map((decision) =>
        decision.type === 'transition' ? { ...decision, atMs: 0 } : decision,
      ),
    );

    const result = EditDecisionListSchema.safeParse(decisions);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'decisions.5.atMs')).toBe(true);
    }
  });

  it('rechaza dos punch-in solapados (E6)', () => {
    const decisions = withDecisions(ca013Edl, [
      { id: 'keep-0001', type: 'keep', startMs: 0, endMs: 10_000 },
      { id: 'punch-0001', type: 'punch-in', startMs: 0, endMs: 500, scale: 1.1 },
      { id: 'punch-0002', type: 'punch-in', startMs: 300, endMs: 800, scale: 1.15 },
    ]);

    const result = EditDecisionListSchema.safeParse(decisions);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'decisions.2.startMs')).toBe(true);
    }
  });

  it('rechaza un emphasisIndex fuera de rango (E7)', () => {
    const decisions = withDecisions(
      ca013Edl,
      ca013Edl.decisions.map((decision) =>
        decision.id === 'cap-0003' ? { ...decision, emphasisIndex: 5 } : decision,
      ),
    );

    const result = EditDecisionListSchema.safeParse(decisions);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'decisions.8.emphasisIndex')).toBe(true);
    }
  });

  it('rechaza palabras de caption-group desordenadas (E8)', () => {
    const decisions = withDecisions(
      ca013Edl,
      ca013Edl.decisions.map((decision) =>
        decision.id === 'cap-0003' && decision.type === 'caption-group'
          ? {
              ...decision,
              words: [
                { text: 'totalmente', startMs: 5320, endMs: 6000 },
                { text: 'nada', startMs: 5000, endMs: 5300 },
              ],
            }
          : decision,
      ),
    );

    const result = EditDecisionListSchema.safeParse(decisions);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.join('.') === 'decisions.8.words.1.startMs'),
      ).toBe(true);
    }
  });

  it('rechaza palabras de caption-group fuera del rango de la decisión (E8)', () => {
    const decisions = withDecisions(
      ca013Edl,
      ca013Edl.decisions.map((decision) =>
        decision.id === 'cap-0003' && decision.type === 'caption-group'
          ? {
              ...decision,
              words: [
                { text: 'nada', startMs: 5000, endMs: decision.endMs + 500 },
                { text: 'totalmente', startMs: 5320, endMs: 6000 },
              ],
            }
          : decision,
      ),
    );

    const result = EditDecisionListSchema.safeParse(decisions);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.join('.') === 'decisions.8.words.0.startMs'),
      ).toBe(true);
    }
  });
});

describe('AudioMixPlanSchema', () => {
  it('aplica los defaults de voice y music', () => {
    const result = AudioMixPlanSchema.safeParse({ voice: {}, music: {}, automation: [] });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.voice).toEqual({ integratedLufs: -14, truePeakDbtp: -1, loudnessRange: 11 });
      expect(result.data.music).toEqual({
        baseGainDb: -12,
        duckedGainDb: -24,
        referenceLufs: -16,
        attackMs: 150,
        releaseMs: 400,
        holdMs: 250,
      });
    }
  });

  it('acepta valores explícitos que sobreescriben los defaults', () => {
    const result = AudioMixPlanSchema.safeParse({
      voice: { integratedLufs: -16, truePeakDbtp: -2, loudnessRange: 9 },
      music: { baseGainDb: -10, duckedGainDb: -20, attackMs: 100, releaseMs: 300, holdMs: 200 },
      automation: [{ frame: 0, gainDb: -12 }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.voice.integratedLufs).toBe(-16);
      expect(result.data.music.baseGainDb).toBe(-10);
    }
  });

  it('rechaza propiedades adicionales en el documento', () => {
    const result = AudioMixPlanSchema.safeParse({ voice: {}, music: {}, automation: [], extra: true });

    expect(result.success).toBe(false);
  });

  it('rechaza un keyframe con frame negativo', () => {
    const result = GainKeyframeSchema.safeParse({ frame: -1, gainDb: -12 });

    expect(result.success).toBe(false);
  });
});

describe('TransitionTimingSchema', () => {
  it('acepta la variante linear', () => {
    expect(TransitionTimingSchema.safeParse({ type: 'linear' }).success).toBe(true);
  });

  it('acepta la variante spring completa', () => {
    const result = TransitionTimingSchema.safeParse({
      type: 'spring',
      damping: 10,
      stiffness: 100,
      mass: 1,
    });

    expect(result.success).toBe(true);
  });

  it('rechaza una variante spring incompleta', () => {
    const result = TransitionTimingSchema.safeParse({ type: 'spring', damping: 10 });

    expect(result.success).toBe(false);
  });
});

describe('TimelineSchema', () => {
  it('acepta una timeline mínima válida', () => {
    expect(TimelineSchema.safeParse(minimalTimeline).success).toBe(true);
  });

  it('acepta un captionClip con box y sin box', () => {
    const withBox: Timeline = {
      ...minimalTimeline,
      tracks: {
        ...minimalTimeline.tracks,
        captions: [
          {
            id: 'caption-0001',
            from: 0,
            durationFrames: 30,
            words: [{ text: 'hola', fromFrame: 0, durationFrames: 30 }],
            box: { x: 60, y: 220, width: 960, height: 1300 },
          },
        ],
      },
    };
    const withoutBox: Timeline = {
      ...minimalTimeline,
      tracks: {
        ...minimalTimeline.tracks,
        captions: [{ id: 'caption-0002', from: 0, durationFrames: 30, words: [{ text: 'hola', fromFrame: 0, durationFrames: 30 }] }],
      },
    };

    expect(TimelineSchema.safeParse(withBox).success).toBe(true);
    expect(TimelineSchema.safeParse(withoutBox).success).toBe(true);
  });

  it('rechaza durationFrames menor que 1', () => {
    const result = TimelineSchema.safeParse({ ...minimalTimeline, durationFrames: 0 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'durationFrames')).toBe(true);
    }
  });

  it('rechaza propiedades adicionales en el documento', () => {
    const result = TimelineSchema.safeParse({ ...minimalTimeline, extra: true });

    expect(result.success).toBe(false);
  });

  it('rechaza ids de clip duplicados entre tracks', () => {
    const duplicated: Timeline = {
      ...minimalTimeline,
      tracks: {
        ...minimalTimeline.tracks,
        broll: [
          {
            id: 'aroll-0001',
            assetId: 'broll-shot-01',
            from: 0,
            durationFrames: 30,
            trimStartMs: 0,
            transform: { scale: 1, translateX: 0, translateY: 0 },
          },
        ],
      },
    };

    const result = TimelineSchema.safeParse(duplicated);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'tracks.broll.0.id')).toBe(true);
    }
  });

  it('acepta transiciones y assetId de assets referenciados', () => {
    const withTransition: Timeline = {
      ...minimalTimeline,
      transitions: [
        {
          betweenClipIds: ['aroll-0001', 'aroll-0002'],
          kind: 'fade',
          durationFrames: 9,
          timing: { type: 'spring', damping: 10, stiffness: 100, mass: 1 },
        },
      ],
    };

    expect(TimelineSchema.safeParse(withTransition).success).toBe(true);
  });
});

describe('superficie pública de src/index.ts', () => {
  it('exporta exactamente los valores de la API pública del architect (CA-016)', () => {
    const actualExports = Object.keys(publicApi).sort();

    expect(actualExports).toEqual(PUBLIC_VALUE_EXPORTS);
  });
});

describe('JSON Schema commiteado vs generado (CA-016)', () => {
  const bundle = buildJsonSchemaBundle();

  it.each(SCHEMA_FILE_NAMES)('%s.schema.json coincide byte a byte con el generador', (id) => {
    const committedPath = join(SCHEMAS_DIR, `${id}.schema.json`);
    const committed = readFileSync(committedPath, 'utf8');
    const generated = serializeJsonSchemaFile(bundle[id]);

    expect(committed, 'correr `pnpm nx run timeline-core:schemas`').toBe(generated);
  });

  it('timelineToJsonSchema() devuelve el mismo documento que el bundle completo', () => {
    expect(timelineToJsonSchema()).toEqual(bundle.timeline);
    expect(timelineToJsonSchema().$id).toBe('https://video-maker.local/schemas/timeline.schema.json');
  });
});

describe('normalizeTranscriptionWords (D-08)', () => {
  it('recorta el endMs de una palabra al startMs de la siguiente cuando se solapan', () => {
    const words = [
      { text: 'hola', startMs: 0, endMs: 600 },
      { text: 'mundo', startMs: 500, endMs: 900 },
    ];

    expect(normalizeTranscriptionWords(words)).toEqual([
      { text: 'hola', startMs: 0, endMs: 500 },
      { text: 'mundo', startMs: 500, endMs: 900 },
    ]);
  });

  it('no modifica palabras ya contiguas o sin solape', () => {
    const words = [
      { text: 'hola', startMs: 0, endMs: 400 },
      { text: 'mundo', startMs: 500, endMs: 900 },
    ];

    expect(normalizeTranscriptionWords(words)).toEqual(words);
  });

  it('no muta el arreglo de entrada', () => {
    const words = [
      { text: 'hola', startMs: 0, endMs: 600 },
      { text: 'mundo', startMs: 500, endMs: 900 },
    ];
    const original = structuredClone(words);

    normalizeTranscriptionWords(words);

    expect(words).toEqual(original);
  });

  it('devuelve [] para una lista vacía', () => {
    expect(normalizeTranscriptionWords([])).toEqual([]);
  });
});

describe('TimelineSchema captionTheme', () => {
  const captionTheme = {
    fontFamily: 'Outfit',
    fontFiles: [{ path: 'work/brand/fonts/outfit.woff2', weight: '100 900' }],
    textColor: '#ffffff',
    accentColor: '#0ea5e9',
    boxColor: '#09090b',
  };

  it('acepta captionStyle brand con captionTheme', () => {
    expect(TimelineSchema.safeParse({ ...minimalTimeline, captionStyle: 'brand', captionTheme }).success).toBe(true);
  });

  it('rechaza captionStyle brand sin captionTheme con un mensaje claro', () => {
    const result = TimelineSchema.safeParse({ ...minimalTimeline, captionStyle: 'brand' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['captionTheme']);
  });

  it('rechaza un captionTheme con colores que no son hex', () => {
    expect(
      TimelineSchema.safeParse({ ...minimalTimeline, captionTheme: { ...captionTheme, textColor: 'white' } }).success,
    ).toBe(false);
  });
});

describe('Timeline delivery contract', () => {
  it('acepta una Timeline sin contrato de entrega', () => {
    expect(TimelineSchema.safeParse(minimalTimeline).success).toBe(true);
  });

  it('acepta un contrato de entrega completo', () => {
    const delivery = {
      kind: 'short',
      requiresVoice: true,
      requiresCaptions: true,
      maxDurationSec: 180,
      format: 'vertical-1080x1920',
    };

    expect(TimelineSchema.safeParse({ ...minimalTimeline, delivery }).success).toBe(true);
  });

  it('rechaza un kind desconocido y claves extra', () => {
    expect(TimelineSchema.safeParse({ ...minimalTimeline, delivery: { kind: 'podcast' } }).success).toBe(false);
    expect(TimelineSchema.safeParse({ ...minimalTimeline, delivery: { kind: 'short', extra: 1 } }).success).toBe(false);
  });
});
