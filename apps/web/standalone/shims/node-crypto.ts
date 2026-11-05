/** Substituto de node:crypto no navegador (só o que o motor usa). */
export function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}
export function randomBytes(n: number) {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return { toString: () => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('') };
}
