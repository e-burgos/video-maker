const SPOKEN_NUMBERS: Record<string, string> = {
  '10': 'diez',
  '15': 'quince',
  '20': 'veinte',
  '30': 'treinta',
  '500': 'quinientos',
};

export function normalizeWords(text: string): string[] {
  const plain = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/gu, '');
  return (plain.match(/[a-z0-9]+/gu) ?? []).map((word) => SPOKEN_NUMBERS[word] ?? word);
}

function longestCommonSubsequence(a: string[], b: string[]): number {
  let previous = new Array<number>(b.length + 1).fill(0);
  for (const wordA of a) {
    const current = new Array<number>(b.length + 1).fill(0);
    b.forEach((wordB, j) => {
      current[j + 1] = wordA === wordB ? (previous[j] ?? 0) + 1 : Math.max(previous[j + 1] ?? 0, current[j] ?? 0);
    });
    previous = current;
  }
  return previous[b.length] ?? 0;
}

export function intelligibilityScore(expected: string, heard: string): number {
  const a = normalizeWords(expected);
  const b = normalizeWords(heard);
  if (a.length + b.length === 0) return 1;
  return Math.round(((2 * longestCommonSubsequence(a, b)) / (a.length + b.length)) * 1000) / 1000;
}
