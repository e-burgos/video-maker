import type { FetchRemoteInit, FetchRemotePort } from '../deps/render-api-dependencies';
import type { CallLog } from './call-log';

export interface FakeFetchRemoteCall {
  readonly url: string;
  readonly init: FetchRemoteInit;
}

export interface FakeFetchRemoteRoute {
  readonly status: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly bodyChunks?: readonly Uint8Array[];
}

export type FakeFetchRemoteAnswer = (call: FakeFetchRemoteCall, index: number) => FakeFetchRemoteRoute | Error;

export interface FakeFetchRemote {
  readonly fetchRemote: FetchRemotePort;
  readonly calls: readonly FakeFetchRemoteCall[];
}

export function jsonBodyChunks(value: unknown): readonly Uint8Array[] {
  return [new TextEncoder().encode(JSON.stringify(value))];
}

export function textBodyChunks(text: string): readonly Uint8Array[] {
  return [new TextEncoder().encode(text)];
}

export function createFakeFetchRemote(
  answer: FakeFetchRemoteRoute | Error | FakeFetchRemoteAnswer,
  callLog?: CallLog,
): FakeFetchRemote {
  const calls: FakeFetchRemoteCall[] = [];

  const fetchRemote: FetchRemotePort = async (url, init) => {
    const call: FakeFetchRemoteCall = { url, init };
    calls.push(call);
    callLog?.record('fetchRemote', call);

    const route = typeof answer === 'function' ? answer(call, calls.length - 1) : answer;
    if (route instanceof Error) {
      throw route;
    }

    const chunks = route.bodyChunks ?? [];

    return {
      status: route.status,
      headers: route.headers ?? {},
      body: async function* body() {
        for (const chunk of chunks) {
          yield chunk;
        }
      },
    };
  };

  return { fetchRemote, calls };
}
