export class ProviderFailure extends Error {
  constructor(public retryable: boolean, message = 'Provider unavailable') {
    super(message);
  }
}
interface Entry<T> {
  data?: T;
  cachedAt?: number;
  failures: number;
  openUntil: number;
  calls: number;
  errors: number;
  lastLatencyMs: number;
}
export class ResilientProvider<T> {
  private pending = new Map<
    string,
    Promise<{
      status: 'LIVE' | 'CACHED' | 'UNAVAILABLE';
      data: T | null;
      cachedAt: number | null;
    }>
  >();
  private entries = new Map<string, Entry<T>>();
  constructor(
    private readonly options = {
      timeoutMs: 3000,
      retries: 2,
      baseDelayMs: 200,
      cacheMs: 60000,
      circuitMs: 30000,
      failureThreshold: 3,
    },
  ) {}
  run(
    key: string,
    fetcher: (signal: AbortSignal) => Promise<unknown>,
    validate: (input: unknown) => T,
  ) {
    const pending = this.pending.get(key);
    if (pending) return pending;
    const operation = this.execute(key, fetcher, validate).finally(() =>
      this.pending.delete(key),
    );
    this.pending.set(key, operation);
    return operation;
  }
  private async execute(
    key: string,
    fetcher: (signal: AbortSignal) => Promise<unknown>,
    validate: (input: unknown) => T,
  ) {
    // Caller must include retailer + store + location + request identity in the key.
    let entry = this.entries.get(key);
    if (!entry) {
      if (this.entries.size >= 1000)
        this.entries.delete(this.entries.keys().next().value!);
      entry = {
        failures: 0,
        openUntil: 0,
        calls: 0,
        errors: 0,
        lastLatencyMs: 0,
      };
      this.entries.set(key, entry);
    }
    const fallback = () =>
      entry!.data !== undefined &&
      Date.now() - entry!.cachedAt! <= this.options.cacheMs
        ? {
            status: 'CACHED' as const,
            data: entry!.data,
            cachedAt: entry!.cachedAt!,
          }
        : { status: 'UNAVAILABLE' as const, data: null, cachedAt: null };
    if (entry.openUntil > Date.now()) return fallback();
    for (let attempt = 0; attempt <= this.options.retries; attempt++) {
      const start = Date.now();
      entry.calls++;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const payload = await Promise.race([
          fetcher(controller.signal),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(new ProviderFailure(true, 'Timeout'));
            }, this.options.timeoutMs);
          }),
        ]);
        let data: T;
        try {
          data = validate(payload);
        } catch {
          throw new ProviderFailure(false, 'Invalid provider schema');
        }
        entry.data = data;
        entry.cachedAt = Date.now();
        entry.failures = 0;
        entry.openUntil = 0;
        return { status: 'LIVE' as const, data, cachedAt: entry.cachedAt };
      } catch (error) {
        entry.errors++;
        if (
          !(error instanceof ProviderFailure) ||
          !error.retryable ||
          attempt === this.options.retries
        )
          break;
      } finally {
        clearTimeout(timer);
        entry.lastLatencyMs = Date.now() - start;
      }
      await new Promise(resolve =>
        setTimeout(
          resolve,
          this.options.baseDelayMs * 2 ** attempt +
            Math.random() * this.options.baseDelayMs,
        ),
      );
    }
    entry.failures++;
    if (entry.failures >= this.options.failureThreshold)
      entry.openUntil = Date.now() + this.options.circuitMs;
    return fallback();
  }
  health() {
    return [...this.entries].map(([key, e]) => ({
      key,
      calls: e.calls,
      errors: e.errors,
      consecutiveFailures: e.failures,
      circuitOpen: e.openUntil > Date.now(),
      lastLatencyMs: e.lastLatencyMs,
      lastSuccessAt: e.cachedAt ?? null,
    }));
  }
}
export async function partialProviders<T>(
  providers: Record<string, () => Promise<T>>,
) {
  return Promise.all(
    Object.entries(providers).map(async ([retailer, run]) => {
      try {
        return { retailer, result: await run(), error: null };
      } catch {
        return { retailer, result: null, error: 'Temporarily unavailable' };
      }
    }),
  );
}
