// UTILS
export type Maybe<T> = T | undefined;
type ObjectLike = Record<string, unknown>;

type Keys<O> = Exclude<keyof O, '__typename'>;

type Pattern<O, T> = O extends { __typename: T }
  ? { [K in Keys<O>]: (f: unknown) => O[K] }
  : never;

export type Validator<T> = (_: unknown) => T;

const isTagged = (v: unknown): v is { __typename: string } & ObjectLike =>
  Boolean(
    v &&
      typeof v === 'object' &&
      '__typename' in v &&
      typeof (v as ObjectLike).__typename === 'string',
  );

export const oneOf =
  <T extends ObjectLike & { __typename: string }>(patterns: {
    [K in T['__typename']]: (v: unknown) => T;
  }) =>
  (v: unknown): T => {
    if (!isTagged(v)) {
      throw new Error(`value ${JSON.stringify(v)} should be tagged object`);
    }

    const { __typename } = v;

    const f = patterns[__typename as T['__typename']];

    if (!f) {
      throw new Error(
        `no matching variant fround for value ${JSON.stringify(v)}`,
      );
    }

    return { ...f(v), __typename };
  };

export const irisVariant =
  <O extends ObjectLike, T extends string>(pattern: Pattern<O, T>) =>
  (target: unknown): O => {
    const result: O = Object.create(null);
    const keys = Object.keys(pattern) as any as ReadonlyArray<
      keyof Pattern<O, T>
    >;

    for (const key of keys) {
      try {
        // @ts-expect-error
        result[key] = pattern[key](target[key]);
      } catch (e) {
        throw Error(`cant parse field "${key.toString()}". ${e.message}`);
      }
    }

    return { __typename: undefined, ...result };
  };

const typeError = (typeName: string, value: unknown) =>
  new TypeError(`expected "${typeName}" found ${value}`);

export const irisString = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw typeError('string', value);
  }
  return value;
};

export const irisFloat = (value: unknown): number => {
  if (typeof value !== 'number') {
    throw typeError('number', value);
  }
  return value;
};

export const irisInt = (value: unknown): number => {
  const float = irisFloat(value);
  if (!Number.isInteger(float)) {
    throw typeError('int', value);
  }
  return float;
};

export const irisMaybe =
  <T>(f: Validator<T>) =>
  (v: unknown): Maybe<T> =>
    v === undefined || v === null ? undefined : f(v);

export const debug =
  <T>(f: Validator<T>) =>
  (v: unknown): T | string => {
    try {
      return f(v);
    } catch (e) {
      return e.message;
    }
  };
