import type {
  GraphQLFieldConfig,
  GraphQLNamedType,
  GraphQLOutputType,
  GraphQLSchemaConfig,
  ThunkObjMap,
} from 'graphql';
import {
  GraphQLBoolean,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLUnionType,
  specifiedScalarTypes,
} from 'graphql';
import type { ObjMap } from 'graphql/jsutils/ObjMap';

import { keyMap, mapValue } from '../jsutils/ObjMap';

import type {
  IrisDataType,
  IrisField,
  IrisNamedType,
  IrisResolverType,
  IrisType,
  IrisVariant,
} from '../type/definition';
import { isDataType, isTypeRef } from '../type/definition';
import { isSpecifiedScalarType } from '../type/scalars';
import type { IrisSchema } from '../type/schema';

const stdTypeMap = keyMap([...specifiedScalarTypes], (type) => type.name);

export const toGQLSchema = (schema: IrisSchema): GraphQLSchema => {
  const typeMap: ObjMap<GraphQLNamedType> = stdTypeMap;

  const register = <T extends GraphQLScalarType | GraphQLOutputType>(
    name: string,
    type: T,
  ): T => {
    // @ts-expect-error
    typeMap[name] = type;
    return type;
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
    return register(name, new GraphQLScalarType({ name }));
  };

  const transpileResolverDefinition = (
    type: IrisResolverType,
  ): GraphQLObjectType | GraphQLUnionType => {
    const { name, description } = type;
    const variants = type.variants();

    if (type.isVariantType()) {
      return transpileVariant(variants[0]);
    }

    return register(
      name,
      new GraphQLUnionType({
        name,
        description,
        types: variants.map(transpileVariant),
      }),
    );
  };

  const transpileVariant = (
    variant: IrisVariant<'resolver'>,
  ): GraphQLObjectType => {
    const { name, description } = variant;

    const empty: ObjMap<GraphQLFieldConfig<any, any>> = {
      _: { type: GraphQLBoolean },
    };

    const fields: ThunkObjMap<GraphQLFieldConfig<any, any>> = () =>
      variant.fields ? mapValue(variant.fields, transpileField) : empty;

    return register(
      name,
      new GraphQLObjectType({
        name,
        description,
        fields,
      }),
    );
  };

  const transpileField = ({
    description,
    type,
    resolve,
  }: IrisField): GraphQLFieldConfig<any, any> => ({
    description,
    type: transpileType(type),
    resolve,
  });

  const transpileType = (
    type: IrisType,
    isMaybe?: boolean,
  ): GraphQLOutputType => {
    const withMaybe = (t: GraphQLOutputType) =>
      isMaybe ? t : new GraphQLNonNull(t);

    if (isTypeRef(type)) {
      switch (type.kind) {
        case 'MAYBE':
          return transpileType(type.ofType, true);
        case 'LIST':
          return withMaybe(new GraphQLList(transpileType(type.ofType)));
      }
    }

    const t = typeMap[type.name];
    if (!t) {
      throw new Error(`Unknown type ${type.name}`);
    }
    // @ts-expect-error
    return t ? withMaybe(t) : undefined;
  };

  const types = Object.values(schema.getTypeMap())
    .filter((t) => !isSpecifiedScalarType(t))
    .filter((t) => !['Query', 'Mutation', 'Subscription'].includes(t.name))
    .map(transpileTypeDefinition);

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
