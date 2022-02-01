import {
  GraphQLBoolean,
  GraphQLFieldConfig,
  GraphQLNamedType,
  GraphQLSchemaConfig,
  ThunkObjMap,
} from 'graphql';
import {
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLUnionType,
} from 'graphql';
import type { ObjMap } from 'graphql/jsutils/ObjMap';
import { map } from 'ramda';
import { mapValue } from '../jsutils/ObjMap';

import type {
  IrisNamedType,
  IrisResolverType,
  IrisResolverVariant,
  GraphQLField,
} from '../type/definition';
import { isDataType } from '../type/definition';
import type { IrisSchema } from '../type/schema';

export const toGQLSchema = (schema: IrisSchema): GraphQLSchema => {
  const types = Object.values(schema.getTypeMap()).map(transpileType);

  const config: GraphQLSchemaConfig = {
    description: schema.description,
    query: transpileRootType(schema.getQueryType()),
    mutation: transpileRootType(schema.getMutationType()),
    subscription: transpileRootType(schema.getSubscriptionType()),
    types,
    directives: [],
  };

  return new GraphQLSchema(config);
};

const transpileRootType = (
  type?: IrisResolverType,
): GraphQLObjectType | undefined =>
  type ? (transpileResolver(type) as GraphQLObjectType) : undefined;

const transpileType = (type: IrisNamedType): GraphQLNamedType => {
  const { name } = type;

  if (isDataType(type)) {
    return new GraphQLScalarType({ name });
  }

  return transpileResolver(type);
};

const transpileResolver = (
  type: IrisResolverType,
): GraphQLObjectType | GraphQLUnionType => {
  const { name, description } = type;
  const variants = type.variants();

  if (type.isVariantType()) {
    return transpileVariant(variants[0]);
  }

  return new GraphQLUnionType({
    name,
    description,
    types: variants.map(transpileVariant),
  });
};

const transpileVariant = (variant: IrisResolverVariant): GraphQLObjectType => {
  const { name, description } = variant;

  const empty: ObjMap<GraphQLFieldConfig<any, any, any>> = {
    _: { type: GraphQLBoolean },
  };

  const fields: ObjMap<GraphQLFieldConfig<any, any, any>> = variant.fields
    ? mapValue(variant.fields, transpileField)
    : empty;

  return new GraphQLObjectType({
    name,
    description,
    fields,
  });
};

const transpileField = (
  field: GraphQLField<unknown, unknown, any>,
): GraphQLFieldConfig<any, any, any> => {
  const { description, type } = field;

  return {
    description,
    type: type,
  };
};
