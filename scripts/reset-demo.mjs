/** Apaga o banco do MODO DEMONSTRAÇÃO (o banco do modo real nunca é tocado). Rode com o orquestrador parado. */
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(import.meta.dirname, '..', process.env.ACC_DATA_DIR ?? 'data');
let removed = 0;
for (const suffix of ['', '-wal', '-shm']) {
  const file = path.join(dataDir, `demo.sqlite${suffix}`);
  if (existsSync(file)) {
    rmSync(file);
    removed++;
  }
}
console.log(removed ? `Demonstração zerada (${dataDir}/demo.sqlite).` : 'Nada para apagar: o banco de demonstração não existe.');
