import { isObjectLike } from '../jsutils/isObjectLike';
import { mapValue } from '../jsutils/mapValue';

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
