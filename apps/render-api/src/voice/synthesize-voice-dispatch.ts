import type { SynthesizeVoiceInput, SynthesizeVoicePort } from '../deps/render-api-dependencies';
import { isElevenLabsVoiceId } from './elevenlabs-voice';

export interface VoiceEngineSynthesizers {
  readonly piper: SynthesizeVoicePort;
  readonly elevenlabs: SynthesizeVoicePort;
}

export function createVoiceSynthesisDispatcher(engines: VoiceEngineSynthesizers): SynthesizeVoicePort {
  return (input: SynthesizeVoiceInput) =>
    input.voiceId !== undefined && isElevenLabsVoiceId(input.voiceId)
      ? engines.elevenlabs(input)
      : engines.piper(input);
}
