// UTILS
export type Maybe<T> = T | undefined;

export type Validator<T> = (_: unknown) => T;

export const oneOf =
  <T>(r: ReadonlyArray<(v: unknown) => Maybe<T>>) =>
  (v: unknown): T => {
    const res = r.find((f) => f(v))?.(v);

    if (res === undefined) {
      throw new Error('');
    }

    return res;
  };

type ObjectLike = Record<string, unknown>;
type Keys<O> = Exclude<keyof O, '__typename'>;

type Pattern<O, T> = O extends { __typename: T }
  ? { [K in Keys<O>]: (f: unknown) => O[K] }
  : never;

type Input<O, T> = O extends { __typename: T }
  ? { [K in keyof Keys<T>]: unknown }
  : never;

export const irisVariant =
  <O extends ObjectLike, T extends string>(name: T, pattern: Pattern<O, T>) =>
  (target: unknown): Maybe<O> => {
    const result: O = Object.create(null);
    const keys = Object.keys(pattern) as any as ReadonlyArray<
      keyof Pattern<O, T>
    >;

    if (!isVariant<O, T>(target, name)) {
      return undefined;
    }

    for (const key of keys) {
      // @ts-expect-error
      result[key] = pattern[key](target[key]);
    }

    return { __typename: name, ...result };
  };

const isVariant = <T, K>(v: unknown, t: K): v is Input<T, K> =>
  Boolean(
    v &&
      typeof v === 'object' &&
      '__typename' in v &&
      (v as any).__typename === t,
  );

export const irisString = (x: unknown): string => {
  if (typeof x !== 'string') {
    throw new Error('expected string!');
  }
  return x;
};

export const irisFloat = (x: unknown): number => {
  if (typeof x !== 'number') {
    throw new Error('Expected number!');
  }
  return x;
};

export const irisInt = (x: unknown): number => {
  const float = irisFloat(x);
  if (Number.isInteger(float)) {
    throw new Error('expected Integer');
  }

  return float;
};

export const irisMaybe =
  <T>(f: Validator<T>) =>
  (v: unknown): Maybe<T> =>
    f(v);
