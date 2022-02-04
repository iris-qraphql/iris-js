import { Kind } from 'graphql';

import type { ObjectFieldNode } from '../language/ast';

import type { ObjMap } from './ObjMap';

export type Maybe<T> = null | undefined | T;
export type Override<T, T2> = Omit<T, keyof T2> & T2;

export type ConfigMap<T> = ObjMap<ConfigMapValue<T>>;

export type ConfigMapValue<T> = Omit<T, 'name'>;

export const lookupObjectTypename = (
  obj: ObjMap<ObjectFieldNode>,
): string | undefined => {
  const variantType = obj.__typename?.value;
  return variantType?.kind === Kind.STRING ? variantType.value : undefined;
};

export const notNill = <T>(x: Maybe<T>): x is T => Boolean(x);
