import type { Word } from '@video-maker/timeline-core';

function normalizedToken(token: string): string {
  return token
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function scriptTokens(text: string): readonly string[] {
  return text.split(/\s+/u).filter((token) => normalizedToken(token) !== '');
}

function matchedPairs(script: readonly string[], heard: readonly string[]): ReadonlyMap<number, number> {
  const columns = heard.length + 1;
  const lengths = new Array<number>((script.length + 1) * columns).fill(0);
  const lengthAt = (scriptIndex: number, heardIndex: number): number => lengths[scriptIndex * columns + heardIndex] ?? 0;
  for (let scriptIndex = script.length - 1; scriptIndex >= 0; scriptIndex -= 1) {
    for (let heardIndex = heard.length - 1; heardIndex >= 0; heardIndex -= 1) {
      lengths[scriptIndex * columns + heardIndex] =
        script[scriptIndex] === heard[heardIndex]
          ? lengthAt(scriptIndex + 1, heardIndex + 1) + 1
          : Math.max(lengthAt(scriptIndex + 1, heardIndex), lengthAt(scriptIndex, heardIndex + 1));
    }
  }

  const pairs = new Map<number, number>();
  let scriptIndex = 0;
  let heardIndex = 0;
  while (scriptIndex < script.length && heardIndex < heard.length) {
    if (script[scriptIndex] === heard[heardIndex]) {
      pairs.set(scriptIndex, heardIndex);
      scriptIndex += 1;
      heardIndex += 1;
    } else if (lengthAt(scriptIndex + 1, heardIndex) >= lengthAt(scriptIndex, heardIndex + 1)) {
      scriptIndex += 1;
    } else {
      heardIndex += 1;
    }
  }
  return pairs;
}

function spreadOver(tokens: readonly string[], startMs: number, endMs: number): Word[] {
  const spanMs = Math.max(0, endMs - startMs);
  return tokens.map((text, index) => ({
    text,
    startMs: startMs + Math.round((spanMs * index) / tokens.length),
    endMs: startMs + Math.round((spanMs * (index + 1)) / tokens.length),
  }));
}

export function alignScriptTextToWords(scriptText: string, heardWords: readonly Word[]): readonly Word[] {
  const tokens = scriptTokens(scriptText);
  const first = heardWords[0];
  const last = heardWords[heardWords.length - 1];
  if (tokens.length === 0 || first === undefined || last === undefined) {
    return heardWords;
  }

  const lineStartMs = first.startMs;
  const lineEndMs = last.endMs;
  const pairs = matchedPairs(tokens.map(normalizedToken), heardWords.map((word) => normalizedToken(word.text)));
  if (pairs.size === 0) {
    return spreadOver(tokens, lineStartMs, lineEndMs);
  }

  const aligned: Word[] = [];
  let pending: string[] = [];
  let pendingStartMs = lineStartMs;

  tokens.forEach((token, index) => {
    const heardIndex = pairs.get(index);
    const heard = heardIndex === undefined ? undefined : heardWords[heardIndex];
    if (heard === undefined) {
      pending.push(token);
      return;
    }
    if (pending.length === 0 || heard.startMs > pendingStartMs) {
      aligned.push(...spreadOver(pending, pendingStartMs, heard.startMs));
      aligned.push({ text: token, startMs: heard.startMs, endMs: heard.endMs });
    } else {
      aligned.push(...spreadOver([...pending, token], Math.min(pendingStartMs, heard.startMs), heard.endMs));
    }
    pending = [];
    pendingStartMs = heard.endMs;
  });

  if (pending.length > 0) {
    if (lineEndMs > pendingStartMs) {
      aligned.push(...spreadOver(pending, pendingStartMs, lineEndMs));
    } else {
      const previous = aligned.pop();
      aligned.push(
        ...(previous === undefined
          ? spreadOver(pending, pendingStartMs, lineEndMs)
          : spreadOver([previous.text, ...pending], previous.startMs, previous.endMs)),
      );
    }
  }

  return aligned;
}
