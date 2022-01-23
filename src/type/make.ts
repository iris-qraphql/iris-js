import type { ObjMap } from '../jsutils/ObjMap';

import type {
  GraphQLFieldConfig,
  GraphQLInputField,
  GraphQLIsTypeOfFn,
  GraphQLScalarLiteralParser,
  GraphQLScalarSerializer,
  GraphQLScalarValueParser,
  GraphQLTypeResolver,
  IrisResolverVariantConfig,
  ThunkObjMap,
} from './definition';
import { IrisDataType, IrisResolverType } from './definition';

type InputC = {
  name: string;
  fields: ObjMap<Omit<GraphQLInputField, 'name'>>;
};

export const emptyDataType = (name: string) => new IrisDataType({ name });

const gqlInput = ({ name, fields }: InputC) =>
  new IrisDataType({
    name,
    variants: [
      {
        name,
        fields,
      },
    ],
  });

const gqlEnum = (name: string, values: Array<string>) =>
  new IrisDataType({
    name,
    variants: values.map((v) => ({ name: v })),
  });

type GQLObject = {
  name: string;
  description?: string;
  fields: ThunkObjMap<GraphQLFieldConfig<any, any>>;
  isTypeOf?: GraphQLIsTypeOfFn<any, any>;
};

const gqlObject = ({ name, fields, isTypeOf, description }: GQLObject) =>
  new IrisResolverType({
    name,
    variants: [{ name, description, fields }],
    isTypeOf,
    description,
  });

type GQLUnion = {
  name: string;
  types: ReadonlyArray<IrisResolverType>;
  resolveType?: GraphQLTypeResolver<any, any>;
};

const gqlUnion = ({ name, types, resolveType }: GQLUnion) =>
  new IrisResolverType({
    name,
    variants: types.map(
      (type): IrisResolverVariantConfig<any, any> => ({
        name: type.name,
        type: () => type,
      }),
    ),
    resolveType,
  });

type GQLScalar<I = unknown, O = I> = {
  name: string;
  description?: string;
  serialize?: GraphQLScalarSerializer<O>;
  parseValue?: GraphQLScalarValueParser<I>;
  parseLiteral?: GraphQLScalarLiteralParser<I>;
};

const gqlScalar = <T>(x: GQLScalar<T>) =>
  new IrisDataType<T>({ ...x, isPrimitive: true });

export { gqlInput, gqlEnum, gqlObject, gqlUnion, gqlScalar };
