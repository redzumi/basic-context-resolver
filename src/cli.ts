import process from 'node:process';
import { ContextResolver } from './context/resolver';
import { Metrics } from './utils/metrics';

const waitMs = Number(process.env.WAIT_MS || 0);

async function main(): Promise<void> {
  const metrics = new Metrics();

  if (waitMs > 0) {
    console.log(`Waiting ${waitMs}ms before resolving context...`);
    metrics.mark('wait_start');
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    metrics.mark('wait_end');
    metrics.measure('waitBeforeResolveMs', 'wait_start', 'wait_end');
  }

  const resolver = new ContextResolver();
  const { context, debug } = await resolver.resolveWithDebug();

  console.log(JSON.stringify({ context, debug, metrics: metrics.toJSON() }, null, 2));
}

main().catch((error: unknown) => {
  console.error('Fatal error:');
  console.error(error);
  process.exit(1);
});
