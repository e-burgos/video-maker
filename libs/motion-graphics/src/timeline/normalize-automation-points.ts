export interface AutomationPoint {
  t: number;
  v: number;
}

const round = (value: number): number => Math.round(value * 1000) / 1000;

export function normalizeAutomationPoints(raw: readonly AutomationPoint[]): AutomationPoint[] {
  const points: AutomationPoint[] = [];
  for (const point of [...raw].sort((a, b) => a.t - b.t)) {
    const previous = points.at(-1);
    const t = previous && point.t <= previous.t ? previous.t + 0.01 : Math.max(0, point.t);
    points.push({ t: round(t), v: point.v });
  }
  return points;
}
