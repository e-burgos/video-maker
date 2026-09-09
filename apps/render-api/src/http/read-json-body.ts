export const MAX_JSON_BODY_BYTES = 16_777_216;

export type JsonBodyResult =
  | { readonly kind: 'parsed'; readonly value: unknown }
  | { readonly kind: 'invalid-json' }
  | { readonly kind: 'too-large' }
  | { readonly kind: 'empty' };

export async function readJsonBody(
  source: AsyncIterable<Uint8Array>,
  limitBytes: number,
): Promise<JsonBodyResult> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for await (const chunk of source) {
    totalBytes += chunk.length;
    if (totalBytes > limitBytes) {
      return { kind: 'too-large' };
    }
    chunks.push(chunk);
  }

  if (totalBytes === 0) {
    return { kind: 'empty' };
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  try {
    const text = new TextDecoder('utf-8').decode(merged);
    return { kind: 'parsed', value: JSON.parse(text) };
  } catch {
    return { kind: 'invalid-json' };
  }
}
