/**
 * `items[index]` for an index the caller knows is in range.
 *
 * `noUncheckedIndexedAccess` types an index as `T | undefined`, and a `!` there is a crash the compiler was told
 * not to see. This narrows the type the same way, and when the index is out of range it fails at the access and
 * names the index, instead of a few lines later on a property of `undefined`.
 */
export function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new RangeError(`index ${index} is outside an array of ${items.length}`);
  return item;
}
