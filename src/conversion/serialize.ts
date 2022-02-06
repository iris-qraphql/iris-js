import { isNil } from 'ramda';

import type {
  IrisDataType,
  IrisStrictType,
  IrisVariant,
} from '../type/definition';
import { isMaybeType, isTypeRef } from '../type/definition';

import { irisError } from '../error';
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
        return isNil(value) ? null : serializeValue(value, itemType);
      case 'LIST': {
        return serializeList(value, itemType);
      }
    }
  }

  return parseDataType(value, type);
};

const serializeList: Serializer<IrisStrictType> = (value, type) => {
  if (!isIterableObject(value)) {
    throw new TypeError('Required Type!');
  }

  const valuesNodes = [];
  for (const item of value) {
    valuesNodes.push(serializeValue(item, type));
  }

  return valuesNodes;
};

type IrisObject = {
  name?: string;
  fields: Record<string, unknown>;
};

const parseDataType: Serializer<IrisDataType> = (value, type) => {
  if (isNil(value)) {
    throw new TypeError('Required Type!');
  }

  if (type.isPrimitive) {
    const serialized = type.serialize(value);

    if (typeof serialized === 'number' && !Number.isFinite(serialized)) {
      throw new TypeError(
        `Cannot convert value to AST: ${inspect(serialized)}.`,
      );
    }

    return serialized;
  }

  return parseDataVariant(value, type);
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

  throw irisError(
    `Data "${typeName}" cannot represent value: ${inspect(value)}.`,
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
    fieldNodes[name] = serializeValue(fields[name], type);
  }

  return fieldNodes;
};
