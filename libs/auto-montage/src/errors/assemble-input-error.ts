import { AutoMontageError } from './auto-montage-error';

export type AssembleInputReason =
  | 'storyboard-missing'
  | 'storyboard-invalid'
  | 'catalog-missing'
  | 'voice-invalid'
  | 'assignment-invalid'
  | 'words-invalid';

export interface AssembleInputErrorInput {
  readonly reason: AssembleInputReason;
  readonly resource: string;
  readonly detail?: string;
}

const REASON_MESSAGES: Record<AssembleInputReason, string> = {
  'storyboard-missing': 'El proyecto no tiene un storyboard para ensamblar.',
  'storyboard-invalid': 'El storyboard del proyecto no cumple su schema.',
  'catalog-missing': 'El proyecto no tiene catálogo: falta correr la ingesta.',
  'voice-invalid': 'El manifest de voz del proyecto no cumple su schema.',
  'assignment-invalid': 'La asignación de visuales por escena no cumple su schema.',
  'words-invalid': 'Un documento de palabras de la voz no cumple su schema.',
};

export class AssembleInputError extends AutoMontageError {
  readonly code = 'ASSEMBLE_INPUT_INVALID';
  readonly reason: AssembleInputReason;
  readonly resource: string;
  readonly detail: string | null;

  constructor({ reason, resource, detail }: AssembleInputErrorInput) {
    super(`${REASON_MESSAGES[reason]} (${resource})`);
    this.name = 'AssembleInputError';
    this.reason = reason;
    this.resource = resource;
    this.detail = detail ?? null;
  }
}
