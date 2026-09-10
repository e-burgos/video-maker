import { normalizeTerm } from '../concepts/normalize-term';

export interface ScriptToken {
  readonly text: string;
  readonly key: string;
}

export function tokenizeScript(scriptText: string): readonly ScriptToken[] {
  return scriptText
    .split(/\s+/u)
    .map((text) => ({ text, key: normalizeTerm(text) }))
    .filter((token) => token.key.length > 0);
}
