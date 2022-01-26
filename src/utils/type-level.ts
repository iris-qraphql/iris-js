import type { ObjMap } from '../jsutils/ObjMap';

import type { ObjectFieldNode } from '../language/ast';
import { Kind } from '../language/kinds';

export type Override<T, T2> = Omit<T, keyof T2> & T2;

export type ConfigMap<T> = ObjMap<ConfigMapValue<T>>;

export type ConfigMapValue<T> = Omit<T, 'name'>;

export const lookupObjectTypename = (
  obj: ObjMap<ObjectFieldNode>,
): string | undefined => {
  const variantType = obj.__typename?.value;
  return variantType?.kind === Kind.STRING ? variantType.value : undefined;
};
