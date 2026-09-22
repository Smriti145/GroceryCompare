export interface PricePoint {
  observedAt: Date;
  pricePaise: number;
  inStock: boolean;
}
export function priceAnalytics(
  points: PricePoint[],
  days: 7 | 30,
  now = new Date(),
) {
  const start =
    Date.parse(now.toISOString().slice(0, 10)) - (days - 1) * 86400000;
  const valid = points
    .filter(
      p => p.inStock && p.observedAt.getTime() >= start && p.observedAt <= now,
    )
    .sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
  const daily = new Map<string, PricePoint>();
  for (const p of valid) daily.set(p.observedAt.toISOString().slice(0, 10), p);
  const graph = [...daily].map(([date, p]) => ({
    date,
    pricePaise: p.pricePaise,
  }));
  const prices = graph.map(p => p.pricePaise).sort((a, b) => a - b);
  const current = valid[valid.length - 1];
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000)
    .toISOString()
    .slice(0, 10);
  const prior = daily.get(yesterday);
  const history = graph
    .filter(p => p.date !== today)
    .map(p => p.pricePaise)
    .sort((a, b) => a - b);
  const median = (a: number[]) =>
    a.length
      ? Math.round(
          (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2,
        )
      : null;
  const mean = prices.length
    ? prices.reduce((a, b) => a + b, 0) / prices.length
    : 0;
  const deviation = mean
    ? Math.sqrt(prices.reduce((a, b) => a + (b - mean) ** 2, 0) / prices.length)
    : 0;
  const typical = median(history);
  return {
    days,
    graph,
    sampleCount: valid.length,
    observedDays: graph.length,
    currentPricePaise: current?.pricePaise ?? null,
    lowestRecordedPaise: valid.length
      ? Math.min(...valid.map(p => p.pricePaise))
      : null,
    usualPricePaise: history.length >= 3 ? typical : null,
    dropTodayPaise:
      daily.has(today) && prior
        ? Math.max(0, prior.pricePaise - daily.get(today)!.pricePaise)
        : null,
    volatilityScore:
      prices.length >= 3
        ? Math.min(100, Math.round((deviation / (mean || 1)) * 100))
        : null,
    dealConfidence:
      history.length < 3 || !current
        ? 'INSUFFICIENT_DATA'
        : history.length >= 7
        ? 'HIGH'
        : 'LOW',
    isDeal:
      history.length >= 3 && current && typical !== null
        ? current.pricePaise < typical
        : null,
    lastObservedAt: current?.observedAt.toISOString() ?? null,
  };
}
