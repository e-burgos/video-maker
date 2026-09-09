import { describe, expect, it } from 'vitest';

import { createKeyedSerializer } from './serialize-by-key';

function delayedTask(order: string[], label: string, ms: number): () => Promise<void> {
  return () =>
    new Promise((resolve) => {
      setTimeout(() => {
        order.push(label);
        resolve();
      }, ms);
    });
}

describe('createKeyedSerializer', () => {
  it('runs two operations on the same key one after the other and different keys concurrently', async () => {
    const serializer = createKeyedSerializer();
    const order: string[] = [];

    const sameKeyFirst = serializer.run('project-a', delayedTask(order, 'a-first', 20));
    const sameKeySecond = serializer.run('project-a', delayedTask(order, 'a-second', 5));
    const otherKey = serializer.run('project-b', delayedTask(order, 'b-first', 1));

    await Promise.all([sameKeyFirst, sameKeySecond, otherKey]);

    expect(order.indexOf('a-first')).toBeLessThan(order.indexOf('a-second'));
    expect(order.indexOf('b-first')).toBeLessThan(order.indexOf('a-second'));
  });
});
