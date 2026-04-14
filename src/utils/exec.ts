import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function execText(
  command: string,
  args: string[] = [],
  options: Parameters<typeof execFileAsync>[2] = {},
): Promise<string> {
  const { stdout } = await execFileAsync(command, args, {
    timeout: 5000,
    maxBuffer: 1024 * 1024,
    encoding: 'utf8',
    ...options,
  });

  return (stdout as string).trim();
}
