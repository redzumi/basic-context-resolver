export function nowMs(): number {
  return Number(process.hrtime.bigint()) / 1e6;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatMs(ms: number): string {
  return `${ms.toFixed(1)}ms`;
}

export class Metrics {
  private readonly startedAt = nowMs();
  private readonly marks = new Map<string, number>();
  private readonly steps = new Map<string, number>();
  private totalMs = 0;

  mark(name: string): void {
    this.marks.set(name, nowMs());
  }

  measure(name: string, startMark: string, endMark: string): void {
    const start = this.marks.get(startMark);
    const end = this.marks.get(endMark);

    if (start == null || end == null) {
      throw new Error(`Missing marks for measure "${name}"`);
    }

    this.steps.set(name, end - start);
  }

  set(name: string, valueMs: number): void {
    this.steps.set(name, valueMs);
  }

  finish(): void {
    this.totalMs = nowMs() - this.startedAt;
  }

  toJSON(): { totalMs: number; steps: Record<string, number> } {
    return {
      totalMs: Number(this.totalMs.toFixed(1)),
      steps: Object.fromEntries(
        [...this.steps.entries()].map(([k, v]) => [k, Number(v.toFixed(1))]),
      ),
    };
  }
}
