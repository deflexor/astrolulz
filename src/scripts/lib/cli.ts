import fs from 'node:fs';
import path from 'node:path';

/** Minimal flag/value CLI parsing for the content scripts. */
export function parseArgs(argv: readonly string[]): {
  flags: Set<string>;
  values: Map<string, string>;
} {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      values.set(key, next);
      i += 1;
    } else {
      flags.add(key);
    }
  }
  return { flags, values };
}

export function readJsonlFile(filePath: string): unknown[] {
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  return lines.filter((line) => line.trim().length > 0).map((line) => JSON.parse(line));
}

export function writeJsonlFile(filePath: string, records: readonly unknown[]): void {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(
    filePath,
    records.map((record) => JSON.stringify(record)).join('\n') + '\n',
    'utf8',
  );
}
