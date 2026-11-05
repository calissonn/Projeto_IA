import { pathOf, useRoute } from '../router';

/** Substituto de next/navigation para a versão standalone. */
export function usePathname(): string {
  return pathOf(useRoute());
}
