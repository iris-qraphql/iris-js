import { isNil } from 'ramda';

import { irisError } from '../error';
import type {
  FieldDefinitionNode,
  TypeNode,
  VariantDefinitionNode,
} from '../types/ast';
import { getVariant } from '../types/ast';
import { IrisKind } from '../types/kinds';
import type { IrisSchema } from '../types/schema';
import { inspect } from '../utils/legacy';
import { isIterableObject, isObjectLike } from '../utils/ObjMap';
import type { IrisMaybe, Maybe } from '../utils/type-level';

const cannotRepresent = <T>(value: unknown, type: T) =>
  irisError(`type ${type} cannot represent value: ${inspect(value)}.`);

type JSON = unknown;

type Serializer<T> = (
  schema: IrisSchema,
  value: unknown,
  type: T,
) => Maybe<JSON>;

export const typeCheckValue: Serializer<TypeNode> = (schema, value, type) => {
  switch (type.kind) {
    case IrisKind.MAYBE_TYPE:
      return isNil(value) ? null : typeCheckValue(schema, value, type.type);
    case IrisKind.LIST_TYPE: {
      return serializeList(schema, value, type.type);
    }
    case IrisKind.NAMED_TYPE:
      return parseDataType(schema, value, type.name.value);
  }
};

const serializeList: Serializer<TypeNode> = (schema, value, type) => {
  if (!isIterableObject(value)) {
    throw cannotRepresent(value, `[${type.kind}]`);
  }

  const valuesNodes = [];
  for (const item of value) {
    valuesNodes.push(typeCheckValue(schema, item, type));
  }

  return valuesNodes;
};

export type IrisVariantValue = {
  name?: string;
  fields: Record<string, unknown>;
};

const parseDataType: Serializer<string> = (schema, value, type) => {
  if (isNil(value)) {
    throw cannotRepresent(value, type);
  }

  // if (type.boxedScalar) {
  //   const serialized = type.boxedScalar.serialize(value);

  //   if (typeof serialized === 'number' && !Number.isFinite(serialized)) {
  //     throw cannotRepresent(value, type);
  //   }

  //   return serialized;
  // }

  return parseVariantWith(
    schema,
    (x, y) => parseVariantValue(schema, x, y),
    value,
    type,
  );
};

export const parseVariantWith = <T>(
  schema: IrisSchema,
  f: (o: IrisVariantValue, v: VariantDefinitionNode) => T,
  value: unknown,
  typeName: string,
): T => {
  const type = schema.types[typeName];
  const object = toVariantObject(value, type.name.value);
  const variant = getVariant(type, object.name);
  const variantType = variant.fields
    ? variant
    : getVariant(schema.types[variant.name.value]);
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
  variantFields: Array<FieldDefinitionNode>,
): boolean =>
  Boolean(name) &&
  variantFields.filter(({ type }) => type.kind !== IrisKind.MAYBE_TYPE)
    .length === 0 &&
  Object.values(fields).length === 0;

const parseVariantValue = (
  schema: IrisSchema,
  object: IrisVariantValue,
  variant: VariantDefinitionNode,
): IrisMaybe<JSON> => {
  const { name: __typename, fields } = object;
  const variantFields = Object.values(variant.fields ?? {});

  if (isEmptyVariant(object, variantFields)) {
    return __typename;
  }

  const fieldNodes: Record<string, JSON> = __typename ? { __typename } : {};

  for (const { name, type } of variantFields) {
    fieldNodes[name.value] = typeCheckValue(schema, fields[name.value], type);
  }

  return fieldNodes;
};
