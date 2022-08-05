import type { ObjectFieldNode } from '../types/ast';
import { GQLKind } from '../types/kinds';

import type { ObjMap } from './ObjMap';

export type IrisMaybe<T> = T | undefined;

export type Maybe<T> = null | undefined | T;
export type Override<T, T2> = Omit<T, keyof T2> & T2;

export type ConfigMap<T> = ObjMap<ConfigMapValue<T>>;

export type ConfigMapValue<T> = Omit<T, 'name'>;

export const lookupObjectTypename = (
  obj: ObjMap<ObjectFieldNode>,
): string | undefined => {
  const variantType = obj.__typename?.value;
  return variantType?.kind === GQLKind.STRING ? variantType.value : undefined;
};

export const notNill = <T>(x: Maybe<T>): x is T => Boolean(x);

export const omitNil = <O extends Record<string, unknown>>(o: O): O =>
  Object.fromEntries(
    Object.entries(o).filter(([_, v]) => v !== undefined),
  ) as O;
