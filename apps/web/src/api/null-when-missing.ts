import { RenderApiError } from './render-api-error';

export async function nullWhenMissing<T>(code: string, load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (cause) {
    if (cause instanceof RenderApiError && cause.code === code) {
      return null;
    }
    throw cause;
  }
}
