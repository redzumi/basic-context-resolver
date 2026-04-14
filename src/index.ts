import process from 'node:process';
import { ContextResolver } from './context/resolver';
import { Metrics, sleep } from './utils/metrics';

async function main(): Promise<void> {
  const metrics = new Metrics();
  const waitMs = Number(process.env.WAIT_MS || 0);

  if (waitMs > 0) {
    console.log(`Waiting ${waitMs}ms before resolving context...`);
    metrics.mark('wait_start');
    await sleep(waitMs);
    metrics.mark('wait_end');
    metrics.measure('waitBeforeResolveMs', 'wait_start', 'wait_end');
  }

  const resolver = new ContextResolver();

  const result = await resolver.resolveWithDebug();
  metrics.finish();

  console.log(
    JSON.stringify(
      {
        context: result.context,
        debug: result.debug,
        metrics: metrics.toJSON(),
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error('Fatal error:');
  console.error(error);
  process.exit(1);
});
