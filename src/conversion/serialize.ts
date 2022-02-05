import { isNil } from 'ramda';

import type {
  IrisDataType,
  IrisStrictType,
  IrisVariant,
} from '../type/definition';
import { isMaybeType, isTypeRef } from '../type/definition';

import { inspect } from '../utils/legacy';
import { isIterableObject, isObjectLike } from '../utils/ObjMap';
import type { IrisMaybe, Maybe } from '../utils/type-level';

type JSON = unknown;

type Serializer<T> = (value: unknown, type: T) => Maybe<JSON>;

export const serializeValue: Serializer<IrisStrictType> = (value, type) => {
  if (isTypeRef(type)) {
    const itemType = type.ofType;

    switch (type.kind) {
      case 'MAYBE':
        // only explicit null, not undefined, NaN
        return value === null ? null : serializeValue(value, itemType);
      case 'LIST': {
        return serializeList(value, itemType);
      }
      default:
        return serializeValue(value, itemType);
    }
  }

  if (isNil(value)) {
    return undefined;
  }

  return parseDataType(value, type);
};

const serializeList: Serializer<IrisStrictType> = (value, type) => {
  if (isIterableObject(value)) {
    const valuesNodes = [];
    for (const item of value) {
      const itemNode = serializeValue(item, type);
      if (itemNode === undefined) {
        return undefined;
      }
      valuesNodes.push(itemNode);
    }
    return valuesNodes;
  }
  return undefined;
};

type IrisObject = {
  name?: string;
  fields: Record<string, unknown>;
};

const parseDataType: Serializer<IrisDataType> = (value, type) => {
  if (!type.isPrimitive) {
    return parseDataVariant(value, type);
  }

  const serialized = type.serialize(value);

  if (typeof serialized === 'number' && !Number.isFinite(serialized)) {
    throw new TypeError(`Cannot convert value to AST: ${inspect(serialized)}.`);
  }

  return serialized;
};

const parseDataVariant: Serializer<IrisDataType> = (value, type) => {
  const object = decodeValue(value, type.name);
  const variant = type.variantBy(object.name);
  const variantType = variant.type ? variant.type.variantBy() : variant;
  return parseVariantValue(object, variantType);
};

const decodeValue = (value: unknown, typeName: string): IrisObject => {
  if (typeof value === 'string') {
    return { name: value, fields: {} };
  }

  if (isObjectLike(value) && !isIterableObject(value)) {
    const { __typename, ...fields } = value;
    return { name: __typename as string, fields };
  }

  throw new TypeError(
    `value ${inspect(
      value,
    )} should be either string or object to match type ${typeName}.`,
  );
};

const parseVariantValue = (
  { name: __typename, fields }: IrisObject,
  variant: IrisVariant<'data'>,
): IrisMaybe<JSON> => {
  const variantFields = Object.values(variant.fields ?? {});

  if (
    __typename &&
    variantFields.filter(({ type }) => !isMaybeType(type)).length === 0 &&
    Object.values(fields).length === 0
  ) {
    return __typename;
  }

  const fieldNodes: Record<string, JSON> = __typename ? { __typename } : {};

  for (const { name, type } of variantFields) {
    const fieldValue = serializeValue(fields[name], type);
    if (isNil(fieldValue)) {
      return undefined;
    }
    fieldNodes[name] = fieldValue;
  }

  return fieldNodes;
};
