import process from 'node:process';
import { NativeMessagingBrowserProvider } from './providers/browser/nativeMessagingBrowserProvider';
import { MacOSBrowserProvider } from './providers/browser/macosBrowserProvider';
import { GetWindowsProvider } from './providers/window/getWindowsProvider';
import { ContextResolver } from './resolver/contextResolver';
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

  const resolver = new ContextResolver({
    windowProvider: new GetWindowsProvider(),
    browserProviders: [
      new NativeMessagingBrowserProvider(),
      new MacOSBrowserProvider(),
    ],
    metrics,
  });

  const result = await resolver.resolve();
  metrics.finish();

  console.log(
    JSON.stringify(
      {
        activeWindow: result.activeWindow,
        browserContext: result.browserContext,
        final: result.final,
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
