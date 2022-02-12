import { validateSDL } from '../validation/validate';
import type { SDLValidationRule } from '../validation/ValidationContext';

import { parse } from '../parsing/parser';
import type { IrisSchema } from '../types/schema';

import { isObjectLike, mapValue } from './ObjMap';
import type { Maybe } from './type-level';

export function toJSONDeep(value: unknown): unknown {
  if (!isObjectLike(value)) {
    return value;
  }

  if (typeof value.toJSON === 'function') {
    return value.toJSON();
  }

  if (Array.isArray(value)) {
    return value.map(toJSONDeep);
  }

  return mapValue(value, toJSONDeep);
}

export function toJSONError(fn: () => unknown) {
  try {
    fn();
    return undefined;
  } catch (error) {
    return toJSONDeep(error);
  }
}

export function getSDLValidationErrors(
  schema: Maybe<IrisSchema>,
  rule: SDLValidationRule,
  sdlStr: string,
): any {
  const doc = parse(sdlStr);
  const errors = validateSDL(doc, schema, [rule]);
  return toJSONDeep(errors);
}
