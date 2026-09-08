import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { Sequence } from 'remotion';
import { defaultFormat } from '@video-maker/timeline-core';
import { captionClipPlan } from '../helpers/caption-clip-plan';
import { captionPreset } from '../helpers/caption-preset';
import type { CaptionSequenceProps } from '../helpers/timeline-to-sequence-props';
import type { CaptionBox } from '../helpers/timeline-types';
import { KineticCaptions } from './kinetic-captions';

interface CaptionBoxDivProps {
  style: {
    left: number;
    top: number;
    width: number;
    height: number;
    fontSize: number;
    transform?: string;
  };
  children: ReactNode;
}

type SequenceElement = ReactElement<{
  from: number;
  durationInFrames: number;
  children: ReactNode;
}>;

function sequenceChildrenOf(tree: ReactNode): readonly SequenceElement[] {
  if (!isValidElement(tree)) {
    return [];
  }

  const fragmentProps = tree.props as { children?: ReactNode };
  return Children.toArray(fragmentProps.children).filter(
    isValidElement,
  ) as readonly SequenceElement[];
}

function boxDivOf(sequence: SequenceElement): ReactElement<CaptionBoxDivProps> {
  const boxDiv = sequence.props.children;

  if (!isValidElement(boxDiv)) {
    throw new Error('expected the Sequence to render a single box div');
  }

  return boxDiv as ReactElement<CaptionBoxDivProps>;
}

const FORMAT = defaultFormat('tiktok-9x16');
const PRESET = captionPreset('bold-impact');

function clip(id: string, from: number, durationInFrames: number, box: CaptionBox | null = null): CaptionSequenceProps {
  return {
    clipId: id,
    from,
    durationInFrames,
    words: [{ text: 'hola', fromFrame: 0, durationFrames: durationInFrames }],
    emphasisIndex: null,
    box,
  };
}

describe('KineticCaptions', () => {
  it('monta una Sequence por clip, con from/durationInFrames exactos (CA-009)', () => {
    const clips = [clip('cap-0001', 0, 30), clip('cap-0002', 40, 20)];

    const tree = KineticCaptions({ clips, format: FORMAT });
    const sequences = sequenceChildrenOf(tree);

    expect(sequences).toHaveLength(clips.length);
    sequences.forEach((sequence, index) => {
      expect(sequence.type).toBe(Sequence);
      expect(sequence.props.from).toBe(clips[index]?.from);
      expect(sequence.props.durationInFrames).toBe(clips[index]?.durationInFrames);
      expect(String(sequence.key)).toContain(clips[index]?.clipId ?? '');
    });
  });

  it('con clips: [] no produce ningún hijo, sin lanzar', () => {
    const tree = KineticCaptions({ clips: [], format: FORMAT });

    expect(sequenceChildrenOf(tree)).toHaveLength(0);
  });

  it('el <div> de la caja no tiene clave transform (R-8, nivel 2) y coincide con captionClipPlan', () => {
    const clips = [clip('cap-0001', 0, 30)];

    const tree = KineticCaptions({ clips, format: FORMAT, preset: 'bold-impact' });
    const [sequence] = sequenceChildrenOf(tree);

    expect(sequence).toBeDefined();
    if (sequence === undefined) {
      throw new Error('expected at least one Sequence');
    }

    const boxDiv = boxDivOf(sequence);
    const [expectedPlan] = captionClipPlan({ clips, format: FORMAT, preset: PRESET });

    expect(expectedPlan).toBeDefined();
    expect('transform' in boxDiv.props.style).toBe(false);
    expect(boxDiv.props.style.left).toBe(expectedPlan?.box.x);
    expect(boxDiv.props.style.top).toBe(expectedPlan?.box.y);
    expect(boxDiv.props.style.width).toBe(expectedPlan?.box.width);
    expect(boxDiv.props.style.height).toBe(expectedPlan?.box.height);
    expect(boxDiv.props.style.fontSize).toBe(expectedPlan?.fontSize);
  });

  it("con boxSource: 'clip' y un clip con box, el <div> de la caja usa el box del clip (R-9 en el árbol real)", () => {
    const clipBox: CaptionBox = { x: 10, y: 20, width: 300, height: 100 };
    const clips = [clip('cap-0001', 0, 30, clipBox)];

    const tree = KineticCaptions({ clips, format: FORMAT, boxSource: 'clip' });
    const [sequence] = sequenceChildrenOf(tree);

    expect(sequence).toBeDefined();
    if (sequence === undefined) {
      throw new Error('expected at least one Sequence');
    }

    const boxDiv = boxDivOf(sequence);

    expect(boxDiv.props.style.left).toBe(clipBox.x);
    expect(boxDiv.props.style.top).toBe(clipBox.y);
    expect(boxDiv.props.style.width).toBe(clipBox.width);
    expect(boxDiv.props.style.height).toBe(clipBox.height);
  });
});
