function nowMs(): number {
  return Number(process.hrtime.bigint()) / 1e6;
}

export class Metrics {
  private readonly startedAt = nowMs();
  private readonly marks = new Map<string, number>();
  private readonly steps = new Map<string, number>();

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

  toJSON(): { totalMs: number; steps: Record<string, number> } {
    const totalMs = Number((nowMs() - this.startedAt).toFixed(1));

    return {
      totalMs,
      steps: Object.fromEntries(
        [...this.steps.entries()].map(([k, v]) => [k, Number(v.toFixed(1))]),
      ),
    };
  }
}
