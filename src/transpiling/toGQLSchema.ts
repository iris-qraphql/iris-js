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

import { typeCheckValue } from '../validation/typeCheckValue';

import { irisError } from '../error';
import type {
  IrisField,
  IrisType,
  IrisTypeDefinition,
  IrisVariant,
} from '../types/definition';
import { isSpecifiedScalarType, isTypeRef } from '../types/definition';
import type { IrisSchema } from '../types/schema';
import type { ObjMap } from '../utils/ObjMap';
import { keyMap, mapValue } from '../utils/ObjMap';

const stdTypeMap = keyMap([...specifiedScalarTypes], (type) => type.name);
export type ResolverMap = Record<string, unknown>;

export const toGQLSchema = (
  schema: IrisSchema,
  resolverMap: ResolverMap = {},
): GraphQLSchema => {
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
    type?: IrisTypeDefinition<'resolver'>,
  ): GraphQLObjectType | undefined =>
    type ? (transpileResolverDefinition(type) as GraphQLObjectType) : undefined;

  const transpileTypeDefinition = (
    type: IrisTypeDefinition,
  ): GraphQLNamedType => {
    switch (type.role) {
      case 'data':
        return transpileDataDefinition(type as IrisTypeDefinition<'data'>);
      case 'resolver':
        return transpileResolverDefinition(
          type as IrisTypeDefinition<'resolver'>,
        );
    }
  };

  const transpileDataDefinition = (
    type: IrisTypeDefinition<'data'>,
  ): GraphQLScalarType => {
    const { name } = type;
    const check = (value: unknown) => typeCheckValue(value, type);
    return register(
      name,
      new GraphQLScalarType({
        name,
        serialize: check,
        parseValue: check,
        parseLiteral: () => {
          throw irisError('literals are not supported');
        },
      }),
    );
  };

  const transpileResolverDefinition = (
    type: IrisTypeDefinition<'resolver'>,
  ): GraphQLObjectType | GraphQLUnionType => {
    const { name, description } = type;
    const variants = type.variants();

    if (type.isVariantType) {
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

    const typeResolver = resolverMap[name] ?? {};

    const empty: ObjMap<GraphQLFieldConfig<any, any>> = {
      _: { type: GraphQLBoolean },
    };

    if (!variant.fields && variant.type) {
      return lookup(variant.type.name);
    }

    const fields: ThunkObjMap<GraphQLFieldConfig<any, any>> = () =>
      variant.fields
        ? mapValue(variant.fields, transpileField(typeResolver))
        : empty;

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

  const transpileField =
    (resolvers: any) =>
    (
      { description, type }: IrisField<'resolver'>,
      name: string,
    ): GraphQLFieldConfig<any, any> => ({
      description,
      type: transpileType(type),
      resolve: resolvers[name],
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

  const types = Object.values(schema.types)
    .filter((t) => !isSpecifiedScalarType(t))
    .filter((t) => !['Query', 'Mutation', 'Subscription'].includes(t.name))
    .map(transpileTypeDefinition);

  const config: GraphQLSchemaConfig = {
    query: transpileRootTypeDefinition(
      schema.types.Query as IrisTypeDefinition<'resolver'>,
    ),
    mutation: transpileRootTypeDefinition(
      schema.types.Mutation as IrisTypeDefinition<'resolver'>,
    ),
    subscription: transpileRootTypeDefinition(
      schema.types.Subscription as IrisTypeDefinition<'resolver'>,
    ),
    types,
    directives: [],
  };

  return new GraphQLSchema(config);
};
