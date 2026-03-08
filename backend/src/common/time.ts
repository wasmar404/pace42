export async function time<T>(label: string, fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = process.hrtime.bigint();
  try {
    const result = await fn();
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1e6;
    return { result, ms };
  } finally {
    // no-op
  }
}

export function msSince(startNs: bigint): number {
  return Number(process.hrtime.bigint() - startNs) / 1e6;
}
