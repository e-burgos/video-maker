import type { EditDecisionList } from '../schemas/edit-decision-list.schema';
import type { OutputFormat } from '../schemas/output-format.schema';

export const ca013Format: OutputFormat = {
  preset: 'reels-9x16',
  width: 1080,
  height: 1920,
  fps: 30,
};

export const ca013Edl: EditDecisionList = {
  schemaVersion: 1,
  sourceAssetId: 'aroll-cam-01',
  format: ca013Format,
  generatedBy: { tool: 'fixture', params: {} },
  decisions: [
    { id: 'keep-0001', type: 'keep', startMs: 0, endMs: 4080 },
    { id: 'cut-0001', type: 'cut', startMs: 4080, endMs: 4920, reason: 'silence' },
    { id: 'keep-0002', type: 'keep', startMs: 4920, endMs: 10_000 },
    {
      id: 'punch-0001',
      type: 'punch-in',
      startMs: 4920,
      endMs: 10_000,
      scale: 1.15,
      anchor: 'center',
    },
    {
      id: 'broll-0001',
      type: 'broll-overlay',
      startMs: 5200,
      endMs: 7200,
      assetId: 'broll-shot-01',
      fit: 'cover',
      keepVoice: true,
    },
    {
      id: 'trans-0001',
      type: 'transition',
      atMs: 4920,
      kind: 'fade',
      durationMs: 300,
      timing: 'spring',
    },
    {
      id: 'cap-0001',
      type: 'caption-group',
      startMs: 500,
      endMs: 1600,
      words: [
        { text: 'te', startMs: 500, endMs: 700 },
        { text: 'muestro', startMs: 720, endMs: 1100 },
        { text: 'cómo', startMs: 1120, endMs: 1600 },
      ],
      emphasisIndex: 1,
    },
    {
      id: 'cap-0002',
      type: 'caption-group',
      startMs: 1700,
      endMs: 2800,
      words: [
        { text: 'editar', startMs: 1700, endMs: 2050 },
        { text: 'un', startMs: 2070, endMs: 2180 },
        { text: 'video', startMs: 2200, endMs: 2800 },
      ],
      emphasisIndex: 2,
    },
    {
      id: 'cap-0003',
      type: 'caption-group',
      startMs: 5000,
      endMs: 6000,
      words: [
        { text: 'nada', startMs: 5000, endMs: 5300 },
        { text: 'totalmente', startMs: 5320, endMs: 6000 },
      ],
      emphasisIndex: 0,
    },
  ],
};

function withRange<T extends { startMs: number; endMs: number }>(
  decision: T,
  range: { startMs: number; endMs: number },
): T {
  return { ...decision, ...range };
}

export const invalidPunchInEdl: EditDecisionList = {
  ...ca013Edl,
  decisions: ca013Edl.decisions.map((decision) =>
    decision.type === 'punch-in' ? withRange(decision, { startMs: 4200, endMs: 4600 }) : decision,
  ),
};
