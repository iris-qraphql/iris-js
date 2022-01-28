export type ObjMap<T> = Record<string, T>;

export function mapValue<T, V>(
  map: Readonly<Record<string, T>>,
  fn: (value: T, key: string) => V,
): ObjMap<V> {
  const result = Object.create(null);

  for (const key of Object.keys(map)) {
    result[key] = fn(map[key], key);
  }
  return result;
}

export function keyMap<T>(
  list: ReadonlyArray<T>,
  keyFn: (item: T) => string,
): ObjMap<T> {
  const result = Object.create(null);
  for (const item of list) {
    result[keyFn(item)] = item;
  }
  return result;
}

export function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value == 'object' && value !== null;
}

export function isIterableObject(
  maybeIterable: any,
): maybeIterable is Iterable<unknown> {
  return (
    typeof maybeIterable === 'object' &&
    typeof maybeIterable?.[Symbol.iterator] === 'function'
  );
}
