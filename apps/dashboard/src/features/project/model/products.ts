import type { Product } from '@rustrak/client';

/** Where a product sits in a project's sidebar. */
export type ProductGroup = 'triage' | 'monitor';

/**
 * Every product, in its default order, with the sidebar group it sits in.
 *
 * The order here is what a project that never reordered anything gets, and
 * where a product the project's saved order does not mention -- one added in
 * a later release -- is placed.
 */
export const PRODUCTS: readonly { key: Product; group: ProductGroup }[] = [
  { key: 'issues', group: 'triage' },
  { key: 'feedback', group: 'triage' },
  { key: 'releases', group: 'triage' },
  { key: 'performance', group: 'monitor' },
  { key: 'logs', group: 'monitor' },
  { key: 'crons', group: 'monitor' },
  { key: 'agents', group: 'monitor' },
];

/** `issues` is always kept: the server refuses to turn it off. */
export const LOCKED_PRODUCT: Product = 'issues';

/**
 * The project's saved order, then every product it does not mention in the
 * default order. Duplicates and unknown keys in the saved order are dropped.
 */
export function orderedProducts(saved: readonly Product[]): Product[] {
  const known = new Set(PRODUCTS.map((p) => p.key));
  const seen = new Set<Product>();
  const first = saved.filter((key) => {
    if (!known.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...first, ...PRODUCTS.map((p) => p.key).filter((k) => !seen.has(k))];
}

/**
 * Whether a project keeps `product`'s data. The same rule as the server's
 * `Project::keeps`: agents need performance too.
 */
export function keepsProduct(
  disabled: readonly Product[],
  product: Product,
): boolean {
  if (product === LOCKED_PRODUCT) return true;
  if (product === 'agents' && disabled.includes('performance')) return false;
  return !disabled.includes(product);
}
