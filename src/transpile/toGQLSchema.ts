import type {
  GraphQLFieldConfig,
  GraphQLNamedType,
  GraphQLOutputType,
  GraphQLSchemaConfig} from 'graphql';
import {
  GraphQLBoolean,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLUnionType,
} from 'graphql';
import type { ObjMap } from 'graphql/jsutils/ObjMap';

import { mapValue } from '../jsutils/ObjMap';

import type {
  GraphQLField,
  IrisDataType,
  IrisNamedType,
  IrisResolverType,
  IrisResolverVariant,
  IrisType,
} from '../type/definition';
import { isDataType, isTypeRef } from '../type/definition';
import type { IrisSchema } from '../type/schema';

export const toGQLSchema = (schema: IrisSchema): GraphQLSchema => {
  const types = Object.values(schema.getTypeMap()).map(transpileTypeDefinition);

  const config: GraphQLSchemaConfig = {
    description: schema.description,
    query: transpileRootTypeDefinition(schema.getQueryType()),
    mutation: transpileRootTypeDefinition(schema.getMutationType()),
    subscription: transpileRootTypeDefinition(schema.getSubscriptionType()),
    types,
    directives: [],
  };

  return new GraphQLSchema(config);
};

const transpileRootTypeDefinition = (
  type?: IrisResolverType,
): GraphQLObjectType | undefined =>
  type ? (transpileResolverDefinition(type) as GraphQLObjectType) : undefined;

const transpileTypeDefinition = (type: IrisNamedType): GraphQLNamedType => {
  if (isDataType(type)) {
    return transpileDataDefinition(type);
  }

  return transpileResolverDefinition(type);
};

const transpileDataDefinition = (type: IrisDataType): GraphQLScalarType => {
  const { name } = type;
  return new GraphQLScalarType({ name });
};

const transpileResolverDefinition = (
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

  const empty: ObjMap<GraphQLFieldConfig<any, any>> = {
    _: { type: GraphQLBoolean },
  };

  const fields: ObjMap<GraphQLFieldConfig<any, any>> = variant.fields
    ? mapValue(variant.fields, transpileField)
    : empty;

  return new GraphQLObjectType({
    name,
    description,
    fields,
  });
};

const transpileField = (field: GraphQLField): GraphQLFieldConfig<any, any> => {
  const { description, type } = field;

  return {
    description,
    type: transpileType(type),
  };
};

const transpileType = (type: IrisType, isMaybe?: boolean): GraphQLOutputType => {
  const withMaybe = (t: GraphQLOutputType) => (isMaybe ? t : new GraphQLNonNull(t));

  if (isTypeRef(type)) {
    switch (type.kind) {
      case 'MAYBE':
        return transpileType(type.ofType, true);
      case 'LIST':
        return withMaybe(new GraphQLList(transpileType(type.ofType)));
    }
  }

  if (isDataType(type)) {
    return withMaybe(transpileDataDefinition(type));
  }

  return withMaybe(transpileResolverDefinition(type));
};
