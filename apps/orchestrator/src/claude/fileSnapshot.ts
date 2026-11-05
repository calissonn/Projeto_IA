import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { FileChange } from '@acc/shared';

const SKIP = new Set(['.git', 'node_modules', '.next', 'dist', '.cache', '.turbo']);
const MAX_FILES = 5000;
const HASH_LIMIT = 2 * 1024 * 1024;

export type Snapshot = Map<string, string>;

/** Retrato dos arquivos do workspace (caminho → impressão digital) para saber o que mudou de fato. */
export function snapshot(root: string): Snapshot {
  const out: Snapshot = new Map();
  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.size >= MAX_FILES) return;
      if (SKIP.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) {
        try {
          const st = statSync(full);
          const fp = st.size <= HASH_LIMIT ? createHash('sha1').update(readFileSync(full)).digest('hex') : `${st.size}:${st.mtimeMs}`;
          out.set(path.relative(root, full).split(path.sep).join('/'), fp);
        } catch {
          /* arquivo sumiu durante a leitura */
        }
      }
    }
  };
  walk(root);
  return out;
}

export function diffSnapshots(before: Snapshot, after: Snapshot): FileChange[] {
  const changes: FileChange[] = [];
  for (const [p, fp] of after) {
    if (!before.has(p)) changes.push({ path: p, change: 'created' });
    else if (before.get(p) !== fp) changes.push({ path: p, change: 'modified' });
  }
  for (const p of before.keys()) if (!after.has(p)) changes.push({ path: p, change: 'deleted' });
  return changes.sort((a, b) => a.path.localeCompare(b.path));
}
