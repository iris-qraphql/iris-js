import { isNil } from 'ramda';

import { irisError } from '../error';
import type {
  IrisField,
  IrisTypeDefinition,
  IrisTypeRef,
  IrisVariant,
} from '../types/definition';
import { inspect } from '../utils/legacy';
import { isIterableObject, isObjectLike } from '../utils/ObjMap';
import type { IrisMaybe, Maybe } from '../utils/type-level';

const cannotRepresent = <T>(value: unknown, type: T) =>
  irisError(`type ${type} cannot represent value: ${inspect(value)}.`);

type JSON = unknown;

type Serializer<T> = (value: unknown, type: T) => Maybe<JSON>;

export const typeCheckValue: Serializer<IrisTypeRef<'data'>> = (
  value,
  type,
) => {
  switch (type.kind) {
    case 'MAYBE':
      return isNil(value) ? null : typeCheckValue(value, type.ofType);
    case 'LIST': {
      return serializeList(value, type.ofType);
    }
    case 'NAMED':
      return parseDataType(value, type.ofType);
  }
};

const serializeList: Serializer<IrisTypeRef<'data'>> = (value, type) => {
  if (!isIterableObject(value)) {
    throw cannotRepresent(value, `[${type}]`);
  }

  const valuesNodes = [];
  for (const item of value) {
    valuesNodes.push(typeCheckValue(item, type));
  }

  return valuesNodes;
};

export type IrisVariantValue = {
  name?: string;
  fields: Record<string, unknown>;
};

const parseDataType: Serializer<IrisTypeDefinition<'data'>> = (value, type) => {
  if (isNil(value)) {
    throw cannotRepresent(value, type);
  }

  if (type.boxedScalar) {
    const serialized = type.boxedScalar.serialize(value);

    if (typeof serialized === 'number' && !Number.isFinite(serialized)) {
      throw cannotRepresent(value, type);
    }

    return serialized;
  }

  return parseVariantWith(parseVariantValue, value, type);
};

export const parseVariantWith = <T>(
  f: (o: IrisVariantValue, v: IrisVariant<'data'>) => T,
  value: unknown,
  type: IrisTypeDefinition<'data'>,
): T => {
  const object = toVariantObject(value, type.name);
  const variant = type.variantBy(object.name);
  const variantType = variant.type ? variant.type.variantBy() : variant;
  return f(object, variantType);
};

const toVariantObject = (
  value: unknown,
  typeName: string,
): IrisVariantValue => {
  if (typeof value === 'string') {
    return { name: value, fields: {} };
  }

  if (isObjectLike(value) && !isIterableObject(value)) {
    const { __typename, ...fields } = value;
    return { name: __typename as string, fields };
  }

  throw cannotRepresent(value, typeName);
};

export const isEmptyVariant = (
  { name, fields }: IrisVariantValue,
  variantFields: Array<IrisField<'data'>>,
): boolean =>
  Boolean(name) &&
  variantFields.filter(({ type }) => type.kind !== 'MAYBE').length === 0 &&
  Object.values(fields).length === 0;

const parseVariantValue = (
  object: IrisVariantValue,
  variant: IrisVariant<'data'>,
): IrisMaybe<JSON> => {
  const { name: __typename, fields } = object;
  const variantFields = Object.values(variant.fields ?? {});

  if (isEmptyVariant(object, variantFields)) {
    return __typename;
  }

  const fieldNodes: Record<string, JSON> = __typename ? { __typename } : {};

  for (const { name, type } of variantFields) {
    fieldNodes[name] = typeCheckValue(fields[name], type);
  }

  return fieldNodes;
};
