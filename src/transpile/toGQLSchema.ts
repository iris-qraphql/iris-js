import type {
  GraphQLFieldConfig,
  GraphQLNamedOutputType,
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

import { serializeValue } from '../conversion/serialize';
import type { ObjMap } from '../utils/ObjMap';
import { keyMap, mapValue } from '../utils/ObjMap';

const stdTypeMap = keyMap([...specifiedScalarTypes], (type) => type.name);

export const toGQLSchema = (schema: IrisSchema): GraphQLSchema => {
  const typeMap: ObjMap<GraphQLNamedOutputType> = stdTypeMap;

  const register = <T extends GraphQLNamedOutputType>(
    name: string,
    type: T,
  ): T => {
    typeMap[name] = type;
    return type;
  };

  const lookup = <T extends GraphQLNamedOutputType>(name: string): T => {
    const namedType = typeMap[name] as T;
    if (!namedType) {
      throw new Error(`Unknown type ${name}`);
    }

    return namedType;
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
    const { name, parseLiteral } = type;
    const typeCheck = (value: unknown) => serializeValue(value, type);
    return register(
      name,
      new GraphQLScalarType({
        name,
        serialize: typeCheck,
        parseValue: typeCheck,
        parseLiteral,
      }),
    );
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
        types: variants.map((v) => transpileVariant(v, name)),
      }),
    );
  };

  const transpileVariant = (
    variant: IrisVariant<'resolver'>,
    namespace?: string,
  ): GraphQLObjectType => {
    const { name, description } = variant;

    const empty: ObjMap<GraphQLFieldConfig<any, any>> = {
      _: { type: GraphQLBoolean },
    };

    if (!variant.fields && variant.type) {
      return lookup(variant.type.name);
    }

    const fields: ThunkObjMap<GraphQLFieldConfig<any, any>> = () =>
      variant.fields ? mapValue(variant.fields, transpileField) : empty;

    const variantTypeName = namespace ? `${namespace}_${name}` : name;

    return register(
      variantTypeName,
      new GraphQLObjectType({
        name: variantTypeName,
        description,
        fields,
      }),
    );
  };

  const transpileField = ({
    description,
    type,
  }: IrisField<'resolver'>): GraphQLFieldConfig<any, any> => ({
    description,
    type: transpileType(type),
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

    return withMaybe(lookup(type.name));
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
